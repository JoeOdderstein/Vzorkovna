import { useEffect, useState } from 'react';
import { Menu, X } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useScrollY } from '../hooks';
import { SITE_DATA } from '../data';

interface NavProps {
  activeSection: string;
}

export default function Nav({ activeSection }: NavProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const scrollY = useScrollY();
  const [menuOpen, setMenuOpen] = useState(false);
  const isScrolled = scrollY > 80 || location.pathname !== '/';

  const goToSection = (id: string) => {
    setMenuOpen(false);
    const sectionId = id.toLowerCase();

    if (location.pathname !== '/') {
      navigate('/', { state: { scrollTo: sectionId } });
      return;
    }

    const el = document.getElementById(sectionId);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  const goHome = () => {
    setMenuOpen(false);
    if (location.pathname !== '/') {
      navigate('/');
      return;
    }
    goToSection('hero');
  };

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  return (
    <>
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-700 ${
          isScrolled ? 'py-4' : 'py-6'
        }`}
        style={{
          background: isScrolled
            ? 'linear-gradient(to bottom, rgba(5,5,5,0.95) 0%, rgba(5,5,5,0) 100%)'
            : 'linear-gradient(to bottom, rgba(5,5,5,0.6) 0%, rgba(5,5,5,0) 100%)',
        }}
      >
        <div className="max-w-screen-xl mx-auto px-8 flex items-center justify-between">
          {/* Logo: same file as hero — replace public/images/logo.png */}
          <button
            onClick={goHome}
            className="opacity-90 hover:opacity-100 transition-opacity duration-300"
            aria-label={`${SITE_DATA.name} — back to top`}
          >
            <img
              src={SITE_DATA.heroLogoUrl}
              alt=""
              className="h-[1.75rem] w-auto object-contain"
              draggable={false}
            />
          </button>

          {/* Desktop Links */}
          <div className="hidden md:flex items-center gap-10">
            {SITE_DATA.navLinks.map((link) => (
              <button
                key={link}
                onClick={() => goToSection(link)}
                className={`nav-link font-sans text-xs tracking-[0.2em] uppercase transition-colors duration-300 ${
                  activeSection === link.toLowerCase()
                    ? 'text-[var(--color-accent)]'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                {link}
              </button>
            ))}
          </div>

          {/* Mobile Hamburger */}
          <button
            className="md:hidden text-white/80 hover:text-white transition-colors"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
          >
            <Menu size={22} strokeWidth={1.5} />
          </button>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      <div
        className={`fixed inset-0 z-50 flex flex-col justify-center items-center transition-all duration-500 modal-backdrop ${
          menuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        <button
          className="absolute top-6 right-8 text-white/60 hover:text-white transition-colors"
          onClick={() => setMenuOpen(false)}
          aria-label="Close menu"
        >
          <X size={22} strokeWidth={1.5} />
        </button>

        <div className="flex flex-col items-center gap-10">
          {SITE_DATA.navLinks.map((link, i) => (
            <button
              key={link}
              onClick={() => goToSection(link)}
              className="font-serif text-4xl text-white/80 hover:text-white transition-colors duration-300 tracking-wide"
              style={{
                fontFamily: 'var(--font-serif)',
                transitionDelay: menuOpen ? `${i * 60}ms` : '0ms',
                transform: menuOpen ? 'translateY(0)' : 'translateY(20px)',
                opacity: menuOpen ? 1 : 0,
                transition: `opacity 0.5s ease ${i * 60}ms, transform 0.5s ease ${i * 60}ms, color 0.3s ease`,
              }}
            >
              {link}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
