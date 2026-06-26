// send-test-push.js — fires ONE push straight at your device, bypassing all app logic
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const TARGET_EMAIL = "maz@amazmade.com"; // your account

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: TARGET_EMAIL },
    select: { id: true, email: true, pushToken: true },
  });

  if (!user) return console.log("No user found for", TARGET_EMAIL);
  if (!user.pushToken)
    return console.log("No push token saved for that user. Re-open the app, then retry.");

  console.log("Sending test push to:", user.pushToken);

  const res = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      to: user.pushToken,
      title: "AutoAI Test 🚗",
      body: "If you see this, push delivery works!",
      sound: "default",
      priority: "high",
    }),
  });

  const data = await res.json();
  console.log("\n---- EXPO RESPONSE ----");
  console.log(JSON.stringify(data, null, 2));
  console.log("-----------------------\n");
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());