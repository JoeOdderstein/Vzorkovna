import { SITE_DATA } from '../data';

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer
      className="relative w-full py-12 border-t site-border"
      style={{ backgroundColor: 'var(--site-bg)' }}
    >
      <div className="max-w-screen-xl mx-auto px-8 md:px-16 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <span
          className="font-serif text-base tracking-[0.12em] site-text-subtle"
          style={{ fontFamily: 'var(--font-serif)' }}
        >
          {SITE_DATA.name}
        </span>

        <p className="font-sans text-[0.65rem] tracking-[0.15em] site-text-faint">
          &copy; {year} {SITE_DATA.name}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
