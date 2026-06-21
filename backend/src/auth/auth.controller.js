import sgMail from "@sendgrid/mail";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import prisma from "../lib/prisma.js";

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

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

// REGISTER
export const register = async (req, res) => {
  try {
    const { email, password, name, role } = req.body;

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

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(400).json({ message: "Email already in use" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const verificationToken = crypto.randomBytes(32).toString("hex");

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role: role || "DIYER",
        emailVerified: false,
        verificationToken,
      },
    });

    // Send verification email
    const verifyLink = `https://automotive-ai-production.up.railway.app/api/auth/verify-email?token=${verificationToken}`;
    await sgMail.send({
      to: email,
      from: "maz@amazmade.com",
      subject: "Verify Your AutoAI Account 🚗",
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; background: #050509; color: white; padding: 32px; border-radius: 16px;">
          <h2 style="color: #345bff;">AutoAI™</h2>
          <p>Welcome to Automotive AI! One last step — verify your email to activate your account.</p>
          <a href="${verifyLink}" style="display: inline-block; background: #345bff; color: white; padding: 14px 28px; border-radius: 12px; text-decoration: none; font-weight: bold; margin: 20px 0;">
            Verify My Email
          </a>
          <p style="color: #6b7280; font-size: 13px;">If you didn't create an account, ignore this email.</p>
        </div>
      `,
    });

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

    await sgMail.send({
      to: email,
      from: "maz@amazmade.com",
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
          h1 { color: #345bff; font-size: 32px; margin-bottom: 12px; }
          p { color: #9ca3af; margin-bottom: 32px; }
          a { background: #345bff; color: white; padding: 16px 32px; border-radius: 12px; text-decoration: none; font-weight: bold; font-size: 18px; }
        </style>
      </head>
      <body>
        <div>
          <h1>🔑 Reset Your Password</h1>
          <p>Tap below to open AutoAI and set a new password.</p>
          <a href="automotiveai://reset-password?token=${token}">Open AutoAI 🚗</a>
        </div>
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

// VERIFY EMAIL
export const verifyEmail = async (req, res) => {
  try {
    const { token } = req.query;

    const user = await prisma.user.findFirst({
      where: { verificationToken: token },
    });

    if (!user) {
      return res.status(400).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
          <title>Verification Failed — AutoAI</title>
          <style>
            body { background: #050509; color: white; font-family: sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; text-align: center; padding: 20px; }
            h1 { color: #ef4444; font-size: 32px; margin-bottom: 12px; }
            p { color: #9ca3af; margin-bottom: 32px; }
          </style>
        </head>
        <body>
          <div>
            <h1>❌ Link Expired</h1>
            <p>This verification link is invalid or has already been used. Please request a new one from the app.</p>
          </div>
        </body>
        </html>
      `);
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        verificationToken: null,
      },
    });

    const jwtToken = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
        <title>Email Verified — AutoAI</title>
        <style>
          body { background: #050509; color: white; font-family: sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; text-align: center; padding: 20px; }
          h1 { color: #345bff; font-size: 32px; margin-bottom: 12px; }
          p { color: #9ca3af; margin-bottom: 32px; }
          a { background: #345bff; color: white; padding: 16px 32px; border-radius: 12px; text-decoration: none; font-weight: bold; font-size: 18px; }
        </style>
      </head>
      <body>
        <div>
          <h1>✅ Email Verified!</h1>
          <p>Welcome to AutoAI! Tap below to open the app and start exploring.</p>
          <a href="automotiveai://verified">Open AutoAI 🚗</a>
        </div>
      </body>
      </html>
    `);
  } catch (err) {
    console.error("VERIFY EMAIL ERROR:", err);
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

    const verificationToken = crypto.randomBytes(32).toString("hex");
    await prisma.user.update({
      where: { email },
      data: { verificationToken },
    });

    const verifyLink = `https://automotive-ai-production.up.railway.app/api/auth/verify-email?token=${verificationToken}`;
    await sgMail.send({
      to: email,
      from: "maz@amazmade.com",
      subject: "Verify Your AutoAI Account 🚗",
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; background: #050509; color: white; padding: 32px; border-radius: 16px;">
          <h2 style="color: #345bff;">AutoAI™</h2>
          <p>Here's your new verification link. Tap below to activate your account.</p>
          <a href="${verifyLink}" style="display: inline-block; background: #345bff; color: white; padding: 14px 28px; border-radius: 12px; text-decoration: none; font-weight: bold; margin: 20px 0;">
            Verify My Email
          </a>
          <p style="color: #6b7280; font-size: 13px;">If you didn't create an account, ignore this email.</p>
        </div>
      `,
    });

    res.json({ message: "Verification email sent!" });
  } catch (err) {
    console.error("RESEND VERIFICATION ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
};
