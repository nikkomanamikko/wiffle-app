import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "vite";

const stateDir = path.resolve(".data");
const stateFile = path.join(stateDir, "wiffle-state.json");
const liveEventsFile = path.join(stateDir, "wiffle-live-events.json");
const liveEventsIndexFile = path.join(stateDir, "wiffle-live-events-index.json");

function liveEventsKey(gameId = "") {
  const safeGameId = String(gameId || "main").replace(/[^a-z0-9-_]+/gi, "-").slice(0, 80) || "main";
  return safeGameId === "main" ? liveEventsFile : path.join(stateDir, `wiffle-live-events-${safeGameId}.json`);
}

function readJsonFile(filePath, fallbackValue) {
  if (!fs.existsSync(filePath)) return fallbackValue;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJsonFile(filePath, value) {
  fs.mkdirSync(stateDir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

function sharedWiffleStatePlugin() {
  return {
    name: "shared-wiffle-state",
    configureServer(server) {
      function handleSharedStateRequest(req, res) {
        res.setHeader("Content-Type", "application/json");
        const url = new URL(req.url || "/", "http://localhost");
        const isLiveEventsRequest = url.searchParams.get("liveEvents") === "1";
        const liveGameId = url.searchParams.get("gameId") || "main";
        const activeLiveEventsFile = liveEventsKey(liveGameId);

        if (req.method === "GET") {
          if (isLiveEventsRequest && url.searchParams.get("list") === "1") {
            res.end(JSON.stringify(readJsonFile(liveEventsIndexFile, { games: [] })));
            return;
          }
          if (isLiveEventsRequest) {
            res.end(JSON.stringify(readJsonFile(activeLiveEventsFile, { id: liveGameId, events: [], updatedAt: "" })));
            return;
          }
          if (!fs.existsSync(stateFile)) {
            res.end(JSON.stringify(null));
            return;
          }
          res.end(fs.readFileSync(stateFile, "utf8"));
          return;
        }

        if (req.method === "DELETE") {
          if (isLiveEventsRequest) {
            if (fs.existsSync(activeLiveEventsFile)) fs.unlinkSync(activeLiveEventsFile);
            const index = readJsonFile(liveEventsIndexFile, { games: [] });
            writeJsonFile(liveEventsIndexFile, {
              games: (index.games || []).filter((game) => game.id !== liveGameId),
              updatedAt: new Date().toISOString(),
            });
            res.end(JSON.stringify({ ok: true, deleted: true }));
            return;
          }
          if (fs.existsSync(stateFile)) fs.unlinkSync(stateFile);
          res.end(JSON.stringify({ ok: true, deleted: true }));
          return;
        }

        if (req.method === "POST") {
          let body = "";
          req.on("data", (chunk) => {
            body += chunk;
          });
          req.on("end", () => {
            try {
              const parsed = JSON.parse(body || "null");
              if (isLiveEventsRequest) {
                const operation = parsed?.operation || "append";
                const current = readJsonFile(activeLiveEventsFile, { id: liveGameId, events: [], updatedAt: "" });
                let events = Array.isArray(current.events) ? current.events : [];
                let setupSnapshot = current.setupSnapshot || null;
                let status = current.status || "";
                let summary = current.summary || null;
                if (operation === "replace") {
                  events = Array.isArray(parsed.events) ? parsed.events : [];
                  setupSnapshot = parsed.setupSnapshot || setupSnapshot;
                  status = parsed.status || "live";
                  summary = parsed.summary || summary;
                } else if (operation === "clear") {
                  events = [];
                  setupSnapshot = null;
                  status = "cleared";
                  summary = null;
                } else if (operation === "cancel") {
                  events = [];
                  setupSnapshot = null;
                  status = "cancelled";
                  summary = parsed.summary || summary;
                } else {
                  const incomingEvents = Array.isArray(parsed.events) ? parsed.events : parsed?.event ? [parsed.event] : [];
                  const existingIds = new Set(events.map((event) => event?.id).filter(Boolean));
                  incomingEvents.forEach((event) => {
                    if (!event || typeof event !== "object") return;
                    if (event.id && existingIds.has(event.id)) return;
                    events.push(event);
                    if (event.id) existingIds.add(event.id);
                  });
                  setupSnapshot = parsed.setupSnapshot || setupSnapshot;
                  status = parsed.status || status || "live";
                  summary = parsed.summary || summary;
                }
                const nextLiveEvents = { id: liveGameId, events, setupSnapshot, status, summary, updatedAt: new Date().toISOString() };
                writeJsonFile(activeLiveEventsFile, nextLiveEvents);
                const index = readJsonFile(liveEventsIndexFile, { games: [] });
                const label = parsed?.gameLabel || setupSnapshot?.gameLabel || `${setupSnapshot?.awayTeam || "Away"} vs ${setupSnapshot?.homeTeam || "Home"}`;
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
                writeJsonFile(liveEventsIndexFile, {
                  games: [nextSummary, ...(index.games || []).filter((game) => game.id !== liveGameId)].slice(0, 24),
                  updatedAt: nextLiveEvents.updatedAt,
                });
                res.end(JSON.stringify({ ok: true, eventCount: events.length, updatedAt: nextLiveEvents.updatedAt }));
                return;
              }

              if (!parsed || typeof parsed !== "object") {
                res.statusCode = 400;
                res.end(JSON.stringify({ ok: false, error: "Invalid app state." }));
                return;
              }
              if (!parsed.savedAt) parsed.savedAt = new Date().toISOString();
              const currentState = fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile, "utf8")) : null;
              const currentSavedAt = currentState?.savedAt ? new Date(currentState.savedAt).getTime() : 0;
              const baseSavedAt = req.headers["x-wiffle-base-saved-at"] ? new Date(String(req.headers["x-wiffle-base-saved-at"])).getTime() : 0;
              const forceSave = req.headers["x-wiffle-force-save"] === "1";
              if (!forceSave && currentSavedAt > baseSavedAt) {
                res.statusCode = 409;
                res.end(JSON.stringify({ ok: false, error: "Shared state is newer than this browser state.", state: currentState }));
                return;
              }
              fs.mkdirSync(stateDir, { recursive: true });
              writeJsonFile(stateFile, parsed);
              res.end(JSON.stringify({ ok: true }));
            } catch (error) {
              res.statusCode = 400;
              res.end(JSON.stringify({ ok: false, error: "Invalid JSON" }));
            }
          });
          return;
        }

        res.statusCode = 405;
        res.end(JSON.stringify({ ok: false, error: "Method not allowed" }));
      }

      server.middlewares.use("/api/wiffle-state", handleSharedStateRequest);
      server.middlewares.use("/.netlify/functions/wiffle-state", handleSharedStateRequest);
    },
  };
}

export default defineConfig({
  plugins: [sharedWiffleStatePlugin(), react(), tailwindcss()],
  server: {
    watch: {
      ignored: ["**/.data/**"],
    },
  },
});
