'use client';
import {useEffect, useRef, useState} from 'react';
import {stepSlide, type Slide} from '@/lib/announcement-rules';

/** Storefront announcements: auto-advances, swipes on touch, pauses on hover/focus and for reduced motion. */
export default function AnnouncementCarousel({slides, intervalSeconds}: {slides: Slide[]; intervalSeconds: number}) {
  const [index, setIndex] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [stopped, setStopped] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const pointerStart = useRef<number | null>(null);
  const count = slides.length;
  const autoplay = count > 1 && !hovered && !stopped && !reducedMotion;

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(query.matches);
    const onChange = () => setReducedMotion(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    if (!autoplay) return;
    const timer = window.setTimeout(() => setIndex(current => stepSlide(current, 1, count)), intervalSeconds * 1000);
    return () => window.clearTimeout(timer);
  }, [autoplay, index, count, intervalSeconds]);

  const go = (delta: number) => setIndex(current => stepSlide(current, delta, count));
  if (!count) return null;
  return <section className="announcements" aria-roledescription="carousel" aria-label="Announcements"
    onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onFocus={() => setHovered(true)} onBlur={() => setHovered(false)}
    onKeyDown={event => { if (event.key === 'ArrowLeft') go(-1); if (event.key === 'ArrowRight') go(1); }}
    onPointerDown={event => { pointerStart.current = event.clientX; }}
    onPointerUp={event => { const start = pointerStart.current; pointerStart.current = null; if (start !== null && Math.abs(event.clientX - start) > 40) go(event.clientX < start ? 1 : -1); }}>
    <div className="announcement-track" style={{transform: `translateX(-${index * 100}%)`}} aria-live={autoplay ? 'off' : 'polite'}>
      {slides.map((slide, position) => {
        const image = <img src={slide.imagePath} alt={slide.caption || `Announcement ${position + 1}`} draggable={false} loading={position === 0 ? 'eager' : 'lazy'}/>;
        return <div className="announcement-slide" key={slide.imagePath + position} role="group" aria-roledescription="slide" aria-label={`${position + 1} of ${count}`} aria-hidden={position !== index}>
          {slide.link ? <a href={slide.link} tabIndex={position === index ? 0 : -1}>{image}</a> : image}
          {slide.caption && <p className="announcement-caption">{slide.caption}</p>}
        </div>;
      })}
    </div>
    {count > 1 && <>
      <button type="button" className="announcement-arrow prev" aria-label="Previous announcement" onClick={() => go(-1)}>‹</button>
      <button type="button" className="announcement-arrow next" aria-label="Next announcement" onClick={() => go(1)}>›</button>
      <div className="announcement-controls">
        <div className="announcement-dots">{slides.map((_, position) => <button type="button" key={position} className={position === index ? 'active' : ''} aria-label={`Show announcement ${position + 1}`} aria-current={position === index} onClick={() => setIndex(position)}/>)}</div>
        <button type="button" className="announcement-toggle" aria-label={stopped ? 'Play announcements' : 'Pause announcements'} onClick={() => setStopped(value => !value)}>{stopped ? '▶' : '❚❚'}</button>
      </div>
    </>}
  </section>;
}
