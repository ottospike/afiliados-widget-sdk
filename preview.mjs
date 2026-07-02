// previewDist() — serve uma dist JÁ BUILDADA como arquivo estático puro, pra olhar/testar
// no navegador ANTES de subir (upload/publish). Sem dependência nova: só http/fs nativos.
// Mesma semântica de serve dos dois consumidores reais da dist (o server.ts da plataforma
// widgets e a rota /api/widgets/dist/<id>/<path> do afiliados) — o que funciona aqui deve
// funcionar lá, MENOS os endpoints de dados (/__up, /api/widgets/*), que só existem quando
// a dist está de fato hospedada atrás do server/app real — a página carrega, os assets
// resolvem, mas fetch/EventSource pra dado ao vivo vão falhar (esperado, sem servidor real).
import http from "http";
import fs from "fs";
import path from "path";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ico": "image/x-icon",
};

function safeRel(p) {
  return path.normalize(p).replace(/^(\.\.[/\\])+/, "").replace(/^[/\\]+/, "");
}

export function previewDist(distDir, { port = 4173 } = {}) {
  const server = http.createServer((req, res) => {
    const u = new URL(req.url || "/", "http://x");
    const rel = safeRel(decodeURIComponent(u.pathname)) || "index.html";
    const abs = path.join(distDir, rel.endsWith("/") || rel === "" ? rel + "index.html" : rel);
    fs.readFile(abs, (err, buf) => {
      if (err) {
        res.writeHead(404, { "Content-Type": "text/plain" });
        return res.end("not found");
      }
      res.writeHead(200, { "Content-Type": MIME[path.extname(abs).toLowerCase()] || "application/octet-stream" });
      res.end(buf);
    });
  });
  return new Promise((resolve) => {
    server.listen(port, () => resolve(server));
  });
}
