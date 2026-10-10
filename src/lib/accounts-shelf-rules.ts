// Settings of the SkyBlock accounts shelf: the storefront words and the Hypixel options (no Node.js imports; unit-tested).
import {z} from 'zod';

export const shelfSchema = z.object({
  enabled: z.boolean(),
  packagesTabLabel: z.string().trim().min(1).max(30),
  accountsTabLabel: z.string().trim().min(1).max(30),
  heading: z.string().trim().max(80),
  intro: z.string().trim().max(400),
  showIgnByDefault: z.boolean()
}).strict();
export type Shelf = z.infer<typeof shelfSchema>;
export const defaultShelf: Shelf = {enabled: true, packagesTabLabel: 'Packages', accountsTabLabel: 'SkyBlock accounts', heading: 'SkyBlock accounts', intro: 'Hand-checked Hypixel SkyBlock accounts. Stats are a snapshot from the Hypixel API; the login details appear on your order page as soon as your payment is confirmed.', showIgnByDefault: false};

export const REFRESH_HOURS = [0, 6, 12, 24] as const;
export const hypixelSettingsSchema = z.object({
  /** The API key, sealed (account-vault). It never leaves the server. */
  apiKeyEnc: z.string().max(2000).nullable(),
  /** The last four characters, kept so the Admin page can show which key is saved without opening it. */
  apiKeyTail: z.string().max(8).nullable(),
  autoRefreshHours: z.union([z.literal(0), z.literal(6), z.literal(12), z.literal(24)]),
  fairySoulsTotal: z.number().int().min(1).max(2000)
}).strict();
export type HypixelSettings = z.infer<typeof hypixelSettingsSchema>;
export const defaultHypixelSettings: HypixelSettings = {apiKeyEnc: null, apiKeyTail: null, autoRefreshHours: 12, fairySoulsTotal: 289};

/** What the browser may see of the Hypixel settings: never the key itself. */
export const publicHypixelSettings = (settings: HypixelSettings) => ({hasKey: Boolean(settings.apiKeyEnc), keyTail: settings.apiKeyTail, autoRefreshHours: settings.autoRefreshHours, fairySoulsTotal: settings.fairySoulsTotal});

/** A Hypixel API key is a UUID. */
export const HYPIXEL_KEY = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Minecraft names: 3–16 letters, digits and underscores. */
export const MINECRAFT_NAME = /^[A-Za-z0-9_]{3,16}$/;
export const MINECRAFT_UUID = /^[0-9a-f]{32}$/;
