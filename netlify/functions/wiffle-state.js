import { getStore } from "@netlify/blobs";

const STORE_NAME = "wiffle-app";
const STATE_KEY = "state";

function jsonResponse(status, value) {
  return Response.json(value, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function getSavedAtTime(state) {
  const savedAt = state?.savedAt ? new Date(state.savedAt).getTime() : 0;
  return Number.isFinite(savedAt) ? savedAt : 0;
}

export default async function handler(request) {
  const store = getStore(STORE_NAME);

  if (request.method === "GET") {
    const state = await store.get(STATE_KEY, { type: "json", consistency: "strong" });
    return jsonResponse(200, state || null);
  }

  if (request.method === "POST") {
    try {
      const nextState = await request.json();
      if (!nextState || typeof nextState !== "object") {
        return jsonResponse(400, { ok: false, error: "Invalid app state." });
      }
      if (!nextState.savedAt) nextState.savedAt = new Date().toISOString();

      const currentState = await store.get(STATE_KEY, { type: "json", consistency: "strong" });
      const currentSavedAt = getSavedAtTime(currentState);
      const nextSavedAt = getSavedAtTime(nextState);

      if (currentState && currentSavedAt > nextSavedAt) {
        return jsonResponse(409, {
          ok: false,
          error: "Shared state is newer than this browser state.",
          state: currentState,
        });
      }

      await store.setJSON(STATE_KEY, nextState);
      return jsonResponse(200, { ok: true, savedAt: nextState.savedAt || "" });
    } catch (error) {
      return jsonResponse(400, { ok: false, error: error?.message || "Invalid JSON." });
    }
  }

  return jsonResponse(405, { ok: false, error: "Method not allowed." });
}
