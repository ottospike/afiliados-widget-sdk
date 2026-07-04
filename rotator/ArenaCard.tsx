/**
 * ArenaCard — card "Arena Panda" individual, visual cheio (banner).
 * ================================================================
 * Arte full-bleed (cover) + prêmio dourado + nome do jogo + countdown + pill de
 * participantes. SEM o badge de notificação (overlay limpo).
 * Portado de frontend/src/components/widgets/ArenaCard.tsx (fase 2 — bundle standalone).
 * Cópia local (mesmo arquivo de widget-dists/arena/ArenaCard.tsx) — cada dist é self-contida.
 */
import { useEffect, useState, type CSSProperties } from "react";

// ─── Countdown (cópia de hooks/core/useCountdownParts.js) ────────────────
const pad2 = (n: number) => String(n).padStart(2, "0");

const useCountdownParts = (endsAt: string | null | undefined) => {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    if (!endsAt) return undefined;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [endsAt]);
  if (!endsAt || now == null) {
    return { days: "00", hours: "00", minutes: "00", seconds: "00" };
  }
  const ms = Math.max(0, new Date(endsAt).getTime() - now);
  return {
    days: pad2(Math.floor(ms / 86_400_000)),
    hours: pad2(Math.floor((ms % 86_400_000) / 3_600_000)),
    minutes: pad2(Math.floor((ms % 3_600_000) / 60_000)),
    seconds: pad2(Math.floor((ms % 60_000) / 1000)),
  };
};

// 1247 → "1,2k", 1_247_863 → "1,2M".
const formatPlayers = (n: number | null | undefined) => {
  if (n == null) return "";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(".", ",")}M`;
  if (n >= 1_000) return `${(n / 1000).toFixed(1).replace(".", ",")}k`;
  return String(n);
};

// Troféu inline (mesmo path do solar:cup-star-bold).
const TrophyIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    role="img"
    className={className}
    width="1em"
    height="1em"
    viewBox="0 0 24 24"
  >
    <path
      fill="currentColor"
      d="M22 8.162v.073c0 .86 0 1.291-.207 1.643s-.584.561-1.336.98l-.793.44c.546-1.848.729-3.834.796-5.532l.01-.221l.002-.052c.651.226 1.017.395 1.245.711c.283.393.283.915.283 1.958m-20 0v.073c0 .86 0 1.291.207 1.643s.584.561 1.336.98l.794.44c-.547-1.848-.73-3.834-.797-5.532l-.01-.221l-.001-.052c-.652.226-1.018.395-1.246.711C2 6.597 2 7.12 2 8.162"
    />
    <path
      fill="currentColor"
      fillRule="evenodd"
      d="M12 2c1.784 0 3.253.157 4.377.347c1.139.192 1.708.288 2.184.874s.45 1.219.4 2.485c-.172 4.349-1.11 9.78-6.211 10.26V19.5h1.43a1 1 0 0 1 .98.804l.19.946H18a.75.75 0 0 1 0 1.5H6a.75.75 0 0 1 0-1.5h2.65l.19-.946a1 1 0 0 1 .98-.804h1.43v-3.534c-5.1-.48-6.038-5.912-6.21-10.26c-.051-1.266-.076-1.9.4-2.485c.475-.586 1.044-.682 2.183-.874A26.4 26.4 0 0 1 12 2m.952 4.199l-.098-.176C12.474 5.34 12.284 5 12 5s-.474.34-.854 1.023l-.098.176c-.108.194-.162.29-.246.354c-.085.064-.19.088-.4.135l-.19.044c-.738.167-1.107.25-1.195.532s.164.577.667 1.165l.13.152c.143.167.215.25.247.354s.021.215 0 .438l-.02.203c-.076.785-.114 1.178.115 1.352c.23.174.576.015 1.267-.303l.178-.082c.197-.09.295-.135.399-.135s.202.045.399.135l.178.082c.691.319 1.037.477 1.267.303s.191-.567.115-1.352l-.02-.203c-.021-.223-.032-.334 0-.438s.104-.187.247-.354l.13-.152c.503-.588.755-.882.667-1.165c-.088-.282-.457-.365-1.195-.532l-.19-.044c-.21-.047-.315-.07-.4-.135c-.084-.064-.138-.16-.246-.354"
      clipRule="evenodd"
    />
  </svg>
);

// Tamanhos FIXOS calibrados pro card de 227x87 (mesma proporção do SidebarLoyalty).
// (cqi/container-query não constringe aqui — o texto nowrap estourava a largura.)
const CSS = `
.arc-card {
  position: relative;
  box-sizing: border-box;
  width: 100%;
  max-width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 8px 12px;
  border-radius: 14px;
  overflow: hidden;
  background-color: #0C0C0C;
  background-image:
    linear-gradient(180deg, rgba(12, 12, 12, 0.40) 0%, rgba(12, 12, 12, 0.85) 100%),
    var(--arc-texture, none);
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  color: #fff;
  font-family: "Special Gothic", "Aestetico", system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif;
}

.arc-media { position: absolute; inset: 0; z-index: 0; border-radius: inherit; overflow: hidden; }
.arc-media-inner { width: 100%; height: 100%; object-fit: cover; object-position: center; display: block; }

.arc-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    linear-gradient(90deg, rgba(12, 12, 12, 0) 28%, rgba(12, 12, 12, 0.55) 72%, rgba(12, 12, 12, 0.80) 100%),
    linear-gradient(180deg, rgba(12, 12, 12, 0.55) 0%, rgba(12, 12, 12, 0.20) 42%, rgba(12, 12, 12, 0.62) 100%);
}

.arc-players {
  position: absolute;
  left: 9px;
  top: 9px;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 7px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.55);
  border: 1px solid rgba(255, 255, 255, 0.12);
  font-size: 9px;
  color: rgba(255, 255, 255, 0.9);
  white-space: nowrap;
}
.arc-players b { color: #fff; font-weight: 700; font-variant-numeric: tabular-nums; }
.arc-players-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #22C55E;
  flex: 0 0 auto;
  animation: arcLivePulse 1.6s cubic-bezier(0.16, 1, 0.3, 1) infinite;
}
@keyframes arcLivePulse {
  0%   { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.55); }
  70%  { box-shadow: 0 0 0 6px rgba(34, 197, 94, 0); }
  100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); }
}
@media (prefers-reduced-motion: reduce) { .arc-players-dot { animation: none; } }

.arc-body {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  text-align: right;
  gap: 4px;
  max-width: calc(100% - 22px);
}

.arc-prize { margin: 0; display: inline-flex; align-items: center; gap: 5px; line-height: 1; }
.arc-prize-icon { width: 16px; height: 16px; color: #FFCD4D; flex-shrink: 0; }
.arc-prize-value {
  font-weight: 700;
  font-size: 16px;
  line-height: 1;
  color: #FFCD4D;
  font-variant-numeric: tabular-nums;
  text-shadow: 0 0 10px rgba(255, 205, 77, 0.4);
  white-space: nowrap;
}

.arc-title {
  margin: 0;
  font-family: "Special Gothic Expanded One", "Special Gothic", "Aestetico", Impact, sans-serif;
  font-weight: 400;
  font-size: 12.5px;
  letter-spacing: 0.5px;
  line-height: 1;
  text-transform: uppercase;
  color: #fff;
  text-shadow: 0 2px 6px rgba(0, 0, 0, 0.6);
  white-space: nowrap;
}

.arc-timer {
  display: inline-flex;
  align-items: center;
  padding: 3px 9px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.82);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
  font-weight: 700;
  font-size: 10.5px;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.04em;
  color: #0C0C0C;
  white-space: nowrap;
}

.arc-coming {
  display: inline-flex;
  align-items: center;
  padding: 5px 12px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.10);
  color: rgba(255, 255, 255, 0.6);
  font-weight: 700;
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
`;

export interface ArenaCardProps {
  imageUrl?: string;
  prize?: string | null;
  title?: string | null;
  endsAt?: string | null;
  playersCount?: number | null;
  textureUrl?: string;
}

const ArenaCard = ({ imageUrl, prize, title, endsAt, playersCount, textureUrl }: ArenaCardProps = {}) => {
  const active = !!endsAt;
  const { days, hours, minutes, seconds } = useCountdownParts(active ? endsAt : null);
  const isVideo = /\.(webm|mp4)(\?|$)/i.test(imageUrl || "");
  const timerText =
    days === "00"
      ? `${hours}H ${minutes}M ${seconds}S`
      : `${days}D ${hours}H ${minutes}M ${seconds}S`;

  return (
    <>
      <style>{CSS}</style>
      <div
        className="arc-card"
        style={textureUrl ? ({ "--arc-texture": `url("${textureUrl}")` } as CSSProperties) : undefined}
      >
        {imageUrl && (
          <div className="arc-media">
            {isVideo ? (
              <video src={imageUrl} autoPlay loop muted playsInline className="arc-media-inner" />
            ) : (
              <img src={imageUrl} alt="" className="arc-media-inner" />
            )}
            <span className="arc-overlay" aria-hidden="true" />
          </div>
        )}

        {playersCount != null && (
          <span className="arc-players" aria-label={`${playersCount} jogando`}>
            <i className="arc-players-dot" aria-hidden="true" />
            <b>{formatPlayers(playersCount)}</b> jogando
          </span>
        )}

        <div className="arc-body">
          {prize && (
            <p className="arc-prize">
              <TrophyIcon className="arc-prize-icon" />
              <strong className="arc-prize-value">{prize}</strong>
            </p>
          )}
          {title && <p className="arc-title">{title}</p>}
          {active ? (
            <span className="arc-timer">{timerText}</span>
          ) : (
            <span className="arc-coming">Em breve</span>
          )}
        </div>
      </div>
    </>
  );
};

export default ArenaCard;
