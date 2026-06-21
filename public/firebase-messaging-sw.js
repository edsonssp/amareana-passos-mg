importScripts('https://www.gstatic.com/firebasejs/10.12.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyC_dyBUP0jgl4gYA2mto50vXoG5BR3VxvE",
  authDomain: "amarena-sorvetes.firebaseapp.com",
  projectId: "amarena-sorvetes",
  storageBucket: "amarena-sorvetes.firebasestorage.app",
  messagingSenderId: "850893265305",
  appId: "1:850893265305:web:8d31c675b8dd54b6b91b08",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/Logo.png'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
