import admin from "firebase-admin";

// Initialize the Admin SDK once, from Railway env vars.
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      // Railway stores the key with literal "\n" — convert back to real newlines
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}

// POST /api/auth/firebase-token
// Mints a Firebase custom token whose UID == the user's Prisma id (as a string),
// so it satisfies the Storage rule: request.auth.uid == userId
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