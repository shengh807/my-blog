// serve.js
// -----------------------------------------------------------------------------
// docs/ 폴더를 로컬에서 미리보기 위한 아주 작은 정적 파일 서버입니다.
// 실행: npm run preview  (내부적으로 build 후 이 스크립트를 실행합니다)
// -----------------------------------------------------------------------------
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DOCS_DIR = path.resolve(__dirname, "..", "docs");
const PORT = process.env.PORT || 4000;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".gif": "image/gif",
  ".ico": "image/x-icon"
};

function resolvePath(urlPath) {
  let p = decodeURIComponent(urlPath.split("?")[0]);
  if (p.endsWith("/")) p += "index.html";

  let full = path.join(DOCS_DIR, p);

  if (!full.startsWith(DOCS_DIR)) return null; // 경로 탈출 방지

  if (fs.existsSync(full) && fs.statSync(full).isDirectory()) {
    full = path.join(full, "index.html");
  }

  if (!fs.existsSync(full)) {
    // 확장자가 없으면 .html을 붙여본다
    if (!path.extname(full) && fs.existsSync(full + ".html")) {
      full += ".html";
    } else {
      return null;
    }
  }

  return full;
}

const server = http.createServer((req, res) => {
  const filePath = resolvePath(req.url);

  if (!filePath) {
    const notFound = path.join(DOCS_DIR, "404.html");
    res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
    res.end(fs.existsSync(notFound) ? fs.readFileSync(notFound) : "404 Not Found");
    return;
  }

  const ext = path.extname(filePath);
  res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
  fs.createReadStream(filePath).pipe(res);
});

server.listen(PORT, () => {
  console.log(`로컬 미리보기: http://localhost:${PORT}`);
  console.log("종료하려면 Ctrl+C 를 누르세요.");
});
