import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, X } from 'lucide-react';
import { useInView } from '../hooks';
import { PROJECTS } from '../data';
import type { Project } from '../data';
import { projectBackgroundStyle } from '../projectBackground';

/* ── VIDEO MODAL ─────────────────────────────────────────────────── */

function VideoModal({
  project,
  onClose,
}: {
  project: Project;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop"
      onClick={onClose}
    >
      <button
        className="absolute top-6 right-8 text-white/50 hover:text-white transition-colors"
        onClick={onClose}
        aria-label="Close video"
      >
        <X size={22} strokeWidth={1.5} />
      </button>

      <div
        className="relative w-full max-w-5xl mx-6 aspect-video"
        onClick={(e) => e.stopPropagation()}
      >
        {project.videoType === 'local' ? (
          /* REPLACE: for local .mp4, videoUrl is e.g. '/videos/project-1.mp4' */
          <video
            className="w-full h-full"
            src={project.videoUrl}
            controls
            autoPlay
          />
        ) : (
          /* YouTube / Vimeo embed */
          <iframe
            className="w-full h-full"
            src={`${project.videoUrl}?autoplay=1&rel=0`}
            title={project.title}
            allow="autoplay; fullscreen"
            allowFullScreen
          />
        )}
      </div>
    </div>
  );
}

/* ── SINGLE PROJECT BLOCK ────────────────────────────────────────── */

function ProjectBlock({ project, index }: { project: Project; index: number }) {
  const navigate = useNavigate();
  const { ref, inView } = useInView(0.1);
  const bgRef = useRef<HTMLDivElement>(null);
  const [showModal, setShowModal] = useState(false);
  const [bgOffset, setBgOffset] = useState(0);
  const hasDetailPage = Boolean(project.detail);

  // Parallax on the background image
  useEffect(() => {
    const onScroll = () => {
      if (!bgRef.current) return;
      const rect = bgRef.current.getBoundingClientRect();
      const center = rect.top + rect.height / 2 - window.innerHeight / 2;
      setBgOffset(center * 0.2);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const isEven = index % 2 === 0;

  return (
    <>
      {showModal && (
        <VideoModal project={project} onClose={() => setShowModal(false)} />
      )}

      <section
        ref={bgRef}
        className={`relative w-full h-[50vh] flex items-center overflow-hidden ${
          hasDetailPage ? 'cursor-pointer group/section' : ''
        }`}
        style={{ backgroundColor: 'var(--color-black)' }}
        onClick={hasDetailPage ? () => navigate(`/projects/${project.id}`) : undefined}
        onKeyDown={
          hasDetailPage
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  navigate(`/projects/${project.id}`);
                }
              }
            : undefined
        }
        role={hasDetailPage ? 'link' : undefined}
        tabIndex={hasDetailPage ? 0 : undefined}
        aria-label={hasDetailPage ? `View ${project.title} project details` : undefined}
      >
        {/* ── BACKGROUND IMAGE ──────────────────────────────────
            REPLACE: project backgroundImage in src/data.ts.
            Use a Pexels URL or a local path like '/images/project-1.jpg'.
        ─────────────────────────────────────────────────────── */}
        <div
          className="absolute inset-0 w-full h-full overflow-hidden"
        >
          <div
            className={project.backgroundImageRotation ? 'absolute' : 'absolute inset-0 w-full h-full'}
            style={projectBackgroundStyle(project, { parallaxOffset: bgOffset })}
          />
        </div>

        {/* Directional overlay — alternates side for visual rhythm */}
        <div
          className="absolute inset-0"
          style={{
            background: isEven
              ? 'linear-gradient(to right, rgba(5,5,5,0.92) 0%, rgba(5,5,5,0.7) 50%, rgba(5,5,5,0.2) 100%)'
              : 'linear-gradient(to left, rgba(5,5,5,0.92) 0%, rgba(5,5,5,0.7) 50%, rgba(5,5,5,0.2) 100%)',
          }}
        />

        {/* Top + bottom fade to black */}
        <div
          className="absolute inset-x-0 top-0 h-16"
          style={{ background: 'linear-gradient(to bottom, #050505, transparent)' }}
        />
        <div
          className="absolute inset-x-0 bottom-0 h-16"
          style={{ background: 'linear-gradient(to top, #050505, transparent)' }}
        />

        {/* ── CONTENT ─────────────────────────────────────── */}
        <div
          className={`relative z-10 w-full max-w-screen-xl mx-auto px-8 md:px-16 py-8 md:py-10 flex ${
            isEven ? 'justify-start' : 'justify-end'
          }`}
        >
          <div
            ref={ref}
            className={`max-w-xl reveal ${inView ? 'visible' : ''}`}
            style={{ transitionDelay: '0.1s' }}
          >
            {/* Category + year */}
            <div className="flex items-center gap-4 mb-6">
              <span className="accent-line" />
              <span className="font-sans text-[0.65rem] tracking-[0.25em] uppercase text-[var(--color-accent)]">
                {project.category}
              </span>
              <span className="font-sans text-[0.65rem] tracking-[0.15em] text-white/30">
                {project.year}
              </span>
            </div>

            {/* Title */}
            <h2
              className="font-serif text-[clamp(2.5rem,5vw,5rem)] font-light leading-none tracking-wide text-white mb-4"
              style={{ fontFamily: 'var(--font-serif)' }}
            >
              {project.title}
            </h2>

            {/* Subtitle */}
            <p
              className="font-sans text-xs tracking-[0.2em] uppercase text-white/40 mb-8"
            >
              {project.subtitle}
            </p>

            {/* Play Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowModal(true);
              }}
              className="group flex items-center gap-4 cursor-pointer"
              aria-label={`Play video for ${project.title}`}
            >
              {/* Circle with ripple */}
              <div className="relative flex-shrink-0">
                {/* Ripple ring */}
                <div className="absolute inset-0 rounded-full border border-white/20 play-button-ring" />
                {/* Main circle */}
                <div className="relative w-14 h-14 rounded-full border border-white/40 flex items-center justify-center group-hover:border-[var(--color-accent)] group-hover:bg-[var(--color-accent)]/10 transition-all duration-500">
                  <Play
                    size={16}
                    className="text-white/70 group-hover:text-[var(--color-accent)] transition-colors duration-300 ml-0.5"
                    fill="currentColor"
                    strokeWidth={0}
                  />
                </div>
              </div>
              <span className="font-sans text-xs tracking-[0.2em] uppercase text-white/40 group-hover:text-white/70 transition-colors duration-300">
                Watch Film
              </span>
            </button>
          </div>
        </div>
      </section>
    </>
  );
}

/* ── PROJECTS SECTION ────────────────────────────────────────────── */

export default function Projects() {
  return (
    <section id="projects">
      {PROJECTS.map((project, i) => (
        <ProjectBlock key={project.id} project={project} index={i} />
      ))}
    </section>
  );
}
