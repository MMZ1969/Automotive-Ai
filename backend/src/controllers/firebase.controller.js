import admin from "firebase-admin";

// Normalize the private key no matter how Railway stored it:
// strip wrapping quotes, then convert any literal \n into real newlines.
let privateKey = process.env.FIREBASE_PRIVATE_KEY || "";
privateKey = privateKey.replace(/^["']|["']$/g, "");   // remove wrapping quotes if present
privateKey = privateKey.replace(/\\n/g, "\n");          // turn literal \n into real line breaks

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey,
    }),
  });
}