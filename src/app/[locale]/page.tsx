import Link from 'next/link';
import {notFound} from 'next/navigation';
import {Catalog, ProductArt} from '@/components/store-ui';

export default async function Store({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  if (locale !== 'en') notFound();
  return <>
    <div className="floating-horse-1" aria-hidden="true"></div>
    <div className="floating-horse-2" aria-hidden="true"></div>
    <section className="hero"><div className="hero-copy"><span className="pill">✦ Your digital storefront · UI preview</span><h1>Digital goods.<br/>A better <em>experience.</em></h1><p>From your first discovery to the final checkout. Explore a clear, considered shopping experience built around you.</p><div className="hero-actions"><Link className="button" href="#catalog">Explore packages →</Link><Link className="text-link" href="#how-it-works">How it works ↗</Link></div><div className="hero-meta"><span>USD · Sample prices</span><span>Manual fulfillment</span></div></div><div className="hero-visual"><div className="visual-label">A NEW WAY TO EXPLORE <span>↗</span></div><ProductArt/><div className="floating-card"><span>✦</span><div><strong>Every detail, considered.</strong><small>Discover → Cart → Checkout</small></div></div><div className="visual-bottom">COLLECTION 01 <span>INTERACTIVE CONCEPT</span></div></div></section>
    <div className="feature-strip">{[['01','Clear information','Review prices and details first'],['02','Package by package','Individual delivery forms'],['03','Chat support','Ask the team before you buy']].map(([n,title,desc]) => <div key={n}><span className="feature-index">{n}</span><div><strong>{title}</strong><small>{desc}</small></div></div>)}</div>
    <Catalog/>
    <section id="how-it-works" className="section how-section"><p className="eyebrow">HOW IT WORKS</p><h2>Simple, from start to finish.</h2><div className="steps-grid">{[['Find your package','Browse the collection and review package details.'],['Add your details','Each package has its own form. Use test data only.'],['Explore checkout','Review your order and try a simulated payment.']].map(([title,desc],i) => <article key={title}><span className="step-number">0{i+1}</span><h3>{title}</h3><p className="muted">{desc}</p></article>)}</div></section>
    <section id="faq" className="section faq-section"><div><p className="eyebrow">GOOD TO KNOW</p><h2>Before you get started.</h2></div><div>{[['Can I make a real purchase?','Not yet. This prototype does not collect payments, create real orders or deliver products.'],['Can I use other currencies?','This demo uses USD only. Exchange rates and payment availability still need verification.'],['How can I contact support?','Discord/email are planned. Official channels are not configured; no invented contact details are displayed.']].map(([q,a]) => <details key={q}><summary>{q}<span aria-hidden="true">+</span></summary><p>{a}</p></details>)}</div></section>
  </>;
}