importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyDub8zDIVWzhHFN7qx4nuYdwCb1a0s3mR0",
  authDomain: "mini-f7bac.firebaseapp.com",
  projectId: "mini-f7bac",
  storageBucket: "mini-f7bac.appspot.com",
  messagingSenderId: "547201758346",
  appId: "1:547201758346:web:18ea0bbc8921b0d1b2e973"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {
  console.log('Background Message received:', payload);

  const notificationTitle = payload.notification?.title || 'নতুন কল';
  const notificationOptions = {
    body: payload.notification?.body || 'কেউ তোমাকে কল করছে',
    icon: '/icon.png',
    data: payload.data
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
