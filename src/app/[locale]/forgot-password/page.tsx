import Link from 'next/link';
import {SHOP_DISCORD_QR, SHOP_DISCORD_URL} from '@/lib/contact';

export default async function ForgotPasswordPage({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  return <div className="auth-page page-heading"><p className="eyebrow">ACCOUNT ACCESS</p><h1>Forgot password?</h1>
    <section className="auth-card card forgot-card">
      <h2>Signed up with Google?</h2>
      <p>Use <strong>Continue with Google</strong> on the sign-in page. Your password is not needed.</p>
      <Link className="button secondary full-width" href={`/${locale}/login`}>Back to sign in</Link>
      <h2>Signed up with email?</h2>
      <p>Message the shop on Discord with the email you registered. After we confirm the account is yours, we set a new password and send it to you. Please change it after signing in.</p>
      <a className="button full-width discord-button" href={SHOP_DISCORD_URL} target="_blank" rel="noreferrer">Open the shop’s Discord</a>
      <figure className="contact-qr">
        <img src={SHOP_DISCORD_QR} alt="Discord invite QR code for the shop" width={544} height={513}/>
        <figcaption>Or scan with your phone camera to join the shop’s Discord.</figcaption>
      </figure>
      <p className="field-caption">Invite link: <a href={SHOP_DISCORD_URL} target="_blank" rel="noreferrer">{SHOP_DISCORD_URL.replace('https://', '')}</a></p>
      <p className="field-caption">We will never ask for your password. The shop cannot see it either.</p>
    </section><Link className="auth-back" href={`/${locale}`}>← Back to store</Link>
  </div>;
}
