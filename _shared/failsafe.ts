// Failsafe de overlay (OBS): recarrega a página SEMPRE com fadeout antes, em dois casos —
//   (1) o admin trocou/mandou recarregar o widget → poll de versão. Multi-pod-safe: lê o token
//       do banco por qualquer réplica; nada de push WS (não cruzaria os 2-5 pods sem Redis).
//   (2) a conexão de dados morreu de vez → o caller arma o "deadman" (o retry/reconnect fica
//       no caller; isto é só a escalada quando reconectar não resolve por muito tempo).
// Os dois gatilhos chamam o MESMO fadeoutReload — nunca um reload seco.

// id da dist a partir da URL sob a qual o host serve o overlay: /widgets/overlay/<id>/ (novo)
// e /widgets/embed/<id>/ (alias legado, ainda usado por OBS de afiliados reais). null fora
// desses paths (ex.: dev server) → sem poll de versão.
const distId = (): string | null =>
  location.pathname.match(/\/(?:overlay|embed)\/([^/]+)/)?.[1] ?? null;

// logging de diagnóstico SEMPRE ligado (o console do overlay não é visível pro viewer, e
// ajuda a depurar no OBS). No console, filtre por "failsafe" pra ver só estes.
const log = (...a: unknown[]) => console.log("[failsafe]", ...a);

let reloading = false;
// fadeout suave → reload. Idempotente: dispara uma vez só, mesmo se os dois gatilhos baterem.
export function fadeoutReload(): void {
  if (reloading) return;
  reloading = true;
  log("fadeout → reload em 380ms");
  const el = document.getElementById("root") || document.body;
  try {
    el.style.transition = "opacity .35s ease";
    requestAnimationFrame(() => { el.style.opacity = "0"; });
  } catch (_) { /* noop */ }
  setTimeout(() => location.reload(), 380);
}

// gatilho manual (dev/console): __wgtReload() dispara o MESMO caminho dos failsafes
// (fadeout + reload) — valida o comportamento sem esperar troca de versão nem deadman.
try { (window as unknown as Record<string, unknown>).__wgtReload = fadeoutReload; } catch (_) { /* sem window (harness) */ }

// (1) poll de versão: no load guarda a baseline; a cada pollMs compara; token diferente →
// fadeoutReload. 404/erro/offline → ignora (não recarrega à toa; volta a checar no próximo tick).
export function watchVersion(pollMs = 12000): void {
  const id = distId();
  if (!id) return;
  const url = `/api/widgets/dist/${encodeURIComponent(id)}/version`;
  // baseline = a versão CARIMBADA no HTML servido (<meta wgt-version>, injetada por
  // serveWidgetDist). Assim não dependemos de um 1º poll pra fixar a baseline — se o boot for
  // offline e um bump cair na janela, ainda comparamos contra a versão real do serve, não
  // adotamos a nova como baseline. Sem o meta (dev / HTML antigo) → cai no 1º poll.
  let baseline: string | null =
    document.querySelector('meta[name="wgt-version"]')?.getAttribute("content") ?? null;
  log("watchVersion ativo — id=", id, "baseline=", baseline, baseline ? "(meta)" : "(vai do 1º poll)");
  const tick = async () => {
    try {
      const r = await fetch(url, { cache: "no-store" });
      if (!r.ok) { log("poll falhou:", r.status); return; }
      const v = (await r.json())?.version;
      if (typeof v !== "string") return;
      if (baseline === null) { baseline = v; log("baseline fixada no 1º poll:", v); }
      else if (v !== baseline) { log("versão mudou:", baseline, "→", v, "— recarregando"); fadeoutReload(); }
      else log("poll ok, versão igual:", v);
    } catch (_) { log("poll offline — tenta no próximo tick"); }
  };
  tick();
  setInterval(tick, pollMs);
}

// (2) deadman da conexão: o caller chama alive() a CADA frame recebido (rearma o timer). Se
// passar deadMs sem nenhum frame — apesar do retry/reconnect do caller — a conexão está morta
// de vez → fadeoutReload. deadMs é folgado de propósito (> watchdog de reconnect): reconectar
// tem prioridade; o reload é o último recurso, não reage a piscada de rede.
// CAP: 1 reload por EPISÓDIO de morte. Marca em sessionStorage antes de recarregar; se recarregar
// e ainda assim não voltar frame (backend fora), o deadman seguinte NÃO recarrega de novo (só
// segue reconectando) — senão viraria reload a cada deadMs com o backend down. O episódio
// encerra quando volta a chegar frame (alive() limpa a marca). sessionStorage sobrevive ao
// reload no mesmo source do OBS; indisponível (ex.: harness) → cap desligado, recarrega sempre.
const DEAD_KEY = "wgt:deadReloaded";
export function deadmanReload(deadMs = 100000): { alive: () => void; cancel: () => void } {
  let t: ReturnType<typeof setTimeout>;
  const fire = () => {
    try {
      if (sessionStorage.getItem(DEAD_KEY)) { log("deadman disparou mas já recarregou neste episódio — só reconecta"); return; }
      sessionStorage.setItem(DEAD_KEY, "1");
    } catch (_) { /* sem sessionStorage → sem cap */ }
    log("deadman: sem frame há", deadMs + "ms — socket morto, recarregando");
    fadeoutReload();
  };
  const rearm = () => { clearTimeout(t); t = setTimeout(fire, deadMs); };
  const alive = () => { try { sessionStorage.removeItem(DEAD_KEY); } catch (_) {} rearm(); }; // frame → episódio encerra
  rearm(); // arma SEM limpar a marca (preserva o cap entre reloads)
  return { alive, cancel: () => clearTimeout(t) };
}
