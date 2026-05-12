import { getStore } from "@netlify/blobs";

const STORE_NAME = "wiffle-app";
const STATE_KEY = "state";
const LIVE_EVENTS_KEY = "live-events";
const LIVE_EVENTS_INDEX_KEY = "live-events-index";

function liveEventsKey(gameId = "") {
  const safeGameId = String(gameId || "main").replace(/[^a-z0-9-_]+/gi, "-").slice(0, 80) || "main";
  return safeGameId === "main" ? LIVE_EVENTS_KEY : `${LIVE_EVENTS_KEY}-${safeGameId}`;
}

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
  const liveGameId = url.searchParams.get("gameId") || "main";

  if (isLiveEventsRequest) {
    if (url.searchParams.get("list") === "1") {
      const index = await store.get(LIVE_EVENTS_INDEX_KEY, { type: "json", consistency: "strong" });
      return jsonResponse(200, Array.isArray(index?.games) ? index : { games: [] });
    }

    if (request.method === "GET") {
      const liveEvents = await store.get(liveEventsKey(liveGameId), { type: "json", consistency: "strong" });
      return jsonResponse(200, liveEvents || { id: liveGameId, events: [], updatedAt: "" });
    }

    if (request.method === "DELETE") {
      if (url.searchParams.get("all") === "1") {
        const index = await store.get(LIVE_EVENTS_INDEX_KEY, { type: "json", consistency: "strong" }) || { games: [] };
        await Promise.all((index.games || []).map((game) => store.delete(liveEventsKey(game.id))));
        await store.delete(LIVE_EVENTS_KEY);
        await store.setJSON(LIVE_EVENTS_INDEX_KEY, { games: [], updatedAt: new Date().toISOString() });
        return jsonResponse(200, { ok: true, deleted: true });
      }
      await store.delete(liveEventsKey(liveGameId));
      const index = await store.get(LIVE_EVENTS_INDEX_KEY, { type: "json", consistency: "strong" }) || { games: [] };
      await store.setJSON(LIVE_EVENTS_INDEX_KEY, { games: (index.games || []).filter((game) => game.id !== liveGameId), updatedAt: new Date().toISOString() });
      return jsonResponse(200, { ok: true, deleted: true });
    }

    if (request.method === "POST") {
      try {
        const payload = await request.json();
        const operation = payload?.operation || "append";
        const current = await store.get(liveEventsKey(liveGameId), { type: "json", consistency: "strong" }) || { id: liveGameId, events: [], updatedAt: "" };
        let events = Array.isArray(current.events) ? current.events : [];
        let setupSnapshot = current.setupSnapshot || null;
        let status = current.status || "";
        let summary = current.summary || null;

        if (operation === "replace") {
          const incomingEvents = Array.isArray(payload.events) ? payload.events : [];
          events = !payload.allowShorter && incomingEvents.length < events.length ? events : incomingEvents;
          setupSnapshot = payload.setupSnapshot || setupSnapshot;
          status = payload.status || "live";
          summary = payload.summary || summary;
        } else if (operation === "clear") {
          events = [];
          setupSnapshot = null;
          status = "cleared";
          summary = null;
        } else if (operation === "cancel") {
          events = [];
          setupSnapshot = null;
          status = "cancelled";
          summary = payload.summary || summary;
        } else {
          const incomingEvents = Array.isArray(payload.events) ? payload.events : payload.event ? [payload.event] : [];
          const existingIds = new Set(events.map((event) => event?.id).filter(Boolean));
          incomingEvents.forEach((event) => {
            if (!event || typeof event !== "object") return;
            if (event.id && existingIds.has(event.id)) return;
            events.push(event);
            if (event.id) existingIds.add(event.id);
          });
          setupSnapshot = payload.setupSnapshot || setupSnapshot;
          status = payload.status || status || "live";
          summary = payload.summary || summary;
        }

        const nextLiveEvents = { id: liveGameId, events, setupSnapshot, status, summary, updatedAt: new Date().toISOString() };
        await store.setJSON(liveEventsKey(liveGameId), nextLiveEvents);
        const index = await store.get(LIVE_EVENTS_INDEX_KEY, { type: "json", consistency: "strong" }) || { games: [] };
        const label = payload?.gameLabel || setupSnapshot?.gameLabel || `${setupSnapshot?.awayTeam || "Away"} vs ${setupSnapshot?.homeTeam || "Home"}`;
        const nextSummary = {
          id: liveGameId,
          label,
          awayTeam: setupSnapshot?.awayTeam || "",
          homeTeam: setupSnapshot?.homeTeam || "",
          status,
          summary,
          eventCount: events.length,
          updatedAt: nextLiveEvents.updatedAt,
        };
        await store.setJSON(LIVE_EVENTS_INDEX_KEY, {
          games: [nextSummary, ...(index.games || []).filter((game) => game.id !== liveGameId)].slice(0, 24),
          updatedAt: nextLiveEvents.updatedAt,
        });
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
      const forceSave = request.headers.get("x-wiffle-force-save") === "1";

      if (!forceSave && currentState && currentSavedAt > baseSavedAt) {
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
