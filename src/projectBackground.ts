import type { Project } from './data';

export function projectBackgroundStyle(
  project: Project,
  options: { parallaxOffset?: number; scale?: number } = {}
) {
  const { parallaxOffset = 0, scale = 1.15 } = options;
  const rotation = project.backgroundImageRotation;

  const base = {
    backgroundImage: `url(${project.backgroundImage})`,
    backgroundSize: 'cover' as const,
    backgroundPosition: 'center' as const,
    willChange: 'transform' as const,
  };

  if (rotation) {
    return {
      ...base,
      position: 'absolute' as const,
      left: '50%',
      top: '50%',
      width: '100vh',
      height: '100vw',
      transform: `translate(-50%, -50%) rotate(${rotation}deg) translateY(${parallaxOffset}px) scale(${scale})`,
    };
  }

  return {
    ...base,
    transform: `translateY(${parallaxOffset}px) scale(${scale})`,
  };
}
