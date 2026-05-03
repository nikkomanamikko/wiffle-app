import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";

const WIFFLE_LOCAL_STORAGE_KEY = "wiffle-app-state-v1";
const WIFFLE_SHARED_STATE_ENDPOINT = "/api/wiffle-state";
const WIFFLE_SHARED_STATE_POLL_MS = 5000;

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

    const localRaw = window.localStorage.getItem(WIFFLE_LOCAL_STORAGE_KEY);
    const localState = localRaw ? JSON.parse(localRaw) : null;
    const localSavedAt = savedAtTime(localState);
    const sharedSavedAt = savedAtTime(sharedState);

    if (!localState || sharedSavedAt > localSavedAt) {
      window.localStorage.setItem(WIFFLE_LOCAL_STORAGE_KEY, JSON.stringify(sharedState));
    }
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

function startSharedStatePolling() {
  window.setInterval(async () => {
    try {
      const response = await fetch(WIFFLE_SHARED_STATE_ENDPOINT, { cache: "no-store" });
      if (!response.ok) return;
      const sharedState = await response.json();
      if (!sharedState || typeof sharedState !== "object") return;

      const sharedSavedAt = savedAtTime(sharedState);
      const baseSavedAt = window.__WIFFLE_SYNC_BASE_SAVED_AT ? new Date(window.__WIFFLE_SYNC_BASE_SAVED_AT).getTime() : 0;
      if (sharedSavedAt <= baseSavedAt) return;

      window.localStorage.setItem(WIFFLE_LOCAL_STORAGE_KEY, JSON.stringify(sharedState));
      window.__WIFFLE_SYNC_BASE_SAVED_AT = sharedState.savedAt || "";
      window.location.reload();
    } catch (error) {
      // The API is optional during static preview, so polling failures stay quiet.
    }
  }, WIFFLE_SHARED_STATE_POLL_MS);
}

await syncNewestSharedStateBeforeRender();

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

startSharedStatePolling();
