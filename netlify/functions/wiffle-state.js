import { getStore } from "@netlify/blobs";

const STORE_NAME = "wiffle-app";
const STATE_KEY = "state";
const LIVE_EVENTS_KEY = "live-events";

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
  const url = new URL(request.url);
  const isLiveEventsRequest = url.searchParams.get("liveEvents") === "1";

  if (isLiveEventsRequest) {
    if (request.method === "GET") {
      const liveEvents = await store.get(LIVE_EVENTS_KEY, { type: "json", consistency: "strong" });
      return jsonResponse(200, liveEvents || { events: [], updatedAt: "" });
    }

    if (request.method === "DELETE") {
      await store.delete(LIVE_EVENTS_KEY);
      return jsonResponse(200, { ok: true, deleted: true });
    }

    if (request.method === "POST") {
      try {
        const payload = await request.json();
        const operation = payload?.operation || "append";
        const current = await store.get(LIVE_EVENTS_KEY, { type: "json", consistency: "strong" }) || { events: [], updatedAt: "" };
        let events = Array.isArray(current.events) ? current.events : [];

        if (operation === "replace") {
          events = Array.isArray(payload.events) ? payload.events : [];
        } else if (operation === "clear") {
          events = [];
        } else {
          const incomingEvents = Array.isArray(payload.events) ? payload.events : payload.event ? [payload.event] : [];
          const existingIds = new Set(events.map((event) => event?.id).filter(Boolean));
          incomingEvents.forEach((event) => {
            if (!event || typeof event !== "object") return;
            if (event.id && existingIds.has(event.id)) return;
            events.push(event);
            if (event.id) existingIds.add(event.id);
          });
        }

        const nextLiveEvents = { events, updatedAt: new Date().toISOString() };
        await store.setJSON(LIVE_EVENTS_KEY, nextLiveEvents);
        return jsonResponse(200, { ok: true, eventCount: events.length, updatedAt: nextLiveEvents.updatedAt });
      } catch (error) {
        return jsonResponse(400, { ok: false, error: error?.message || "Invalid JSON." });
      }
    }

    return jsonResponse(405, { ok: false, error: "Method not allowed." });
  }

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
