// Minimal static file server for Ledgerly, used by start.sh when Python 3 isn't installed.
// Usage: node server.js <port> <host> <root>
"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");

const [port = "8765", host = "127.0.0.1", rootArg = path.join(__dirname, "app")] = process.argv.slice(2);
const root = path.resolve(rootArg);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
};

function send(res, status, file) {
  res.writeHead(status, {
    "Content-Type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream",
    "X-Content-Type-Options": "nosniff",
  });
  fs.createReadStream(file).pipe(res);
}

function notFound(res) {
  const page = path.join(root, "404.html");
  if (fs.existsSync(page)) return send(res, 404, page);
  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Not found");
}

const server = http.createServer((req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { Allow: "GET, HEAD" });
    return res.end();
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  } catch {
    res.writeHead(400);
    return res.end();
  }

  const target = path.resolve(root, "." + pathname);
  if (target !== root && !target.startsWith(root + path.sep)) return notFound(res);

  fs.stat(target, (err, stat) => {
    if (err) return notFound(res);
    if (stat.isDirectory()) {
      if (!pathname.endsWith("/")) {
        res.writeHead(301, { Location: pathname + "/" });
        return res.end();
      }
      const index = path.join(target, "index.html");
      return fs.existsSync(index) ? send(res, 200, index) : notFound(res);
    }
    send(res, 200, target);
  });
});

server.on("error", (err) => {
  console.error(err.message);
  process.exit(1);
});

server.listen(Number(port), host, () => console.log(`Serving ${root} at http://${host}:${port}/`));
