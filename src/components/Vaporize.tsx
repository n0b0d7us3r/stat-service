import { cloneElement, useImperativeHandle, useRef, type ReactElement, type Ref } from 'react';
import '../styles/components/Vaporize.css';

const DURATION_MS = 760;
const MAX_PARTICLES = 5200;
const VAPOR_COLORS: Array<[number, number, number]> = [
  [176, 132, 96],
  [154, 118, 92],
  [196, 146, 102],
  [138, 122, 112],
  [168, 124, 84],
  [122, 108, 102],
];

function vaporColor(): string {
  const [red, green, blue] = VAPOR_COLORS[Math.floor(Math.random() * VAPOR_COLORS.length)];
  const jitter = Math.round((Math.random() - 0.5) * 18);
  const channel = (value: number) => Math.max(0, Math.min(255, value + jitter));
  return `rgb(${channel(red)}, ${channel(green)}, ${channel(blue)})`;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  seed: number;
  color: string;
  alpha: number;
}

export interface VaporizeHandle {
  play: () => Promise<void>;
}

interface VaporizeProps {
  children: ReactElement<{ ref?: Ref<HTMLElement> }>;
  ref?: Ref<VaporizeHandle>;
}

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function parseAlpha(opacity: string): number {
  const value = Number.parseFloat(opacity);
  return Number.isFinite(value) ? value : 1;
}

function displayText(text: string, style: CSSStyleDeclaration): string {
  const trimmed = text.replace(/\s+/g, ' ');
  if (style.textTransform === 'uppercase') return trimmed.toLocaleUpperCase();
  if (style.textTransform === 'lowercase') return trimmed.toLocaleLowerCase();
  return trimmed;
}

function clipRounded(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const r = Math.min(Math.max(radius, 0), width / 2, height / 2);
  ctx.beginPath();
  if (r <= 0) {
    ctx.rect(x, y, width, height);
    return;
  }

  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function paintBorder(
  ctx: CanvasRenderingContext2D,
  style: CSSStyleDeclaration,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const sides = [
    { width: style.borderTopWidth, color: style.borderTopColor, style: style.borderTopStyle, edge: 'top' },
    { width: style.borderRightWidth, color: style.borderRightColor, style: style.borderRightStyle, edge: 'right' },
    { width: style.borderBottomWidth, color: style.borderBottomColor, style: style.borderBottomStyle, edge: 'bottom' },
    { width: style.borderLeftWidth, color: style.borderLeftColor, style: style.borderLeftStyle, edge: 'left' },
  ] as const;

  for (const side of sides) {
    const thickness = Number.parseFloat(side.width);
    if (!thickness || side.style === 'none' || side.style === 'hidden') continue;
    ctx.fillStyle = side.color;
    if (side.edge === 'top') ctx.fillRect(x, y, width, thickness);
    if (side.edge === 'right') ctx.fillRect(x + width - thickness, y, thickness, height);
    if (side.edge === 'bottom') ctx.fillRect(x, y + height - thickness, width, thickness);
    if (side.edge === 'left') ctx.fillRect(x, y, thickness, height);
  }
}

function paintText(
  ctx: CanvasRenderingContext2D,
  element: HTMLElement,
  style: CSSStyleDeclaration,
  root: DOMRect,
) {
  ctx.save();
  ctx.fillStyle = style.color;
  ctx.font = style.font;
  ctx.textBaseline = 'top';

  for (const node of element.childNodes) {
    if (node.nodeType !== Node.TEXT_NODE) continue;
    const raw = node.textContent ?? '';
    if (!raw.trim()) continue;

    const range = document.createRange();
    range.selectNodeContents(node);
    const rects = Array.from(range.getClientRects()).filter((rect) => rect.width > 0 && rect.height > 0);
    range.detach();
    if (rects.length === 0) continue;

    const text = displayText(raw, style);
    if (rects.length === 1) {
      const rect = rects[0];
      ctx.fillText(text, rect.left - root.left, rect.top - root.top, rect.width + 2);
      continue;
    }

    const totalWidth = rects.reduce((sum, rect) => sum + rect.width, 0) || 1;
    let cursor = 0;
    rects.forEach((rect, index) => {
      const share = index === rects.length - 1
        ? text.length - cursor
        : Math.max(1, Math.round(text.length * (rect.width / totalWidth)));
      const part = text.slice(cursor, cursor + share).trim();
      cursor += share;
      if (!part) return;
      ctx.fillText(part, rect.left - root.left, rect.top - root.top, rect.width + 2);
    });
  }

  ctx.restore();
}

function paintElement(
  ctx: CanvasRenderingContext2D,
  element: HTMLElement,
  root: DOMRect,
  opacity: number,
) {
  const style = getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden') return;

  const box = element.getBoundingClientRect();
  if (box.width <= 0 || box.height <= 0) return;

  const nextOpacity = opacity * parseAlpha(style.opacity);
  if (nextOpacity <= 0.01) return;

  const x = box.left - root.left;
  const y = box.top - root.top;
  const radius = Number.parseFloat(style.borderTopLeftRadius) || 0;

  ctx.save();
  ctx.globalAlpha = nextOpacity;

  const background = style.backgroundColor;
  if (background && background !== 'transparent' && background !== 'rgba(0, 0, 0, 0)') {
    ctx.fillStyle = background;
    ctx.fillRect(x, y, box.width, box.height);
  }

  if (element instanceof HTMLImageElement && element.complete && element.naturalWidth > 0) {
    ctx.drawImage(element, x, y, box.width, box.height);
  }

  paintBorder(ctx, style, x, y, box.width, box.height);

  const clips = style.overflowX === 'hidden' || style.overflowY === 'hidden' || radius > 0;
  if (clips) {
    ctx.save();
    clipRounded(ctx, x, y, box.width, box.height, radius);
    ctx.clip();
  }

  if (element.tagName !== 'svg') {
    paintText(ctx, element, style, root);
  }

  for (const child of element.children) {
    if (child instanceof HTMLElement) {
      paintElement(ctx, child, root, nextOpacity);
    }
  }

  if (clips) ctx.restore();
  ctx.restore();
}

function sampleParticles(image: ImageData, dpr: number, width: number, height: number, originX: number, originY: number): Particle[] {
  const { data } = image;
  const pixelWidth = image.width;
  const area = width * height;
  const baseStep = area > 90000 ? 3 : 2;
  const estimated = (width / baseStep) * (height / baseStep);
  const stepCss = estimated > MAX_PARTICLES ? Math.sqrt(area / MAX_PARTICLES) : baseStep;
  const step = Math.max(1, Math.round(stepCss * dpr));
  const particles: Particle[] = [];
  const centerX = width / 2;
  const centerY = height / 2;

  for (let y = 0; y < image.height; y += step) {
    for (let x = 0; x < image.width; x += step) {
      let bestAlpha = 0;
      let bestScore = -1;
      const yLimit = Math.min(image.height, y + step);
      const xLimit = Math.min(pixelWidth, x + step);

      for (let py = y; py < yLimit; py += 1) {
        for (let px = x; px < xLimit; px += 1) {
          const index = (py * pixelWidth + px) * 4;
          const pixelAlpha = data[index + 3];
          if (pixelAlpha < 28) continue;
          const red = data[index];
          const green = data[index + 1];
          const blue = data[index + 2];
          const chroma = Math.max(red, green, blue) - Math.min(red, green, blue);
          const luminance = 0.299 * red + 0.587 * green + 0.114 * blue;
          const score = luminance * 1.35 + chroma;
          if (score > bestScore) {
            bestScore = score;
            bestAlpha = pixelAlpha;
          }
        }
      }

      if (bestScore < 0) continue;

      const cssX = originX + x / dpr;
      const cssY = originY + y / dpr;
      const dx = x / dpr - centerX;
      const dy = y / dpr - centerY;
      const distance = Math.hypot(dx, dy) || 1;
      const speed = 70 + Math.random() * 150;
      particles.push({
        x: cssX,
        y: cssY,
        vx: (dx / distance) * speed * 1.05 + (Math.random() - 0.5) * 64,
        vy: (dy / distance) * speed * 0.48 - (56 + Math.random() * 130),
        size: 2 + Math.random() * 1.15,
        seed: Math.random() * Math.PI * 2,
        color: vaporColor(),
        alpha: Math.min(1, bestAlpha / 255),
      });
    }
  }

  return particles;
}

function runParticles(canvas: HTMLCanvasElement, particles: Particle[], snapshot: HTMLCanvasElement, dpr: number, pad: number, width: number, height: number): Promise<void> {
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    canvas.remove();
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const started = performance.now();

    const draw = (now: number) => {
      const progress = Math.min(1, (now - started) / DURATION_MS);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);

      if (progress < 0.05) {
        ctx.drawImage(snapshot, pad, pad, width, height);
      } else {
        const local = (progress - 0.05) / 0.95;
        for (const particle of particles) {
          const fade = (1 - local) ** 0.9;
          if (fade <= 0.01) continue;
          const travel = 1 - (1 - local) ** 2;
          const wobble = Math.sin(local * 10 + particle.seed) * 5 * local;
          ctx.globalAlpha = particle.alpha * fade;
          ctx.fillStyle = particle.color;
          const size = particle.size * (1 - local * 0.55);
          ctx.fillRect(particle.x + particle.vx * travel + wobble, particle.y + particle.vy * travel, size, size);
        }
        ctx.globalAlpha = 1;
      }

      if (progress < 1) {
        requestAnimationFrame(draw);
      } else {
        canvas.remove();
        resolve();
      }
    };

    draw(started);
  });
}

/** Разбивает элемент на мелкие частицы и рассеивает их. Элемент из вёрстки не удаляет. */
export function vaporize(element: HTMLElement): Promise<void> {
  if (prefersReducedMotion()) return Promise.resolve();

  const rect = element.getBoundingClientRect();
  if (rect.width < 2 || rect.height < 2) return Promise.resolve();

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const snapshot = document.createElement('canvas');
  snapshot.width = Math.max(1, Math.ceil(rect.width * dpr));
  snapshot.height = Math.max(1, Math.ceil(rect.height * dpr));
  const snapshotCtx = snapshot.getContext('2d', { willReadFrequently: true });
  if (!snapshotCtx) return Promise.resolve();

  snapshotCtx.scale(dpr, dpr);
  paintElement(snapshotCtx, element, rect, 1);
  const particles = sampleParticles(snapshotCtx.getImageData(0, 0, snapshot.width, snapshot.height), dpr, rect.width, rect.height, 0, 0);
  if (particles.length === 0) return Promise.resolve();

  const pad = 160;
  const canvas = document.createElement('canvas');
  canvas.className = 'vaporize-layer';
  canvas.width = Math.ceil((rect.width + pad * 2) * dpr);
  canvas.height = Math.ceil((rect.height + pad * 2) * dpr);
  canvas.style.left = `${rect.left - pad}px`;
  canvas.style.top = `${rect.top - pad}px`;
  canvas.style.width = `${rect.width + pad * 2}px`;
  canvas.style.height = `${rect.height + pad * 2}px`;
  document.body.appendChild(canvas);

  element.style.visibility = 'hidden';

  const shifted = particles.map((particle) => ({
    ...particle,
    x: particle.x + pad,
    y: particle.y + pad,
  }));

  return runParticles(canvas, shifted, snapshot, dpr, pad, rect.width, rect.height);
}

function assignRef<T>(ref: Ref<T> | undefined, value: T | null) {
  if (!ref) return;
  if (typeof ref === 'function') {
    ref(value);
    return;
  }
  ref.current = value;
}

export function Vaporize({ children, ref }: VaporizeProps) {
  const nodeRef = useRef<HTMLElement | null>(null);

  useImperativeHandle(ref, () => ({
    play() {
      const element = nodeRef.current;
      if (!element) return Promise.resolve();
      return vaporize(element);
    },
  }), []);

  return cloneElement(children, {
    ref: (node: HTMLElement | null) => {
      nodeRef.current = node;
      assignRef(children.props.ref, node);
    },
  });
}
