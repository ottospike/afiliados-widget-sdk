// Entry do widget fortuna-bar — overrides standalone vivem AQUI (o componente
// JackpotTickerBarType1.tsx permanece cópia fiel do app; ver header dele).
import { createRoot } from "react-dom/client";
import { dispatch } from "use-bus";
import JackpotTickerBarType1 from "./JackpotTickerBarType1";

// base do proxy = path do módulo + /__up (derivada em runtime, contrato do SDK).
const BASE = location.pathname.replace(/\/(index\.html)?$/, "") + "/__up";

// ponte WS (autenticado, via relay) -> event-bus: ticker + winner (PAGOU real).
// 1 conexão pro widget inteiro; reconecta sozinha.
function bridge() {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  let ws: WebSocket;
  const connect = () => {
    ws = new WebSocket(proto + "://" + location.host + BASE + "/ws");
    ws.onmessage = (ev: MessageEvent) => {
      try {
        const d = JSON.parse(ev.data);
        if (d.type === "jackpot_ticker") dispatch({ type: "jackpot:ticker", payload: d });
        else if (d.type === "jackpot_winner") dispatch({ type: "jackpot:winner", payload: d });
      } catch (_) {}
    };
    ws.onclose = () => setTimeout(connect, 1500);
    ws.onerror = () => { try { ws.close(); } catch (_) {} };
  };
  connect();
}
bridge();

// Stage do widget: fundo transparente (overlay) e TAMANHO ORIGINAL da barra
// (227×46 — altura pinada via --bar-h no .module.scss). O padding do #root só
// acolhe os transbordos do martelo (esquerda e topo/baixo, ele é maior que a barra).
// REVEAL-ON-READY: #root nasce INVISÍVEL (opacity:0, SEM transition — senão o
// default 1 anima um fade-out do estado vazio) e só entra em cena via reveal().
// TAMANHO-ALVO = a caixa do ROTATOR que mescla (crossfade) as cenas de dado
// (jackpot/weekly/monthly): 360×90. A largura escala TUDO proporcionalmente
// (zoom); a altura da barra é ajustada via --widget-bar-h pra fechar 90
// renderizados. Ajuste fino: só trocar TARGET_W/TARGET_H abaixo.
const TARGET_W = 360;
const TARGET_H = 90;
const BASE_W = 227; // largura CSS da barra (design original)
const ZOOM = TARGET_W / BASE_W; // ≈1.586
const BAR_H = (TARGET_H / ZOOM).toFixed(2); // px CSS → 90 renderizados
const style = document.createElement("style");
style.textContent =
  "html,body{margin:0;background:transparent;overflow:hidden}" +
  `#root{width:${BASE_W}px;--widget-bar-h:${BAR_H}px;padding:8px 0 8px 10px;` +
  `box-sizing:content-box;zoom:${ZOOM};opacity:0;pointer-events:none}`;
document.head.appendChild(style);

// Fade-in SÓ com tudo renderizado: 1º dado real (onReady do componente) + fontes
// carregadas + todas as imagens decodificadas. Nada de placeholder "···", FOUT ou
// martelo pela metade no ar. Se o dado nunca vier, o overlay permanece invisível.
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

// Gatilho manual do PAGOU (dev/console): __jpWin(3) Grand, (2) Major, (1) Minor;
// __jpWin(tier, prize) fixa o valor. Mesmo caminho do evento real (bus).
let devWin = 0;
(window as any).__jpWin = (tier: number = 3, prize: number = 12345.67) =>
  dispatch({
    type: "jackpot:winner",
    payload: { win_id: `dev-${++devWin}`, top_tier_won: tier, prize_total: prize, first_name: "Dev" },
  });

createRoot(root).render(<JackpotTickerBarType1 onReady={reveal} />);
