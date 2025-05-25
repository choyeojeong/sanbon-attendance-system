// public/firebase-messaging-sw.js
importScripts("https://www.gstatic.com/firebasejs/10.8.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.8.1/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyDWW8oAdRwptijwo32HTH80wz3KPylztCk",
  authDomain: "sanbon-attendance-system.firebaseapp.com",
  projectId: "sanbon-attendance-system",
  messagingSenderId: "215198982150",
  appId: "1:215198982150:web:cf707914f544b0809fe387"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] 백그라운드 메시지 수신:', payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/icons/icon-192.png', // 앱 아이콘 경로
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});