import { useEffect, useState, useRef } from "react";
import gsap from "gsap";
import ArenaCard, { type ArenaCardProps } from "./ArenaCard";
import { fetchCatalog, cardAndTopForPeriod, textureUrl } from "./arena-data";
import { Top3, decodeImg, type Entry } from "./Top3";

/**
 * Rotator LIVE ESPECIAL — variante enxuta do rotator/: 2 cenas, "special" (o card
 * monthly-special-simple: lockup LIVE ESPECIAL + countdown centralizados + Top3 no
 * dropdown) e "qr" (per-affiliate), com os mesmos crossfades GSAP e coreografia do
 * dropdown do rotator original.
 *
 * Diferenças de transporte vs rotator/:
 *  • TEMPOS via /api/widgets/rotator-config?id=rotator-special (config por dist no admin;
 *    poll 8s, fallback nos defaults do bundle se 404/offline). As CENAS seguem FIXAS no
 *    bundle: "special" sempre; "qr" entra só se a URL do embed tem ?aff= (mesmo
 *    contrato per-affiliate: ?aff=&dest=&mode= → /api/widgets/qr).
 *  • Dados: só o período MONTHLY (card + top3 numa request, via cardAndTopForPeriod).
 */
const MINI = "/api/widgets/minigames"; // proxy same-origin p/ o minigames-api público
const ROTATOR_CFG = "/api/widgets/rotator-config?id=rotator-special";
const QR_ART = "/widgets/qr-art.png";
const QR_DEFAULT = "/widgets/qr-default.svg";
const PERIOD = "monthly";

// offset (px) que desce a cena special p/ alinhar com o topo do card do QR.
const OTHERS_TOP = 21;

// QR: params da própria URL do embed (o afiliado configura ?aff=&dest=&mode= no OBS).
// `aff` também decide se a cena de QR entra no ciclo.
const qrParams = new URLSearchParams(location.search);
const aff = qrParams.get("aff") || "";
const dest = qrParams.get("dest") || "";
const mode = qrParams.get("mode") || "";
const QR_SRC = `/api/widgets/qr?${new URLSearchParams({ aff, dest, mode }).toString()}`;

// cenas fixas no bundle; tempos abaixo são os DEFAULTS (o admin sobrepõe via rotator-config).
const SCENES: string[] = aff ? ["special", "qr"] : ["special"];
const DWELL_MS: Record<string, number> = { special: 15000, qr: 15000 };
const FADE = 0.3;

interface Timing {
  dwellMs: Record<string, number>;
  crossfadeMs: number;
}
const DEFAULT_TIMING: Timing = { dwellMs: DWELL_MS, crossfadeMs: FADE * 1000 };

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
const until = (pred: () => boolean, cancelled: () => boolean) =>
  new Promise<void>((res) => {
    const tick = () => {
      if (cancelled() || pred()) {
        res();
        return;
      }
      setTimeout(tick, 60);
    };
    tick();
  });

export default function Rotator() {
  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(true);
  const [timing, setTiming] = useState<Timing>(DEFAULT_TIMING);
  const timingRef = useRef(timing); // transições leem via ref (config nova não replay a animação)
  timingRef.current = timing;
  const [card, setCard] = useState<ArenaCardProps | null>(null);
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const spRef = useRef<HTMLDivElement>(null);
  const qrRef = useRef<HTMLDivElement>(null);
  const ddRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<ArenaCardProps | null>(null);
  const prevScene = useRef<string>("");
  const top3ReadyRef = useRef(false);
  const revealedRef = useRef(false);

  const snapToScene = (s?: string) => {
    if (!spRef.current) return;
    gsap.killTweensOf([spRef.current, qrRef.current, ddRef.current]);
    gsap.set(spRef.current, { opacity: s === "special" ? 1 : 0 });
    gsap.set(qrRef.current, { opacity: s === "qr" ? 1 : 0 });
    gsap.set(ddRef.current, { clipPath: s === "special" ? "inset(0 0 0% 0)" : "inset(0 0 100% 0)", y: 0 });
  };

  // pausa o ciclo em background e re-sincroniza ao voltar
  useEffect(() => {
    const onVis = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  // tempos do admin (dwell/crossfade por dist) — poll 8s; 404/offline mantém os defaults do bundle.
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch(ROTATOR_CFG, { cache: "no-store" });
        if (!r.ok) return;
        const c = (await r.json()) as Partial<Timing>;
        if (!alive) return;
        const next: Timing = {
          dwellMs: { ...DWELL_MS, ...(c.dwellMs || {}) },
          crossfadeMs: typeof c.crossfadeMs === "number" ? c.crossfadeMs : DEFAULT_TIMING.crossfadeMs,
        };
        setTiming((t) => (JSON.stringify(t) === JSON.stringify(next) ? t : next));
      } catch {
        /* offline → mantém o que tem */
      }
    };
    load();
    const id = setInterval(load, 8000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  // dados: card + top3 do MONTHLY (uma request), poll 15s
  useEffect(() => {
    let alive = true;
    const load = async () => {
      const catalog = await fetchCatalog(MINI);
      const data = await cardAndTopForPeriod(MINI, catalog, PERIOD, 3);
      if (!alive || !data) return;
      setCard(data.card);
      cardRef.current = data.card;
      if (data.top && data.top.length) setEntries(data.top);
      decodeImg(data.card.imageUrl);
      decodeImg(textureUrl);
    };
    load();
    const id = setInterval(load, 15000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  // estado inicial: snap na cena 0
  useEffect(() => {
    prevScene.current = SCENES[0];
    snapToScene(SCENES[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ciclo: agenda a PRÓXIMA cena pelo dwell da atual. 1 cena (sem aff) ou aba oculta → não cicla.
  // `timing` nas deps: config nova (sig diferente) re-agenda o timer com o dwell atualizado.
  useEffect(() => {
    if (SCENES.length <= 1 || !visible) return;
    const cur = SCENES[idx % SCENES.length];
    const t = setTimeout(() => setIdx((i) => (i + 1) % SCENES.length), timing.dwellMs[cur] || DWELL_MS[cur] || 15000);
    return () => clearTimeout(t);
  }, [idx, visible, timing]);

  // ao voltar do background, re-sincroniza a cena atual
  useEffect(() => {
    if (visible) snapToScene(SCENES[idx % SCENES.length]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const reveal = () => {
    if (revealedRef.current) return;
    revealedRef.current = true;
    const root = (typeof document !== "undefined" && document.getElementById("wgt")) || stageRef.current?.parentElement;
    if (!root) return;
    const el = root as HTMLElement;
    el.style.transition = "opacity .35s ease";
    requestAnimationFrame(() => requestAnimationFrame(() => { el.style.opacity = "1"; }));
  };

  // reveal-on-complete: aparece só com a cena inicial (special) 100% pronta. Failsafe 4s.
  useEffect(() => {
    let cancelled = false;
    const isCancelled = () => cancelled;
    (async () => {
      try {
        await document.fonts?.ready;
      } catch {
        /* noop */
      }
      await until(() => !!cardRef.current, isCancelled);
      if (cancelled) return;
      await Promise.all([decodeImg(textureUrl), decodeImg(cardRef.current?.imageUrl)]);
      await until(() => top3ReadyRef.current, isCancelled);
      if (cancelled) return;
      await nextFrame();
      await nextFrame();
      if (!cancelled) reveal();
    })();
    const fs = setTimeout(reveal, 4000);
    return () => {
      cancelled = true;
      clearTimeout(fs);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // transições special <-> qr (sequencial; dropdown recolhe antes de sair, desce ao entrar)
  useEffect(() => {
    if (!visible) return;
    const cur = SCENES[idx % SCENES.length];
    const prev = prevScene.current;
    prevScene.current = cur;
    if (cur === prev) return;

    const curSpecial = cur === "special";
    const curEl = curSpecial ? spRef.current : qrRef.current;
    const prevEl = curSpecial ? qrRef.current : spRef.current;
    if (curSpecial) gsap.set(ddRef.current, { clipPath: "inset(0 0 100% 0)", y: -14 });

    const fade = timingRef.current.crossfadeMs / 1000;
    const tl = gsap.timeline();
    if (!curSpecial) tl.to(ddRef.current, { clipPath: "inset(0 0 100% 0)", y: -14, duration: 0.28, ease: "back.in(1.6)" }, 0);
    tl.to(prevEl, { opacity: 0, duration: fade, ease: "power1.inOut" }, !curSpecial ? 0.1 : 0);
    tl.to(curEl, { opacity: 1, duration: fade, ease: "power1.inOut" });
    if (curSpecial) tl.to(ddRef.current, { clipPath: "inset(0 0 0% 0)", y: 0, duration: 0.55, ease: "back.out(1.7)" }, "-=0.05");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, visible]);

  return (
    <div id="rot-stage" ref={stageRef}>
      <style>{STYLE}</style>
      <div className="rot-scenes">
        <div className="rot-scene rot-scene-qr" ref={qrRef}>
          <div className="rot-qr-wrap">
            <img
              className="rot-qr-code"
              src={QR_SRC}
              alt="QR code"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = QR_DEFAULT;
              }}
            />
          </div>
        </div>
        <div className="rot-scene rot-scene-special" ref={spRef}>
          <div className="rot-board-wrap">
            <div className="rot-card-stack">
              {card ? <ArenaCard textureUrl={textureUrl} {...card} /> : null}
            </div>
            <div className="rot-dropdown" ref={ddRef}>
              <Top3
                base={MINI}
                period={PERIOD}
                limit={3}
                compact
                entries={entries}
                onReady={() => {
                  top3ReadyRef.current = true;
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const STYLE = `
html, body {
  margin: 0;
  width: 360px;
  height: 290px;
  background: transparent;
  overflow: hidden;
}
/* #root cumpre o papel do #wgt nativo: começa oculto, o reveal-on-complete revela. */
#root { width: 360px; height: 290px; opacity: 0; }

#rot-stage { position: absolute; top: 0; left: 0; width: 360px; height: 290px; }
.rot-scenes { position: absolute; inset: 0; }
.rot-scene { position: absolute; inset: 0; opacity: 0; pointer-events: none; }

.rot-qr-wrap { position: absolute; top: 0; left: 50%; transform: translateX(-50%); width: 211px; height: 290px; background: url(${QR_ART}) center top / contain no-repeat; }
.rot-qr-code { position: absolute; top: 63.4%; left: 50%; transform: translate(-50%, -50%); width: 95%; height: auto; display: block; }

.rot-board-wrap { position: absolute; top: ${OTHERS_TOP}px; left: 0; width: 360px; }
.rot-card-stack { position: relative; z-index: 2; width: 360px; height: 90px; }
.rot-dropdown {
  position: absolute; top: 80px; left: 0; width: 339px; z-index: 1;
  background: #fff9f2;
  border-radius: 0 0 16px 16px;
  padding: 10px 10px 6px;
}
`;
