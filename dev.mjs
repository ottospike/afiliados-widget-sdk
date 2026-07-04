// devModule() — servidor de DEV de UM widget (Vite dev server + HMR). Complementa o
// preview (dist estática): aqui é a FONTE que é servida, com hot reload, e o /__up do
// contrato é proxyado (HTTP + WS) pra um alvo real — tipicamente um módulo do server da
// plataforma (ex.: http://localhost:8787/jackpot/__up), que injeta o JWT. Assim o widget
// roda em dev com DADO VIVO sem expor credenciais no client.
//
// O widget deriva a base em runtime (location.pathname + "/__up"); no dev server o path
// é "/" → base "/__up", que cai neste proxy. Mesmo contrato, zero código condicional.
import { createServer } from "vite";
import react from "@vitejs/plugin-react";

export async function devModule({ srcDir, port = 5173, proxyTarget, apiTarget }) {
  const proxy = {};
  if (proxyTarget) {
    // "/__up/ws" -> `${proxyTarget}/ws` (http-proxy prefixa o path do target).
    proxy["/__up"] = {
      target: proxyTarget,
      changeOrigin: true,
      ws: true,
      rewrite: (p) => p.replace(/^\/__up/, ""),
    };
  }
  if (apiTarget) {
    // widgets do contrato afiliados (paths same-origin /api/widgets/...): proxya
    // /api pro afiliados (ex.: http://localhost:3000) → SSE/minigames vivos em dev.
    proxy["/api"] = { target: apiTarget, changeOrigin: true };
  }
  const server = await createServer({
    configFile: false,
    root: srcDir,
    base: "./",
    plugins: [react()],
    server: {
      port,
      strictPort: true,
      proxy: Object.keys(proxy).length ? proxy : undefined,
    },
  });
  await server.listen();
  return server;
}
