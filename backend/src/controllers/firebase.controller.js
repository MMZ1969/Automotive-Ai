import admin from "firebase-admin";

let privateKey = process.env.FIREBASE_PRIVATE_KEY || "";
privateKey = privateKey.replace(/^["']|["']$/g, "");
privateKey = privateKey.replace(/\\n/g, "\n");

// ── TEMP DIAGNOSTIC — remove after ──
console.log("KEY STARTS:", JSON.stringify(privateKey.slice(0, 40)));
console.log("KEY ENDS:", JSON.stringify(privateKey.slice(-40)));
console.log("KEY LENGTH:", privateKey.length);
console.log("HAS REAL NEWLINES:", privateKey.includes("\n"));


if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey,
    }),
  });
}

export async function getFirebaseToken(req, res) {
  try {
    const userId = req.user.id;
    const token = await admin.auth().createCustomToken(String(userId));
    res.json({ token });
  } catch (err) {
    console.error("FIREBASE TOKEN ERROR:", err);
    res.status(500).json({ error: "Could not generate Firebase token" });
  }
}