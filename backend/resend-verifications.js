// resend-verifications.js
// Run this once from your backend folder:
// node resend-verifications.js

import sgMail from "@sendgrid/mail";
import crypto from "crypto";
import dotenv from "dotenv";
dotenv.config();

import prisma from "./src/lib/prisma.js";

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

async function resendAll() {
  console.log("🔍 Finding unverified users...");

  const unverifiedUsers = await prisma.user.findMany({
    where: { emailVerified: false },
    select: { id: true, email: true, name: true },
  });

  console.log(`📬 Found ${unverifiedUsers.length} unverified users. Sending emails...`);

  let success = 0;
  let failed = 0;

  for (const user of unverifiedUsers) {
    try {
      // Generate a fresh token
      const verificationToken = crypto.randomBytes(32).toString("hex");

      // Update token in DB
      await prisma.user.update({
        where: { id: user.id },
        data: { verificationToken },
      });

      // Send the email
      const verifyLink = `https://automotive-ai-production.up.railway.app/api/auth/verify-email?token=${verificationToken}`;

      await sgMail.send({
        to: user.email,
        from: "maz@amazmade.com",
        subject: "Verify Your AutoAI Account 🚗",
        html: `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; background: #050509; color: white; padding: 32px; border-radius: 16px;">
            <h2 style="color: #345bff;">AutoAI™</h2>
            <p>Hey ${user.name}! We fixed an issue with our email verification. Please tap the button below to verify your account and get started.</p>
            <a href="${verifyLink}" style="display: inline-block; background: #345bff; color: white; padding: 14px 28px; border-radius: 12px; text-decoration: none; font-weight: bold; margin: 20px 0;">
              Verify My Email
            </a>
            <p style="color: #6b7280; font-size: 13px;">If you didn't create an account, ignore this email.</p>
          </div>
        `,
      });

      console.log(`✅ Sent to ${user.email}`);
      success++;

      // Small delay to avoid SendGrid rate limits
      await new Promise(r => setTimeout(r, 200));

    } catch (err) {
      console.error(`❌ Failed for ${user.email}:`, err.message);
      failed++;
    }
  }

  console.log(`\n🎉 Done! ${success} sent, ${failed} failed.`);
  await prisma.$disconnect();
}

resendAll();