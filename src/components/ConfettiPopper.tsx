import { useEffect, useMemo, useState } from 'react';
import '../styles/components/ConfettiPopper.css';

interface ConfettiPiece {
  id: string;
  left: string;
  bottom: string;
  delay: string;
  duration: string;
  rotate: string;
  tx: string;
  ty: string;
  size: string;
  color: string;
  shape: 'rect' | 'circle';
}

const CONFETTI_COLORS = [
  '#f59e0b',
  '#b45309',
  '#fbbf24',
  '#fcd34d',
  '#fde68a',
  '#ffffff',
  '#ef4444',
  '#10b981',
  '#a855f7',
  '#38bdf8',
];

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function getBurstSettings(): {
  countPerSide: number;
  distanceMin: number;
  distanceMax: number;
  sizeMin: number;
  sizeMax: number;
} {
  if (typeof window === 'undefined') {
    return { countPerSide: 48, distanceMin: 380, distanceMax: 760, sizeMin: 8, sizeMax: 14 };
  }

  if (window.innerWidth >= 1200) {
    return { countPerSide: 72, distanceMin: 520, distanceMax: 980, sizeMin: 9, sizeMax: 16 };
  }

  if (window.innerWidth >= 901) {
    return { countPerSide: 58, distanceMin: 460, distanceMax: 880, sizeMin: 8, sizeMax: 15 };
  }

  if (window.innerWidth >= 641) {
    return { countPerSide: 44, distanceMin: 340, distanceMax: 680, sizeMin: 7, sizeMax: 13 };
  }

  return { countPerSide: 34, distanceMin: 260, distanceMax: 520, sizeMin: 7, sizeMax: 12 };
}

function createBurstParticles(
  side: 'left' | 'right',
  count: number,
  settings: ReturnType<typeof getBurstSettings>,
): ConfettiPiece[] {
  return Array.from({ length: count }, (_, index) => {
    const originLeft = side === 'left'
      ? randomBetween(2, 18)
      : randomBetween(82, 98);
    const originBottom = randomBetween(4, 22);
    const angleSpread = side === 'left'
      ? randomBetween(235, 315)
      : randomBetween(225, 305);
    const distance = randomBetween(settings.distanceMin, settings.distanceMax);
    const radians = (angleSpread * Math.PI) / 180;
    const tx = Math.cos(radians) * distance;
    const ty = Math.sin(radians) * distance;
    const size = randomBetween(settings.sizeMin, settings.sizeMax);

    return {
      id: `${side}-${index}-${Math.random().toString(36).slice(2, 7)}`,
      left: `${originLeft}%`,
      bottom: `${originBottom}%`,
      delay: `${randomBetween(0, 0.22).toFixed(3)}s`,
      duration: `${randomBetween(1.35, 2.15).toFixed(3)}s`,
      rotate: `${randomBetween(0, 1080).toFixed(1)}deg`,
      tx: `${tx.toFixed(1)}px`,
      ty: `${ty.toFixed(1)}px`,
      size: `${size.toFixed(1)}px`,
      color: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
      shape: Math.random() > 0.4 ? 'rect' : 'circle',
    };
  });
}

function createBurst(side: 'left' | 'right', settings: ReturnType<typeof getBurstSettings>): ConfettiPiece[] {
  return createBurstParticles(side, settings.countPerSide, settings);
}

interface ConfettiPopperProps {
  active: boolean;
  burstKey?: number | string | null;
}

export function ConfettiPopper({ active, burstKey = 0 }: ConfettiPopperProps) {
  const [renderKey, setRenderKey] = useState(0);
  const [burstSettings, setBurstSettings] = useState(getBurstSettings);

  useEffect(() => {
    if (!active) {
      return;
    }

    setBurstSettings(getBurstSettings());
    setRenderKey((value) => value + 1);
  }, [active, burstKey]);

  const particles = useMemo(() => {
    if (!active) {
      return [];
    }

    return [...createBurst('left', burstSettings), ...createBurst('right', burstSettings)];
  }, [active, burstSettings, renderKey]);

  if (!active || particles.length === 0) {
    return null;
  }

  return (
    <div className="confetti-popper" aria-hidden="true">
      {particles.map((piece) => (
        <span
          key={piece.id}
          className={`confetti-piece confetti-piece-${piece.shape}`}
          style={{
            left: piece.left,
            bottom: piece.bottom,
            width: piece.size,
            height: piece.shape === 'rect' ? `calc(${piece.size} * 0.55)` : piece.size,
            backgroundColor: piece.color,
            animationDelay: piece.delay,
            animationDuration: piece.duration,
            ['--confetti-tx' as string]: piece.tx,
            ['--confetti-ty' as string]: piece.ty,
            ['--confetti-rotate' as string]: piece.rotate,
          }}
        />
      ))}
    </div>
  );
}
