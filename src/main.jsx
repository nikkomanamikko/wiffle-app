import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";

const WIFFLE_LOCAL_STORAGE_KEY = "wiffle-app-state-v1";
const WIFFLE_PENDING_SAVE_KEY = "wiffle-app-pending-save-v1";
const WIFFLE_SHARED_STATE_ENDPOINT = "/.netlify/functions/wiffle-state";
const DEVICE_SESSION_STATE_KEYS = [
  "events",
  "archivedFinalEventId",
  "expandedGameId",
  "activeSavedGameId",
  "activePage",
  "statsViewMode",
  "statsLeagueId",
  "statsSeasonYear",
  "statsSessionId",
  "statsPlayerFilter",
  "statsVsHitterFilter",
  "statsVsPitcherFilter",
  "statsVsScope",
  "leadersViewMode",
  "leadersLeagueId",
  "leadersSeasonYear",
  "selectedLeaderStats",
  "fieldImportSourceLeagueId",
  "selectedImportFieldIds",
  "setupAttempted",
  "matchupStatScopeIndex",
  "selectedLeagueTeamsSessionId",
  "copyScheduleTargetSessionId",
  "copyScheduleFirstWeekDate",
  "copySeasonSourceId",
  "copySeasonTargetId",
  "copySeasonFirstWeekDate",
  "activeScheduleCopyTool",
  "pendingCopyWeekId",
  "copyWeekOneWeekLater",
  "draftSessionId",
  "draftSelectedPlayer",
  "draftBidTeamId",
  "draftBidAmount",
  "draftTimerRemaining",
  "draftTimerRunning",
  "draftAwardError",
  "mockDraftMode",
  "mockDrafts",
  "draftStartedOverrides",
  "gameStarted",
  "setupEditingDuringGame",
];

function savedAtTime(state) {
  const value = state?.savedAt ? new Date(state.savedAt).getTime() : 0;
  return Number.isFinite(value) ? value : 0;
}

function mergeSharedStateForStartup(currentState, sharedState) {
  const nextState = { ...(currentState || {}), ...(sharedState || {}) };
  DEVICE_SESSION_STATE_KEYS.forEach((key) => {
    if (currentState && Object.prototype.hasOwnProperty.call(currentState, key)) nextState[key] = currentState[key];
    else delete nextState[key];
  });
  return nextState;
}

async function syncNewestSharedStateBeforeRender() {
  try {
    const response = await fetch(WIFFLE_SHARED_STATE_ENDPOINT, { cache: "no-store" });
    if (!response.ok) return;
    const sharedState = await response.json();
    const localRaw = window.localStorage.getItem(WIFFLE_LOCAL_STORAGE_KEY);
    const localState = localRaw ? JSON.parse(localRaw) : null;
    const pendingRaw = window.localStorage.getItem(WIFFLE_PENDING_SAVE_KEY);
    const pendingSave = pendingRaw ? JSON.parse(pendingRaw) : null;
    const localSavedAt = savedAtTime(localState);
    const sharedSavedAt = savedAtTime(sharedState);

    if (pendingSave?.savedAt && localState && localSavedAt > sharedSavedAt) {
      const saveResponse = await fetch(WIFFLE_SHARED_STATE_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Wiffle-Base-Saved-At": sharedState?.savedAt || "",
        },
        body: JSON.stringify(localState),
      });
      if (saveResponse.ok) {
        window.localStorage.removeItem(WIFFLE_PENDING_SAVE_KEY);
        window.__WIFFLE_SYNC_BASE_SAVED_AT = localState.savedAt || "";
        return;
      }
    }

    if (!sharedState || typeof sharedState !== "object") return;

    window.localStorage.setItem(WIFFLE_LOCAL_STORAGE_KEY, JSON.stringify(mergeSharedStateForStartup(localState, sharedState)));
    window.localStorage.removeItem(WIFFLE_PENDING_SAVE_KEY);
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
