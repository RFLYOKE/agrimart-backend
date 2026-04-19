import admin from 'firebase-admin';

let isFirebaseInitialized = false;

try {
  const serviceAccountKey = process.env.FCM_SERVICE_ACCOUNT;
  
  if (serviceAccountKey) {
    const serviceAccount = JSON.parse(serviceAccountKey);
    
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    
    isFirebaseInitialized = true;
    console.log('Firebase Admin SDK successfully initialized.');
  } else {
    console.warn('FCM_SERVICE_ACCOUNT is not defined. Push notifications will be bypassed.');
  }
} catch (error) {
  console.error('Failed to initialize Firebase Admin SDK. Please check FCM_SERVICE_ACCOUNT JSON.', error);
}

export const messaging = isFirebaseInitialized ? admin.messaging() : null;
export default admin;
