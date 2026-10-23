import '../styles/components/Starfield.css';

interface Star {
  id: number;
  left: number;
  top: number;
  size: number;
  duration: number;
  delay: number;
  opacity: number;
}

function createStars(count: number): Star[] {
  return Array.from({ length: count }, (_, id) => ({
    id,
    left: Math.random() * 100,
    top: Math.random() * 100,
    size: Math.random() < 0.82 ? 1 + Math.random() * 1.3 : 2.1 + Math.random() * 1.5,
    duration: 32 + Math.random() * 40,
    delay: -Math.random() * 60,
    opacity: 0.35 + Math.random() * 0.65,
  }));
}

const STARS = createStars(110);

export function Starfield() {
  return (
    <div className="starfield" aria-hidden="true">
      {STARS.map((star) => (
        <span
          key={star.id}
          className="starfield-star"
          style={{
            left: `${star.left}%`,
            width: star.size,
            height: star.size,
            opacity: star.opacity,
            animationDuration: `${star.duration}s`,
            animationDelay: `${star.delay}s`,
            ['--star-top' as string]: `${star.top}%`,
          }}
        />
      ))}
    </div>
  );
}
