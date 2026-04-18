import { initializeApp } from "firebase/app";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyC2N4fgD8-MR5WzSD6MFnGWnVwq7Bkq0v0",
  authDomain: "automotive-ai-d3291.firebaseapp.com",
  projectId: "automotive-ai-d3291",
  storageBucket: "automotive-ai-d3291.firebasestorage.app",
  messagingSenderId: "511012609862",
  appId: "1:511012609862:web:b147141c953c65e0c5cf47",
  measurementId: "G-B48T7YMD1D"
};

const app = initializeApp(firebaseConfig);
export const storage = getStorage(app);
export default app;