// src/lib/referrals.js
// One place for the referral reward so the DIYer (first vehicle) and mechanic
// (verification request) triggers can't drift apart.
import prisma from "./prisma.js";

// A referrer stops earning rep once this many of their referrals have been
// processed. The referred person still gets their own welcome bonus.
export const MAX_REWARDED_REFERRALS_PER_REFERRER = 20;
export const REFERRER_REWARD_POINTS = 10;
export const REFERRED_REWARD_POINTS = 5;

export async function grantReferralReward(userId, referredById) {
  // Claim the reward atomically: only one request can flip referralRewardGiven
  // from false to true, so a double-tap or retry can never pay out twice.
  const claimed = await prisma.user.updateMany({
    where: { id: userId, referralRewardGiven: false },
    data: { referralRewardGiven: true, repPoints: { increment: REFERRED_REWARD_POINTS } },
  });
  if (claimed.count === 0) return { granted: false };

  const referrer = await prisma.user.findUnique({
    where: { id: referredById },
    select: { isBanned: true },
  });
  const alreadyProcessed = await prisma.user.count({
    where: { referredById, referralRewardGiven: true, NOT: { id: userId } },
  });

  const referrerEligible =
    !!referrer && !referrer.isBanned && alreadyProcessed < MAX_REWARDED_REFERRALS_PER_REFERRER;

  if (referrerEligible) {
    await prisma.user.update({
      where: { id: referredById },
      data: { repPoints: { increment: REFERRER_REWARD_POINTS } },
    });
  }

  return { granted: true, referrerPaid: referrerEligible };
}
