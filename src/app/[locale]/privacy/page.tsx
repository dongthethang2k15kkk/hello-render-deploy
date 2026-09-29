import Link from 'next/link';

export default async function PrivacyPage({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  return <article className="page-heading legal-page"><p className="eyebrow">JEWISH HORSE</p><h1>Privacy Policy</h1><p className="muted">Last updated: 29 September 2026</p>
    <section className="card">
      <h2>What we store</h2>
      <ul>
        <li><strong>Account:</strong> your name and email address. If you use a password, we store only a one-way hash; nobody at the shop can read your password. If you sign in with Google, we receive your name, email and Google account ID.</li>
        <li><strong>Sign-in history:</strong> the time of each sign-in attempt, whether it succeeded, the sign-in method, your IP address and browser/device description.</li>
        <li><strong>Support chat:</strong> messages and images you send to support.</li>
        <li><strong>Cart:</strong> kept in your own browser, not on our servers.</li>
      </ul>
      <h2>Why</h2>
      <p>To let you sign in, answer your support questions, and protect accounts from password guessing and misuse.</p>
      <h2>How long</h2>
      <ul>
        <li>Sign-in history and chat images are deleted automatically after 90 days.</li>
        <li>Your account and chat messages are kept until you ask us to delete your account.</li>
      </ul>
      <h2>Who can see it</h2>
      <p>Only shop administrators, through the shop’s admin area. We do not sell your data. Our hosting and database providers process it on our behalf.</p>
      <h2>Your choices</h2>
      <p>You can change your password or sign out of all devices on your <Link href={`/${locale}/account`}>account page</Link>. To delete your account and its data, contact us on Zalo (see <Link href={`/${locale}/forgot-password`}>contact</Link>).</p>
    </section>
  </article>;
}
