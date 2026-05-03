import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT) || 5173;
const distDir = path.join(__dirname, "dist");
const stateDir = process.env.WIFFLE_DATA_DIR ? path.resolve(process.env.WIFFLE_DATA_DIR) : path.join(__dirname, ".data");
const stateFile = path.join(stateDir, "wiffle-state.json");
const liveEventsFile = path.join(stateDir, "wiffle-live-events.json");

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

function sendJson(response, statusCode, value) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(value));
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 15_000_000) {
        reject(new Error("Request body is too large."));
        request.destroy();
      }
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

function getSavedAtTime(state) {
  const savedAt = state?.savedAt ? new Date(state.savedAt).getTime() : 0;
  return Number.isFinite(savedAt) ? savedAt : 0;
}

function readSharedState() {
  if (!fs.existsSync(stateFile)) return null;
  return JSON.parse(fs.readFileSync(stateFile, "utf8"));
}

function writeSharedState(state) {
  fs.mkdirSync(stateDir, { recursive: true });
  fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
}

function readLiveEvents() {
  if (!fs.existsSync(liveEventsFile)) return { events: [], updatedAt: "" };
  return JSON.parse(fs.readFileSync(liveEventsFile, "utf8"));
}

function writeLiveEvents(events) {
  const nextLiveEvents = { events, updatedAt: new Date().toISOString() };
  fs.mkdirSync(stateDir, { recursive: true });
  fs.writeFileSync(liveEventsFile, JSON.stringify(nextLiveEvents, null, 2));
  return nextLiveEvents;
}

async function handleStateApi(request, response) {
  const isLiveEventsRequest = (request.url || "").includes("liveEvents=1");

  if (isLiveEventsRequest) {
    if (request.method === "GET") {
      sendJson(response, 200, readLiveEvents());
      return;
    }

    if (request.method === "DELETE") {
      if (fs.existsSync(liveEventsFile)) fs.unlinkSync(liveEventsFile);
      sendJson(response, 200, { ok: true, deleted: true });
      return;
    }

    if (request.method === "POST") {
      try {
        const parsed = JSON.parse((await readRequestBody(request)) || "null");
        const operation = parsed?.operation || "append";
        let events = Array.isArray(readLiveEvents().events) ? readLiveEvents().events : [];
        if (operation === "replace") events = Array.isArray(parsed.events) ? parsed.events : [];
        else if (operation === "clear") events = [];
        else {
          const incomingEvents = Array.isArray(parsed?.events) ? parsed.events : parsed?.event ? [parsed.event] : [];
          const existingIds = new Set(events.map((event) => event?.id).filter(Boolean));
          incomingEvents.forEach((event) => {
            if (!event || typeof event !== "object") return;
            if (event.id && existingIds.has(event.id)) return;
            events.push(event);
            if (event.id) existingIds.add(event.id);
          });
        }
        const nextLiveEvents = writeLiveEvents(events);
        sendJson(response, 200, { ok: true, eventCount: events.length, updatedAt: nextLiveEvents.updatedAt });
      } catch (error) {
        sendJson(response, 400, { ok: false, error: error?.message || "Invalid JSON." });
      }
      return;
    }

    sendJson(response, 405, { ok: false, error: "Method not allowed." });
    return;
  }

  if (request.method === "GET") {
    sendJson(response, 200, readSharedState());
    return;
  }

  if (request.method === "DELETE") {
    if (fs.existsSync(stateFile)) fs.unlinkSync(stateFile);
    sendJson(response, 200, { ok: true, deleted: true });
    return;
  }

  if (request.method === "POST") {
    try {
      const parsed = JSON.parse((await readRequestBody(request)) || "null");
      if (!parsed || typeof parsed !== "object") {
        sendJson(response, 400, { ok: false, error: "Invalid app state." });
        return;
      }
      if (!parsed.savedAt) parsed.savedAt = new Date().toISOString();

      const currentState = readSharedState();
      const currentSavedAt = getSavedAtTime(currentState);
      const baseSavedAt = request.headers["x-wiffle-base-saved-at"] ? new Date(String(request.headers["x-wiffle-base-saved-at"])).getTime() : 0;

      if (currentSavedAt > baseSavedAt) {
        sendJson(response, 409, { ok: false, error: "Shared state is newer than this browser state.", state: currentState });
        return;
      }

      writeSharedState(parsed);
      sendJson(response, 200, { ok: true, savedAt: parsed.savedAt || "" });
    } catch (error) {
      sendJson(response, 400, { ok: false, error: error?.message || "Invalid JSON." });
    }
    return;
  }

  sendJson(response, 405, { ok: false, error: "Method not allowed." });
}

function safeStaticPath(urlPath) {
  const decodedPath = decodeURIComponent(urlPath.split("?")[0] || "/");
  const normalizedPath = path.normalize(decodedPath).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(distDir, normalizedPath === "/" ? "index.html" : normalizedPath);
  return filePath.startsWith(distDir) ? filePath : path.join(distDir, "index.html");
}

function serveStatic(request, response) {
  let filePath = safeStaticPath(request.url || "/");
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(distDir, "index.html");
  }

  if (!fs.existsSync(filePath)) {
    sendJson(response, 404, { ok: false, error: "Build not found. Run npm run build first." });
    return;
  }

  const extension = path.extname(filePath);
  response.writeHead(200, {
    "Content-Type": contentTypes[extension] || "application/octet-stream",
    "Cache-Control": filePath.endsWith("index.html") ? "no-store" : "public, max-age=31536000, immutable",
  });
  fs.createReadStream(filePath).pipe(response);
}

const server = http.createServer((request, response) => {
  if ((request.url || "").startsWith("/api/wiffle-state") || (request.url || "").startsWith("/.netlify/functions/wiffle-state")) {
    handleStateApi(request, response);
    return;
  }

  if ((request.url || "").startsWith("/api/health")) {
    sendJson(response, 200, { ok: true });
    return;
  }

  serveStatic(request, response);
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Wiffle app listening on http://0.0.0.0:${port}`);
  console.log(`Shared state file: ${stateFile}`);
});
