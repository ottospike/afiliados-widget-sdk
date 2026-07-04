// Camada de DADOS do widget — o MÍNIMO que alimenta o gráfico: o total do pote.
// Transporte (espelha o app): seed + polling (2s) GET /jackpot/state via proxy
// (/<id>/__up, JWT no server) + frames do WS autenticado do relay reemitidos no
// event-bus ("jackpot:ticker") pela ponte do main.tsx (1 conexão → N consumidores).
import { useEffect, useState } from "react";
import useBus from "use-bus";

// base do proxy = path do módulo + /__up (derivada em runtime — contrato do SDK).
export const proxyBase = () =>
  location.pathname.replace(/\/(index\.html)?$/, "") + "/__up";

export function useJackpotPublicTicker() {
  const [total, setTotal] = useState<number | null>(null);

  const applyTicker = (payload: any) => {
    if (typeof payload?.total === "number") setTotal(payload.total);
  };

  // Seed + polling (2s) via proxy — mantém o count-up mesmo sem frames do WS.
  useEffect(() => {
    const url = `${proxyBase()}/jackpot/state`;
    let cancelled = false;
    const pull = () =>
      fetch(url)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (!cancelled && data) applyTicker(data);
        })
        .catch(() => {});
    pull();
    const id = setInterval(pull, 2000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  // Tempo real: frames do WS do relay, reemitidos no bus pela ponte do main.tsx.
  useBus("jackpot:ticker", (e) => applyTicker(e?.payload), []);

  return { total };
}
