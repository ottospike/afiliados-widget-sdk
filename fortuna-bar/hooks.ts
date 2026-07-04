// Camada de DADOS do widget — o MÍNIMO que alimenta o gráfico: o total do pote.
// Transporte: SSE pública do afiliados (/api/widgets/jackpot/stream), aberta pela
// ponte do main.tsx e reemitida no event-bus ("jackpot:ticker"). O server reenvia
// o último ticker ao conectar → seed instantâneo, sem poll.
import { useState } from "react";
import useBus from "use-bus";

export function useJackpotPublicTicker() {
  const [total, setTotal] = useState<number | null>(null);

  useBus(
    "jackpot:ticker",
    (e) => {
      if (typeof e?.payload?.total === "number") setTotal(e.payload.total);
    },
    []
  );

  return { total };
}
