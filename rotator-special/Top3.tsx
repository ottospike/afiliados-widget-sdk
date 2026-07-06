// Componente Top3 (usado pelo Rotator). Recebe a BASE do proxy same-origin
// (/api/widgets/minigames) — os endpoints do minigames-api são públicos.
// Portado de frontend/src/components/widgets/Top3.tsx (fase 2 — bundle standalone);
// medalhas servidas em /widgets/ pelo host.
// Cópia local (mesmo arquivo de widget-dists/arena/Top3.tsx) — cada dist é self-contida.
import { useEffect, useState, useRef } from 'react'

const MEDALS = ['/widgets/OURO-100.png', '/widgets/PRATA-100.png', '/widgets/BRONZE-100.png']

// preload + decode de uma imagem (resolve mesmo em erro) — pra só revelar com tudo pintado.
export function decodeImg(src?: string | null): Promise<void> {
  return new Promise((res) => {
    if (!src || typeof Image === 'undefined') {
      res()
      return
    }
    const img = new Image()
    img.src = src
    if (img.decode) img.decode().then(() => res(), () => res())
    else {
      img.onload = () => res()
      img.onerror = () => res()
    }
  })
}

export interface Entry {
  position: number
  name: string
  score: number
  reward: string | number | null
}

// tira zeros à direita: "5.00" → "5", "5.50" → "5.5" (só quando há decimal).
const trimZeros = (s: string) => (s.includes('.') ? s.replace(/0+$/, '').replace(/\.$/, '') : s)
function fmtPts(v: unknown, compact?: boolean): string {
  const n = Math.round(Number(v) || 0)
  if (compact) {
    if (n >= 1e6) return trimZeros((Math.floor(n / 1e4) / 100).toFixed(2)) + 'M' // 5000000 → "5M"
    if (n >= 1e3) return trimZeros((Math.floor(n / 100) / 10).toFixed(1)) + 'k'
    return String(n)
  }
  return n.toLocaleString('pt-BR') + ' pts'
}
function fmtPrize(r: string | number | null): string | null {
  if (r == null) return null
  const n = parseFloat(String(r).replace(/[^\d.,-]/g, '').replace(/\.(?=\d{3}\b)/g, '').replace(',', '.'))
  if (!Number.isFinite(n) || n <= 0) return null
  const frac = Math.round(n) !== n
  return 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: frac ? 2 : 0, maximumFractionDigits: 2 })
}

// gameId do período via /games (schedules); sem match → null (SEM fallback p/ games[0], evita ranking cruzado).
async function gameIdForPeriod(base: string, period: string): Promise<number | null> {
  try {
    const d = (await (await fetch(base + '/games')).json()) as { games?: { id: number; schedules?: string[] }[] }
    const games = (d && d.games) || []
    // SEM fallback pra games[0]: se nenhum jogo tem o schedule do período, retorna null (sem
    // ranking) em vez do ranking de OUTRO período (dado cruzado). Alinha com cardAndTopForPeriod,
    // que também devolve null p/ período sem jogo.
    const g = games.find((x) => (x.schedules || []).includes(period))
    return g ? g.id : null
  } catch {
    return null
  }
}
export async function fetchTop(base: string, period: string, limit: number): Promise<Entry[] | null> {
  const gameId = await gameIdForPeriod(base, period)
  if (gameId == null) return null
  try {
    const r = await fetch(`${base}/ranking/current?gameId=${gameId}&limit=${limit}`)
    if (!r.ok) return null
    const d = (await r.json()) as { entries?: Entry[] }
    return (d.entries || []) as Entry[]
  } catch {
    return null
  }
}

let cssInjected = false
function injectCss() {
  if (cssInjected || typeof document === 'undefined') return
  cssInjected = true
  const s = document.createElement('style')
  s.textContent = TOP3_CSS
  document.head.appendChild(s)
}

// `entries` controlado (prefetch externo) → renderiza na hora, sem buscar. Sem a prop, busca sozinho.
export function Top3({
  base,
  period,
  limit = 3,
  onReady,
  compact = false,
  entries: entriesProp,
}: {
  base: string
  period: string
  limit?: number
  onReady?: () => void
  compact?: boolean
  entries?: Entry[] | null
}) {
  const controlled = entriesProp !== undefined
  const [fetched, setFetched] = useState<Entry[] | null>(null)
  const entries = controlled ? entriesProp : fetched
  const readyRef = useRef(false)

  useEffect(() => {
    injectCss()
  }, [])

  // busca interna só quando NÃO controlado
  useEffect(() => {
    if (controlled) return
    let alive = true
    const load = async () => {
      const e = await fetchTop(base, period, limit)
      if (!alive || !e || !e.length) return
      setFetched(e)
      await Promise.all(MEDALS.map((m) => decodeImg(m)))
      if (alive && onReady) onReady()
    }
    load()
    const id = setInterval(load, 15000)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [base, period, limit, controlled, onReady])

  // controlado: sinaliza "pronto" na 1ª vez que recebe dados (medalhas decodificadas)
  useEffect(() => {
    if (!controlled || readyRef.current || !(entries && entries.length)) return
    readyRef.current = true
    Promise.all(MEDALS.map((m) => decodeImg(m))).then(() => onReady && onReady())
  }, [controlled, entries, onReady])

  const rows = (entries || []).slice(0, limit)
  if (!rows.length) return null

  return (
    <div className={'top3-root' + (compact ? ' compact' : '')}>
      <table className="ranking-table">
        <colgroup>
          <col className="c-pos" />
          <col className="c-name" />
          <col className="c-pts" />
          <col className="c-prize" />
        </colgroup>
        <thead>
          <tr className="rk-head">
            <th className="rk-pos">Pos.</th>
            <th className="rk-name">Usuário</th>
            <th className="rk-pts">Pontos</th>
            <th className="rk-prize">Prêmio</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((e, i) => {
            const prize = fmtPrize(e.reward)
            return (
              <tr key={e.position ?? i} className={`rk-row-${i + 1}`}>
                <td className="rk-pos">
                  {i < 3 ? (
                    <img className="rk-pos-medal" alt={`Top ${i + 1}`} src={MEDALS[i]} />
                  ) : (
                    <span className="rk-pos-num">{e.position ?? i + 1}</span>
                  )}
                </td>
                <td className="rk-name">{e.name || '—'}</td>
                <td className="rk-pts num">
                  <span className="rk-pts-tag">
                    <span className="rk-pts-val">{fmtPts(e.score, compact)}</span>
                  </span>
                </td>
                <td className="rk-prize num">
                  {prize ? (
                    <span className="rk-prize-tag">
                      <span className="rk-prize-val">{prize}</span>
                    </span>
                  ) : (
                    <span className="rk-prize-dash">—</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

const TOP3_CSS = `
@import url("https://fonts.googleapis.com/css2?family=Lilita+One&family=Lexend+Deca:wght@400;600;700&display=swap");

:root {
  --c-violet-text: #5b1a93;
  --c-cream-2: #fff4df;
  --c-cream-1: #fffae0;
  --c-beige-dark: #c9b48a;
  --c-brown: #3b1b0d;
  --c-gold-1: #ffe566;
  --c-gold-2: #f6c431;
  --c-gold-edge: #9a7000;
  --c-gold-ink: #5a3800;
  --r-md: 16px;
  --r-pill: 999px;
  --font-display: "Lilita One", system-ui, sans-serif;
  --font-body: "Lexend Deca", system-ui, sans-serif;
}

.top3-root, .top3-root * { box-sizing: border-box; }
.top3-root {
  width: 100%;
  max-width: 760px;
  margin: 0 auto;
  font-family: var(--font-body);
}

.ranking-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0 10px;
  color: var(--c-brown);
  table-layout: fixed;
}
.c-pos { width: 96px; }
.c-pts { width: 210px; }
.c-prize { width: 210px; }

.rk-head th {
  font-family: var(--font-body);
  font-size: 15px; font-weight: 700; letter-spacing: 2.5px; text-transform: uppercase;
  color: var(--c-beige-dark);
  padding: 0 18px 10px;
  border-bottom: 2px solid rgba(201, 180, 138, 0.55);
}
.rk-head .rk-pos { text-align: center; }
.rk-head .rk-name { text-align: left; }
.rk-head .rk-pts, .rk-head .rk-prize { text-align: center; }

tbody tr td {
  background: var(--c-cream-2);
  box-shadow: 0 6px 0 rgba(201, 180, 138, 0.45);
  padding: 12px 18px;
  vertical-align: middle;
}
tbody tr td:first-child { border-radius: var(--r-md) 0 0 var(--r-md); }
tbody tr td:last-child { border-radius: 0 var(--r-md) var(--r-md) 0; }
tbody tr.rk-row-1 td {
  background: var(--c-cream-1);
  box-shadow: inset 0 0 0 2px var(--c-gold-2), 0 6px 0 rgba(201, 180, 138, 0.5), 0 0 22px rgba(246, 196, 49, 0.35);
}

.rk-pos { text-align: center; }
.rk-pos-medal { width: 52px; height: 52px; object-fit: contain; display: inline-block; vertical-align: middle; filter: drop-shadow(0 3px 4px rgba(0,0,0,.3)); }
.rk-pos-num { font-family: var(--font-display); font-size: 26px; color: var(--c-beige-dark); }

.rk-name {
  font-family: var(--font-display); font-size: 28px; letter-spacing: 0.5px;
  color: var(--c-brown); text-transform: uppercase;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}

.num { font-variant-numeric: tabular-nums; }
.rk-pts { font-family: var(--font-display); font-size: 26px; color: var(--c-violet-text); white-space: nowrap; text-align: right; }
.rk-pts-tag { display: inline-grid; align-items: center; justify-items: center; }
.rk-pts-val { grid-area: 1 / 1; }

.rk-prize { text-align: right; white-space: nowrap; }
.rk-prize-tag {
  display: inline-grid; justify-items: center; align-items: center; text-align: center;
  font-family: var(--font-display); font-size: 21px;
  color: var(--c-gold-ink);
  background: linear-gradient(180deg, var(--c-gold-1) 0%, var(--c-gold-2) 55%, #e8a91c 100%);
  border: 2px solid var(--c-gold-edge);
  border-radius: var(--r-pill); padding: 6px 18px;
  box-shadow: inset 0 2px 0 rgba(255, 255, 255, 0.6), 0 4px 0 var(--c-gold-edge);
}
.rk-prize-tag::before { content: "R$ 1.000.000"; grid-area: 1 / 1; visibility: hidden; pointer-events: none; }
.rk-prize-val { grid-area: 1 / 1; }
.rk-prize-dash { color: var(--c-beige-dark); font-family: var(--font-display); font-size: 22px; }

.top3-root.compact .ranking-table { table-layout: auto; width: 100%; border-spacing: 0 6px; }
.top3-root.compact .c-pos { width: 1px; }
.top3-root.compact .c-pts { width: 1px; }
.top3-root.compact .c-prize { width: 1px; }
.top3-root.compact .rk-head th { font-size: 8px; letter-spacing: 1px; padding: 0 8px 4px; }
.top3-root.compact tbody tr td { padding: 5px 8px; box-shadow: 0 3px 0 rgba(201, 180, 138, 0.45); }
.top3-root.compact tbody tr td:first-child { border-radius: 10px 0 0 10px; }
.top3-root.compact tbody tr td:last-child { border-radius: 0 10px 10px 0; }
.top3-root.compact tbody tr.rk-row-1 td { box-shadow: inset 0 0 0 1.5px var(--c-gold-2), 0 3px 0 rgba(201, 180, 138, 0.5), 0 0 14px rgba(246, 196, 49, 0.3); }
.top3-root.compact .rk-pos-medal { width: 30px; height: 30px; }
.top3-root.compact .rk-pos-num { font-size: 16px; }
.top3-root.compact .rk-name { font-size: 15px; letter-spacing: 0; }
.top3-root.compact .rk-pts { font-size: 13px; }
/* compact: SEM reserva de largura — as badges (pílula de prêmio e tag de pontos)
   abraçam o próprio conteúdo. A reserva ("R$ 1.000.000"/"00.00M") esticava as
   pílulas dos 3 lugares pra largura do maior prêmio possível. */
.top3-root.compact .rk-pts-tag::before { content: none; }
.top3-root.compact .rk-prize-tag::before { content: none; }
.top3-root.compact .rk-prize-tag { font-size: 11px; padding: 3px 9px; border-width: 1.5px; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.55), 0 2px 0 var(--c-gold-edge); }
.top3-root.compact .rk-prize-dash { font-size: 14px; }
`
