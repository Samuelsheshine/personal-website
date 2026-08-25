const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const distDir = path.resolve(__dirname, "..", "dist");
const port = Number.parseInt(process.env.PORT || "4173", 10);
const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".xml": "application/xml; charset=utf-8",
};

function resolveRequestPath(pathname) {
  const decodedPath = decodeURIComponent(pathname);
  const relativePath = decodedPath.replace(/^\/+/, "");
  let candidate = path.resolve(distDir, relativePath || "index.html");

  if (!candidate.toLowerCase().startsWith(distDir.toLowerCase())) return null;

  if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
    candidate = path.join(candidate, "index.html");
  }

  if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;

  if (/^blog\/[^/]+\/?$/u.test(relativePath)) {
    return path.join(distDir, "blog", "post", "index.html");
  }

  const projectRoute = relativePath.match(/^(?:(en|ja)\/)?projects\/[^/]+\/?$/u);
  if (projectRoute) {
    return path.join(
      distDir,
      ...(projectRoute[1] ? [projectRoute[1]] : []),
      "projects",
      "project",
      "index.html",
    );
  }

  return path.join(distDir, "404.html");
}

const server = http.createServer((request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
    const filePath = resolveRequestPath(url.pathname);

    if (!filePath || !fs.existsSync(filePath)) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }

    const isFallback = filePath.endsWith(`${path.sep}404.html`);
    response.writeHead(isFallback ? 404 : 200, {
      "Content-Type": mimeTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream",
      "Cache-Control": filePath.endsWith("firebase-config.js") ? "no-store" : "no-cache",
    });
    fs.createReadStream(filePath).pipe(response);
  } catch (error) {
    response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    response.end(`Server error: ${error.message}`);
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Local preview: http://localhost:${port}`);
});
