// RFC 5322 / MIME message builder for the Gmail API (raw, base64url). No Next.js imports so it can be unit tested.

export type MailAttachment = {filename: string; contentType: string; content: string};
export type MailMessage = {from: string; to: string[]; subject: string; text: string; html: string; attachments?: MailAttachment[]};

const b64 = (value: string) => Buffer.from(value, 'utf8').toString('base64');
const wrap = (value: string) => value.replace(/.{1,76}/g, line => `${line}\r\n`);
const singleLine = (value: string) => value.replace(/[\r\n]+/g, ' ').trim();

/** RFC 2047 encoded-word for non-ASCII headers (Vietnamese subjects). */
export function encodeHeader(value: string) {
  const clean = singleLine(value);
  return /^[\x20-\x7e]*$/.test(clean) ? clean : `=?UTF-8?B?${b64(clean)}?=`;
}

export function validEmail(value: string) {
  return /^[^\s@<>,;"]+@[^\s@<>,;"]+\.[^\s@<>,;"]+$/.test(value);
}

export function buildMime(message: MailMessage, boundarySeed = Date.now().toString(36)) {
  const to = message.to.filter(validEmail);
  if (!to.length) throw new Error('No valid recipients');
  const mixed = `mixed_${boundarySeed}`; const alternative = `alt_${boundarySeed}`;
  const parts = [
    `From: ${singleLine(message.from)}`,
    `To: ${to.join(', ')}`,
    `Subject: ${encodeHeader(message.subject)}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${mixed}"`,
    '',
    `--${mixed}`,
    `Content-Type: multipart/alternative; boundary="${alternative}"`,
    '',
    `--${alternative}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    wrap(b64(message.text)),
    `--${alternative}`,
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    wrap(b64(message.html)),
    `--${alternative}--`
  ];
  for (const attachment of message.attachments ?? []) {
    const name = attachment.filename.replace(/[^A-Za-z0-9._-]/g, '_');
    parts.push(`--${mixed}`, `Content-Type: ${attachment.contentType}; name="${name}"`, `Content-Disposition: attachment; filename="${name}"`, 'Content-Transfer-Encoding: base64', '', wrap(b64(attachment.content)));
  }
  parts.push(`--${mixed}--`, '');
  return parts.join('\r\n');
}

export function toBase64Url(value: string) {
  return Buffer.from(value, 'utf8').toString('base64url');
}
