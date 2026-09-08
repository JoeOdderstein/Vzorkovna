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
      className={`reveal ${inView ? 'visible' : ''} relative w-full max-w-[56vw] lg:max-w-none shrink-0 row-start-1 ${
        isLeft ? 'col-start-1' : 'col-start-3 justify-self-end'
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
            ? 'linear-gradient(to right, transparent, var(--site-bg))'
            : 'linear-gradient(to left, transparent, var(--site-bg))',
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
      style={{ backgroundColor: 'var(--site-bg)' }}
    >
      {/* Subtle background texture */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, transparent, transparent 79px, rgba(255,255,255,0.8) 79px, rgba(255,255,255,0.8) 80px)',
        }}
      />

      <div className="relative z-10 grid grid-cols-[minmax(75px,56vw)_1fr_minmax(75px,56vw)] lg:grid-cols-[44vw_1fr_44vw] items-center">
        <AboutPortrait
          src={SITE_DATA.about.portraitUrl}
          side="left"
          inView={leftPortraitInView}
          portraitRef={leftPortraitRef}
        />

        {/* Text — full-width centered overlay on mobile; grid column on desktop */}
        <div
          ref={textRef}
          className={`reveal ${textInView ? 'visible' : ''} absolute inset-x-0 top-0 bottom-0 z-20 flex items-center justify-center overflow-hidden max-lg:pointer-events-none lg:relative lg:col-start-2 lg:row-start-1 lg:flex lg:items-center lg:justify-center lg:overflow-visible lg:px-6 lg:py-0 lg:-mx-10 xl:-mx-16`}
        >
          <div className="pointer-events-auto text-center max-lg:w-[8.25rem] max-lg:px-1 sm:max-lg:w-[9.5rem] lg:mx-auto lg:w-auto lg:max-w-xl">
            <span className="font-sans uppercase text-[var(--color-accent)] block max-lg:text-[0.4rem] max-lg:tracking-[0.18em] max-lg:mb-1.5 lg:text-[0.65rem] lg:tracking-[0.3em] lg:mb-6">
              About
            </span>
            <h2
              className="font-serif font-light text-white/90 max-lg:text-[clamp(0.72rem,2.1vw,3.5rem)] max-lg:leading-[1.1] max-lg:mb-2 lg:text-[clamp(1.75rem,3.5vw,3.5rem)] lg:leading-[1.15] lg:mb-8"
              style={{ fontFamily: 'var(--font-serif)' }}
            >
              {SITE_DATA.about.heading}
            </h2>
            <div className="max-lg:space-y-1.5 lg:space-y-5">
              {SITE_DATA.about.body.map((para, i) => (
                <p
                  key={i}
                  className="font-sans text-white/50 max-lg:text-[0.52rem] max-lg:leading-[1.55] lg:text-sm lg:leading-[1.85]"
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
