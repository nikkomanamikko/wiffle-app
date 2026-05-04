import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "vite";

const stateDir = path.resolve(".data");
const stateFile = path.join(stateDir, "wiffle-state.json");
const liveEventsFile = path.join(stateDir, "wiffle-live-events.json");

function sharedWiffleStatePlugin() {
  return {
    name: "shared-wiffle-state",
    configureServer(server) {
      function handleSharedStateRequest(req, res) {
        res.setHeader("Content-Type", "application/json");
        const isLiveEventsRequest = (req.url || "").includes("liveEvents=1");
        const activeStateFile = isLiveEventsRequest ? liveEventsFile : stateFile;

        if (req.method === "GET") {
          if (!fs.existsSync(activeStateFile)) {
            res.end(JSON.stringify(isLiveEventsRequest ? { events: [], updatedAt: "" } : null));
            return;
          }
          res.end(fs.readFileSync(activeStateFile, "utf8"));
          return;
        }

        if (req.method === "DELETE") {
          if (fs.existsSync(activeStateFile)) fs.unlinkSync(activeStateFile);
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
                const current = fs.existsSync(liveEventsFile) ? JSON.parse(fs.readFileSync(liveEventsFile, "utf8")) : { events: [], updatedAt: "" };
                let events = Array.isArray(current.events) ? current.events : [];
                let setupSnapshot = current.setupSnapshot || null;
                let status = current.status || "";
                if (operation === "replace") {
                  events = Array.isArray(parsed.events) ? parsed.events : [];
                  setupSnapshot = parsed.setupSnapshot || setupSnapshot;
                  status = parsed.status || "live";
                } else if (operation === "clear") {
                  events = [];
                  setupSnapshot = null;
                  status = "cleared";
                } else if (operation === "cancel") {
                  events = [];
                  setupSnapshot = null;
                  status = "cancelled";
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
                }
                const nextLiveEvents = { events, setupSnapshot, status, updatedAt: new Date().toISOString() };
                fs.mkdirSync(stateDir, { recursive: true });
                fs.writeFileSync(liveEventsFile, JSON.stringify(nextLiveEvents, null, 2));
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
              fs.writeFileSync(stateFile, JSON.stringify(parsed, null, 2));
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
