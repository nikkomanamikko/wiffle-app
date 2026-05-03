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

  if (request.method === "DELETE") {
    await store.delete(STATE_KEY);
    return jsonResponse(200, { ok: true, deleted: true });
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
      const baseSavedAtHeader = request.headers.get("x-wiffle-base-saved-at");
      const baseSavedAt = baseSavedAtHeader ? new Date(baseSavedAtHeader).getTime() : 0;

      if (currentState && currentSavedAt > baseSavedAt) {
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
