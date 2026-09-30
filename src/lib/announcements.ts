import 'server-only';
import {announcementsSchema, emptyAnnouncements, type Announcements} from './announcement-rules';
import {getPaymentDb} from './payment-db';

const KEY = 'announcements';
const CACHE_MS = 30_000;
const store = globalThis as unknown as {announcementsCache?: {value: Announcements; at: number}};

export async function getAnnouncements(): Promise<Announcements> {
  const hit = store.announcementsCache;
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;
  let value = emptyAnnouncements;
  if (process.env.DATABASE_URL) {
    try {
      const row = await getPaymentDb().storeSetting.findUnique({where: {key: KEY}});
      const parsed = announcementsSchema.safeParse(row?.value);
      if (parsed.success) value = parsed.data;
    } catch { return hit?.value ?? emptyAnnouncements; }
  }
  store.announcementsCache = {value, at: Date.now()};
  return value;
}

export async function setAnnouncements(value: Announcements, actorEmail: string) {
  await getPaymentDb().storeSetting.upsert({where: {key: KEY}, create: {key: KEY, value, updatedBy: actorEmail}, update: {value, updatedBy: actorEmail}});
  store.announcementsCache = {value, at: Date.now()};
}

/** Image paths in use by announcements, so image cleanup never removes them. */
export async function announcementImagePaths() {
  const row = process.env.DATABASE_URL ? await getPaymentDb().storeSetting.findUnique({where: {key: KEY}}) : null;
  const parsed = announcementsSchema.safeParse(row?.value);
  return new Set(parsed.success ? parsed.data.slides.map(slide => slide.imagePath) : []);
}
