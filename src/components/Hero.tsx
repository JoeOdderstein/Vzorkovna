import { useRef, useEffect } from 'react';
import DimmingGlowText from './DimmingGlowText';
import { useScrollY } from '../hooks';
import { SITE_DATA } from '../data';

export default function Hero() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const scrollY = useScrollY();

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.play().catch(() => {
      // Autoplay blocked — browser will show poster
    });
  }, []);

  // Subtle parallax: video moves up slightly as you scroll
  const parallaxOffset = scrollY * 0.3;

  return (
    <section
      id="hero"
      className="relative w-full h-screen overflow-hidden flex items-center justify-center"
      style={{ backgroundColor: 'var(--site-bg)' }}
    >
      {/* Background video: replace public/videos/hero.mp4 to update */}
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover"
        style={{ backgroundColor: 'var(--site-bg)' }}
        style={{ transform: `translateY(${parallaxOffset}px) scale(1.1)` }}
        src={SITE_DATA.heroVideoUrl}
        poster={SITE_DATA.heroPosterUrl}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
      />

      {/* Dark overlay + bottom gradient fade to black */}
      <div className="absolute inset-0 video-overlay" />

      {/* Hero logo: replace public/images/logo.png to update */}
      <div className="relative z-10 text-center px-6 flex flex-col items-center overflow-visible">
        <img
          src={SITE_DATA.heroLogoUrl}
          alt={SITE_DATA.name}
          className="h-[clamp(3rem,8vw,8rem)] w-auto mb-6 object-contain"
          draggable={false}
        />

        <DimmingGlowText>{SITE_DATA.tagline}</DimmingGlowText>
      </div>

      {/* ── SCROLL INDICATOR ──────────────────────────────── */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-2">
        <span className="golden-glow-text font-sans text-[0.6rem] tracking-[0.3em] uppercase">
          Scroll
        </span>
        <div className="w-px h-10 scroll-indicator-dot" />
      </div>
    </section>
  );
}
