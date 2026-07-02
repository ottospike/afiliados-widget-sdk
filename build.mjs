// buildModule() — build de UM widget (Vite programático, base relativa). Ponto ÚNICO desta
// lógica: usado tanto pelo build.mjs da raiz (batch dos módulos embutidos) quanto pela CLI
// `kp-widget build` (módulos externos). Base relativa ("./") = a dist é portável (não amarra
// o id do build ao path onde ela é servida/upada) — a base do proxy (/<id>/__up) já é
// derivada em runtime via location.pathname em cada widget, não no build.
import { build } from "vite";
import react from "@vitejs/plugin-react";
import fs from "fs";
import path from "path";

export async function buildModule({ srcDir, outDir, shimPath, define, logLevel = "warn" }) {
  await build({
    root: srcDir,
    base: "./",
    plugins: [react()],
    resolve: shimPath ? { alias: { "next/link": shimPath } } : undefined,
    define,
    build: { outDir, emptyOutDir: true },
    logLevel,
  });
}

// manifesto que a dist carrega consigo (widget.json) — lido pelo upload do CMS no modo
// "Automático" pra auto-configurar título/proxy sem digitar nada.
export function writeManifest(outDir, manifest) {
  fs.writeFileSync(path.join(outDir, "widget.json"), JSON.stringify(manifest, null, 2));
}
