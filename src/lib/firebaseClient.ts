import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  type Auth,
} from "firebase/auth";

export interface GoogleUserSummary {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
}

function getFirebaseConfig() {
  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim() || "",
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN?.trim() || "",
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim() || "",
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID?.trim() || "",
  };
}

export function isFirebaseConfigured(): boolean {
  const cfg = getFirebaseConfig();
  return Boolean(cfg.apiKey && cfg.authDomain && cfg.projectId);
}

let cachedApp: FirebaseApp | null = null;
let cachedAuth: Auth | null = null;

function getFirebaseAuthInstance(): Auth {
  if (!isFirebaseConfigured()) {
    throw new Error(
      "El acceso con Google no está disponible temporalmente."
    );
  }
  if (!cachedApp) {
    const existing = getApps();
    cachedApp = existing.length > 0 ? existing[0] : initializeApp(getFirebaseConfig());
  }
  if (!cachedAuth) {
    cachedAuth = getAuth(cachedApp);
  }
  return cachedAuth;
}

/**
 * Opens Google Sign-In popup via Firebase Auth. Must be invoked directly from a user click handler.
 */
export async function signInWithGooglePopup(): Promise<GoogleUserSummary> {
  const auth = getFirebaseAuthInstance();
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });

  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    return {
      uid: user.uid,
      email: user.email || "cuenta@google.com",
      displayName: user.displayName || "Usuario Google",
      photoURL: user.photoURL || undefined,
    };
  } catch (err) {
    const code = (err as { code?: string })?.code || "";
    if (code === "auth/popup-closed-by-user") {
      throw new Error("Cerraste la ventana de Google antes de completar el acceso.");
    }
    if (code === "auth/popup-blocked") {
      throw new Error("El navegador bloqueó la ventana emergente de Google. Permite popups e inténtalo de nuevo.");
    }
    if (code === "auth/unauthorized-domain") {
      throw new Error("Este dominio aún no está autorizado en Firebase Console → Authentication → Authorized domains.");
    }
    throw new Error(
      err instanceof Error
        ? err.message
        : "No se pudo conectar con Google mediante Firebase Auth."
    );
  }
}

export async function signOutFirebase(): Promise<void> {
  if (!isFirebaseConfigured()) return;
  const auth = getFirebaseAuthInstance();
  await signOut(auth).catch(() => {});
}
