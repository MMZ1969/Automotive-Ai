import admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
    }),
  });
}

// POST /api/auth/firebase-token
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