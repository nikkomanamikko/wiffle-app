import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "vite";

const stateDir = path.resolve(".data");
const stateFile = path.join(stateDir, "wiffle-state.json");

function sharedWiffleStatePlugin() {
  return {
    name: "shared-wiffle-state",
    configureServer(server) {
      function handleSharedStateRequest(req, res) {
        res.setHeader("Content-Type", "application/json");

        if (req.method === "GET") {
          if (!fs.existsSync(stateFile)) {
            res.end(JSON.stringify(null));
            return;
          }
          res.end(fs.readFileSync(stateFile, "utf8"));
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
              if (!parsed || typeof parsed !== "object") {
                res.statusCode = 400;
                res.end(JSON.stringify({ ok: false, error: "Invalid app state." }));
                return;
              }
              if (!parsed.savedAt) parsed.savedAt = new Date().toISOString();
              const currentState = fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile, "utf8")) : null;
              const currentSavedAt = currentState?.savedAt ? new Date(currentState.savedAt).getTime() : 0;
              const baseSavedAt = req.headers["x-wiffle-base-saved-at"] ? new Date(String(req.headers["x-wiffle-base-saved-at"])).getTime() : 0;
              if (currentSavedAt > baseSavedAt) {
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
