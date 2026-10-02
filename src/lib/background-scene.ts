import 'server-only';
import {defaultScene, sceneSchema, type BackgroundScene} from './background-rules';
import {getPaymentDb} from './payment-db';

const KEY = 'backgroundScene';
const CACHE_MS = 30_000;
const store = globalThis as unknown as {backgroundSceneCache?: {value: BackgroundScene; at: number}};

/** The saved scene, or the built-in look until an Admin saves one. */
export async function getBackgroundScene(): Promise<BackgroundScene> {
  const hit = store.backgroundSceneCache;
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;
  let value = defaultScene;
  if (process.env.DATABASE_URL) {
    try {
      const row = await getPaymentDb().storeSetting.findUnique({where: {key: KEY}});
      const parsed = sceneSchema.safeParse(row?.value);
      if (parsed.success) value = parsed.data;
    } catch { return hit?.value ?? defaultScene; }
  }
  store.backgroundSceneCache = {value, at: Date.now()};
  return value;
}

export async function setBackgroundScene(value: BackgroundScene, actorEmail: string) {
  await getPaymentDb().storeSetting.upsert({where: {key: KEY}, create: {key: KEY, value, updatedBy: actorEmail}, update: {value, updatedBy: actorEmail}});
  store.backgroundSceneCache = {value, at: Date.now()};
}

/** Uploaded images in use by the background, so image cleanup never removes them. */
export async function backgroundImagePaths() {
  const row = process.env.DATABASE_URL ? await getPaymentDb().storeSetting.findUnique({where: {key: KEY}}) : null;
  const parsed = sceneSchema.safeParse(row?.value);
  return new Set(parsed.success ? parsed.data.layers.map(layer => layer.imagePath) : []);
}
