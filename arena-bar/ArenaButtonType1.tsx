/*
 * ArenaButtonType1 — port ENXUTO do componente do app (snapshot 2026-07-03):
 *   kingpanda-front/components/Headers/ArenaButtonType1/ArenaButtonType1.jsx
 * Widget é GRÁFICO puro de overlay (regras da skill kp-widget-platform): ficou SÓ
 * o que gera o visual — billboard das ofertas fixas + reta final (timer ≤1h).
 * Removidos em relação ao app: estado promo de rodada grátis (é PER-USER, nunca
 * ocorre no overlay), navegação/<button>/redux (abria o PandaPlusSheet), hover.
 * Dados via ./hooks (proxy /<id>/__up do SDK). Estados de teste: __arenaForce.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import useBus from "use-bus";
import { useArenaGamesTicker } from "./hooks";
import arenaLogo from "./assets/logo-branca-arena.svg";
import styles from "./ArenaButtonType1.module.scss";

// Barra "Arena Panda" (era o botão do header mobile do app). Dois estados:
//  - Ciclo (normal): billboard de 2 faces por oferta — swipe de LADO traz
//    "<cadência> + logo da ARENA"; swipe pra CIMA traz "paga <valor>". Cicla as
//    3 ofertas fixas (R$10 mil/dia · R$100 mil/sexta · R$1 milhão/mês). Anima por
//    KEYFRAME (entra `cur`, sai `prev`); o eixo do swipe alterna por frame.
//  - Reta final (algum jogo na última 1h): TRAVA num timer do jogo prioritário,
//    fundo de alerta (vermelho→âmbar) e swipe-UP alternando o cronômetro (MM:SS)
//    com o CTA "Última chance / jogue suas revanches" (e volta, reverse).

const FINAL_WINDOW_MS = 60 * 60 * 1000; // janela da reta final (≤ 1h)
const TIMER_SLIDE_MS = 3200; // troca cronômetro ↔ CTA de revanche
const BILLBOARD_FRAME_MS = 2000; // tempo de cada face do billboard (normal)

// Logo branca da ARENA (face "<cadência> + logo") — asset LOCAL/bundlado.
const ARENA_LOGO = arenaLogo;

// Prioridade dos períodos (maior primeiro): mensal > semanal > diário > horário.
const PRIORITY: Record<string, number> = {
  monthly: 4,
  weekly: 3,
  daily: 2,
  hourly: 1,
};

// Textos fixos do ciclo (estado normal) — sempre estes 3, independente dos dados.
const CYCLE_ITEMS = [
  { value: "R$10 mil", cadence: "todo dia" },
  { value: "R$100 mil", cadence: "toda sexta" },
  { value: "R$1 milhão", cadence: "todo mês" },
];

const pad2 = (n: number) => String(n).padStart(2, "0");

// Tempo restante (ms) → "MM:SS" (dentro de 1h os minutos vão de 00 a 59).
const formatClock = (ms: number) => {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  return `${pad2(Math.floor(totalSec / 60))}:${pad2(totalSec % 60)}`;
};

interface ArenaButtonType1Props {
  // WIDGET: dispara UMA vez quando a 1ª carga de dados liquida (com ou sem dado —
  // o billboard tem textos fixos) — o main.tsx usa pro reveal (fade-in).
  onReady?: () => void;
}

const ArenaButtonType1 = ({ onReady }: ArenaButtonType1Props = {}) => {
  const { games, settled } = useArenaGamesTicker();
  // now começa null → 1º render cai no ciclo, sem depender do relógio.
  const [now, setNow] = useState<number | null>(null);
  const [timerSlide, setTimerSlide] = useState(0); // 0 = cronômetro, 1 = CTA
  // Billboard do estado normal: cicla 6 frames (3 ofertas × 2 faces). `cur` é o
  // frame visível, `prev` o que sai (null no 1º). Par = face A (cadência+logo,
  // entra de LADO); ímpar = face B (paga+valor, entra de CIMA). offer = floor(cur/2).
  const [bb, setBb] = useState<{ cur: number; prev: number | null }>({
    cur: 0,
    prev: null,
  });
  // DEV: override de estado via bus. null = Auto (estado decidido pelos dados);
  // "final" trava a reta final, "cycle" o billboard (window.__arenaForce no entry).
  const [devForce, setDevForce] = useState<string | null>(null);
  useBus("arena:dev-force", (e) => setDevForce(e?.payload ?? null), []);

  // WIDGET: gate do reveal — 1ª carga liquidou.
  const readyRef = useRef(false);
  useEffect(() => {
    if (settled && !readyRef.current) {
      readyRef.current = true;
      onReady?.();
    }
  }, [settled, onReady]);

  // Tick de 1s pro countdown e pra reavaliar a janela da reta final.
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Itens do ticker (período + endsAt), ordenados por prioridade (mensal 1º).
  const items = useMemo(() => {
    const list = (Array.isArray(games) ? games : []).map((g) => ({
      period: g.period || "",
      periodLabel: g.periodLabel || "",
      endsAt: g.endsAt || null,
    }));
    return list.sort(
      (a, b) => (PRIORITY[b.period] || 0) - (PRIORITY[a.period] || 0)
    );
  }, [games]);

  // Jogo na reta final de maior prioridade (≤ 1h). Empate → o que acaba antes.
  const activeTimer = useMemo(() => {
    if (now == null) return null;
    return (
      items
        .map((it) => ({
          it,
          ms: it.endsAt ? new Date(it.endsAt).getTime() - now : Infinity,
        }))
        .filter(({ ms }) => ms > 0 && ms <= FINAL_WINDOW_MS)
        .sort(
          (a, b) =>
            (PRIORITY[b.it.period] || 0) - (PRIORITY[a.it.period] || 0) ||
            a.ms - b.ms
        )[0] || null
    );
  }, [items, now]);

  // Timer EFETIVO: em DEV, o override força o estado; sem override usa o real.
  // "final" fabrica um cronômetro que conta dentro de 1h (deriva de `now`).
  const effectiveTimer = useMemo(() => {
    if (devForce === "final") {
      return {
        it: { periodLabel: "Arena diária", period: "daily" },
        ms:
          now != null ? FINAL_WINDOW_MS - (now % FINAL_WINDOW_MS) : 23 * 60 * 1000,
      };
    }
    if (devForce === "cycle") return null;
    return activeTimer;
  }, [devForce, activeTimer, now]);

  // Booleano ESTÁVEL: effectiveTimer vira objeto novo a cada segundo (depende de
  // `now`), então os intervals abaixo NÃO podem depender dele direto — senão são
  // recriados a cada tick e nunca disparam. Dependem deste flag.
  const timerActive = Boolean(effectiveTimer);

  // Estado normal (sem reta final) → roda o billboard.
  const isNormal = !timerActive;

  // Billboard do estado normal: avança 1 frame por BILLBOARD_FRAME_MS guardando o
  // anterior em `prev` (pra ele sair junto). Reseta ao sair do normal — volta ao
  // 1º frame sem `prev`, evitando um slide-out fantasma na reentrada.
  useEffect(() => {
    if (!isNormal) {
      setBb({ cur: 0, prev: null });
      return undefined;
    }
    const id = setInterval(
      () => setBb(({ cur: c }) => ({ cur: (c + 1) % 6, prev: c })),
      BILLBOARD_FRAME_MS
    );
    return () => clearInterval(id);
  }, [isNormal]);

  // Alterna cronômetro ↔ CTA enquanto no timer (reseta ao sair).
  useEffect(() => {
    if (!timerActive) {
      setTimerSlide(0);
      return undefined;
    }
    const id = setInterval(() => setTimerSlide((s) => (s ? 0 : 1)), TIMER_SLIDE_MS);
    return () => clearInterval(id);
  }, [timerActive]);

  let stage;
  if (effectiveTimer) {
    // Swipe-UP: cronômetro (slot base) ↔ CTA de revanche. transform via style →
    // a transição volta sozinha (reverse) quando o slide alterna.
    stage = (
      <span className={styles.stage}>
        <span
          className={styles.slot}
          style={{
            transform: timerSlide === 0 ? "translateY(0)" : "translateY(-110%)",
          }}
        >
          <span className={styles.sub}>
            <strong className={styles.timerLabel}>
              {effectiveTimer.it.periodLabel}
            </strong>{" "}
            termina em:
          </span>
          <span className={styles.value}>{formatClock(effectiveTimer.ms)}</span>
        </span>
        <span
          className={styles.slot}
          style={{
            transform: timerSlide === 0 ? "translateY(110%)" : "translateY(0)",
          }}
        >
          <span className={styles.sub}>Última chance</span>
          <span className={`${styles.value} ${styles.cta}`}>
            use suas revanches
          </span>
        </span>
      </span>
    );
  } else {
    // Billboard: DOIS slots PERSISTENTES por PAPEL (não por frame). Slot A é
    // sempre a face "<cadência> + logo"; slot B, sempre "paga + valor". Com key
    // estável por papel o React REUSA os nós entre frames — o <img> da logo nunca
    // é remontado. A animação segue re-disparando porque a CLASSE muda a cada
    // tick (bb-in-x ↔ bb-out-y…) e trocar animation-name reinicia o keyframe.
    const faceInner = (s: number) => {
      const offer = CYCLE_ITEMS[Math.floor(s / 2) % CYCLE_ITEMS.length];
      if (s % 2 === 0) {
        // "todo dia" → prefixo branco ("TODO") + período amarelo ("DIA"). O período
        // é a última palavra da cadência (dia/sexta/mês).
        const parts = String(offer.cadence).trim().split(/\s+/);
        const period = parts.pop();
        const head = parts.join(" ");
        return (
          <>
            <span className={styles.faceCadence}>
              {head}
              {head ? " " : ""}
              <span className={styles.cadPeriod}>{period}</span>
            </span>
            {/* width/height intrínsecos: fallback anti-flash gigante (regra da
                skill) — o CSS (height clamp + width auto) vence quando presente. */}
            <img
              className={styles.faceLogo}
              src={ARENA_LOGO}
              width={55}
              height={36}
              alt=""
              aria-hidden="true"
            />
          </>
        );
      }
      return (
        <>
          <span className={`${styles.sub} ${styles.kicker}`}>paga</span>
          <span className={styles.value}>{offer.value}</span>
        </>
      );
    };
    // Eixo do swipe pela PARIDADE de `cur`: par → face A entra de LADO (X); ímpar
    // → face B entra de CIMA (Y). O slot que ENTRA (mostra `cur`) fica por cima.
    const activeIsA = bb.cur % 2 === 0;
    const axis = activeIsA ? "X" : "Y";
    // Frame de cada face: a que entra mostra `cur`, a que sai mostra `prev`.
    const slotAFrame = activeIsA ? bb.cur : bb.prev; // face A (cadência + logo)
    const slotBFrame = activeIsA ? bb.prev : bb.cur; // face B (paga + valor)
    const anim = (entering: boolean) =>
      entering
        ? axis === "X"
          ? styles.inX
          : styles.inY
        : axis === "X"
        ? styles.outX
        : styles.outY;
    stage = (
      <span className={styles.stage}>
        {slotAFrame != null && (
          <span
            key="bb-face-a"
            className={`${styles.bbSlot} ${styles.bbFaceA} ${anim(activeIsA)}`}
            style={{ zIndex: activeIsA ? 2 : 1 }}
          >
            {faceInner(slotAFrame)}
          </span>
        )}
        {slotBFrame != null && (
          <span
            key="bb-face-b"
            className={`${styles.bbSlot} ${styles.bbFaceB} ${anim(!activeIsA)}`}
            style={{ zIndex: activeIsA ? 1 : 2 }}
          >
            {faceInner(slotBFrame)}
          </span>
        )}
      </span>
    );
  }

  // WIDGET: raiz é <span> GRÁFICO (era <button> que abria o PandaPlusSheet).
  return (
    <span
      className={`${styles.bar} ${styles.bar_static} ${
        effectiveTimer ? styles.bar_alert : ""
      }`}
      aria-label="Arena Panda, recompensas"
    >
      <span className={styles.shape} aria-hidden="true" />
      {stage}
    </span>
  );
};

export default ArenaButtonType1;
