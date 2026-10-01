const http = require("http");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "public");
const port = process.env.PORT || 3000;

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
  ".ico": "image/x-icon"
};

const server = http.createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, {"Content-Type": "text/plain"});
    return res.end("ok");
  }

  const raw = decodeURIComponent((req.url || "/").split("?")[0]);
  const safe = raw === "/" ? "/index.html" : raw;
  const filePath = path.normalize(path.join(root, safe));

  if (!filePath.startsWith(root)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }

  fs.stat(filePath, (err, stat) => {
    const target = !err && stat.isFile() ? filePath : path.join(root, "index.html");
    fs.readFile(target, (readErr, data) => {
      if (readErr) {
        res.writeHead(500);
        return res.end("Server error");
      }
      res.writeHead(200, {
        "Content-Type": types[path.extname(target)] || "application/octet-stream",
        "Cache-Control": target.endsWith("index.html") ? "no-cache" : "public, max-age=3600"
      });
      res.end(data);
    });
  });
});

server.listen(port, "0.0.0.0", () => {
  console.log(`JOBBY site listening on ${port}`);
});
