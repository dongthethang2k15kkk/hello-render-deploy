'use client';
import {clearChatDrafts} from '@/lib/chat-drafts';

export default function AdminLogout({locale}: {locale: string}) {
  return <button className="secondary" type="button" onClick={async () => {
    const response = await fetch('/api/auth/logout', {method: 'POST'});
    if (response.ok) {clearChatDrafts(); window.location.assign(`/${locale}/login`);}
  }}>Log out</button>;
}
