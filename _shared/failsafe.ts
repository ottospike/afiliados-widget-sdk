// Failsafe de overlay (OBS): recarrega a página SEMPRE com fadeout antes, em dois casos —
//   (1) o admin trocou/mandou recarregar o widget → poll de versão. Multi-pod-safe: lê o token
//       do banco por qualquer réplica; nada de push WS (não cruzaria os 2-5 pods sem Redis).
//   (2) a conexão de dados morreu de vez → o caller arma o "deadman" (o retry/reconnect fica
//       no caller; isto é só a escalada quando reconectar não resolve por muito tempo).
// Os dois gatilhos chamam o MESMO fadeoutReload — nunca um reload seco.

// id da dist a partir da URL sob a qual o host serve o overlay (/widgets/overlay/<id>/ ou
// /api/widgets/dist/<id>/). null fora desses paths (ex.: dev server) → sem poll de versão.
const distId = (): string | null =>
  location.pathname.match(/\/(?:overlay|dist)\/([^/]+)/)?.[1] ?? null;

let reloading = false;
// fadeout suave → reload. Idempotente: dispara uma vez só, mesmo se os dois gatilhos baterem.
export function fadeoutReload(): void {
  if (reloading) return;
  reloading = true;
  const el = document.getElementById("root") || document.body;
  try {
    el.style.transition = "opacity .35s ease";
    requestAnimationFrame(() => { el.style.opacity = "0"; });
  } catch (_) { /* noop */ }
  setTimeout(() => location.reload(), 380);
}

// (1) poll de versão: no load guarda a baseline; a cada pollMs compara; token diferente →
// fadeoutReload. 404/erro/offline → ignora (não recarrega à toa; volta a checar no próximo tick).
export function watchVersion(pollMs = 12000): void {
  const id = distId();
  if (!id) return;
  const url = `/api/widgets/dist/${encodeURIComponent(id)}/version`;
  let baseline: string | null = null;
  const tick = async () => {
    try {
      const r = await fetch(url, { cache: "no-store" });
      if (!r.ok) return;
      const v = (await r.json())?.version;
      if (typeof v !== "string") return;
      if (baseline === null) baseline = v;
      else if (v !== baseline) fadeoutReload();
    } catch (_) { /* offline → tenta no próximo tick */ }
  };
  tick();
  setInterval(tick, pollMs);
}

// (2) deadman da conexão: o caller chama o retorno a CADA frame recebido (rearma o timer). Se
// passar deadMs sem nenhum frame — apesar do retry/reconnect do caller — a conexão está morta
// de vez → fadeoutReload. deadMs é folgado de propósito (> watchdog de reconnect): reconectar
// tem prioridade; o reload é o último recurso, não reage a piscada de rede.
export function deadmanReload(deadMs = 100000): { alive: () => void; cancel: () => void } {
  let t: ReturnType<typeof setTimeout>;
  const alive = () => { clearTimeout(t); t = setTimeout(fadeoutReload, deadMs); };
  alive();
  return { alive, cancel: () => clearTimeout(t) };
}
