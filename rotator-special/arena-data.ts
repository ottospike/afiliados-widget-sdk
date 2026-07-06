// Helpers de dados da Arena (portado de frontend/src/lib/widgets/arena-data.ts, fase 2 —
// bundle standalone). Conteúdo via CMS (config.json, CORS *); período/ranking via proxy
// same-origin /api/widgets/minigames (endpoints públicos do minigames-api, sem auth).
// Cópia local do mesmo arquivo já usado em widget-dists/arena/ — cada dist é self-contida
// (o build da SDK builda cada pasta isolada, sem imports cross-folder).
import type { ArenaCardProps } from './ArenaCard'
import type { Entry } from './Top3'

export const CONFIG_URL = 'https://imgs.kingpanda.bet.br/config.json'

// textura de fundo do ArenaCard, servida pelo host (mesma origem do dist). Usada pelo rotator.
export const textureUrl = '/widgets/the-panda-way.webp'

export interface ApiGame {
  id: number
  name?: string
  schedules?: string[]
  thumbnailUrl?: string
}

export interface CmsMinigame {
  gameId: number
  title?: string
  prize?: string
  imageUrl?: string
  imageUrlSquare?: string
}

export interface Catalog {
  games: ApiGame[]
  cms: CmsMinigame[]
}

const tokensOf = (s: string | undefined): string[] =>
  (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 3)

export function matchCms(cms: CmsMinigame[], apiGame: ApiGame): CmsMinigame | null {
  const byId = (cms || []).find((c) => Number(c.gameId) === Number(apiGame.id))
  if (byId) return byId
  const toks = tokensOf(apiGame.name)
  return (
    (cms || []).find((c) => {
      const u = (c.imageUrl || '').toLowerCase()
      return toks.some((t) => u.includes(t))
    }) || null
  )
}

// catálogo (games da API + minigames do CMS) — buscar 1x.
export async function fetchCatalog(base: string): Promise<Catalog> {
  const [games, cms] = await Promise.all([
    fetch(`${base}/games`)
      .then((r) => r.json())
      .then((d: { games?: ApiGame[] }) => d.games || [])
      .catch(() => [] as ApiGame[]),
    fetch(CONFIG_URL)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { minigames?: CmsMinigame[] } | null) => (d && d.minigames) || [])
      .catch(() => [] as CmsMinigame[]),
  ])
  return { games, cms }
}

// card + Top3 de UM período com UMA ÚNICA busca ao ranking. Antes eram 2 chamadas ao MESMO
// endpoint /ranking/current (uma sem limit p/ o card, outra com &limit p/ o top3); a resposta
// COM limit já é superset — traz round.endsAt + totalPlayers (card) E entries (top3). Resolve o
// gameId pelo catálogo (sem re-buscar /games). Sem jogo pro período → null (sem cena/ranking cruzado).
export async function cardAndTopForPeriod(
  base: string,
  catalog: Catalog,
  period: string,
  limit = 3,
): Promise<{ card: ArenaCardProps; top: Entry[] } | null> {
  const apiGame = (catalog.games || []).find((g) => (g.schedules || []).includes(period))
  if (!apiGame) return null
  const c = matchCms(catalog.cms, apiGame)

  let endsAt: string | null = null
  let players: number | null = null
  let top: Entry[] = []
  try {
    const r = await fetch(`${base}/ranking/current?gameId=${apiGame.id}&limit=${limit}`)
    if (r.ok) {
      const d: { round?: { endsAt?: string }; totalPlayers?: number; entries?: Entry[] } = await r.json()
      endsAt = (d.round && d.round.endsAt) || null
      players = typeof d.totalPlayers === 'number' ? d.totalPlayers : null
      top = (d.entries || []) as Entry[]
    }
  } catch {
    /* mantém último bom estado */
  }

  return {
    card: {
      imageUrl: (c && (c.imageUrl || c.imageUrlSquare)) || apiGame.thumbnailUrl || '',
      prize: c && c.prize ? c.prize : null,
      // título = NOME do jogo, sem o sufixo " - <período>".
      title: (apiGame.name || '').replace(/\s*[-–—]\s*\S+\s*$/, '').trim() || apiGame.name || null,
      playersCount: players,
      endsAt,
    },
    top,
  }
}
