// packModule() — zipa uma dist já buildada (index.html + assets) num buffer .zip pronto pro
// upload em POST /__admin/widgets. Ponto ÚNICO desta lógica: usado pelo pack.mjs da raiz e
// pela CLI `kp-widget pack`/`publish`.
import { zipSync } from "fflate";
import fs from "fs";
import path from "path";

function collectFiles(dir, rel = "", acc = {}) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, ent.name);
    const r = rel ? `${rel}/${ent.name}` : ent.name; // caminhos do zip sempre com "/" (cross-platform)
    if (ent.isDirectory()) collectFiles(abs, r, acc);
    else acc[r] = new Uint8Array(fs.readFileSync(abs));
  }
  return acc;
}

export function packModule(distDir) {
  return zipSync(collectFiles(distDir), { level: 9 });
}
