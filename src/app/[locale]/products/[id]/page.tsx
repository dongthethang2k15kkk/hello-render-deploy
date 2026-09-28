import {notFound} from 'next/navigation';
import Link from 'next/link';
import {products, usd} from '@/lib/catalog';
import {messages} from '@/i18n/messages';
import {ProductForm} from '@/components/product-form';
import {ProductArt} from '@/components/store-ui';

export default async function Product({params}: {params: Promise<{locale: string; id: string}>}) {
  const {locale, id} = await params;
  if (locale !== 'en') notFound();
  const product = products.find(p => p.id === id);
  if (!product) notFound();
  const t = messages[locale];
  return <>
    <div className="breadcrumb"><Link href={`/${locale}`}>{t.back}</Link> / {product.title[locale]}</div>
    <section className="detail-layout"><div><div className="detail-art"><ProductArt variant={id === 'sample-basic' ? 0 : 1}/></div><p className="eyebrow">DIGITAL COLLECTION / DEMO</p><h1>{product.title[locale]}</h1><p className="muted">{product.description[locale]}</p><div className="feature-strip"><div><span className="feature-index">01</span><strong>USD base price</strong></div><div><span className="feature-index">02</span><strong>Manual delivery</strong></div><div><span className="feature-index">03</span><strong>Sample package</strong></div></div><details open><summary>Before you order</summary><p>{t.privacy}</p><p>{t.rate}</p></details></div><aside className="card order-summary"><div className="row"><span className="eyebrow">CONFIGURE PACKAGE</span><span className="sample-tag">DEMO</span></div><p className="price">{usd(product.usdCents,locale)}</p><p className="field-caption">{t.available}: {product.stock} · Not live inventory</p><ProductForm productId={product.id}/><Link className="text-link" href={`/${locale}/cart`}>View cart →</Link></aside></section>
  </>;
}