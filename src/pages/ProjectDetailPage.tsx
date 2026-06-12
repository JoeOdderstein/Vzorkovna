import { useEffect } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { ArrowLeft, Play } from 'lucide-react';
import Nav from '../components/Nav';
import { getProjectById } from '../data';
import { projectBackgroundStyle } from '../projectBackground';

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const project = id ? getProjectById(id) : undefined;

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [id]);

  if (!project?.detail) {
    return <Navigate to="/" replace />;
  }

  const { detail } = project;

  return (
    <>
      <Nav activeSection="" />

      <main className="relative min-h-screen pt-28 pb-24" style={{ backgroundColor: 'var(--color-black)' }}>
        {/* Hero image */}
        <div className="relative w-full h-[45vh] md:h-[55vh] overflow-hidden">
          <div
            className={project.backgroundImageRotation ? 'absolute' : 'absolute inset-0 w-full h-full'}
            style={projectBackgroundStyle(project, { scale: 1 })}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#050505]/40 via-[#050505]/60 to-[#050505]" />
        </div>

        <div className="relative z-10 max-w-screen-lg mx-auto px-8 md:px-16 -mt-24 md:-mt-32">
          <Link
            to="/"
            state={{ scrollTo: 'projects' }}
            className="inline-flex items-center gap-2 font-sans text-xs tracking-[0.2em] uppercase text-white/40 hover:text-white/70 transition-colors duration-300 mb-10"
          >
            <ArrowLeft size={14} strokeWidth={1.5} />
            All Projects
          </Link>

          <div className="flex items-center gap-4 mb-6">
            <span className="accent-line" />
            <span className="font-sans text-[0.65rem] tracking-[0.25em] uppercase text-[var(--color-accent)]">
              {project.category}
            </span>
            <span className="font-sans text-[0.65rem] tracking-[0.15em] text-white/30">
              {project.year}
            </span>
          </div>

          <h1
            className="font-serif text-[clamp(2.5rem,6vw,5rem)] font-light leading-none tracking-wide text-white mb-4"
            style={{ fontFamily: 'var(--font-serif)' }}
          >
            {project.title}
          </h1>

          <p className="font-sans text-xs tracking-[0.2em] uppercase text-white/40 mb-12">
            {project.subtitle}
          </p>

          <div className="space-y-6 mb-16">
            {detail.paragraphs.map((paragraph, i) => (
              <p key={i} className="font-sans text-base leading-relaxed text-white/65 max-w-2xl">
                {paragraph}
              </p>
            ))}
          </div>

          {detail.credits && detail.credits.length > 0 && (
            <div className="mb-16 pt-8 border-t border-white/10">
              <span className="font-sans text-[0.65rem] tracking-[0.25em] uppercase text-[var(--color-accent)] block mb-6">
                Credits
              </span>
              <dl className="grid gap-4 sm:grid-cols-2 max-w-2xl">
                {detail.credits.map(({ role, name }) => (
                  <div key={role}>
                    <dt className="font-sans text-[0.65rem] tracking-[0.15em] uppercase text-white/30 mb-1">
                      {role}
                    </dt>
                    <dd className="font-sans text-sm text-white/70">{name}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          <div className="aspect-video w-full max-w-4xl overflow-hidden bg-black/40 border border-white/10">
            {project.videoType === 'local' ? (
              <video
                className="w-full h-full"
                src={project.videoUrl}
                controls
                playsInline
              />
            ) : (
              <iframe
                className="w-full h-full"
                src={project.videoUrl}
                title={project.title}
                allow="autoplay; fullscreen"
                allowFullScreen
              />
            )}
          </div>

          <div className="mt-8 flex items-center gap-3 text-white/40">
            <Play size={14} className="text-[var(--color-accent)]" fill="currentColor" strokeWidth={0} />
            <span className="font-sans text-xs tracking-[0.2em] uppercase">Watch Film</span>
          </div>
        </div>
      </main>
    </>
  );
}
