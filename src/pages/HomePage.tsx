import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Hero from '../components/Hero';
import Projects from '../components/Projects';
import About from '../components/About';
import Contact from '../components/Contact';
import Footer from '../components/Footer';
import Nav from '../components/Nav';
import UnderConstructionModal from '../components/UnderConstructionModal';

const SECTIONS = ['hero', 'projects', 'about', 'contact'];

export default function HomePage() {
  const location = useLocation();
  const [activeSection, setActiveSection] = useState('hero');
  const [showConstructionNotice, setShowConstructionNotice] = useState(true);

  useEffect(() => {
    const scrollTarget =
      (location.state as { scrollTo?: string } | null)?.scrollTo ??
      location.hash.replace('#', '');

    if (!scrollTarget) return;

    const el = document.getElementById(scrollTarget);
    if (el) {
      requestAnimationFrame(() => {
        el.scrollIntoView({ behavior: 'smooth' });
      });
    }
  }, [location.state, location.hash]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { threshold: 0.3 }
    );

    SECTIONS.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <>
      {showConstructionNotice && (
        <UnderConstructionModal onClose={() => setShowConstructionNotice(false)} />
      )}
      <Nav activeSection={activeSection} />
      <Hero />
      <Projects />
      <About />
      <Contact />
      <Footer />
    </>
  );
}
