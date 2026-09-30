// Announcement carousel shown in the storefront hero (pure; shared by server and browser).
import {z} from 'zod';
import {productImagePathPattern} from './product-image';

export const MAX_SLIDES = 10;

export const slideSchema = z.object({
  imagePath: z.string().regex(productImagePathPattern, 'Upload the image first.'),
  caption: z.string().trim().max(160).default(''),
  link: z.string().trim().max(300).refine(value => value === '' || /^\/[A-Za-z0-9/_#?=&.-]*$/.test(value) || /^https:\/\/[^\s]+$/.test(value), 'Use a site path like /en#catalog or an https:// link.').default('')
}).strict();

export const announcementsSchema = z.object({
  slides: z.array(slideSchema).max(MAX_SLIDES, `Use at most ${MAX_SLIDES} images.`),
  intervalSeconds: z.number().int().min(3).max(30)
}).strict();

export type Slide = z.infer<typeof slideSchema>;
export type Announcements = z.infer<typeof announcementsSchema>;
export const emptyAnnouncements: Announcements = {slides: [], intervalSeconds: 6};

/** Next slide index with wrap-around, used by arrows, swipes and the auto-advance timer. */
export function stepSlide(index: number, delta: number, count: number) {
  return count ? (index + delta + count) % count : 0;
}
