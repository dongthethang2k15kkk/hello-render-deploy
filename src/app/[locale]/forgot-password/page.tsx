import Link from 'next/link';

export default async function ForgotPasswordPage({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  return <div className="auth-page page-heading"><p className="eyebrow">ACCOUNT ACCESS</p><h1>Forgot password?</h1>
    <section className="auth-card card forgot-card">
      <h2>Signed up with Google?</h2>
      <p>Use <strong>Continue with Google</strong> on the sign-in page. Your password is not needed.</p>
      <Link className="button secondary full-width" href={`/${locale}/login`}>Back to sign in</Link>
      <h2>Signed up with email?</h2>
      <p>Message the shop on Zalo with the email you registered. After we confirm the account is yours, we set a new password and send it to you. Please change it after signing in.</p>
      <figure className="contact-qr">
        <img src="/contact/zalo-qr.png" alt="Zalo QR code to add the shop as a friend" width={544} height={513}/>
        <figcaption>Scan with the Zalo app to add the shop.</figcaption>
      </figure>
      <p className="field-caption">On your phone? <a href="/contact/zalo-qr.png" download="jewish-horse-zalo-qr.png">Save the QR image</a>, then in Zalo open the QR scanner and choose the image from your gallery.</p>
      <p className="field-caption">We will never ask for your password. The shop cannot see it either.</p>
    </section><Link className="auth-back" href={`/${locale}`}>← Back to store</Link>
  </div>;
}
