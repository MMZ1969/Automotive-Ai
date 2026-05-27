import { signInWithCustomToken } from "firebase/auth";
import { auth } from "../firebaseConfig";
import api from "./api";

let tokenExpiry: number | null = null;

export const ensureFirebaseAuth = async () => {
  // If token is still valid (within 55 minutes) skip
  if (tokenExpiry && Date.now() < tokenExpiry) return;

  try {
    const res = await api.post("/api/auth/firebase-token");
    await signInWithCustomToken(auth, res.data.token);
    // Custom tokens last 1 hour, refresh after 55 min
    tokenExpiry = Date.now() + 55 * 60 * 1000;
  } catch (err) {
    console.error("FIREBASE AUTH ERROR:", err);
    throw new Error("Could not authenticate with Firebase");
  }
};