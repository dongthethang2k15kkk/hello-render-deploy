// What an Admin may send when saving a game account (no Node.js imports; unit-tested).
import {z} from 'zod';
import {ADMIN_STATUSES} from './account-rules';
import {MINECRAFT_NAME, MINECRAFT_UUID} from './accounts-shelf-rules';
import {productImagePathPattern} from './product-image';
import {accountStatsSchema} from './skyblock-stats';

export const MAX_ACCOUNT_IMAGES = 8;
const MAX_PRICE_VND = 2_000_000_000;

export const accountInputSchema = z.object({
  ign: z.string().trim().regex(MINECRAFT_NAME, 'The in-game name is 3–16 letters, digits or underscores.'),
  uuid: z.string().regex(MINECRAFT_UUID).nullable().default(null),
  profileId: z.string().max(60).nullable().default(null),
  profileName: z.string().trim().max(60).nullable().default(null),
  showIgn: z.boolean(),
  title: z.string().trim().min(1, 'Write a title.').max(120, 'The title is at most 120 characters.'),
  description: z.string().trim().max(4000, 'The description is at most 4000 characters.').default(''),
  priceVnd: z.number().int().min(0).max(MAX_PRICE_VND),
  salePriceVnd: z.number().int().min(1).max(MAX_PRICE_VND).nullable().default(null),
  sortOrder: z.number().int().min(-100000).max(100000).default(0),
  imagePaths: z.array(z.string().regex(productImagePathPattern, 'Use images uploaded here.')).max(MAX_ACCOUNT_IMAGES, `At most ${MAX_ACCOUNT_IMAGES} screenshots.`).default([]),
  stats: accountStatsSchema.nullable().default(null),
  statsSource: z.enum(['hypixel', 'manual']).default('manual'),
  statsLocked: z.boolean().default(false),
  /** New login details. Omitted when editing an account whose saved login stays as it is. */
  login: z.string().max(4000, 'The login details are at most 4000 characters.').optional(),
  adminNote: z.string().trim().max(1000).default(''),
  status: z.enum(ADMIN_STATUSES).default('draft')
}).strict();
export type AccountInput = z.infer<typeof accountInputSchema>;

/** A template to start from, so every account's login details look alike. */
export const LOGIN_TEMPLATE = 'Email: \nPassword: \nRecovery email: \nNotes: ';
