import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";

const WIFFLE_LOCAL_STORAGE_KEY = "wiffle-app-state-v1";
const WIFFLE_SHARED_STATE_ENDPOINT = "/.netlify/functions/wiffle-state";

function savedAtTime(state) {
  const value = state?.savedAt ? new Date(state.savedAt).getTime() : 0;
  return Number.isFinite(value) ? value : 0;
}

async function syncNewestSharedStateBeforeRender() {
  try {
    const response = await fetch(WIFFLE_SHARED_STATE_ENDPOINT, { cache: "no-store" });
    if (!response.ok) return;
    const sharedState = await response.json();
    if (!sharedState || typeof sharedState !== "object") return;

    window.localStorage.setItem(WIFFLE_LOCAL_STORAGE_KEY, JSON.stringify(sharedState));
  } catch (error) {
    console.warn("Unable to load shared Wiffle data before startup.", error);
  } finally {
    try {
      const finalRaw = window.localStorage.getItem(WIFFLE_LOCAL_STORAGE_KEY);
      const finalState = finalRaw ? JSON.parse(finalRaw) : null;
      window.__WIFFLE_SYNC_BASE_SAVED_AT = finalState?.savedAt || "";
    } catch (error) {
      window.__WIFFLE_SYNC_BASE_SAVED_AT = "";
    }
  }
}

await syncNewestSharedStateBeforeRender();

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
