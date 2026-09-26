'use client';
import {useLocale, useTranslations} from 'next-intl';
import {useState} from 'react';
import {useCart} from '@/components/cart-provider';
import {products, usd, Locale} from '@/lib/catalog';
import {totalUsdCents} from '@/lib/cart';
import Link from 'next/link';
import {ProductArt} from '@/components/store-ui';

export default function Cart() {
  const {lines, ready, save} = useCart();
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const [error, setError] = useState('');
  const vi = locale === 'vi';
  return <section><div className="page-heading"><p className="eyebrow">YOUR SELECTION</p><h1>{t('cart')}</h1><div className="checkout-steps"><span className="current">01 / {t('cart')}</span><span>02 / Checkout</span><span>03 / {vi ? 'Xác nhận mô phỏng' : 'Demo confirmation'}</span></div></div>
    {!ready ? <p aria-busy="true">…</p> : <>
      {lines.length === 0 && <div className="empty-state"><div className="empty-icon">◇</div><h2>{t('empty')}</h2><p className="muted">{vi ? 'Một trải nghiệm mới bắt đầu từ lựa chọn đầu tiên.' : 'A new experience starts with your first pick.'}</p><Link className="button" href={`/${locale}#catalog`}>{vi ? 'Khám phá các gói' : 'Explore packages'} →</Link></div>}
      {lines.length > 0 && <div className="checkout-layout"><div>
      {lines.map((line, index) => {
        const product = products.find(p => p.id === line.productId)!;
        return <article className="card cart-item" key={index}><ProductArt variant={line.productId === 'sample-basic' ? 0 : 1}/><div>
          <h2>{product.title[locale]}</h2>
          <p>{t('quantity')}: {line.quantity} · {usd(product.usdCents * line.quantity, locale)}</p>
          {Object.entries(line.delivery).map(([key, value]) => <p key={key}>{t(key)}: {value}</p>)}
          <div className="row"><div className="quantity-control"><button aria-label={vi ? `Giảm số lượng mục ${index+1}` : `Decrease item ${index+1}`} disabled={line.quantity <= 1} onClick={() => setError(save(lines.map((l,i) => i === index ? {...l,quantity:l.quantity-1} : l)) ? '' : t('invalid'))}>−</button><output>{line.quantity}</output><button aria-label={vi ? `Tăng số lượng mục ${index+1}` : `Increase item ${index+1}`} disabled={lines.filter(l => l.productId === line.productId).reduce((sum,l) => sum+l.quantity,0) >= product.stock} onClick={() => setError(save(lines.map((l,i) => i === index ? {...l,quantity:l.quantity+1} : l)) ? '' : t('invalid'))}>+</button></div><button className="secondary" onClick={() => {
            setError(save(lines.filter((_, i) => i !== index)) ? '' : t('unavailable'));
          }}>{t('remove')}</button></div></div>
        </article>;
      })}
      </div><aside className="card order-summary"><h2>{vi ? 'Tóm tắt giỏ hàng' : 'Order summary'}</h2><div className="summary-line"><span>{vi ? 'Số lượng' : 'Items'}</span><strong>{lines.reduce((sum,l) => sum+l.quantity,0)}</strong></div><div className="summary-total"><small>{t('total')}</small><p className="price">{usd(totalUsdCents(lines),locale)}</p></div><p className="notice">{vi ? 'Giá minh họa, chưa tính thuế/phí. Không có khoản tiền nào được thu.' : 'Illustrative prices, excluding undetermined taxes/fees. No money is collected.'}</p><Link className="button full-width" href={`/${locale}/checkout`}>{vi ? 'Thử checkout' : 'Preview checkout'} →</Link><button className="full-width" disabled style={{marginTop:12}}>{t('checkout')}</button></aside></div>}
    </>}
    <p role="alert">{error}</p><p className="notice">{t('rate')}</p>
  </section>;
}