// send-test-push.js: fires ONE push straight at a user's device, bypassing app logic,
// then checks Expo's delivery receipt, which is where Android/FCM credential problems show up.
//
//   node send-test-push.js                          (defaults to maz@amazmade.com)
//   node send-test-push.js amazmade.webdesign@gmail.com
//   node send-test-push.js 100                      (by user id)
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const arg = process.argv[2] || "maz@amazmade.com";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const where = /^\d+$/.test(arg) ? { id: Number(arg) } : { email: arg };
  const user = await prisma.user.findUnique({ where, select: { id: true, email: true, pushToken: true } });

  if (!user) return console.log("No user found for", arg);
  if (!user.pushToken) return console.log(`#${user.id} ${user.email} has no push token. Open the app on the phone (log in), then retry.`);

  console.log(`Sending test push to #${user.id} ${user.email}\n  token: ${user.pushToken}`);
  const res = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      to: user.pushToken,
      title: "AutoAI Test 🚗",
      body: "If you see this, push delivery works!",
      sound: "default",
      priority: "high",
      channelId: "default",
    }),
  });
  const ticket = (await res.json())?.data;
  console.log("\nTicket:", JSON.stringify(ticket));
  if (ticket?.status !== "ok") return console.log("\n✗ Expo rejected it. See the details above.");

  // The ticket only means "queued". The receipt says whether Apple/Google accepted it.
  console.log("\nWaiting 15s for the delivery receipt...");
  await sleep(15000);
  const rr = await fetch("https://exp.host/--/api/v2/push/getReceipts", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ ids: [ticket.id] }),
  });
  const receipt = (await rr.json())?.data?.[ticket.id];
  console.log("Receipt:", JSON.stringify(receipt));

  if (!receipt) console.log("\n… No receipt yet. Run again in a minute; it can lag.");
  else if (receipt.status === "ok") console.log("\n✓ Delivered to Apple/Google. The phone should show it now.");
  else {
    const e = receipt.details?.error;
    console.log(`\n✗ Delivery failed: ${e || receipt.message}`);
    if (e === "InvalidCredentials") console.log("  → The FCM V1 key in Expo credentials is wrong or missing (Android).");
    if (e === "DeviceNotRegistered") console.log("  → That token is stale (app uninstalled/reinstalled). Re-open the app to refresh it.");
    if (e === "MismatchSenderId") console.log("  → google-services.json and the FCM key are from different Firebase projects.");
  }
}

main().catch((e) => console.error(e)).finally(() => prisma.$disconnect());
