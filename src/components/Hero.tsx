import DimmingGlowText from './DimmingGlowText';
import HeroVideoBackground from './HeroVideoBackground';
import { useScrollY } from '../hooks';
import { SITE_DATA } from '../data';

export default function Hero() {
  const scrollY = useScrollY();
  const parallaxOffset = scrollY * 0.3;

  return (
    <section
      id="hero"
      className="relative w-full h-screen overflow-hidden flex items-center justify-center"
      style={{ backgroundColor: 'var(--site-bg)' }}
    >
      <HeroVideoBackground parallaxOffset={parallaxOffset} />

      <div className="relative z-10 text-center px-6 flex flex-col items-center overflow-visible">
        <DimmingGlowText
          className="site-logo site-logo--hero mb-6"
          containerClassName="max-w-[92vw]"
          as="h1"
          spotlightRadius={130}
        >
          Headlight Rabbits
        </DimmingGlowText>

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
