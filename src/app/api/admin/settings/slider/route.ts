import {amountSliderSchema, autoSlider, defaultAmountSlider} from '@/lib/amount-slider-rules';
import {getSavedAmountSlider, setAmountSlider} from '@/lib/amount-slider';
import {recordAudit} from '@/lib/audit';
import {getSession} from '@/lib/auth';
import {getPublicCatalog} from '@/lib/catalog-server';
import {sameOrigin} from '@/lib/customer-rules';

export const runtime = 'nodejs';
const json = (data: unknown, status = 200) => Response.json(data, {status, headers: {'Cache-Control': 'no-store'}});

/** Active packages the slider can sell, with their price per unit and stock. */
async function packages() {
  const catalog = await getPublicCatalog();
  return {vndPerUsd: catalog.vndPerUsd, products: catalog.products, packages: catalog.products.map(product => ({id: product.id, title: product.title.en, priceVnd: product.priceVnd, stock: product.stock}))};
}

export async function GET() {
  if ((await getSession())?.role !== 'admin') return json({error: 'Admin role required'}, 403);
  if (!process.env.DATABASE_URL) return json({error: 'Database is not configured'}, 503);
  const {products, ...rest} = await packages();
  const saved = await getSavedAmountSlider();
  // Until an Admin saves, the store uses the automatic slider; show it so saving keeps what customers already see.
  return json({slider: saved ?? autoSlider(products) ?? defaultAmountSlider, saved: Boolean(saved), ...rest});
}

export async function POST(request: Request) {
  if (!sameOrigin(request.headers)) return json({error: 'Invalid request origin.'}, 403);
  const admin = await getSession();
  if (admin?.role !== 'admin') return json({error: 'Admin role required'}, 403);
  if (!process.env.DATABASE_URL) return json({error: 'Database is not configured'}, 503);
  const parsed = amountSliderSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return json({error: parsed.error.issues[0]?.message ?? 'Invalid slider settings.'}, 400);
  const {packages: list} = await packages();
  const chosen = list.find(item => item.id === parsed.data.packageId);
  if (parsed.data.enabled && !chosen) return json({error: 'Choose an active package with a price.'}, 400);
  try {
    await setAmountSlider(parsed.data, admin.email);
    await recordAudit({actorEmail: admin.email, action: 'settings.amount_slider', summary: `${parsed.data.enabled ? 'Turned on' : 'Saved (off)'} the amount slider${chosen ? ` for ${chosen.title}` : ''}: ${parsed.data.min}–${parsed.data.max} ${parsed.data.unitLabel}, step ${parsed.data.step}`, entityType: 'settings'});
    return json({ok: true, slider: parsed.data});
  } catch { return json({error: 'Slider settings could not be saved.'}, 503); }
}
