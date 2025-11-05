// Javascript/firebase-init.js

// ‼️ สำคัญ: ใช้ firebaseConfig เดิมของคุณที่นี่
const firebaseConfig = {
  apiKey: "AIzaSyAHiYwqBpdECJ5lz19JvS_ECN6pJzw3GAE",
  authDomain: "dndprojact.firebaseapp.com",
  databaseURL: "https://dndprojact-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "dndprojact",
  storageBucket: "dndprojact.firebasestorage.app",
  messagingSenderId: "335533278163",
  appId: "1:335533278163:web:42a0828535336cdbb0e526"
  // measurementId ไม่จำเป็นสำหรับ Realtime Database
};

// Initialize Firebase โดยใช้รูปแบบเก่า (v8)
// ไม่ต้องใช้ import, เพราะเราเรียก script มาใน HTML แล้ว
firebase.initializeApp(firebaseConfig);

// สร้างตัวแปร `db` ให้อยู่ใน scope กลางเพื่อให้ไฟล์อื่นเรียกใช้ได้
const db = firebase.database();
