// Entry do widget arena-bar — overrides standalone vivem AQUI (o componente
// ArenaButtonType1.tsx permanece cópia fiel do app; ver header dele).
import { createRoot } from "react-dom/client";
import { dispatch } from "use-bus";
import ArenaButtonType1 from "./ArenaButtonType1";

// Stage do widget: fundo transparente (overlay) e MESMO tratamento de tamanho/
// posição do fortuna-bar — barra 227×46 (altura pinada via --bar-h no
// .module.scss) e padding idêntico ao do fortuna (8px topo/baixo + 10px à
// esquerda), pra os dois overlays alinharem 1:1 quando empilhados no OBS.
// O posicionamento dos TEXTOS é o original do componente (slots centralizados).
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

// Fade-in SÓ com tudo renderizado: 1ª carga de dados liquidada (onReady do
// componente — o billboard tem textos fixos, então API fora não trava o reveal)
// + fontes carregadas + todas as imagens decodificadas.
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

// Gatilho manual de estado (dev/console): __arenaForce("final") trava a reta
// final, ("cycle") o billboard; (null) volta ao Auto (bus arena:dev-force).
(window as any).__arenaForce = (state: string | null = null) =>
  dispatch({ type: "arena:dev-force", payload: state });

createRoot(root).render(<ArenaButtonType1 onReady={reveal} />);
