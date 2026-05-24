import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDqGRiLLOrcRJGYLtptVMw1dOiFF_VNVaw",
  authDomain: "crb-checker-66cea.firebaseapp.com",
  projectId: "crb-checker-66cea",
  storageBucket: "crb-checker-66cea.firebasestorage.app",
  messagingSenderId: "1063408432263",
  appId: "1:1063408432263:web:97b1d39acf090b75e13422",
  measurementId: "G-H4QFYRHM2G"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
