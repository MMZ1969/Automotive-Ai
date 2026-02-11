// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyC2N4fgD8-MR5WzSD6MFnGWnVwq7Bkq0v0",
  authDomain: "automotive-ai-d3291.firebaseapp.com",
  projectId: "automotive-ai-d3291",
  storageBucket: "automotive-ai-d3291.firebasestorage.app",
  messagingSenderId: "511012609862",
  appId: "1:511012609862:web:b147141c953c65e0c5cf47",
  measurementId: "G-B48T7YMD1D"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);