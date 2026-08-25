import { getApp, getApps, initializeApp } from "firebase/app";

const requiredConfigKeys = [
  "apiKey",
  "authDomain",
  "projectId",
  "storageBucket",
  "messagingSenderId",
  "appId",
];

export function getClientConfig() {
  return window.__FIREBASE_CONFIG__ || {};
}

export function hasFirebaseConfig(config = getClientConfig()) {
  return requiredConfigKeys.every((key) => typeof config[key] === "string" && config[key].trim());
}

export function getFirebaseApp() {
  const config = getClientConfig();
  if (!hasFirebaseConfig(config)) {
    const error = new Error("Firebase 尚未設定完成。");
    error.code = "app/config-missing";
    throw error;
  }

  return getApps().length ? getApp() : initializeApp(config);
}
