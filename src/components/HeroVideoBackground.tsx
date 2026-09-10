import { useEffect, useRef } from 'react';
import { SITE_DATA } from '../data';

interface HeroVideoBackgroundProps {
  parallaxOffset?: number;
  className?: string;
}

export default function HeroVideoBackground({
  parallaxOffset = 0,
  className = '',
}: HeroVideoBackgroundProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.play().catch(() => {
      // Autoplay blocked — browser will show poster
    });
  }, []);

  return (
    <div
      className={`absolute inset-0 overflow-hidden ${className}`}
      style={{ backgroundColor: 'var(--site-bg)' }}
    >
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover"
        style={{
          backgroundColor: 'var(--site-bg)',
          transform: `translateY(${parallaxOffset}px) scale(1.1)`,
        }}
        src={SITE_DATA.heroVideoUrl}
        poster={SITE_DATA.heroPosterUrl}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
      />
      <div className="absolute inset-0 video-overlay" />
    </div>
  );
}
