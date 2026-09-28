'use client';

export default function AdminLogout({locale}: {locale: string}) {
  return <button className="secondary" type="button" onClick={async () => {
    const response = await fetch('/api/auth/logout', {method: 'POST'});
    if (response.ok) window.location.assign(`/${locale}/login`);
  }}>{locale === 'vi' ? 'Đăng xuất' : 'Log out'}</button>;
}