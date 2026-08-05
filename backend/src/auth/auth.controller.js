import bcrypt from "bcryptjs";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { Resend } from "resend";
import prisma from "../lib/prisma.js";

const resend = new Resend(process.env.RESEND_API_KEY);

// Sender — must be on the Resend-verified domain (send.amazmade.com)
const FROM_EMAIL = "AutoAI <noreply@send.amazmade.com>";

// Simple profanity filter — no external package needed
const BANNED_WORDS = [
  "fuck", "shit", "ass", "bitch", "dick", "cock", "pussy",
  "cunt", "bastard", "nigger", "nigga", "faggot", "retard",
  "whore", "slut", "piss", "crap", "douche"
];

const isProfane = (text) => {
  if (!text) return false;
  const lower = text.toLowerCase();
  return BANNED_WORDS.some(word => lower.includes(word));
};

// Shared password strength check — one source of truth for all password rules
const validatePassword = (password) => {
  if (!password || password.length < 8) {
    return "Password must be at least 8 characters.";
  }
  if (!/[0-9]/.test(password)) {
    return "Password must contain at least one number.";
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    return "Password must contain at least one special character (!@#$%^&* etc).";
  }
  return null;
};

// Basic email format check — blocks garbage like "Capshaw" or "Lukas@789"
const isValidEmail = (email) =>
  typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

// REGISTER
export const register = async (req, res) => {
  try {
    const { password, name, role } = req.body;
    const email = (req.body.email || "").trim();

    if (!isValidEmail(email)) {
      return res.status(400).json({ message: "Please enter a valid email address." });
    }

    if (isProfane(name)) {
      return res.status(400).json({ message: "Username contains inappropriate language. Please choose a different name." });
    }

    if (!name || name.trim().length < 2 || name.trim().length > 30) {
      return res.status(400).json({ message: "Username must be between 2 and 30 characters." });
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      return res.status(400).json({ message: passwordError });
    }

    const existing = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
    });
    if (existing) {
      return res.status(400).json({ message: "Email already in use" });
    }

    const banned = await prisma.bannedEmail.findUnique({
  where: { email: email.toLowerCase() },
    });
  if (banned) {
  return res.status(403).json({ message: "This email address is not permitted to register." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const verificationCode = crypto.randomInt(100000, 999999).toString();
    const verificationCodeExpiry = new Date(Date.now() + 1000 * 60 * 15); // 15 min

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role: role || "DIYER",
        emailVerified: false,
        verificationToken: verificationCode,
        verificationCodeExpiry,
      },
    });

    // Send verification code email
    const { error } = await resend.emails.send({
      to: email,
      from: FROM_EMAIL,
      subject: "Your AutoAI Verification Code 🚗",
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; background: #050509; color: white; padding: 32px; border-radius: 16px;">
          <h2 style="color: #345bff;">AutoAI™</h2>
          <p>Welcome to Automotive AI! Enter this code in the app to activate your account:</p>
          <div style="background: #111; border: 2px solid #345bff; border-radius: 12px; padding: 20px; text-align: center; margin: 20px 0;">
            <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #345bff;">${verificationCode}</span>
          </div>
          <p style="color: #6b7280; font-size: 13px;">This code expires in 15 minutes. If you didn't create an account, ignore this email.</p>
        </div>
      `,
    });
    if (error) throw error;

    res.json({
      message: "Account created! Please check your email to verify your account.",
      needsVerification: true,
    });
  } catch (err) {
    console.error("REGISTER ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// LOGIN
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    if (!user.emailVerified) {
      return res.status(403).json({ 
        message: "Please verify your email before logging in. Check your inbox!",
        needsVerification: true,
      });
    }

    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        profilePhoto: user.profilePhoto,
        repPoints: user.repPoints,
        isAdmin: user.isAdmin,
        location: user.location,
        isVerified: user.isVerified,
        isBanned: user.isBanned,
        hasCompletedOnboarding: user.hasCompletedOnboarding,
      },
    });
    
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ME
export const me = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        profilePhoto: true,
        repPoints: true,
        isVerified: true,
        isBanned: true,
        isAdmin: true,
        location: true,
        phone: true,
        hasCompletedOnboarding: true,
      },
    });

    res.json({ user });
  } catch (err) {
    console.error("ME ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// DELETE ACCOUNT
export const deleteAccount = async (req, res) => {
  try {
    const userId = req.user.id;

    await prisma.carShowAttendee.deleteMany({ where: { userId } });
    await prisma.carShow.deleteMany({ where: { userId } });
    await prisma.message.deleteMany({ where: { OR: [{ senderId: userId }, { receiverId: userId }] } });
    await prisma.conversation.deleteMany({ where: { OR: [{ user1Id: userId }, { user2Id: userId }] } });
    await prisma.part.deleteMany({ where: { userId } });
    await prisma.notification.deleteMany({ where: { OR: [{ recipientId: userId }, { actorId: userId }] } });
    await prisma.report.deleteMany({ where: { reporterId: userId } });
    await prisma.block.deleteMany({ where: { OR: [{ blockerId: userId }, { blockedId: userId }] } });
    await prisma.like.deleteMany({ where: { userId } });
    await prisma.comment.deleteMany({ where: { userId } });
    await prisma.follow.deleteMany({ where: { OR: [{ followerId: userId }, { followingId: userId }] } });
    await prisma.bid.deleteMany({ where: { OR: [{ mechanicId: userId }, { job: { userId } }] } });
    await prisma.review.deleteMany({ where: { OR: [{ reviewerId: userId }, { mechanicId: userId }] } });
    await prisma.log.deleteMany({ where: { userId } });
    await prisma.vehicle.deleteMany({ where: { userId } });
    await prisma.post.deleteMany({ where: { userId } });
    await prisma.job.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } });

    res.json({ success: true });
  } catch (err) {
    console.error("DELETE ACCOUNT ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// FORGOT PASSWORD
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.json({ message: "If that email exists, a reset link has been sent." });
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expiry = new Date(Date.now() + 1000 * 60 * 60); // 1 hour

    await prisma.user.update({
      where: { email },
      data: {
        resetToken: token,
        resetTokenExpiry: expiry,
      },
    });

    const resetLink = `https://automotive-ai-production.up.railway.app/api/auth/reset-password-redirect?token=${token}`;

    const { error } = await resend.emails.send({
      to: email,
      from: FROM_EMAIL,
      subject: "Reset Your AutoAI Password 🔧",
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; background: #050509; color: white; padding: 32px; border-radius: 16px;">
          <h2 style="color: #345bff;">AutoAI™</h2>
          <p>You requested a password reset. Tap the button below to set a new password.</p>
          <p>This link expires in <strong>1 hour</strong>.</p>
          <a href="${resetLink}" style="display: inline-block; background: #345bff; color: white; padding: 14px 28px; border-radius: 12px; text-decoration: none; font-weight: bold; margin: 20px 0;">
            Reset My Password
          </a>
          <p style="color: #6b7280; font-size: 13px;">If you didn't request this, ignore this email. Your password won't change.</p>
        </div>
      `,
    });
    if (error) throw error;

    res.json({ message: "If that email exists, a reset link has been sent." });
  } catch (err) {
    console.error("FORGOT PASSWORD ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// RESET PASSWORD
export const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      return res.status(400).json({ message: passwordError });
    }
    const user = await prisma.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExpiry: { gt: new Date() },
      },
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired reset link." });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpiry: null,
      },
    });

    res.json({ message: "Password reset successfully!" });
  } catch (err) {
    console.error("RESET PASSWORD ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// RESET PASSWORD REDIRECT (HTTPS intermediary page)
export const resetPasswordRedirect = async (req, res) => {
  try {
    // Helmet's default CSP blocks the inline <script> this page needs for
    // the desktop password-reset form. Loosen it just for this route —
    // rest of the API keeps Helmet's default strict policy untouched.
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';"
    );
    
    const { token } = req.query;

    if (!token) {
      return res.status(400).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
          <title>Invalid Link — AutoAI</title>
          <style>
            body { background: #050509; color: white; font-family: sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; text-align: center; padding: 20px; }
            h1 { color: #ef4444; font-size: 32px; margin-bottom: 12px; }
            p { color: #9ca3af; margin-bottom: 32px; }
          </style>
        </head>
        <body>
          <div>
            <h1>❌ Invalid Link</h1>
            <p>This password reset link is missing required information. Please request a new one from the app.</p>
          </div>
        </body>
        </html>
      `);
    }

    const user = await prisma.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExpiry: { gt: new Date() },
      },
    });

    if (!user) {
      return res.status(400).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
          <title>Link Expired — AutoAI</title>
          <style>
            body { background: #050509; color: white; font-family: sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; text-align: center; padding: 20px; }
            h1 { color: #ef4444; font-size: 32px; margin-bottom: 12px; }
            p { color: #9ca3af; margin-bottom: 32px; }
          </style>
        </head>
        <body>
          <div>
            <h1>❌ Link Expired</h1>
            <p>This password reset link is invalid or has expired. Please request a new one from the app.</p>
          </div>
        </body>
        </html>
      `);
    }

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
        <title>Reset Password — AutoAI</title>
        <style>
          body { background: #050509; color: white; font-family: sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; text-align: center; padding: 20px; }
          .card { max-width: 400px; width: 100%; }
          h1 { color: #345bff; font-size: 28px; margin-bottom: 8px; }
          p { color: #9ca3af; margin-bottom: 24px; font-size: 14px; }
          .deep-link { display: inline-block; background: #345bff; color: white; padding: 16px 32px; border-radius: 12px; text-decoration: none; font-weight: bold; font-size: 17px; margin-bottom: 28px; }
          .divider { display: flex; align-items: center; color: #6b7280; font-size: 12px; margin: 20px 0; }
          .divider::before, .divider::after { content: ""; flex: 1; height: 1px; background: #252838; }
          .divider span { padding: 0 12px; }
          input { width: 100%; box-sizing: border-box; background: #11131a; color: white; padding: 14px; border-radius: 10px; border: 1px solid #252838; font-size: 15px; margin-bottom: 12px; }
          button { width: 100%; background: #345bff; color: white; padding: 14px; border-radius: 10px; border: none; font-size: 16px; font-weight: bold; cursor: pointer; }
          button:disabled { background: #252838; color: #6b7280; }
          .hint { color: #6b7280; font-size: 12px; text-align: left; margin-bottom: 16px; }
          #message { font-size: 14px; margin-top: 14px; min-height: 20px; }
          #message.error { color: #ef4444; }
          #message.success { color: #10b981; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>🔑 Reset Your Password</h1>
          <p>On your phone? Open the app directly. On a computer, reset it right here instead.</p>

          <a class="deep-link" href="automotiveai://reset-password?token=${token}">Open AutoAI 🚗</a>

          <div class="divider"><span>OR RESET HERE</span></div>

          <form id="resetForm">
            <input type="password" id="newPassword" placeholder="New password" autocomplete="new-password" />
            <input type="password" id="confirmPassword" placeholder="Confirm new password" autocomplete="new-password" />
            <div class="hint">Must be 8+ characters, include a number and a special character.</div>
            <button type="submit" id="submitBtn">Reset Password</button>
          </form>
          <div id="message"></div>
        </div>

        <script>
          const form = document.getElementById('resetForm');
          const btn = document.getElementById('submitBtn');
          const msg = document.getElementById('message');

          form.addEventListener('submit', async (e) => {
            e.preventDefault();
            msg.textContent = '';
            msg.className = '';

            const newPassword = document.getElementById('newPassword').value;
            const confirmPassword = document.getElementById('confirmPassword').value;

            if (newPassword !== confirmPassword) {
              msg.textContent = 'Passwords do not match.';
              msg.className = 'error';
              return;
            }

            btn.disabled = true;
            btn.textContent = 'Resetting...';

            try {
              const res = await fetch('/api/auth/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: '${token}', newPassword }),
              });
              const data = await res.json();

              if (!res.ok) {
                msg.textContent = data.message || 'Something went wrong. Please try again.';
                msg.className = 'error';
                btn.disabled = false;
                btn.textContent = 'Reset Password';
                return;
              }

              msg.textContent = '✅ Password reset! You can now log in on the app with your new password.';
              msg.className = 'success';
              form.style.display = 'none';
            } catch (err) {
              msg.textContent = 'Network error. Please try again.';
              msg.className = 'error';
              btn.disabled = false;
              btn.textContent = 'Reset Password';
            }
          });
        </script>
      </body>
      </html>
    `);
  } catch (err) {
    console.error("RESET PASSWORD REDIRECT ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// CHANGE PASSWORD (logged in)
export const changePassword = async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    const user = await prisma.user.findUnique({ where: { id: userId } });

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Current password is incorrect." });
    }

    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      return res.status(400).json({ message: passwordError });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    res.json({ message: "Password changed successfully!" });
  } catch (err) {
    console.error("CHANGE PASSWORD ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// VERIFY EMAIL CODE
export const verifyEmailCode = async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({ message: "Email and code are required." });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return res.status(400).json({ message: "Invalid code." });
    }

    if (user.emailVerified) {
      return res.status(400).json({ message: "Email already verified!" });
    }

    if (
      !user.verificationToken ||
      user.verificationToken !== code ||
      !user.verificationCodeExpiry ||
      user.verificationCodeExpiry < new Date()
    ) {
      return res.status(400).json({ message: "Invalid or expired code. Please request a new one." });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        verificationToken: null,
        verificationCodeExpiry: null,
      },
    });

    const jwtToken = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      message: "Email verified!",
      token: jwtToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        profilePhoto: user.profilePhoto,
        repPoints: user.repPoints,
        isAdmin: user.isAdmin,
        location: user.location,
        isVerified: user.isVerified,
        isBanned: user.isBanned,
        hasCompletedOnboarding: user.hasCompletedOnboarding,
      },
    });
  } catch (err) {
    console.error("VERIFY EMAIL CODE ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
};
      
// RESEND VERIFICATION EMAIL
export const resendVerification = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.json({ message: "If that email exists, a verification link has been sent." });
    }

    if (user.emailVerified) {
      return res.status(400).json({ message: "Email already verified!" });
    }

    const verificationCode = crypto.randomInt(100000, 999999).toString();
    const verificationCodeExpiry = new Date(Date.now() + 1000 * 60 * 15);

    await prisma.user.update({
      where: { email },
      data: { verificationToken: verificationCode, verificationCodeExpiry },
    });

    const { error } = await resend.emails.send({
      to: email,
      from: FROM_EMAIL,
      subject: "Your AutoAI Verification Code 🚗",
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; background: #050509; color: white; padding: 32px; border-radius: 16px;">
          <h2 style="color: #345bff;">AutoAI™</h2>
          <p>Here's your new verification code. Enter it in the app to activate your account:</p>
          <div style="background: #111; border: 2px solid #345bff; border-radius: 12px; padding: 20px; text-align: center; margin: 20px 0;">
            <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #345bff;">${verificationCode}</span>
          </div>
          <p style="color: #6b7280; font-size: 13px;">This code expires in 15 minutes. If you didn't create an account, ignore this email.</p>
        </div>
      `,
    });
    if (error) throw error;

    res.json({ message: "Verification email sent!" });
  } catch (err) {
    console.error("RESEND VERIFICATION ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
};