import { useInView } from '../hooks';
import { SITE_DATA } from '../data';

function AboutPortrait({
  src,
  side,
  inView,
  portraitRef,
}: {
  src: string;
  side: 'left' | 'right';
  inView: boolean;
  portraitRef: React.RefObject<HTMLDivElement>;
}) {
  const isLeft = side === 'left';

  return (
    <div
      ref={portraitRef}
      className={`reveal ${inView ? 'visible' : ''} relative w-full shrink-0 ${
        isLeft ? 'lg:col-start-1' : 'lg:col-start-3 lg:justify-self-end'
      }`}
      style={{ aspectRatio: '1350 / 1724' }}
    >
      <img
        src={src}
        alt=""
        className={`absolute inset-0 w-full h-full object-contain ${
          isLeft ? 'object-left' : 'object-right'
        }`}
        draggable={false}
      />
      <div
        className={`absolute inset-y-0 w-2/5 pointer-events-none ${
          isLeft ? 'right-0' : 'left-0'
        }`}
        style={{
          background: isLeft
            ? 'linear-gradient(to right, transparent, var(--color-black))'
            : 'linear-gradient(to left, transparent, var(--color-black))',
        }}
      />
    </div>
  );
}

export default function About() {
  const { ref: leftPortraitRef, inView: leftPortraitInView } = useInView(0.15);
  const { ref: rightPortraitRef, inView: rightPortraitInView } = useInView(0.15);
  const { ref: textRef, inView: textInView } = useInView(0.2);

  return (
    <section
      id="about"
      className="relative w-full py-16 md:py-20 overflow-hidden"
      style={{ backgroundColor: 'var(--color-black)' }}
    >
      {/* Subtle background texture */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, transparent, transparent 79px, rgba(255,255,255,0.8) 79px, rgba(255,255,255,0.8) 80px)',
        }}
      />

      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-[44vw_1fr_44vw] lg:items-center">
        <AboutPortrait
          src={SITE_DATA.about.portraitUrl}
          side="left"
          inView={leftPortraitInView}
          portraitRef={leftPortraitRef}
        />

        {/* Text — center column, can overlap portrait black areas */}
        <div
          ref={textRef}
          className={`reveal ${textInView ? 'visible' : ''} relative z-20 px-8 py-10 text-center lg:col-start-2 lg:row-start-1 lg:flex lg:items-center lg:justify-center lg:px-6 lg:-mx-10 xl:-mx-16 lg:py-0`}
        >
          <div className="mx-auto max-w-md sm:max-w-lg lg:max-w-xl">
            <span className="font-sans text-[0.65rem] tracking-[0.3em] uppercase text-[var(--color-accent)] block mb-6">
              About
            </span>
            <h2
              className="font-serif text-[clamp(1.75rem,3.5vw,3.5rem)] font-light leading-tight text-white/90 mb-8"
              style={{ fontFamily: 'var(--font-serif)', lineHeight: '1.15' }}
            >
              {SITE_DATA.about.heading}
            </h2>
            <div className="space-y-5">
              {SITE_DATA.about.body.map((para, i) => (
                <p
                  key={i}
                  className="font-sans text-sm leading-[1.85] text-white/50"
                >
                  {para}
                </p>
              ))}
            </div>
          </div>
        </div>

        <AboutPortrait
          src={SITE_DATA.about.colleaguePortraitUrl}
          side="right"
          inView={rightPortraitInView}
          portraitRef={rightPortraitRef}
        />
      </div>
    </section>
  );
}
