// Entry do widget fortuna-bar — overrides standalone vivem AQUI (o componente
// JackpotTickerBarType1.tsx permanece cópia fiel do app; ver header dele).
import { createRoot } from "react-dom/client";
import { dispatch } from "use-bus";
import JackpotTickerBarType1 from "./JackpotTickerBarType1";
import { watchVersion, deadmanReload } from "../_shared/failsafe";

// ponte SSE (afiliados, mesma origem, pública) -> event-bus: ticker + winner
// (PAGOU real). O server reenvia o último ticker ao conectar (seed instantâneo,
// sem poll). Quedas transitórias o EventSource reconecta sozinho; os dois casos
// que ele NÃO cobre a gente cobre aqui: falha fatal (resposta não-2xx/content-type
// errado → readyState CLOSED, o browser desiste de vez) → recria com backoff
// (1s→30s, reseta quando chega frame); conexão zumbi (queda silenciosa, sem evento
// de erro) → watchdog de 60s sem frame força a recriação. Em dev: kp-widget dev
// --api <url> proxya /api pro afiliados.
const SSE_URL = "/api/widgets/jackpot/stream";
const RETRY_BASE_MS = 1000;
const RETRY_MAX_MS = 30000;
const STALL_MS = 60000;
function bridge() {
  let es: EventSource;
  let retryMs = RETRY_BASE_MS;
  let stall: ReturnType<typeof setTimeout>;
  const { alive } = deadmanReload(); // morto por >100s apesar do reconnect → fadeout+reload
  const reconnect = () => {
    try { es.close(); } catch (_) {}
    clearTimeout(stall);
    setTimeout(connect, retryMs);
    retryMs = Math.min(retryMs * 2, RETRY_MAX_MS);
  };
  const arm = () => { clearTimeout(stall); stall = setTimeout(reconnect, STALL_MS); };
  const connect = () => {
    es = new EventSource(SSE_URL);
    arm();
    es.onmessage = (ev: MessageEvent) => {
      retryMs = RETRY_BASE_MS; arm(); alive();
      try {
        const d = JSON.parse(ev.data);
        if (d.type === "jackpot_ticker") dispatch({ type: "jackpot:ticker", payload: d });
        else if (d.type === "jackpot_winner") dispatch({ type: "jackpot:winner", payload: d });
      } catch (_) {}
    };
    es.onerror = () => { if (es.readyState === EventSource.CLOSED) reconnect(); };
  };
  connect();
}
bridge();
watchVersion(); // reload (fadeout) quando o admin trocar/mandar recarregar este widget

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
