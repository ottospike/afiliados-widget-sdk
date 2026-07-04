import { createRoot } from "react-dom/client";

// base do proxy = path do módulo + /__up (derivada em runtime via location.pathname, NUNCA
// hardcoded) — assim a MESMA dist funciona em qualquer path: builda uma vez, sobe com
// qualquer id. Use BASE pra falar com o upstream configurado no widget (proxy no server).
const BASE = location.pathname.replace(/\/(index\.html)?$/, "") + "/__up";

// ── REVEAL-ON-READY (obrigatório — regra da skill kp-widget-platform) ────────
// Widget é GRÁFICO de overlay: nasce INVISÍVEL (opacity:0, SEM transition — senão
// o default 1 anima um fade-out do estado vazio) e só entra em cena (fade-in) com
// TUDO renderizado — 1º dado real + fontes carregadas + imagens decodificadas.
// Sem dado → permanece invisível (overlay limpo, sem placeholder).
const style = document.createElement("style");
style.textContent =
  "html,body{margin:0;background:transparent;overflow:hidden}" +
  "#root{opacity:0;pointer-events:none}";
document.head.appendChild(style);

const root = document.getElementById("root")!;
async function reveal() {
  try {
    await document.fonts.ready;
    await Promise.all(
      Array.from(document.images).map((img) => img.decode().catch(() => {}))
    );
  } catch (_) {}
  root.style.transition = "opacity .35s ease";
  requestAnimationFrame(() => {
    root.style.opacity = "1";
  });
}

function App() {
  // Chame reveal() UMA vez quando o PRIMEIRO dado real chegar (fetch/WS via BASE) —
  // ex.: prop onReady do componente. Este placeholder não tem dado, então revela
  // direto só pra demonstrar o padrão.
  reveal();
  return <div>Widget novo — edite main.tsx (proxy em {BASE}).</div>;
}

createRoot(root).render(<App />);
