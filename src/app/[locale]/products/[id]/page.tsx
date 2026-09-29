import {notFound} from 'next/navigation';
import Link from 'next/link';
import {usd} from '@/lib/catalog';
import {getPublicCatalog} from '@/lib/catalog-server';
import {messages} from '@/i18n/messages';
import {ProductForm} from '@/components/product-form';
import {ProductPreview} from '@/components/store-ui';

export default async function Product({params}: {params: Promise<{locale: string; id: string}>}) {
  const {locale, id} = await params;
  if (locale !== 'en') notFound();
  const catalog = await getPublicCatalog();
  const product = catalog.products.find(p => p.id === id);
  if (!product) notFound();
  const t = messages[locale];
  return <>
    <div className="breadcrumb"><Link href={`/${locale}`}>{t.back}</Link> / {product.title[locale]}</div>
    <section className="detail-layout"><div><div className="detail-art"><ProductPreview product={product} variant={id === 'sample-basic' ? 0 : 1}/></div><p className="eyebrow">DIGITAL COLLECTION / {catalog.source === 'database' ? product.sku : 'DEMO'}</p><h1>{product.title[locale]}</h1><p className="muted">{product.description[locale]}</p><div className="feature-strip"><div><span className="feature-index">01</span><strong>USD price</strong></div><div><span className="feature-index">02</span><strong>Manual delivery</strong></div><div><span className="feature-index">03</span><strong>{product.stock} available</strong></div></div><details open><summary>Before you order</summary><p>{t.privacy}</p><p>{t.rate}</p></details></div><aside className="card order-summary"><div className="row"><span className="eyebrow">CONFIGURE PACKAGE</span><span className="sample-tag">{catalog.source === 'database' ? 'CATALOG' : 'DEMO'}</span></div>{product.saleUsdCents && <p className="old-price">{usd(product.baseUsdCents,locale)}</p>}<p className="price">{usd(product.usdCents,locale)}</p><p className="field-caption">Available: {product.stock}{catalog.source === 'database' ? '' : ' · Illustrative stock'}</p><ProductForm product={product}/><Link className="text-link" href={`/${locale}/cart`}>View cart →</Link></aside></section>
  </>;
}
