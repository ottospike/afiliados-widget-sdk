// Camada de DADOS do widget — substitui o useArenaGamesTicker do app falando com
// o upstream (minigames-api) SÓ via proxy do SDK (/<id>/__up), exceto o config do
// CMS (imgs.kingpanda.bet.br/config.json), que é público com CORS * — mesmo
// padrão dos módulos arena/daily/weekly/monthly da plataforma (ver skill).
// Cascata (espelha o app): CMS → gameIds ativos; /games → período (schedules[0]);
// /ranking/current?gameId= → endsAt da rodada (gatilho da reta final).
import { useEffect, useState } from "react";

// base do proxy = path do módulo + /__up (derivada em runtime — contrato do SDK).
export const proxyBase = () =>
  location.pathname.replace(/\/(index\.html)?$/, "") + "/__up";

const CMS_CONFIG_URL = "https://imgs.kingpanda.bet.br/config.json";
const REFRESH_MS = 60_000; // rodadas viram/prêmios mudam devagar; countdown é local

// Período do jogo → label PT (copiado de hooks/core/useArenaGamesTicker do app).
const PERIOD_LABEL: Record<string, string> = {
  hourly: "Horário",
  daily: "Diário",
  weekly: "Semanal",
  monthly: "Mensal",
};

export interface ArenaGame {
  gameId: number;
  period: string | null;
  periodLabel: string;
  endsAt: string | null;
}

// `endsAt` da rodada aberta (prioridade: expectedEnd → endsAt) — copiado do app.
const resolveEnd = (round: any): string | null => {
  if (round?.expectedEnd) return round.expectedEnd;
  if (round?.endsAt) return round.endsAt;
  return null;
};

export function useArenaGamesTicker() {
  const [games, setGames] = useState<ArenaGame[]>([]);
  // settled = 1ª carga terminou (com OU sem dado) — gate do reveal. O estado
  // normal (billboard) tem textos fixos, então API fora ≠ overlay invisível.
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    const BASE = proxyBase();
    let cancelled = false;

    const load = async () => {
      try {
        // 1) gameIds ativos: CMS primeiro; fallback pros ids do /games.
        const cms: any = await fetch(CMS_CONFIG_URL)
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null);
        let ids: number[] = (cms?.minigames || [])
          .map((m: any) => Number(m?.gameId))
          .filter((n: number) => Number.isFinite(n) && n > 0);

        // 2) período por gameId via /games (schedules[0]).
        const api: any = await fetch(`${BASE}/games`)
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null);
        const periodById: Record<number, string | null> = {};
        (api?.games || []).forEach((g: any) => {
          const id = Number(g?.id);
          if (Number.isFinite(id)) periodById[id] = g?.schedules?.[0] || null;
        });
        if (ids.length === 0) {
          ids = Object.keys(periodById).map(Number);
        }

        // 3) endsAt da rodada aberta por jogo. Jogo que falhar entra sem timer.
        const rankings = await Promise.all(
          ids.map((id) =>
            fetch(`${BASE}/ranking/current?gameId=${id}`)
              .then((r) => (r.ok ? r.json() : null))
              .catch(() => null)
          )
        );

        if (cancelled) return;
        setGames(
          ids.map((gameId, i) => {
            const res: any = rankings[i];
            const period = periodById[gameId] || null;
            return {
              gameId,
              period,
              periodLabel: (period && PERIOD_LABEL[period]) || "",
              endsAt: resolveEnd(res?.round),
            };
          })
        );
      } finally {
        if (!cancelled) setSettled(true);
      }
    };

    load();
    const id = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return { games, settled };
}
