import { useEffect, useState, useRef } from "react";
import gsap from "gsap";
import JackpotTicker, { HAMMER_SRC } from "./JackpotTicker";
import ArenaCard, { type ArenaCardProps } from "./ArenaCard";
import { fetchCatalog, cardAndTopForPeriod, textureUrl } from "./arena-data";
import { Top3, decodeImg, type Entry } from "./Top3";

/**
 * Rotator (standalone) — porte de frontend/src/components/widgets/Rotator.tsx (fase 2 —
 * bundle standalone). Cenas: jackpot ticker → arena (daily/weekly/monthly) → QR, com
 * crossfades GSAP. Composição/timing/CSS copiados 1:1 da fonte; duas diferenças de
 * transporte (self-contida, sem página-pai nem bus):
 *
 *  • QR: a fonte recebe `qrSvg` pronto (SVG renderizado no server, via prop). Aqui não há
 *    prop nenhuma — os params (?aff=&dest=&mode=) vêm da própria URL do embed (como a dist
 *    `qrcode` já faz) e apontam um <img> pro endpoint público `/api/widgets/qr`.
 *  • Jackpot: a fonte separa ticker (JackpotTickerStandalone, consome de um bus) da conexão
 *    de dados (JackpotRelayBridge, abre a SSE do relay e alimenta o bus) — só a ponte é
 *    montada condicionalmente (`hasJackpot`). Aqui os dois viram UM componente só
 *    (JackpotTicker, com sua própria EventSource direta — igual à dist `jackpot` sozinha),
 *    e é esse componente inteiro que só monta quando 'jackpot' está entre as cenas (mesmo
 *    efeito líquido: sem SSE aberta se o jackpot está fora do ciclo).
 *
 * Sem o FREEZE de debug da fonte (trava numa cena p/ testar localmente) — no componente
 * nativo ele já nasce sempre `null` (nunca ligado em produção); omitido aqui por ser um
 * recurso de dev inerte, não uma escolha de comportamento.
 */
const MINI = "/api/widgets/minigames"; // proxy same-origin p/ o minigames-api público
const QR_ART = "/widgets/qr-art.png";
const QR_DEFAULT = "/widgets/qr-default.svg";
// id derivado da URL sob a qual o HOST serve o embed (/widgets/overlay/<id>/ ou
// /api/widgets/dist/<id>/) — cópia do zip sob outro nome obedece ao PRÓPRIO card de
// tempos. Fora desses paths (dev server), cai em "rotator" (comportamento de sempre —
// este bundle PRECISA da config pra ciclar, então nunca fica sem poll).
const DIST_ID = location.pathname.match(/\/(?:overlay|embed)\/([^/]+)/)?.[1] ?? "rotator";
const ROTATOR_CFG = `/api/widgets/rotator-config?id=${encodeURIComponent(DIST_ID)}`;
const PERIODS = ["daily", "weekly", "monthly"] as const;

// offset (px) que desce jackpot + arena p/ alinhar com o topo do card do QR.
const OTHERS_TOP = 21;

// QR: params da própria URL do embed (o afiliado configura ?aff=&dest=&mode= no OBS) —
// mesmo contrato da dist `qrcode`. `aff` também decide se a cena de QR entra no ciclo.
const qrParams = new URLSearchParams(location.search);
const aff = qrParams.get("aff") || "";
const dest = qrParams.get("dest") || "";
const mode = qrParams.get("mode") || "";
const QR_SRC = `/api/widgets/qr?${new URLSearchParams({ aff, dest, mode }).toString()}`;

interface Cfg {
  scenes: string[];
  dwellMs: Record<string, number>;
  crossfadeMs: number;
}
// scenes VAZIO no default: não ciclar um palpite antes do 1º poll de config chegar (senão a
// cena inicial pode ser uma desabilitada → espaço em branco até o poll corrigir). O reveal
// espera a config carregar de qualquer jeito.
const DEFAULT_CFG: Cfg = {
  scenes: [],
  dwellMs: { jackpot: 15000, daily: 15000, weekly: 15000, monthly: 15000, qr: 15000 },
  crossfadeMs: 300,
};

const isArena = (s?: string) => s === "daily" || s === "weekly" || s === "monthly";
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
  const [cfg, setCfg] = useState<Cfg>(DEFAULT_CFG);
  const [ready, setReady] = useState(false);
  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(true);
  const [cards, setCards] = useState<Record<string, ArenaCardProps>>({});
  const [rankings, setRankings] = useState<Record<string, Entry[]>>({});
  const [ddPeriod, setDdPeriod] = useState<string>(PERIODS[0]);
  const [aP, setAP] = useState<string | null>(PERIODS[0]);
  const [bP, setBP] = useState<string | null>(null);
  const topLayer = useRef<"a" | "b">("a");
  const fadeTo = useRef<"a" | "b" | null>(null);
  const prevScene = useRef<string>("");
  const jpRef = useRef<HTMLDivElement>(null);
  const arenaRef = useRef<HTMLDivElement>(null);
  const qrRef = useRef<HTMLDivElement>(null);
  const ddRef = useRef<HTMLDivElement>(null);
  const aRef = useRef<HTMLDivElement>(null);
  const bRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<Record<string, ArenaCardProps>>({});
  const cfgRef = useRef<Cfg>(DEFAULT_CFG);
  const crossRef = useRef(DEFAULT_CFG.crossfadeMs / 1000);
  const sigRef = useRef("");
  const top3ReadyRef = useRef(false);
  const revealedRef = useRef(false);
  const cfgLoadedRef = useRef(false);
  const tickerSeenRef = useRef(false);

  const order = cfg.scenes;
  const scene = order.length ? order[idx % order.length] : undefined;
  const hasJackpot = order.includes("jackpot");

  const snapToScene = (s?: string) => {
    if (!jpRef.current) return;
    gsap.killTweensOf([jpRef.current, qrRef.current, arenaRef.current, ddRef.current, aRef.current, bRef.current]);
    gsap.set(jpRef.current, { opacity: s === "jackpot" ? 1 : 0 });
    gsap.set(qrRef.current, { opacity: s === "qr" ? 1 : 0 });
    gsap.set(arenaRef.current, { opacity: isArena(s) ? 1 : 0 });
    gsap.set(ddRef.current, { clipPath: isArena(s) ? "inset(0 0 0% 0)" : "inset(0 0 100% 0)", y: 0 });
    gsap.set(aRef.current, { opacity: 1 });
    gsap.set(bRef.current, { opacity: 0 });
    if (isArena(s)) {
      topLayer.current = "a";
      setDdPeriod(s as string);
      setAP(s as string);
      setBP(null);
    }
  };

  // pausa o ciclo em background e re-sincroniza ao voltar
  useEffect(() => {
    const onVis = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  // config do rotator (cenas do server + 'qr' local) — poll p/ refletir toggles (snap na cena 0).
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const url = ROTATOR_CFG + (aff ? `&aff=${encodeURIComponent(aff)}` : "");
        const c = (await (await fetch(url, { cache: "no-store" })).json()) as Partial<Cfg> & { qr?: boolean };
        if (!alive) return;
        const serverScenes = Array.isArray(c.scenes) ? c.scenes : [];
        // 'qr' entra se há aff usável (link do afiliado) E o afiliado não desligou a cena de QR
        const scenes = aff && c.qr !== false ? [...serverScenes, "qr"] : serverScenes;
        const next: Cfg = {
          scenes,
          dwellMs: { ...DEFAULT_CFG.dwellMs, ...(c.dwellMs || {}) },
          crossfadeMs: typeof c.crossfadeMs === "number" ? c.crossfadeMs : DEFAULT_CFG.crossfadeMs,
        };
        const sig = JSON.stringify(next);
        if (sig !== sigRef.current) {
          sigRef.current = sig;
          cfgRef.current = next;
          crossRef.current = next.crossfadeMs / 1000;
          setCfg(next);
        }
      } catch {
        /* mantém a config atual */
      }
      cfgLoadedRef.current = true;
      if (alive) setReady(true);
    };
    load();
    const id = setInterval(load, 8000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  // catálogo da arena (dados sempre do proxy; o que filtra é cfg.scenes)
  useEffect(() => {
    let alive = true;
    const load = async () => {
      const catalog = await fetchCatalog(MINI);
      // 1 request por período (card + ranking juntos, mesmo endpoint), os 3 EM PARALELO
      const results = await Promise.all(PERIODS.map(async (p) => ({ p, data: await cardAndTopForPeriod(MINI, catalog, p, 3) })));
      const out: Record<string, ArenaCardProps> = {};
      const ranks: Record<string, Entry[]> = {};
      for (const { p, data } of results) {
        if (data?.card) out[p] = data.card;
        if (data?.top && data.top.length) ranks[p] = data.top;
      }
      if (alive) {
        setCards(out);
        cardsRef.current = out;
        setRankings(ranks);
        PERIODS.forEach((p) => {
          if (out[p]) decodeImg(out[p].imageUrl);
        });
        decodeImg(textureUrl);
      }
    };
    load();
    const id = setInterval(load, 15000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  // estado inicial / SNAP (mount + quando a config muda)
  useEffect(() => {
    const s0 = order[0];
    prevScene.current = s0 || "";
    setIdx(0);
    snapToScene(s0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, cfg]);

  // ciclo: agenda a PRÓXIMA cena pelo dwell da atual. ≤1 cena ou aba oculta → não cicla.
  useEffect(() => {
    if (!ready || order.length <= 1 || !visible) return;
    const cur = order[idx % order.length];
    const ms = cfg.dwellMs[cur] || 15000;
    const t = setTimeout(() => setIdx((i) => (i + 1) % order.length), ms);
    return () => clearTimeout(t);
  }, [idx, ready, order, cfg.dwellMs, visible]);

  // ao voltar do background, re-sincroniza a cena atual
  useEffect(() => {
    if (visible && ready && order.length) snapToScene(order[idx % order.length]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const reveal = () => {
    if (revealedRef.current) return;
    revealedRef.current = true;
    // alvo = #wgt por id (não existe nesta dist) — fallback ao pai de #rot-stage, que é
    // #root (o container do index.html), cumprindo o mesmo papel do #wgt da página nativa.
    const root = (typeof document !== "undefined" && document.getElementById("wgt")) || stageRef.current?.parentElement;
    if (!root) return;
    const el = root as HTMLElement;
    el.style.transition = "opacity .35s ease";
    requestAnimationFrame(() => requestAnimationFrame(() => { el.style.opacity = "1"; }));
  };

  // reveal-on-complete: aparece só com a cena inicial 100% pronta. Failsafe 4s.
  useEffect(() => {
    let cancelled = false;
    const isCancelled = () => cancelled;
    (async () => {
      await until(() => cfgLoadedRef.current, isCancelled);
      if (cancelled) return;
      if (!cfgRef.current.scenes.length) {
        reveal(); // 0 cenas (tudo off + sem aff) → revela overlay vazio na hora (sem esperar 4s)
        return;
      }
      try {
        await document.fonts?.ready;
      } catch {
        /* noop */
      }
      const s0 = cfgRef.current.scenes[0] || "daily";
      if (isArena(s0)) {
        await until(() => !!cardsRef.current[s0], isCancelled);
        if (cancelled) return;
        await Promise.all([decodeImg(textureUrl), decodeImg(cardsRef.current[s0]?.imageUrl)]);
        await until(() => top3ReadyRef.current, isCancelled);
      } else if (s0 === "qr") {
        await Promise.all([decodeImg(QR_ART), decodeImg(QR_SRC)]);
      } else {
        // martelo em paralelo com o 1º dado — senão a barra revela e o martelo pipoca depois
        await Promise.all([decodeImg(HAMMER_SRC), until(() => tickerSeenRef.current, isCancelled)]);
      }
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

  // transições de cena (sequencial entre layouts; arena→arena = mix do card)
  useEffect(() => {
    if (!ready || !order.length || !visible) return;
    const cur = order[idx % order.length];
    const prev = prevScene.current;
    prevScene.current = cur;
    if (cur === prev) return;

    const curArena = isArena(cur),
      prevArena = isArena(prev);
    const fade = crossRef.current;
    const elFor = (s: string) => (s === "qr" ? qrRef.current : isArena(s) ? arenaRef.current : jpRef.current);

    if (curArena && prevArena) {
      setDdPeriod(cur);
      const back = topLayer.current === "a" ? "b" : "a";
      fadeTo.current = back;
      if (back === "a") setAP(cur);
      else setBP(cur);
      return;
    }

    const curEl = elFor(cur),
      prevEl = elFor(prev);
    if (curArena) {
      setDdPeriod(cur);
      topLayer.current = "a";
      setAP(cur);
      setBP(null);
      gsap.set(aRef.current, { opacity: 1 });
      gsap.set(bRef.current, { opacity: 0 });
      gsap.set(ddRef.current, { clipPath: "inset(0 0 100% 0)", y: -14 });
    }

    const tl = gsap.timeline();
    if (prevArena) tl.to(ddRef.current, { clipPath: "inset(0 0 100% 0)", y: -14, duration: 0.28, ease: "back.in(1.6)" }, 0);
    tl.to(prevEl, { opacity: 0, duration: fade, ease: "power1.inOut" }, prevArena ? 0.1 : 0);
    tl.to(curEl, { opacity: 1, duration: fade, ease: "power1.inOut" });
    if (curArena) tl.to(ddRef.current, { clipPath: "inset(0 0 0% 0)", y: 0, duration: 0.55, ease: "back.out(1.7)" }, "-=0.05");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, ready, visible]);

  // crossfade do card (arena→arena) após a layer de trás renderizar o novo período
  useEffect(() => {
    if (!fadeTo.current) return;
    const which = fadeTo.current;
    fadeTo.current = null;
    const inEl = which === "a" ? aRef.current : bRef.current;
    const outEl = which === "a" ? bRef.current : aRef.current;
    // fade-in POR CIMA (a layer de saída fica OPACA até o fim, embaixo): num
    // crossfade simétrico as duas layers ficam translúcidas no meio do fade e o
    // dropdown atrás do card vaza. Como os cards são arte opaca do mesmo shape,
    // só o fade-in da layer de cima já lê como crossfade — sem furo.
    gsap.set(inEl, { zIndex: 2 });
    gsap.set(outEl, { zIndex: 1 });
    gsap.to(inEl, {
      opacity: 1,
      duration: 0.5,
      ease: "power1.inOut",
      onComplete: () => gsap.set(outEl, { opacity: 0 }),
    });
    topLayer.current = which;
  }, [aP, bP]);

  return (
    <div id="rot-stage" ref={stageRef}>
      <style>{STYLE}</style>
      <div className="rot-scenes">
        <div className="rot-scene rot-scene-jackpot" ref={jpRef}>
          <div className="rot-jp-wrap">
            {/* jackpot só monta (e só abre a SSE) quando entre as cenas */}
            {hasJackpot && (
              <JackpotTicker
                onReady={() => {
                  tickerSeenRef.current = true;
                }}
              />
            )}
          </div>
        </div>
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
        <div className="rot-scene rot-scene-arena" ref={arenaRef}>
          <div className="rot-board-wrap">
            <div className="rot-card-stack">
              <div className="rot-card-wrap" ref={aRef}>
                {aP && cards[aP] ? <ArenaCard textureUrl={textureUrl} {...cards[aP]} /> : null}
              </div>
              <div className="rot-card-wrap" ref={bRef}>
                {bP && cards[bP] ? <ArenaCard textureUrl={textureUrl} {...cards[bP]} /> : null}
              </div>
            </div>
            <div className="rot-dropdown" ref={ddRef}>
              <Top3
                base={MINI}
                period={ddPeriod}
                limit={3}
                compact
                entries={rankings[ddPeriod] ?? null}
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
/* #root cumpre o papel do #wgt nativo: começa oculto, o reveal-on-complete revela quando a
   1ª cena está pronta (ver reveal()/useEffect de reveal-on-complete acima). */
#root { width: 360px; height: 290px; opacity: 0; }

#rot-stage { position: absolute; top: 0; left: 0; width: 360px; height: 290px; }
.rot-scenes { position: absolute; inset: 0; }
.rot-scene { position: absolute; inset: 0; opacity: 0; pointer-events: none; }

.rot-jp-wrap { position: absolute; top: ${OTHERS_TOP}px; left: 0; width: 360px; height: 90px; }

.rot-qr-wrap { position: absolute; top: 0; left: 50%; transform: translateX(-50%); width: 211px; height: 290px; background: url(${QR_ART}) center top / contain no-repeat; }
.rot-qr-code { position: absolute; top: 63.4%; left: 50%; transform: translate(-50%, -50%); width: 95%; height: auto; display: block; }

.rot-board-wrap { position: absolute; top: ${OTHERS_TOP}px; left: 0; width: 360px; }
.rot-card-stack { position: relative; z-index: 2; width: 360px; height: 90px; }
.rot-card-wrap { position: absolute; inset: 0; width: 360px; height: 90px; }
.rot-dropdown {
  position: absolute; top: 80px; left: 0; width: 339px; z-index: 1;
  background: #fff9f2;
  border-radius: 0 0 16px 16px;
  padding: 10px 10px 6px;
}

.rot-jp-wrap .jpt-bar { display: block !important; width: 100% !important; height: 100% !important; --bar-h: 90px !important; }
`;
