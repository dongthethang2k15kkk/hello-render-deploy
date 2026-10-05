import Link from 'next/link';
import {notFound} from 'next/navigation';
import {Catalog, ProductArt} from '@/components/store-ui';
import AnnouncementCarousel from '@/components/announcement-carousel';
import {getAnnouncements} from '@/lib/announcements';
import {getPublicCatalog, usdtCheckout} from '@/lib/catalog-server';
import {storeAmountSlider} from '@/lib/amount-slider';
import {getTradeStats} from '@/lib/trade-stats';
import LuckyWheel from '@/components/lucky-wheel';


export default async function Store({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  if (locale !== 'en') notFound();
  const [catalog, announcements, usdt, trades] = await Promise.all([getPublicCatalog(), getAnnouncements(), usdtCheckout(), getTradeStats()]);
  const slider = await storeAmountSlider(catalog.products);
  const currencies = ['VND', ...(usdt ? ['USDT'] : []), ...(catalog.vndPerLtc ? ['LTC'] : [])];
  const payIn = currencies.length > 1 ? `${currencies.slice(0, -1).join(', ')} or ${currencies.at(-1)}` : currencies[0];
  const cryptoNames = [...(usdt ? ['USDT on TRON (TRC20)'] : []), ...(catalog.vndPerLtc ? ['Litecoin'] : [])].join(' or ');
  return <>
    <section className="hero"><div className="hero-copy"><span className="pill">✦ Digital packages · delivered by appointment</span><h1>Digital goods.<br/>A better <em>experience.</em></h1><p>Choose a package, trade right now when we are online or pick a time that suits you, and pay with a QR code. We deliver it with you, live in the site chat.</p><div className="hero-actions"><Link className="button" href="#buy">Buy now →</Link><Link className="text-link" href="#how-it-works">How it works ↗</Link></div><div className="hero-meta"><span>{`Prices in USD · pay in ${payIn}`}</span><span>Delivered by appointment</span></div></div>{announcements.slides.length ? <div className="hero-visual announcement-visual"><AnnouncementCarousel slides={announcements.slides} intervalSeconds={announcements.intervalSeconds}/></div> : <div className="hero-visual"><div className="visual-label">A NEW WAY TO EXPLORE <span>↗</span></div><ProductArt/><div className="floating-card"><span>✦</span><div><strong>Every detail, considered.</strong><small>Discover → Cart → Checkout</small></div></div><div className="visual-bottom">COLLECTION 01 <span>INTERACTIVE CONCEPT</span></div></div>}</section>
    <LuckyWheel/>

    <Catalog products={catalog.products} source={catalog.source} vndPerUsd={catalog.vndPerUsd} vndPerLtc={catalog.vndPerLtc} slider={slider} trades={trades}/>
    <div className="feature-strip">{[['01','Clear information','Review prices and details first'],['02','Package by package','Individual delivery forms'],['03','Chat support','Ask the team before you buy']].map(([n,title,desc]) => <div key={n}><span className="feature-index">{n}</span><div><strong>{title}</strong><small>{desc}</small></div></div>)}</div>
    <section id="how-it-works" className="section how-section"><p className="eyebrow">HOW IT WORKS</p><h2>Three steps. No guesswork.</h2><div className="steps-grid">{[
      ['Pick your package', 'Choose a package, add the few details we need for delivery and place your order. It is reserved for you for 30 minutes, prices shown in USD.'],
      ['Choose a time, then pay', `Trade now while a trader is online, or pick a few times you are free. Then pay by scanning a QR code: ${cryptoNames ? `${cryptoNames} from your wallet, or a bank transfer` : 'a bank transfer in your banking app'}.`],
      ['Get it in the chat', 'We confirm your payment, book one of your times and hand everything over with you, live in the site chat. Questions before then? Message us any time.']
    ].map(([title,desc],i) => <article key={title}><span className="step-number">0{i+1}</span><h3>{title}</h3><p className="muted">{desc}</p></article>)}</div></section>
    <section id="faq" className="section faq-section"><div><p className="eyebrow">GOOD TO KNOW</p><h2>Before you get started.</h2></div><div>{[['How do I pay?',`${usdt ? 'In USDT on the TRON (TRC20) network: send the exact amount shown on your order page from any wallet or exchange. ' : ''}By bank transfer in Vietnamese dong (VND): scan the VietQR code with your banking app and the amount and order code are filled in for you.${catalog.vndPerLtc ? ' You can also pay in Litecoin (LTC): the exact amount follows the live market price when you place the order.' : ''} Crypto payments are detected by themselves.`],['Can I trade right now?','Yes, when the status at the top says “Online now”. Choose “Trade now” at checkout and add one backup time in case the trader gets busy; we start as soon as your payment is confirmed.'],['What happens after I pay?','Tap “I’ve paid”. We confirm the payment and one of the times you chose, by email and in your Inbox on this site, with a calendar link. If you picked “Trade now”, we message you in Chat right away.'],['How is my order delivered?','At the appointment we work with you in the site chat and deliver there. Delivery details stay on your order page, visible only to you.'],['How can I contact support?','Use the Chat button or open Chat support after signing in. Conversations are private and kept with your account.']].map(([q,a]) => <details key={q}><summary>{q}<span aria-hidden="true">+</span></summary><p>{a}</p></details>)}</div></section>
  </>;
}
