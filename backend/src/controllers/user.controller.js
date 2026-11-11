import bcrypt from "bcryptjs";
import { normalizeEmail } from "../lib/emailNormalize.js";
import { setUserBanned } from "../lib/banList.js";
import prisma from "../lib/prisma.js";
import { grantReferralReward } from "../lib/referrals.js";
import { TEST_ACCOUNT_EMAILS } from "../lib/testAccounts.js";

// GET /users/me
export async function getMe(req, res) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        repPoints: true,
        profilePhoto: true,
        phone: true,
        isAdmin: true,
        location: true,
        createdAt: true,
        isVerified: true, isCertified: true,
        isBanned: true,
        isAvailable: true,
        businessHours: true,
        hasCompletedOnboarding: true,
        referralCode: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(user);
  } catch (err) {
    console.error("GET ME ERROR:", err);
    res.status(500).json({ error: "Failed to fetch user" });
  }
}

// Near Me geocodes the location text with Google, so a bare town name can land
// in the wrong state ("Bridgeton" → Bridgeton, MO). Require a region: anything
// after a comma ("Bridgeton, NJ", "Durban, South Africa") or a 5-digit ZIP.
const US_STATES = "AL|AK|AZ|AR|CA|CO|CT|DE|DC|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|PR";
const LOCATION_HINT = "Add your state or ZIP so people nearby can find you, e.g. Bridgeton, NJ or 08302.";
function locationNeedsRegion(loc) {
  const t = String(loc || "").trim();
  if (!t) return false; // clearing is fine
  const endsWithState = new RegExp(`\\s(${US_STATES})\\.?$`, "i").test(t); // "Bridgeton NJ"
  return !(/\b\d{5}\b/.test(t) || /,\s*\S{2,}/.test(t) || endsWithState);
}

// PUT /users/me
export async function updateProfile(req, res) {
  try {
    const userId = req.user.id;
    const { email, name, password } = req.body;

    const data = {};

    if (name) data.name = name;
    if (req.body.phone !== undefined) data.phone = req.body.phone;
    if (req.body.role !== undefined) data.role = req.body.role;
    if (req.body.profilePhoto !== undefined) data.profilePhoto = req.body.profilePhoto;
    if (req.body.location !== undefined) {
      if (locationNeedsRegion(req.body.location)) return res.status(400).json({ error: LOCATION_HINT });
      data.location = typeof req.body.location === "string" ? req.body.location.trim() : req.body.location;
    }
    if (req.body.businessHours !== undefined) data.businessHours = req.body.businessHours;
    if (req.body.pushToken !== undefined) data.pushToken = req.body.pushToken;


    if (email) {
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing && existing.id !== userId) {
        return res.status(400).json({ error: "Email already in use" });
      }
      // An alias of someone else's inbox counts as taken, same as at signup.
      const emailNormalized = normalizeEmail(email);
      const aliasTaken = await prisma.user.findFirst({
        where: { emailNormalized, NOT: { id: userId } },
        select: { id: true },
      });
      if (aliasTaken) {
        return res.status(400).json({ error: "Email already in use" });
      }
      data.email = email;
      data.emailNormalized = emailNormalized;
    }

    if (password) {
      const hashed = await bcrypt.hash(password, 10);
      data.password = hashed;
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data,
      select: {
      id: true,
      email: true,
      name: true,
      role: true,
      profilePhoto: true,
      phone: true,
      repPoints: true,
      isAdmin: true,
      location: true,
      createdAt: true,
 },
    });

    res.json(updated);
  } catch (err) {
    console.error("UPDATE PROFILE ERROR:", err);
    res.status(500).json({ error: "Failed to update profile" });
  }
}

// GET /users/search?q=query
export async function searchUsers(req, res) {
  try {
    const { q } = req.query;
    const currentUserId = req.user.id;

    if (!q || q.trim() === "") {
      return res.json([]);
    }

    const users = await prisma.user.findMany({
      where: {
        AND: [
          { id: { not: currentUserId } },
          { email: { notIn: TEST_ACCOUNT_EMAILS } },
          { isBanned: false },
          // Unfinished signups (never entered the email code) can't log in,
          // so finding or messaging them goes nowhere.
          { emailVerified: true },
          // Name only: matching on email would let anyone probe whether an
          // address has an account.
          { name: { contains: q, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        name: true,
        role: true,
        profilePhoto: true,
        _count: {
          select: {
            followers: true,
            posts: true,
          },
        },
      },
      take: 20,
    });

    res.json(users);
  } catch (err) {
    console.error("SEARCH USERS ERROR:", err);
    res.status(500).json({ error: "Failed to search users" });
  }
}

// GET /users/leaderboard?role=DIYER|MECHANIC
export async function getLeaderboard(req, res) {
  try {
    const { role } = req.query;

    const users = await prisma.user.findMany({
      where: {
        ...(role ? { role: role.toUpperCase() } : {}),
        email: { notIn: TEST_ACCOUNT_EMAILS },
        emailVerified: true,
        isBanned: false,
      },
      orderBy: { repPoints: "desc" },
      take: 20,
      select: {
        id: true,
        name: true,
        role: true,
        profilePhoto: true,
        repPoints: true,
        totalDiagnoses: true,
        _count: {
          select: {
            posts: true,
            followers: true,
            carShows: true,
          },
        },
      },
    });

    // For each leaderboard entry, compute an approximate breakdown of how
    // their rep total was earned, using today's point values against
    // current counts. This is an honest approximation, not a literal
    // ledger — if a point value changes later, or a liked post gets
    // deleted after rep was already awarded, the breakdown won't exactly
    // reconcile to the stored repPoints total. Good enough to answer
    // "how did I earn this?" without building a full event-log table.
    const usersWithBreakdown = await Promise.all(
      users.map(async (user) => {
        const [
          postsByType,
          likesReceived,
          commentsReceived,
          jobsCompletedAsMechanic,
          jobsCompletedAsDiyer,
          partsSold,
          reviewsReceived,
        ] = await Promise.all([
          prisma.post.groupBy({
            by: ["postType"],
            where: { userId: user.id },
            _count: true,
          }),
          prisma.like.count({ where: { post: { userId: user.id } } }),
          prisma.comment.count({ where: { post: { userId: user.id } } }),
          prisma.job.count({ where: { mechanicId: user.id, status: "COMPLETED" } }),
          prisma.job.count({ where: { userId: user.id, status: "COMPLETED" } }),
          prisma.part.count({ where: { userId: user.id, status: "SOLD" } }),
          prisma.review.findMany({ where: { mechanicId: user.id }, select: { rating: true } }),
        ]);

        const questionPosts = postsByType.find((p) => p.postType === "QUESTION")?._count || 0;
        const otherPosts = Math.max(0, user._count.posts - questionPosts);
        const reviewRep = reviewsReceived.reduce((sum, r) => sum + r.rating * 2, 0);

        const repBreakdown = [
          { label: "Posts", count: otherPosts, rep: otherPosts * 1, icon: "📝" },
          { label: "Questions Asked", count: questionPosts, rep: questionPosts * 2, icon: "❓" },
          { label: "Likes Received", count: likesReceived, rep: likesReceived * 2, icon: "❤️" },
          { label: "Comments Received", count: commentsReceived, rep: commentsReceived * 1, icon: "💬" },
          { label: "Diagnoses Run", count: user.totalDiagnoses, rep: user.totalDiagnoses * 5, icon: "🔧" },
          { label: "Car Shows Created", count: user._count.carShows, rep: user._count.carShows * 10, icon: "🎪" },
          { label: "Jobs Completed (Mechanic)", count: jobsCompletedAsMechanic, rep: jobsCompletedAsMechanic * 8, icon: "🏁" },
          { label: "Jobs Completed (DIYer)", count: jobsCompletedAsDiyer, rep: jobsCompletedAsDiyer * 3, icon: "✅" },
          { label: "Parts Sold", count: partsSold, rep: partsSold * 5, icon: "🛒" },
          { label: "Reviews Received", count: reviewsReceived.length, rep: reviewRep, icon: "⭐" },
        ].filter((item) => item.count > 0);

        return { ...user, repBreakdown };
      })
    );

    res.json(usersWithBreakdown);
  } catch (err) {
    console.error("GET LEADERBOARD ERROR:", err);
    res.status(500).json({ error: "Failed to fetch leaderboard" });
  }
}
// GET /users/:id/profile
export async function getUserProfile(req, res) {
  try {
    const id = Number(req.params.id);
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        role: true,
        profilePhoto: true,
        repPoints: true,
        isVerified: true, isCertified: true,
        location: true,
        businessHours: true,
        createdAt: true,
        _count: {
          select: {
            posts: true,
            followers: true,
            following: true,
          },
        },
      },
    });

    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  } catch (err) {
    console.error("GET USER PROFILE ERROR:", err);
    res.status(500).json({ error: "Failed to fetch profile" });
  }
}
// POST /users/push-token
export async function savePushToken(req, res) {
  try {
    const userId = req.user.id;
    const { pushToken } = req.body;

    await prisma.user.update({
      where: { id: userId },
      data: { pushToken },
    });

    res.json({ success: true });
  } catch (err) {
    console.error("SAVE PUSH TOKEN ERROR:", err);
    res.status(500).json({ error: "Failed to save push token" });
  }
}
// POST /users/:id/block
export async function blockUser(req, res) {
  try {
    const blockerId = req.user.id;
    const blockedId = Number(req.params.id);

    if (blockerId === blockedId) {
      return res.status(400).json({ error: "You cannot block yourself" });
    }

    const existing = await prisma.block.findUnique({
      where: { blockerId_blockedId: { blockerId, blockedId } },
    });

    if (existing) {
      await prisma.block.delete({
        where: { blockerId_blockedId: { blockerId, blockedId } },
      });
      return res.json({ blocked: false });
    } else {
      await prisma.block.create({
        data: { blockerId, blockedId },
      });
      return res.json({ blocked: true });
    }
  } catch (err) {
    console.error("BLOCK USER ERROR:", err);
    res.status(500).json({ error: "Failed to block user" });
  }
}

// GET /users/blocked
export async function getBlockedUsers(req, res) {
  try {
    const blocks = await prisma.block.findMany({
      where: { blockerId: req.user.id },
      include: {
        blocked: {
          select: { id: true, name: true, profilePhoto: true },
        },
      },
    });
    res.json(blocks.map((b) => b.blocked));
  } catch (err) {
    console.error("GET BLOCKED USERS ERROR:", err);
    res.status(500).json({ error: "Failed to fetch blocked users" });
  }
}
// GET /users/:id/mechanic-stats
export async function getMechanicStats(req, res) {
  try {
    const id = Number(req.params.id);

    const completedJobs = await prisma.job.count({
      where: {
        mechanicId: id,
        status: "COMPLETED",
      },
    });

    const reviews = await prisma.review.findMany({
      where: { mechanicId: id },
      select: { rating: true },
    });

    const avgRating = reviews.length
      ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
      : null;

    const totalBids = await prisma.bid.count({
      where: { mechanicId: id },
    });

    const acceptedBids = await prisma.bid.count({
      where: { mechanicId: id, status: "ACCEPTED" },
    });

    const winRate = totalBids > 0
      ? Math.round((acceptedBids / totalBids) * 100)
      : 0;

    res.json({
      completedJobs,
      avgRating,
      totalReviews: reviews.length,
      winRate,
    });
  } catch (err) {
    console.error("GET MECHANIC STATS ERROR:", err);
    res.status(500).json({ error: "Failed to fetch mechanic stats" });
  }
}
// GET /users/:id/followers
export async function getFollowers(req, res) {
  try {
    const id = Number(req.params.id);
    const follows = await prisma.follow.findMany({
      where: {
        followingId: id,
        follower: { email: { notIn: TEST_ACCOUNT_EMAILS } },
      },
      include: {
        follower: {
          select: { id: true, name: true, role: true, profilePhoto: true },
        },
      },
    });
    res.json(follows.map((f) => f.follower));
  } catch (err) {
    console.error("GET FOLLOWERS ERROR:", err);
    res.status(500).json({ error: "Failed to fetch followers" });
  }
}

// GET /users/:id/following
export async function getFollowing(req, res) {
  try {
    const id = Number(req.params.id);
    const follows = await prisma.follow.findMany({
      where: {
        followerId: id,
        following: { email: { notIn: TEST_ACCOUNT_EMAILS } },
      },
      include: {
        following: {
          select: { id: true, name: true, role: true, profilePhoto: true },
        },
      },
    });
    res.json(follows.map((f) => f.following));
  } catch (err) {
    console.error("GET FOLLOWING ERROR:", err);
    res.status(500).json({ error: "Failed to fetch following" });
  }
}

// POST /users/verification-request — mechanic submits verification request
export async function requestVerification(req, res) {
  try {
    const userId = req.user.id;
    const { licenseNumber, shopName, shopLocation, experience, proofPhotoUrl } = req.body;

    // "Verified" = we checked this is a real, working mechanic. Accept an ASE /
    // cert number OR a proof photo (work badge, uniform, cert, business card).
    const hasProofPhoto =
      typeof proofPhotoUrl === "string" &&
      proofPhotoUrl.startsWith("https://firebasestorage.googleapis.com/");
    if (!shopName || !String(shopName).trim()) {
      return res.status(400).json({ error: "Shop or business name is required." });
    }
    if (!(licenseNumber && String(licenseNumber).trim()) && !hasProofPhoto) {
      return res.status(400).json({ error: "Add your ASE / certification number or a proof photo." });
    }
    if (locationNeedsRegion(shopLocation)) {
      return res.status(400).json({ error: LOCATION_HINT });
    }

    // Fetch current state BEFORE any writes — same pattern as the
    // vehicle-creation trigger. Only a genuine first activation (not
    // re-submitting an already-onboarded mechanic's request) should
    // ever fire the referral reward.
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { hasCompletedOnboarding: true, referredById: true, referralRewardGiven: true },
    });
    const isFirstActivation = !currentUser?.hasCompletedOnboarding;

    const verificationRequest = JSON.stringify({
      licenseNumber: licenseNumber || "",
      shopName,
      shopLocation,
      experience,
      proofPhotoUrl: hasProofPhoto ? proofPhotoUrl : null,
      submittedAt: new Date().toISOString(),
    });

    await prisma.user.update({
      where: { id: userId },
      data: { verificationRequest, hasCompletedOnboarding: true },
    });

    // Referral reward — same guarded logic as the DIYer vehicle trigger.
    if (isFirstActivation && currentUser?.referredById && !currentUser?.referralRewardGiven) {
      try {
        await grantReferralReward(userId, currentUser.referredById);
      } catch (refErr) {
        console.error("REFERRAL REWARD ERROR:", refErr);
      }
    }

    // Notify all admins so verification requests don't sit unnoticed.
    try {
      const requester = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
      const admins = await prisma.user.findMany({
        where: { isAdmin: true },
        select: { id: true },
      });
      const { createAndSendNotification } = await import("./notification.controller.js");
      await Promise.all(admins.map(admin =>
        createAndSendNotification({
          recipientId: admin.id,
          actorId: userId,
          type: "mechanic_verification",
          message: `🏁 ${requester?.name || "A mechanic"} submitted a verification request — ${shopName}`,
        })
      ));
    } catch (notifyErr) {
      console.error("VERIFICATION NOTIFY ADMIN ERROR:", notifyErr);
    }

    res.json({ success: true, message: "Verification request submitted!" });
  } catch (err) {
    console.error("VERIFICATION REQUEST ERROR:", err);
    res.status(500).json({ error: "Failed to submit verification request" });
  }
}

// POST /users/:id/verify — admin approves verification (admin only)
export async function verifyMechanic(req, res) {
  try {
    const adminId = req.user.id;
    const targetId = Number(req.params.id);
    const { approved, level } = req.body; // level: "certified" | "verified" (optional)

    const admin = await prisma.user.findUnique({
      where: { id: adminId },
      select: { isAdmin: true },
    });

    if (!admin?.isAdmin) {
      return res.status(403).json({ error: "Not authorized" });
    }

    // The verify form collects a shop location, but Near Me only reads
    // user.location. On approval, carry it over if the mechanic hasn't set
    // one, so "you now appear on the Near Me map" is actually true.
    const target = await prisma.user.findUnique({
      where: { id: targetId },
      select: { location: true, verificationRequest: true },
    });
    let shopLocation = null;
    let hasLicense = false;
    try {
      const reqData = JSON.parse(target?.verificationRequest || "{}");
      shopLocation = reqData.shopLocation?.trim() || null;
      hasLicense = !!String(reqData.licenseNumber || "").trim();
    } catch {}
    // Two levels: Certified (gold 🏁, license/ASE checked) and Verified (blue ✓,
    // proven working mechanic, no license needed). The admin picks; older admin
    // screens don't send a level, so default to Certified only when a license
    // number was given.
    const certified = !!approved && (level ? level === "certified" : hasLicense);

    // Clear the request either way. Before, a denied request stayed in the
    // admin Verify list forever and the mechanic never heard back.
    await prisma.user.update({
      where: { id: targetId },
      data: {
        // Denying a Verified mechanic's request to become Certified keeps their
        // existing Verified status; it only declines the upgrade.
        ...(approved ? { isVerified: true, isCertified: certified } : {}),
        verificationRequest: null,
        ...(approved && !target?.location && shopLocation ? { location: shopLocation } : {}),
      },
    });

    try {
      const { createAndSendNotification } = await import("./notification.controller.js");
      await createAndSendNotification({
        recipientId: targetId,
        actorId: adminId,
        type: "verification_result",
        message: !approved
          ? "Your verification request needs more info. Please resubmit with your ASE number or a photo of your work ID, uniform, or business card."
          : certified
            ? "🏁 You're a Certified Mechanic! Your gold badge is live on your profile and the Near Me map."
            : "✓ You're a Verified Mechanic! Your badge is live and you show on the Near Me map. Add your ASE or license number any time to become Certified (gold 🏁).",
      });
    } catch (notifyErr) {
      console.error("VERIFY RESULT NOTIFY ERROR:", notifyErr);
    }

    res.json({ success: true, verified: !!approved, certified });
  } catch (err) {
    console.error("VERIFY MECHANIC ERROR:", err);
    res.status(500).json({ error: "Failed to verify mechanic" });
  }
}

// GET /users/verification-requests — admin gets all pending requests
export async function getVerificationRequests(req, res) {
  try {
    const adminId = req.user.id;

    const admin = await prisma.user.findUnique({
      where: { id: adminId },
      select: { isAdmin: true },
    });

    if (!admin?.isAdmin) {
      return res.status(403).json({ error: "Not authorized" });
    }

    const requests = await prisma.user.findMany({
      where: {
        verificationRequest: { not: null },
        isCertified: false, // Verified (blue) mechanics can apply for Certified
      },
      select: {
        id: true,
        name: true,
        email: true,
        profilePhoto: true,
        repPoints: true,
        verificationRequest: true,
        createdAt: true,
        isVerified: true, // already Verified → this request is an upgrade to Certified
      },
    });

    res.json(requests);
  } catch (err) {
    console.error("GET VERIFICATION REQUESTS ERROR:", err);
    res.status(500).json({ error: "Failed to fetch verification requests" });
  }
}

// GET /users/mechanics — get all mechanics with location
export async function getMechanics(req, res) {
  try {
    const mechanics = await prisma.user.findMany({
      where: {
        role: "MECHANIC",
        location: { not: null },
        email: { notIn: TEST_ACCOUNT_EMAILS },
        emailVerified: true,
        isBanned: false,
      },
      select: {
        id: true,
        name: true,
        profilePhoto: true,
        repPoints: true,
        location: true,
        isVerified: true, isCertified: true,
      },
    });
    res.json(mechanics);
  } catch (err) {
    console.error("GET MECHANICS ERROR:", err);
    res.status(500).json({ error: "Failed to fetch mechanics" });
  }
}

// POST /users/:id/ban — admin only, toggle ban status
export async function banUser(req, res) {
  try {
    const adminId = req.user.id;
    const targetId = Number(req.params.id);

    const admin = await prisma.user.findUnique({ where: { id: adminId } });
    if (!admin?.isAdmin) return res.status(403).json({ error: "Admin access required" });

    if (targetId === adminId) return res.status(400).json({ error: "Cannot ban yourself" });

    const target = await prisma.user.findUnique({ where: { id: targetId } });
    if (!target) return res.status(404).json({ error: "User not found" });

    const banning = !target.isBanned;
    if (banning && target.isAdmin) return res.status(400).json({ error: "Can't ban an admin account" });

    // Also adds/removes the email on the signup ban list (see lib/banList.js).
    await prisma.$transaction((tx) => setUserBanned(tx, target, banning));

    res.json({ isBanned: banning });
  } catch (err) {
    console.error("BAN USER ERROR:", err);
    res.status(500).json({ error: "Failed to update ban status" });
  }
}

// GET /users/admin/all — admin only, list all users
export async function getAllUsers(req, res) {
  try {
    const adminId = req.user.id;
    const admin = await prisma.user.findUnique({ where: { id: adminId } });
    if (!admin?.isAdmin) return res.status(403).json({ error: "Admin access required" });

    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isVerified: true, isCertified: true,
        isBanned: true,
        isAdmin: true,
        createdAt: true,
      },
    });

    res.json(users);
  } catch (err) {
    console.error("GET ALL USERS ERROR:", err);
    res.status(500).json({ error: "Failed to fetch users" });
  }
}

// GET /users/suggestions — people you may know
export async function getSuggestions(req, res) {
  try {
    const userId = req.user.id;

    const following = await prisma.follow.findMany({
      where: { followerId: userId },
      select: { followingId: true },
    });
    const followingIds = following.map(f => f.followingId);
    followingIds.push(userId);

    const suggestions = await prisma.user.findMany({
      where: {
        id: { notIn: followingIds },
        emailVerified: true,
        isBanned: false,
        email: { notIn: TEST_ACCOUNT_EMAILS },
      },
      orderBy: { repPoints: "desc" },
      take: 10,
      select: {
        id: true,
        name: true,
        profilePhoto: true,
        role: true,
        isVerified: true, isCertified: true,
        repPoints: true,
        location: true,
      },
    });

    res.json(suggestions);
  } catch (err) {
    console.error("GET SUGGESTIONS ERROR:", err);
    res.status(500).json({ error: "Failed to fetch suggestions" });
  }
}