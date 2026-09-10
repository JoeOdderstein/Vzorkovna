import { useCallback, useRef, useState } from 'react';

const DEFAULT_SPOTLIGHT_RADIUS = 90;
// Room for text-shadow to render inside the masked layer (avoids rectangular clipping)
const GLOW_BLEED = '2rem';

const DEFAULT_TEXT_CLASS =
  'font-sans text-[clamp(0.65rem,1.2vw,0.8rem)] tracking-[0.3em] uppercase text-center';

interface DimmingGlowTextProps {
  children: string;
  className?: string;
  containerClassName?: string;
  as?: 'p' | 'h1';
  spotlightRadius?: number;
}

export default function DimmingGlowText({
  children,
  className,
  containerClassName = 'max-w-lg',
  as: Tag = 'p',
  spotlightRadius = DEFAULT_SPOTLIGHT_RADIUS,
}: DimmingGlowTextProps) {
  const maskRef = useRef<HTMLDivElement>(null);
  const [mask, setMask] = useState<string | null>(null);

  const updateMask = useCallback(
    (clientX: number, clientY: number) => {
      const el = maskRef.current;
      if (!el) return;

      const rect = el.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;

      setMask(
        `radial-gradient(circle ${spotlightRadius}px at ${x}px ${y}px, transparent 0%, rgba(0,0,0,0.4) 55%, black 100%)`
      );
    },
    [spotlightRadius]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      updateMask(e.clientX, e.clientY);
    },
    [updateMask]
  );

  const handleMouseLeave = useCallback(() => {
    setMask(null);
  }, []);

  const textClass = className ?? DEFAULT_TEXT_CLASS;

  const maskStyle = mask
    ? {
        maskImage: mask,
        WebkitMaskImage: mask,
      }
    : undefined;

  return (
    <div
      className={`dimming-glow-hit-area relative ${containerClassName} cursor-default select-none overflow-visible`}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <div className="grid overflow-visible [&>*]:col-start-1 [&>*]:row-start-1">
        <Tag className={`dimmed-glow-text ${textClass}`} aria-hidden="true">
          {children}
        </Tag>
        <div
          ref={maskRef}
          className="dimming-glow-mask col-start-1 row-start-1 overflow-visible pointer-events-none"
          style={{
            margin: `-${GLOW_BLEED}`,
            padding: GLOW_BLEED,
            ...maskStyle,
          }}
        >
          <Tag className={`golden-glow-text ${textClass}`}>{children}</Tag>
        </div>
      </div>
    </div>
  );
}
