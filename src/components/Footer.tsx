import { SITE_DATA } from '../data';

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer
      className="relative w-full py-12 border-t"
      style={{
        backgroundColor: 'var(--color-black)',
        borderColor: 'rgba(255,255,255,0.05)',
      }}
    >
      <div className="max-w-screen-xl mx-auto px-8 md:px-16 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <span
          className="font-serif text-base tracking-[0.12em] text-white/30"
          style={{ fontFamily: 'var(--font-serif)' }}
        >
          {SITE_DATA.name}
        </span>

        <p className="font-sans text-[0.65rem] tracking-[0.15em] text-white/20">
          &copy; {year} {SITE_DATA.name}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
