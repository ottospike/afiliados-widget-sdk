import { useEffect, useRef, useState, type CSSProperties } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import shapeFortuna from "./assets/shape-fortuna.svg";
import marteloImg from "./assets/icone-martelo.png";

// exportado pro reveal do Rotator pré-decodificar o martelo quando a cena inicial é a
// Fortuna (único asset raster da cena — o shape é SVG inline e as fontes vão no fonts.ready)
export const HAMMER_SRC = marteloImg;
import sgRegular from "./assets/fonts/SpecialGothic-Regular.woff2";
import sgSemiBold from "./assets/fonts/SpecialGothic-SemiBold.woff2";
import sgBold from "./assets/fonts/SpecialGothic-Bold.woff2";

gsap.registerPlugin(useGSAP);

/**
 * JackpotTicker — cena de jackpot do rotator, agora com o VISUAL do widget
 * `fortuna-bar` do afiliados-widget-sdk (barra dourada/navy centralizada + martelo
 * + PAGOU por tier), no MESMO box de 360×90 que a cena antiga ocupava (.rot-jp-wrap;
 * o override do Rotator força --bar-h: 90px). Bordas = pill do fortuna (999px).
 * Transporte/coreografia inalterados: SSE própria (/api/widgets/jackpot/stream),
 * count-up GSAP e timeline do PAGOU idênticos à versão anterior; `onReady` dispara
 * na 1ª vez que chega um valor real (gate do reveal-on-complete do rotator).
 * Valores de estilo = design 227×46 do fortuna-bar × 1.586 (o fator que leva a 360×90).
 * Fontes Special Gothic BUNDLADAS (antes só fallback) — sem FOUT no ar.
 */
const SSE_URL = "/api/widgets/jackpot/stream";

const TIER_NAME: Record<number, string> = { 1: "Minor", 2: "Major", 3: "Grand" };
const tierName = (t: number | string) => TIER_NAME[Number(t)] || "";

// Cor do estado pago por tier (fortuna-bar): gradiente LINEAR escuro à esquerda →
// cor vibrante do tier à direita. Minor verde, Major dourado, Grand rosa.
const WIN_GRAD: Record<number, string> = {
  1: "linear-gradient(110deg, #0a1f15 0%, #176245 42%, #2faf80 78%, #5ad8a8 100%)",
  2: "linear-gradient(110deg, #1a1505 0%, #7a5e1a 42%, #d2a838 78%, #f2cf6a 100%)",
  3: "linear-gradient(110deg, #1e0a16 0%, #8a2050 45%, #d65a92 80%, #f2a0c8 100%)",
};

const fmtBRL = (n: number | null | undefined) =>
  Number(n || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

/* ─────────────────────────────────────────────────────────────────────────
 * Estilos inline — visual do fortuna-bar em classes `jpt-` (o wrap .rot-jp-wrap
 * do Rotator continua mandando no tamanho: width/height 100% + --bar-h 90px).
 * ───────────────────────────────────────────────────────────────────────── */
const FONT_BODY = `"Special Gothic", "Aestetico", system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif`;
const CSS = `
@font-face { font-family: "Special Gothic"; src: url("${sgRegular}") format("woff2"); font-weight: 400; font-style: normal; font-display: swap; }
@font-face { font-family: "Special Gothic"; src: url("${sgSemiBold}") format("woff2"); font-weight: 600; font-style: normal; font-display: swap; }
@font-face { font-family: "Special Gothic"; src: url("${sgBold}") format("woff2"); font-weight: 700; font-style: normal; font-display: swap; }

.jpt-bar {
  --bar-h: 90px;
  position: relative;
  display: block;
  width: 100%;
  height: var(--bar-h);
  margin: 0;
  padding: 0;
  border: none;
  /* pill do fortuna-bar (bordas totalmente arredondadas) */
  border-radius: 999px;
  overflow: hidden;
  text-align: left;
  cursor: default;
  user-select: none;
  -webkit-user-select: none;
  /* gradiente do fortuna-bar: dourado nas laterais, navy no centro */
  background: linear-gradient(
    90deg,
    #FFBA00 0%,
    #a07c3c 9%,
    #2a2349 26%,
    #161433 50%,
    #2a2349 74%,
    #a07c3c 91%,
    #FFBA00 100%
  );
  box-shadow:
    0 1px 3px rgba(20, 14, 45, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.16);
  will-change: transform;
}

/* raios diagonais do Fortuna (color-dodge clareia onde os traços passam) */
.jpt-shape {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background-image: url("${shapeFortuna}");
  background-repeat: no-repeat;
  background-position: center;
  background-size: cover;
  opacity: 1;
  mix-blend-mode: color-dodge;
}

/* conteúdo CENTRALIZADO na horizontal (box inteiro), como no fortuna-bar */
.jpt-layer {
  position: absolute;
  inset: 0;
  z-index: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
  padding: 0 38px;
}

.jpt-sub {
  font-family: ${FONT_BODY};
  font-weight: 600;
  font-size: 17.5px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #FFBA00;
  line-height: 1;
  margin-bottom: 5px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: clip;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.35);
}
.jpt-subStrong { font-weight: 800; color: #FFBA00; }

.jpt-value {
  font-family: ${FONT_BODY};
  font-weight: 700;
  font-size: 28.5px;
  line-height: 1;
  color: #fff;
  font-variant-numeric: tabular-nums;
  font-feature-settings: "tnum" 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: clip;
  text-shadow: 0 2px 5px rgba(0, 0, 0, 0.45);
}

.jpt-cur { opacity: 0.92; margin-right: 5px; }

/* inline-block: o scale do GSAP (respiro a cada subida) só aplica em bloco. */
.jpt-num { display: inline-block; }

/* martelo — irmão da barra (fora do overflow:hidden), transborda a pill.
   Proporcional à barra (razão 1.0735 = 1.13 do fortuna-bar -5%); left 0 pra não sair do canvas. */
.jpt-hammer {
  position: absolute;
  z-index: 4;
  left: 0;
  top: 50%;
  transform: translateY(-52%);
  width: calc(var(--bar-h, 90px) * 1.0735);
  height: calc(var(--bar-h, 90px) * 1.0735);
  object-fit: contain;
  pointer-events: none;
  filter: drop-shadow(0 2px 5px rgba(0, 0, 0, 0.5));
}

/* ── Camada paga (overlay que varre — cor do win por tier via --paid) ── */
.jpt-paid {
  position: absolute;
  inset: 0;
  z-index: 2;
  overflow: hidden;
  background: var(--paid, linear-gradient(110deg, #0a1f15 0%, #2faf80 78%, #5ad8a8 100%));
  clip-path: inset(0 100% 0 0);
  will-change: clip-path;
}
.jpt-paid .jpt-shape { z-index: 0; }
.jpt-paid .jpt-sub, .jpt-paid .jpt-subStrong { color: #fff; }

.jpt-track { position: absolute; inset: 0; z-index: 1; will-change: transform; }

.jpt-slide {
  position: absolute;
  left: 0;
  right: 0;
  height: var(--bar-h);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
  padding: 0 38px;
}
.jpt-slidePagou { top: 0; }
.jpt-slideValor { top: var(--bar-h); }

/* "{TIER} PAGOU!!" — $font-body 700, sem skew de CSS (o GSAP anima o skew) */
.jpt-title {
  font-family: ${FONT_BODY};
  font-weight: 700;
  font-size: 23.5px;
  letter-spacing: 0;
  text-transform: uppercase;
  color: #fff;
  line-height: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-shadow: 0 2px 5px rgba(0, 0, 0, 0.45);
}

.jpt-wonLabel {
  font-family: ${FONT_BODY};
  font-weight: 600;
  font-size: 17.5px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.9);
  line-height: 1;
  margin-bottom: 5px;
}

.jpt-wonValue {
  font-family: ${FONT_BODY};
  font-weight: 700;
  font-size: 28.5px;
  line-height: 1;
  color: #fff;
  font-variant-numeric: tabular-nums;
  font-feature-settings: "tnum" 1;
  white-space: nowrap;
  text-shadow: 0 2px 5px rgba(0, 0, 0, 0.45);
}

.jpt-sheen {
  position: absolute;
  top: -10%;
  left: 0;
  width: 63px;
  height: 120%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.85), transparent);
  transform: translateX(-150%) skewX(-12deg);
  pointer-events: none;
  z-index: 3;
  opacity: 0;
  will-change: transform, opacity;
}

.jpt-flash {
  position: absolute;
  inset: 0;
  background: #fff;
  opacity: 0;
  pointer-events: none;
  z-index: 4;
}
`;

export default function JackpotTicker({ onReady }: { onReady?: () => void }) {
  const [total, setTotal] = useState<number | null>(null);
  // winner: { tier, prize, name } enquanto exibe o estado pago; null = estado normal.
  const [winner, setWinner] = useState<{ tier: number; prize: number; name: string } | null>(null);

  const lastWinIdRef = useRef<string | null>(null);
  // espelha `winner` p/ o handler da SSE (conexão única, sem re-subscribe) checar sem
  // closure velha.
  const winnerActiveRef = useRef(false);
  useEffect(() => {
    winnerActiveRef.current = !!winner;
  }, [winner]);

  // Refs dos alvos do GSAP.
  const barRef = useRef<HTMLDivElement>(null);
  const numRef = useRef<HTMLSpanElement>(null);
  const paidRef = useRef<HTMLSpanElement>(null);
  const trackRef = useRef<HTMLSpanElement>(null);
  const titleRef = useRef<HTMLSpanElement>(null);
  const wonValueRef = useRef<HTMLSpanElement>(null);
  const sheenRef = useRef<HTMLSpanElement>(null);
  const flashRef = useRef<HTMLSpanElement>(null);

  const proxyRef = useRef({ val: 0 });
  const seededRef = useRef(false);

  // Conexão de dados: SSE direta, mesma origem, sem bus/bridge/auth. O server reenvia
  // o último ticker na hora da inscrição (seed instantâneo).
  useEffect(() => {
    const es = new EventSource(SSE_URL);
    es.onmessage = (event) => {
      let frame: any;
      try {
        frame = JSON.parse(event.data);
      } catch {
        return;
      }
      if (frame?.type === "jackpot_ticker") {
        if (typeof frame.total === "number") setTotal(frame.total);
      } else if (frame?.type === "jackpot_winner") {
        const winId = frame?.win_id;
        if (winId == null) return;
        if (lastWinIdRef.current === winId) return;
        if (winnerActiveRef.current) return;
        lastWinIdRef.current = winId;
        // first_name só vem se o server tiver opt-in (WIDGETS_JACKPOT_PUBLIC_NAME);
        // por padrão vem ausente → cai no "{TIER} PAGOU!!" sem nome.
        setWinner({
          tier: Number(frame.top_tier_won),
          prize: Number(frame.prize_total),
          name: (frame.first_name || "").trim(),
        });
      }
    };
    return () => es.close();
  }, []);

  // sinaliza "pronto" na 1ª vez que chega um valor real — gate do reveal do rotator.
  useEffect(() => {
    if (total != null) onReady?.();
  }, [total, onReady]);

  // ── Count-up do valor: tween até o valor corrente a cada atualização.
  useGSAP(
    () => {
      const el = numRef.current;
      if (!el) return;
      if (total == null) {
        el.textContent = "···";
        return;
      }
      const proxy = proxyRef.current;
      if (!seededRef.current) {
        seededRef.current = true;
        proxy.val = total;
        el.textContent = fmtBRL(total);
        return;
      }
      const rising = total > proxy.val;
      gsap.to(proxy, {
        val: total,
        duration: 0.7,
        ease: "power3.out",
        overwrite: true,
        onUpdate: () => {
          el.textContent = fmtBRL(proxy.val);
        },
      });
      if (rising) {
        gsap.fromTo(el, { scale: 1.06 }, { scale: 1, duration: 0.3, ease: "power2.out" });
      }
    },
    { dependencies: [total], scope: barRef }
  );

  // ── Coreografia do estado pago (roda quando `winner` vira não-nulo).
  useGSAP(
    (_context, contextSafe) => {
      if (!winner) return;
      const bar = barRef.current;
      const paid = paidRef.current;
      const track = trackRef.current;
      if (!bar || !paid || !track) return;

      const finish = contextSafe!(() => setWinner(null));

      gsap.set(track, { y: 0 });
      const tl = gsap.timeline();

      // ─ Momento 1: SWIPE → DIREITA ({TIER} PAGOU!!) ─
      tl.fromTo(bar, { scale: 1 }, { scale: 1.05, duration: 0.12, ease: "power3.out" }, 0)
        .to(bar, { scale: 1, duration: 0.5, ease: "elastic.out(1.1, 0.45)" }, 0.12);
      tl.fromTo(
        paid,
        { clipPath: "inset(0 100% 0 0)" },
        { clipPath: "inset(0 0% 0 0)", duration: 0.5, ease: "power3.inOut" },
        0
      );
      tl.set(sheenRef.current, { opacity: 1, xPercent: -150, skewX: -12 }, 0)
        .to(sheenRef.current, { xPercent: 650, duration: 0.5, ease: "power2.inOut" }, 0)
        .to(sheenRef.current, { opacity: 0, duration: 0.18, ease: "power2.out" }, 0.42);
      tl.to(flashRef.current, { opacity: 0.5, duration: 0.07, ease: "power3.in" }, 0.1)
        .to(flashRef.current, { opacity: 0, duration: 0.28, ease: "power2.out" }, 0.17);
      tl.fromTo(
        titleRef.current,
        { scale: 1.18, opacity: 0.2, skewX: -7 },
        { scale: 1, opacity: 1, skewX: -7, duration: 0.45, ease: "back.out(2)" },
        0.34
      );

      // ─ Momento 2: SWIPE → CIMA (valor pago) ─
      const slideH = bar.offsetHeight;
      tl.to(track, { y: -slideH, duration: 0.55, ease: "power3.inOut" }, "+=0.9");
      tl.fromTo(
        wonValueRef.current,
        { scale: 1.14, opacity: 0.3, skewX: -7 },
        { scale: 1, opacity: 1, skewX: -7, duration: 0.45, ease: "back.out(1.8)" },
        "<0.12"
      );
      tl.to(flashRef.current, { opacity: 0.28, duration: 0.06, ease: "power3.in" }, "<")
        .to(flashRef.current, { opacity: 0, duration: 0.26, ease: "power2.out" });

      // ─ Momento 3: hold + reverse (volta ao estado normal) ─
      tl.to({}, { duration: 1.1 });
      tl.to(paid, { clipPath: "inset(0 100% 0 0)", duration: 0.55, ease: "power3.inOut" });
      tl.set(track, { y: 0 });
      tl.add(finish);
    },
    { dependencies: [winner], scope: barRef, revertOnUpdate: true }
  );

  return (
    <>
      <style>{CSS}</style>

      <div
        ref={barRef}
        className="jpt-bar"
        style={winner ? ({ "--paid": WIN_GRAD[Number(winner.tier)] } as CSSProperties) : undefined}
        aria-label={
          winner
            ? winner.name
              ? `${winner.name} ganhou o ${tierName(winner.tier)} na Fortuna do Panda`
              : `${tierName(winner.tier)} pagou na Fortuna do Panda`
            : "Fortuna do Panda ao vivo"
        }
      >
        <span className="jpt-shape" aria-hidden="true" />

        {/* estado normal: marca + valor crescendo (centralizados) */}
        <span className="jpt-layer">
          <span className="jpt-sub">
            Fortuna do <strong className="jpt-subStrong">Panda</strong>
          </span>
          <span className="jpt-value">
            <span className="jpt-cur">R$</span>
            {/* sem children: o GSAP escreve o textContent (count-up). */}
            <span ref={numRef} className="jpt-num" />
          </span>
        </span>

        {/* estado pago: overlay (cor do tier) com 2 slides (PAGOU → VALOR) */}
        <span ref={paidRef} className="jpt-paid" aria-hidden={!winner}>
          {/* raios por cima do gradiente do tier (textura continua no pago) */}
          <span className="jpt-shape" aria-hidden="true" />
          <span ref={trackRef} className="jpt-track">
            <span className="jpt-slide jpt-slidePagou">
              <span className="jpt-sub">
                {winner?.name ? `${tierName(winner.tier)} · ` : ""}Fortuna do{" "}
                <strong className="jpt-subStrong">Panda</strong>
              </span>
              <span ref={titleRef} className="jpt-title">
                {winner ? (winner.name ? `${winner.name} ganhou!` : `${tierName(winner.tier)} PAGOU!!`) : ""}
              </span>
            </span>
            <span className="jpt-slide jpt-slideValor">
              <span className="jpt-wonLabel">Valor pago</span>
              <span ref={wonValueRef} className="jpt-wonValue">
                {winner ? `R$ ${fmtBRL(winner.prize)}` : ""}
              </span>
            </span>
          </span>
        </span>

        {/* efeitos */}
        <span ref={sheenRef} className="jpt-sheen" aria-hidden="true" />
        <span ref={flashRef} className="jpt-flash" aria-hidden="true" />
      </div>

      {/* martelo — FORA da barra (overflow visível no .rot-jp-wrap), transborda a
          pill em cima/embaixo. width/height intrínsecos = fallback anti-flash. */}
      <img
        className="jpt-hammer"
        src={marteloImg}
        width={102}
        height={102}
        alt=""
        aria-hidden="true"
      />
    </>
  );
}
