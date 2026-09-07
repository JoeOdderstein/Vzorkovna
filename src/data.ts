// ============================================================
// HARING STUDIO — SITE DATA
// ============================================================
// Edit this file to update all content across the website.
// ============================================================

export interface ProjectDetail {
  paragraphs: string[];
  credits?: { role: string; name: string }[];
}

export interface Project {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  category: string;
  year: string;
  // Replace with your own image URL or local path e.g. '/images/project-1.jpg'
  backgroundImage: string;
  // Rotate portrait images to fill wide sections (e.g. 90 or -90)
  backgroundImageRotation?: number;
  // Replace with your own video embed URL (YouTube, Vimeo, or local)
  videoUrl: string;
  videoType: 'youtube' | 'vimeo' | 'local';
  // Optional detail page — edit paragraphs in this file
  detail?: ProjectDetail;
}

export function getProjectById(id: string): Project | undefined {
  return PROJECTS.find((project) => project.id === id);
}

export const SITE_DATA = {
  // ── Company ──────────────────────────────────────────────
  name: 'Haring Studio',
  tagline: 'Audiovisual Installations · Immersive Sound · Interactive Experiences',

  // ── Hero Logo ────────────────────────────────────────────
  // Swap the file at public/images/logo.png — no code changes needed.
  heroLogoUrl: '/images/logo.png',

  // ── Hero Video ───────────────────────────────────────────
  // Swap the file at public/videos/hero.mp4 — no code changes needed.
  heroVideoUrl: '/videos/hero.mp4',
  // Fallback poster shown before video loads (solid black, matches site background)
  heroPosterUrl:
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1920' height='1080'%3E%3Crect width='100%25' height='100%25' fill='%23050505'/%3E%3C/svg%3E",

  // ── Link preview (WhatsApp, iMessage, social shares) ───
  // Replace public/images/social/share-preview.jpg — no code changes needed.
  // Recommended size: 1200×630 px (JPG or PNG; keep the same filename).
  sharePreviewUrl: '/images/social/share-preview.jpg',

  // ── Navigation ───────────────────────────────────────────
  navLinks: ['Projects', 'About', 'Contact', 'Login'],

  // ── About Section ────────────────────────────────────────
  about: {
    // Swap portrait files in public/images/about/ — no code changes needed.
    portraitUrl: '/images/about/face1.png',
    colleaguePortraitUrl: '/images/about/face5.png',
    heading: 'We build worlds you can feel.',
    body: [
      'Haring Studio is an independent creative studio working at the intersection of sound, image, and space. We design audiovisual installations, immersive sonic environments, and interactive media experiences for museums, festivals, galleries, and public spaces.',
      'Founded on the belief that technology should serve emotion, our work invites audiences to slow down, listen, and inhabit the moment.',
    ],
    stats: [
      { value: '40+', label: 'Installations' },
      { value: '18', label: 'Countries' },
      { value: '12', label: 'Years' },
    ],
  },

  // ── Contact Section ──────────────────────────────────────
  contact: {
    email: 'studio@haringstudios.com',
    instagram: '@haringstudios',
    location: 'Amsterdam · Berlin · New York',
  },
};

// ── Projects ─────────────────────────────────────────────────
// Add, remove, or reorder projects here.
// backgroundImage: Use a Pexels URL or your own image path.
// videoUrl: Use a YouTube embed URL, Vimeo embed URL, or local .mp4 path.
export const PROJECTS: Project[] = [
  {
    id: 'elements-room',
    title: 'Elements Room',
    subtitle: 'Sound Installation',
    description:
      'A 360° spatial audio environment in which visitors navigate a field of invisible acoustic sculptures. Each movement triggers layered harmonic responses drawn from field recordings gathered across five continents.',
    category: 'Sound Installation',
    year: '2024',
    backgroundImage: '/images/elements/Elements.jpg',
    videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    videoType: 'youtube',
    detail: {
      paragraphs: [
        'Elements Room is a 360° spatial audio environment in which visitors navigate a field of invisible acoustic sculptures. Each movement triggers layered harmonic responses drawn from field recordings gathered across five continents.',
        'The installation treats sound as a physical material — visitors walk through zones of pressure, resonance, and silence that shift in response to their presence. No fixed path exists; each journey through the room composes a unique sonic narrative.',
        'Developed as a site-specific work, Elements Room invites audiences to slow down, listen closely, and inhabit space through hearing alone.',
      ],
      credits: [
        { role: 'Sound Design', name: 'Haring Studio' },
        { role: 'Spatial Audio', name: 'Haring Studio' },
        { role: 'Year', name: '2024' },
      ],
    },
  },
  {
    id: 'vulva-room',
    title: 'Vulva Room',
    subtitle: 'Immersive Installation',
    description:
      'An immersive dark room installation using generative visuals and binaural audio to simulate the experience of deep-space travel. Commissioned for the Amsterdam Light Festival.',
    category: 'Immersive Installation',
    year: '2023',
    backgroundImage: '/images/vulva/vulva3.jpg',
    backgroundImageRotation: 90,
    videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    videoType: 'youtube',
    detail: {
      paragraphs: [
        'Vulva Room is an immersive dark room installation using generative visuals and binaural audio to create a deeply embodied sensory environment. Commissioned for the Amsterdam Light Festival, the work transforms a sealed interior into a space of slow revelation and intimate scale.',
        'Visitors enter alone or in pairs, surrounded by shifting light fields and spatial sound that respond to presence and movement. The generative visual system never repeats — each encounter unfolds as a unique composition of colour, shadow, and resonance.',
        'At its core, Vulva Room asks audiences to surrender to darkness and let image and sound guide them inward — a meditation on interiority, softness, and the body as a site of experience.',
      ],
      credits: [
        { role: 'Concept & Direction', name: 'Haring Studio' },
        { role: 'Generative Visuals', name: 'Haring Studio' },
        { role: 'Commission', name: 'Amsterdam Light Festival' },
        { role: 'Year', name: '2023' },
      ],
    },
  },
  {
    id: 'the-carousel',
    title: 'The Carousel',
    subtitle: 'Interactive Media',
    description:
      'A real-time interactive installation that translates visitors\' heartbeats into evolving light sculptures and ambient soundscapes. No two sessions are ever identical.',
    category: 'Interactive Media',
    year: '2023',
    backgroundImage: '/images/carousel/carousel.png',
    videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    videoType: 'youtube',
    detail: {
      paragraphs: [
        'The Carousel is a real-time interactive installation that translates visitors\' heartbeats into evolving light sculptures and ambient soundscapes. No two sessions are ever identical.',
        'Participants place a sensor on their wrist and step onto a slowly rotating platform. As their pulse is read, the room responds — light arrays pulse in rhythm, tones rise and fall, and a living audiovisual portrait emerges from the body\'s most fundamental signal.',
        'Designed as both spectacle and introspection, The Carousel turns physiology into performance. Each rotation becomes a shared moment between the visitor and the machine — fragile, rhythmic, and entirely personal.',
      ],
      credits: [
        { role: 'Concept & Direction', name: 'Haring Studio' },
        { role: 'Interactive Systems', name: 'Haring Studio' },
        { role: 'Year', name: '2023' },
      ],
    },
  },
];
