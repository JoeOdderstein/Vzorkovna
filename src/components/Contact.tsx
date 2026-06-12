import { useState } from 'react';
import { ArrowRight, Mail, MapPin, Instagram } from 'lucide-react';
import { useInView } from '../hooks';
import { SITE_DATA } from '../data';

export default function Contact() {
  const { ref, inView } = useInView(0.15);
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');

  // Static hosting has no server — we build a mailto: link from the form values.
  // To use a real form backend, replace the handleSubmit logic with a fetch()
  // call to Formspree (https://formspree.io) or a similar service.
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const subject = encodeURIComponent(`Enquiry from ${name || 'website visitor'}`);
    const body = encodeURIComponent(message);
    window.location.href = `mailto:${SITE_DATA.contact.email}?subject=${subject}&body=${body}`;
  };

  return (
    <section
      id="contact"
      className="relative w-full py-40"
      style={{ backgroundColor: 'var(--color-black)' }}
    >
      {/* Top edge gradient */}
      <div
        className="absolute inset-x-0 top-0 h-px"
        style={{ background: 'linear-gradient(to right, transparent, rgba(200,169,110,0.3), transparent)' }}
      />

      <div className="max-w-screen-xl mx-auto px-8 md:px-16">
        <div
          ref={ref}
          className={`reveal ${inView ? 'visible' : ''}`}
        >
          <span className="font-sans text-[0.65rem] tracking-[0.3em] uppercase text-[var(--color-accent)] block mb-8">
            Get in Touch
          </span>

          <div className="grid md:grid-cols-2 gap-20 md:gap-32">

            {/* Left — heading + info */}
            <div>
              <h2
                className="font-serif text-[clamp(2.5rem,5vw,5rem)] font-light leading-tight text-white/90 mb-12"
                style={{ fontFamily: 'var(--font-serif)', lineHeight: '1.1' }}
              >
                Let's build
                <br />
                something
                <br />
                <em>together.</em>
              </h2>

              <div className="space-y-5">
                <a
                  href={`mailto:${SITE_DATA.contact.email}`}
                  className="flex items-center gap-4 group"
                >
                  <Mail size={14} className="text-[var(--color-accent)] flex-shrink-0" strokeWidth={1.5} />
                  <span className="font-sans text-sm text-white/50 group-hover:text-white/90 transition-colors duration-300">
                    {SITE_DATA.contact.email}
                  </span>
                </a>

                <div className="flex items-center gap-4">
                  <Instagram size={14} className="text-[var(--color-accent)] flex-shrink-0" strokeWidth={1.5} />
                  <span className="font-sans text-sm text-white/50">
                    {SITE_DATA.contact.instagram}
                  </span>
                </div>

                <div className="flex items-center gap-4">
                  <MapPin size={14} className="text-[var(--color-accent)] flex-shrink-0" strokeWidth={1.5} />
                  <span className="font-sans text-sm text-white/50">
                    {SITE_DATA.contact.location}
                  </span>
                </div>
              </div>
            </div>

            {/* Right — form */}
            <div>
              <form onSubmit={handleSubmit} className="space-y-8">
                <div className="space-y-2">
                  <label className="font-sans text-[0.65rem] tracking-[0.2em] uppercase text-white/30 block">
                    Your Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="w-full bg-transparent border-b border-white/15 py-3 font-sans text-sm text-white/80 placeholder-white/20 focus:outline-none focus:border-[var(--color-accent)] transition-colors duration-300"
                    placeholder="Jane Smith"
                  />
                </div>

                <div className="space-y-2">
                  <label className="font-sans text-[0.65rem] tracking-[0.2em] uppercase text-white/30 block">
                    Message
                  </label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    required
                    rows={5}
                    className="w-full bg-transparent border-b border-white/15 py-3 font-sans text-sm text-white/80 placeholder-white/20 focus:outline-none focus:border-[var(--color-accent)] transition-colors duration-300 resize-none"
                    placeholder="Tell us about your project..."
                  />
                </div>

                <button
                  type="submit"
                  className="group flex items-center gap-4 font-sans text-xs tracking-[0.2em] uppercase text-white/60 hover:text-white transition-colors duration-300"
                >
                  <span>Send Message</span>
                  <ArrowRight
                    size={14}
                    strokeWidth={1.5}
                    className="group-hover:translate-x-2 transition-transform duration-300"
                  />
                </button>

                <p className="font-sans text-[0.6rem] tracking-[0.1em] text-white/20">
                  Opens your email client to send directly.
                </p>
              </form>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
