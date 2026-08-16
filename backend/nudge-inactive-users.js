// nudge-inactive-users.js
// Sends a one-time re-engagement email to users who verified their email
// but never took their first real action in the app (no vehicle added,
// no post, no activity at all). Dry-run by default — prints who WOULD
// receive the email without sending anything. Pass --send to actually
// send.
//
// Usage:
//   node nudge-inactive-users.js          (dry run, prints recipients only)
//   node nudge-inactive-users.js --send   (actually sends the emails)

import { PrismaClient } from "@prisma/client";
import { Resend } from "resend";

const prisma = new PrismaClient();
const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = "AutoAI <noreply@send.amazmade.com>";
const EXCLUDED_EMAILS = ["apple@test.com", "test@google.com"];

async function main() {
  const shouldSend = process.argv.includes("--send");

  const users = await prisma.user.findMany({
    where: {
      isAdmin: false,
      emailVerified: true,
      email: { notIn: EXCLUDED_EMAILS },
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      _count: {
        select: {
          posts: true,
          comments: true,
          likes: true,
          messagesSent: true,
          jobsPosted: true,
          bids: true,
          vehicles: true,
          following: true,
        },
      },
    },
  });

  const inactive = users.filter((u) => {
    const c = u._count;
    const activity =
      c.posts + c.comments + c.likes + c.messagesSent +
      c.jobsPosted + c.bids + c.vehicles + c.following;
    return activity === 0;
  });

  console.log(`\n=== Nudge Email — ${shouldSend ? "LIVE SEND" : "DRY RUN"} ===\n`);
  console.log(`Found ${inactive.length} verified, zero-activity user(s):\n`);
  inactive.forEach((u) => console.log(`  #${u.id}  ${u.email}  "${u.name || "(no name)"}"  ${u.role}`));

  if (!shouldSend) {
    console.log(`\nDry run complete. No emails sent. Run with --send to actually send.\n`);
    await prisma.$disconnect();
    return;
  }

  console.log(`\nSending ${inactive.length} email(s)...`);
  let sent = 0;
  let failed = 0;

  for (const u of inactive) {
    // Slightly different CTA by role — a DIYer's first real action is
    // adding a vehicle; a mechanic's is submitting verification.
    const isMechanic = u.role === "MECHANIC";
    const firstName = u.name?.trim().split(" ")[0] || "there";
    const ctaText = isMechanic
      ? "Submit your verification to start showing up on the Near Me map and land job requests."
      : "Add your first vehicle to unlock AI diagnostics, maintenance logs, and personalized parts pricing.";

    try {
      const { error } = await resend.emails.send({
        to: u.email,
        from: FROM_EMAIL,
        subject: "You're one step away on AutoAI 🚗",
        html: `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; background: #050509; color: white; padding: 32px; border-radius: 16px;">
            <h2 style="color: #345bff;">AutoAI™</h2>
            <p>Hey ${firstName},</p>
            <p>You verified your AutoAI account a while back but haven't taken the first step yet. ${ctaText}</p>
            <p style="color: #6b7280; font-size: 13px; margin-top: 24px;">If you're not interested anymore, no worries — just ignore this email.</p>
          </div>
        `,
      });
      if (error) throw error;
      console.log(`  Sent to ${u.email}`);
      sent++;
    } catch (err) {
      console.error(`  FAILED for ${u.email}:`, err.message);
      failed++;
    }
  }

  console.log(`\nDone. Sent ${sent}, failed ${failed}.\n`);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error("NUDGE SCRIPT ERROR:", err);
  await prisma.$disconnect();
  process.exit(1);
});