const admin = require("firebase-admin");
const env = require("./env");

let firebaseAdminApp = null;

function isFirebaseAuthEnabled() {
  return Boolean(env.firebase.enabled);
}

function getFirebaseAdminApp() {
  if (!isFirebaseAuthEnabled()) {
    return null;
  }

  if (!firebaseAdminApp) {
    const appOptions = {
      projectId: env.firebase.projectId,
    };

    if (env.firebase.serviceAccount) {
      appOptions.credential = admin.credential.cert(env.firebase.serviceAccount);
    }

    firebaseAdminApp = admin.initializeApp(
      appOptions,
      "civiclink-firebase-auth"
    );
  }

  return firebaseAdminApp;
}

function getFirebaseAuth() {
  const app = getFirebaseAdminApp();
  return app ? admin.auth(app) : null;
}

function getFirebaseMessaging() {
  const app = getFirebaseAdminApp();
  return app ? admin.messaging(app) : null;
}

async function verifyFirebaseIdToken(idToken) {
  const auth = getFirebaseAuth();

  if (!auth) {
    throw new Error("Firebase Admin is not configured.");
  }

  return auth.verifyIdToken(idToken);
}

module.exports = {
  getFirebaseAuth,
  getFirebaseMessaging,
  isFirebaseAuthEnabled,
  verifyFirebaseIdToken,
};
