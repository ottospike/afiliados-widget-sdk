/**
 * ArenaCard (LIVE ESPECIAL) — variante "monthly-special-simple": o card da arena
 * mensal com SÓ duas linhas centralizadas, o lockup "LIVE ESPECIAL <prize>" e o
 * countdown. Shell (arte full-bleed + texture + overlay) igual ao ArenaCard do
 * rotator; title/playersCount são aceitos e ignorados (mesma interface — o
 * arena-data.ts importa ArenaCardProps daqui).
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

// Tamanhos FIXOS calibrados pro card 360×90 (canvas padrão do rotator).
const CSS = `
.arc-card {
  position: relative;
  box-sizing: border-box;
  width: 100%;
  max-width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
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

/* Coluna única, tudo centralizado na horizontal: lockup em cima, countdown embaixo. */
.arc-center {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.arc-live { margin: 0; display: inline-flex; align-items: center; gap: 6px; line-height: 1; white-space: nowrap; }
.arc-live-label {
  font-weight: 700;
  font-size: 20px;
  line-height: 1;
  color: #FFCD4D;
  text-transform: uppercase;
  text-shadow: 0 0 10px rgba(255, 205, 77, 0.4);
}
.arc-prize-value {
  font-weight: 700;
  font-size: 20px;
  line-height: 1;
  color: #FFCD4D;
  font-variant-numeric: tabular-nums;
  text-shadow: 0 0 10px rgba(255, 205, 77, 0.4);
  white-space: nowrap;
}

.arc-timer {
  display: inline-flex;
  align-items: center;
  padding: 4px 12px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.82);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
  font-weight: 700;
  font-size: 20px;
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

const ArenaCard = ({ imageUrl, prize, endsAt, textureUrl }: ArenaCardProps = {}) => {
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

        <div className="arc-center">
          <p className="arc-live">
            <span className="arc-live-label">Live Especial</span>
            {prize && <strong className="arc-prize-value">{prize}</strong>}
          </p>
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
