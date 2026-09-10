import DimmingGlowText from './DimmingGlowText';

export default function About() {
  return (
    <section
      id="about"
      className="relative w-full min-h-[50vh] flex items-center justify-center"
      style={{ backgroundColor: 'var(--site-bg)' }}
    >
      <div className="flex flex-col items-center gap-8 text-center px-6">
        <span className="font-sans text-[0.65rem] tracking-[0.3em] uppercase text-[var(--color-accent)]">
          About
        </span>

        <DimmingGlowText
          className="font-sans text-[clamp(1.1rem,2.8vw,2rem)] tracking-[0.3em] uppercase text-center"
          containerClassName="max-w-3xl"
          spotlightRadius={110}
        >
          WORK IN PROGRESS
        </DimmingGlowText>
      </div>
    </section>
  );
}
