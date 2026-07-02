#!/usr/bin/env node
// kp-widget — CLI do SDK: scaffold, build, pack e publish de widgets standalone da
// plataforma KingPanda (contrato: self-contido, proxy via location.pathname + /__up).
import { parseArgs } from "node:util";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { buildModule, writeManifest } from "./build.mjs";
import { packModule } from "./pack.mjs";
import { previewDist } from "./preview.mjs";

const SDK_ROOT = path.dirname(fileURLToPath(import.meta.url));
const CWD = process.cwd();

function usage() {
  console.log(`kp-widget <comando> <id> [opções]

Comandos:
  create <id>                          scaffold de um novo widget em ./<id>
  build <id> [--src dir] [--out dir]   builda ./<id> (ou --src) -> dist/<id> (ou --out, path exato)
  pack <id> [--dir dir]                zipa a dist -> <id>.zip (dist/<id> por padrão, ou --dir, path exato)
  preview <id> [--dir dir] [--port n]  serve a dist localmente pra olhar/testar ANTES de subir
                                        (só estático — endpoints de dado ao vivo não existem
                                        sem o server/app real por trás, é esperado falhar)
  publish <id> --url <server> --password <senha> [--dir dir]
                                        empacota + envia a dist pro /__admin/widgets do server
                                        (id publicado = <id> do comando, pode ser diferente do
                                        nome da pasta buildada — use --dir pra apontar pra ela)

Exemplos:
  kp-widget create meu-widget
  kp-widget build meu-widget
  kp-widget preview meu-widget
  kp-widget pack meu-widget
  kp-widget publish meu-widget --url https://seu-server.exemplo.com --password ***
`);
}

function cmdCreate(id) {
  const dest = path.join(CWD, id);
  if (fs.existsSync(dest)) { console.error(`✗ ${id}/ já existe.`); process.exit(1); }
  fs.mkdirSync(dest, { recursive: true });
  for (const f of ["index.html", "main.tsx"]) fs.copyFileSync(path.join(SDK_ROOT, "template", f), path.join(dest, f));
  console.log(`✓ criado ${id}/ (index.html + main.tsx)`);
  console.log(`  edite ${id}/main.tsx e rode: kp-widget build ${id}`);
}

async function cmdBuild(id, { src, out }) {
  const srcDir = path.join(CWD, src || id);
  const outDir = path.join(CWD, out || path.join("dist", id));
  if (!fs.existsSync(path.join(srcDir, "index.html"))) { console.error(`✗ ${srcDir}/index.html não encontrado.`); process.exit(1); }
  await buildModule({ srcDir, outDir });
  // widget.config.json (autoral, opcional, na pasta fonte) -> widget.json (manifesto de
  // saída na dist) — mesmo formato que o upload do CMS lê no modo "Automático".
  let cfg = {};
  try { cfg = JSON.parse(fs.readFileSync(path.join(srcDir, "widget.config.json"), "utf8")); } catch (_) {}
  writeManifest(outDir, { id, title: cfg.title || id, description: cfg.description || "", proxy: cfg.proxy });
  console.log(`✓ buildado ${id} -> ${path.relative(CWD, outDir)}`);
}

function cmdPack(id, { dir }) {
  const distDir = path.join(CWD, dir || path.join("dist", id));
  if (!fs.existsSync(path.join(distDir, "index.html"))) { console.error(`✗ ${distDir}/index.html não encontrado. Rode 'kp-widget build ${id}' antes.`); process.exit(1); }
  const buf = packModule(distDir);
  const out = path.join(CWD, `${id}.zip`);
  fs.writeFileSync(out, buf);
  console.log(`✓ ${id}.zip — ${(buf.length / 1024).toFixed(1)} KB`);
}

async function cmdPreview(id, { dir, port }) {
  const distDir = path.join(CWD, dir || path.join("dist", id));
  if (!fs.existsSync(path.join(distDir, "index.html"))) { console.error(`✗ ${distDir}/index.html não encontrado. Rode 'kp-widget build ${id}' antes.`); process.exit(1); }
  const p = port ? parseInt(port, 10) : 4173;
  await previewDist(distDir, { port: p });
  console.log(`✓ preview de '${id}' em http://localhost:${p}`);
  console.log(`  (só estático — fetch/EventSource pra dado ao vivo não respondem sem o server real)`);
  console.log(`  Ctrl+C pra parar.`);
}

async function cmdPublish(id, { dir, url, password }) {
  if (!url || !password) { console.error("✗ informe --url e --password"); process.exit(1); }
  const distDir = path.join(CWD, dir || path.join("dist", id));
  if (!fs.existsSync(path.join(distDir, "index.html"))) { console.error(`✗ ${distDir}/index.html não encontrado. Rode 'kp-widget build ${id}' antes.`); process.exit(1); }
  const buf = packModule(distDir);
  const r = await fetch(new URL("/__admin/widgets", url), {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-cms-password": password },
    body: JSON.stringify({ id, zip_base64: Buffer.from(buf).toString("base64") }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) { console.error(`✗ falhou (${r.status}): ${data.error || ""}`); process.exit(1); }
  console.log(`✓ publicado '${id}' em ${url}`);
}

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: { src: { type: "string" }, out: { type: "string" }, dir: { type: "string" }, port: { type: "string" }, url: { type: "string" }, password: { type: "string" } },
});
const [cmd, id] = positionals;

if (!cmd || cmd === "help" || cmd === "--help") { usage(); process.exit(0); }
if (!id) { usage(); process.exit(1); }

switch (cmd) {
  case "create": cmdCreate(id); break;
  case "build": await cmdBuild(id, values); break;
  case "pack": cmdPack(id, values); break;
  case "preview": await cmdPreview(id, values); break;
  case "publish": await cmdPublish(id, values); break;
  default: usage(); process.exit(1);
}
