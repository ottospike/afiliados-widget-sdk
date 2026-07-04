/*
 * JackpotTickerBarType1 — port ENXUTO do componente do app (snapshot 2026-07-03):
 *   kingpanda-front/components/Headers/JackpotTickerBarType1/JackpotTickerBarType1.jsx
 * Widget é GRÁFICO puro de overlay (regras da skill kp-widget-platform): ficou SÓ
 * o que gera o visual — barra slim + count-up do pote + coreografia do PAGOU.
 * Removidos em relação ao app: variante expandida (TierRing/raio/"Entenda"/wager),
 * navegação (<Link>/href), redux, pílula "Jogar" + saldo, ticker fake de localhost
 * e overrides do painel DEV. Dados via ./hooks (proxy /<id>/__up do SDK).
 */
import { useEffect, useRef, useState, type CSSProperties } from "react";
import useBus from "use-bus";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { useJackpotPublicTicker } from "./hooks";
import marteloImg from "./assets/icone-martelo.png";
import styles from "./JackpotTickerBarType1.module.scss";

// Barra "Fortuna do Panda" (era o botão do header mobile do app):
//   - Estado normal: "Fortuna do Panda" + valor (= total do pote) crescendo, com
//     um respiro de scale a cada subida. Valor vem de useJackpotPublicTicker.
//   - Estado pago: ao chegar "jackpot:winner" (WS autenticado), um overlay (cor
//     do tier) varre da DIREITA revelando "{TIER} PAGOU!!", depois o trilho sobe
//     revelando "Valor pago R$ X" (prize_total do evento), e reseta sozinho.

gsap.registerPlugin(useGSAP);

// Martelo (asset da wallet) — LOCAL/bundlado.
const MARTELO_IMG = marteloImg;

const TIER_NAME: Record<number, string> = { 1: "Minor", 2: "Major", 3: "Grand" };
const tierName = (t: number | string) => TIER_NAME[Number(t)] || "";

// Cor do estado pago por tier: gradiente LINEAR escuro à esquerda → cor vibrante
// do tier à direita. Minor verde, Major dourado, Grand rosa. Via --paid no overlay.
const WIN_GRAD: Record<number, string> = {
  1: "linear-gradient(110deg, #0a1f15 0%, #176245 42%, #2faf80 78%, #5ad8a8 100%)",
  2: "linear-gradient(110deg, #1a1505 0%, #7a5e1a 42%, #d2a838 78%, #f2cf6a 100%)",
  3: "linear-gradient(110deg, #1e0a16 0%, #8a2050 45%, #d65a92 80%, #f2a0c8 100%)",
};

// Batida do martelo por tier — intensidade cresce Minor → Major → Grand.
// Anatomia: CARREGA (windup lento, anticipação) → SEGURA a carga (hold; nos
// tiers altos com tremor de tensão) → CRAVA (strike + empurrão x + blip de
// flash) → ASSENTA (elastic). Quanto maior o tier: arco maior, carga mais
// longa/tremida, soco de escala e vibração maiores.
const HAMMER_HIT: Record<
  number,
  {
    windup: number; windupDur: number; hold: number; tremble: number;
    strike: number; scale: number; kick: number; flash: number;
    settleDur: number; settle: string;
  }
> = {
  1: { windup: -22, windupDur: 0.22, hold: 0.08, tremble: 0, strike: 14, scale: 1.05, kick: 3, flash: 0.18, settleDur: 0.6, settle: "elastic.out(1.3, 0.35)" },
  2: { windup: -32, windupDur: 0.3, hold: 0.14, tremble: 2, strike: 20, scale: 1.09, kick: 5, flash: 0.28, settleDur: 0.7, settle: "elastic.out(1.5, 0.3)" },
  3: { windup: -45, windupDur: 0.4, hold: 0.2, tremble: 3, strike: 28, scale: 1.14, kick: 8, flash: 0.38, settleDur: 0.8, settle: "elastic.out(1.7, 0.25)" },
};

const fmtBRL = (n: number | null | undefined) =>
  Number(n || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

interface JackpotTickerBarType1Props {
  // dispara UMA vez quando o primeiro dado real (total do pote) chega — o
  // main.tsx usa pra revelar o overlay (fade-in) sem flash de placeholder.
  onReady?: () => void;
}

const JackpotTickerBarType1 = ({ onReady }: JackpotTickerBarType1Props = {}) => {
  const { total } = useJackpotPublicTicker();

  // winner: { tier, prize } enquanto exibe o estado pago; null = estado normal.
  const [winner, setWinner] = useState<{ tier: number; prize: number } | null>(null);

  const lastWinIdRef = useRef<string | number | null>(null);

  // Refs dos alvos (GSAP usa refs, não seletores).
  const barRef = useRef<HTMLElement | null>(null);
  const numRef = useRef<HTMLSpanElement | null>(null); // dígitos (textContent via GSAP)
  const paidRef = useRef<HTMLSpanElement | null>(null);
  const trackRef = useRef<HTMLSpanElement | null>(null);
  const titleRef = useRef<HTMLSpanElement | null>(null);
  const wonValueRef = useRef<HTMLSpanElement | null>(null);
  const sheenRef = useRef<HTMLSpanElement | null>(null);
  const flashRef = useRef<HTMLSpanElement | null>(null);
  const hammerRef = useRef<HTMLImageElement | null>(null);

  // proxy tweenado pelo count-up + flag de 1ª leitura (não varrer de 0).
  const proxyRef = useRef({ val: 0 });
  const seededRef = useRef(false);

  const liveValue = total;

  // Avisa o entry (UMA vez) que o primeiro dado real chegou — gate do reveal
  // (fade-in). Sem dado → o overlay permanece invisível, sem placeholder.
  const readyRef = useRef(false);
  useEffect(() => {
    if (liveValue != null && !readyRef.current) {
      readyRef.current = true;
      onReady?.();
    }
  }, [liveValue, onReady]);

  // ── Count-up do valor: tween até o valor corrente a cada atualização.
  useGSAP(
    () => {
      const el = numRef.current;
      if (!el) return;
      if (liveValue == null) {
        el.textContent = "···";
        return;
      }
      const proxy = proxyRef.current;
      // 1ª leitura: seta direto (sem animar de 0).
      if (!seededRef.current) {
        seededRef.current = true;
        proxy.val = liveValue;
        el.textContent = fmtBRL(liveValue);
        return;
      }
      const rising = liveValue > proxy.val;
      gsap.to(proxy, {
        val: liveValue,
        duration: 0.7,
        ease: "power3.out",
        overwrite: true,
        onUpdate: () => {
          el.textContent = fmtBRL(proxy.val);
        },
      });
      // respiro a cada subida (.num é inline-block → scale aplica)
      if (rising) {
        gsap.fromTo(
          el,
          { scale: 1.06 },
          { scale: 1, duration: 0.3, ease: "power2.out" }
        );
      }
    },
    { dependencies: [liveValue], scope: barRef }
  );

  // ── Coreografia do estado pago (roda quando `winner` vira não-nulo).
  useGSAP(
    (context, contextSafe) => {
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
      // martelo "batendo" (sutil), sincronizado com o flash do impacto: recua
      // (windup), crava e assenta com elastic — intensidade por tier (HAMMER_HIT).
      // Pivô perto do cabo pra cabeça fazer o arco. O revert da timeline devolve
      // o transform original do CSS.
      const hit = HAMMER_HIT[Number(winner.tier)] || HAMMER_HIT[1];
      const strikeAt = hit.windupDur + hit.hold;
      // carrega
      tl.fromTo(
        hammerRef.current,
        { rotation: 0, scale: 1, x: 0, transformOrigin: "55% 80%" },
        { rotation: hit.windup, scale: hit.scale, duration: hit.windupDur, ease: "power2.out" },
        0
      );
      // segura a carga tremendo (tensão) — só nos tiers com tremble
      if (hit.tremble) {
        tl.to(
          hammerRef.current,
          {
            rotation: hit.windup + hit.tremble,
            duration: 0.045,
            yoyo: true,
            repeat: Math.max(1, Math.round(hit.hold / 0.045) - 1),
            ease: "sine.inOut",
          },
          hit.windupDur
        );
      }
      // crava (+ blip de flash sincronizado com o impacto)
      tl.to(hammerRef.current, { rotation: hit.strike, x: hit.kick, duration: 0.09, ease: "power4.in" }, strikeAt);
      tl.to(flashRef.current, { opacity: hit.flash, duration: 0.05, ease: "power3.in" }, strikeAt + 0.06)
        .to(flashRef.current, { opacity: 0, duration: 0.22, ease: "power2.out" }, strikeAt + 0.11);
      // assenta — SÓ a rotação ringa (elastic, leitura física); escala e
      // deslocamento voltam limpos e curtos (elastic em scale deforma o PNG).
      tl.to(hammerRef.current, { rotation: 0, duration: hit.settleDur, ease: hit.settle }, strikeAt + 0.09);
      tl.to(hammerRef.current, { scale: 1, x: 0, duration: 0.25, ease: "power2.out" }, strikeAt + 0.09);
      tl.fromTo(
        titleRef.current,
        { scale: 1.18, opacity: 0.2, skewX: -7 },
        { scale: 1, opacity: 1, skewX: -7, duration: 0.45, ease: "back.out(2)" },
        0.34
      );

      // ─ Momento 2: SWIPE → CIMA (valor pago) ─
      const slideH = bar.offsetHeight; // altura responsiva, lida agora
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

  // ── Ganhador (WS autenticado): dispara o estado pago. Dedup por win_id e
  // guard pra ignorar novos enquanto um já está em exibição.
  useBus(
    "jackpot:winner",
    (e) => {
      const p = e?.payload;
      if (!p || p.win_id == null) return;
      if (lastWinIdRef.current === p.win_id) return;
      if (winner) return;
      lastWinIdRef.current = p.win_id;
      setWinner({ tier: p.top_tier_won, prize: p.prize_total });
    },
    [winner]
  );

  const barAria = winner
    ? `${tierName(winner.tier)} pagou na Fortuna do Panda`
    : "Fortuna do Panda ao vivo";
  const paidStyle = winner
    ? ({ "--paid": WIN_GRAD[Number(winner.tier)] } as CSSProperties)
    : undefined;

  return (
    <span className={`${styles.slimWrap} ${styles.slimWrap_static}`}>
      <span
        ref={barRef}
        className={`${styles.bar} ${styles.bar_static}`}
        style={paidStyle}
        aria-label={barAria}
      >
        <span className={styles.shape} aria-hidden="true" />

        {/* estado normal: marca + valor crescendo */}
        <span className={styles.layer}>
          <span className={styles.sub}>
            Fortuna do <strong className={styles.subStrong}>Panda</strong>
          </span>
          <span className={styles.value}>
            <span className={styles.cur}>R$</span>
            {/* sem children: o GSAP escreve o textContent (count-up). Filhos
                controlados pelo React seriam reescritos a cada re-render. */}
            <span ref={numRef} className={styles.num} suppressHydrationWarning />
          </span>
        </span>

        {/* estado pago: overlay (cor do tier) com 2 slides (PAGOU → VALOR) */}
        <span ref={paidRef} className={styles.paid} aria-hidden={!winner}>
          {/* raios por cima do gradiente do tier (textura continua no pago) */}
          <span className={styles.shape} aria-hidden="true" />
          <span ref={trackRef} className={styles.track}>
            <span className={`${styles.slide} ${styles.slidePagou}`}>
              <span className={styles.sub}>
                Fortuna do <strong className={styles.subStrong}>Panda</strong>
              </span>
              <span ref={titleRef} className={styles.title}>
                {winner ? `${tierName(winner.tier)} PAGOU!!` : ""}
              </span>
            </span>
            <span className={`${styles.slide} ${styles.slideValor}`}>
              <span className={styles.wonLabel}>Valor pago</span>
              <span ref={wonValueRef} className={styles.wonValue}>
                {winner ? `R$ ${fmtBRL(winner.prize)}` : ""}
              </span>
            </span>
          </span>
        </span>

        {/* efeitos */}
        <span ref={sheenRef} className={styles.sheen} aria-hidden="true" />
        <span ref={flashRef} className={styles.flash} aria-hidden="true" />
      </span>

      {/* martelo (asset da wallet) — ícone da marca à ESQUERDA, absoluto,
          transbordando pra FORA da borda esquerda da barra (irmão do .bar, fora
          do overflow:hidden). width/height intrínsecos = fallback anti-flash. */}
      <img
        ref={hammerRef}
        src={MARTELO_IMG}
        className={styles.barHammer}
        width={64}
        height={64}
        alt=""
        aria-hidden="true"
      />
    </span>
  );
};

export default JackpotTickerBarType1;
