// Email content. Admin emails are Vietnamese (the shop team); customer emails are English like the storefront.
import {formatVnd} from './money';
import {formatRange, VN_TIME_ZONE} from './order-rules';

export type EmailContent = {subject: string; text: string; html: string};

export function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, char => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[char]!));
}

function layout(title: string, lines: string[], action?: {label: string; url: string}, secondary?: {label: string; url: string}) {
  const button = (item: {label: string; url: string}, primary: boolean) => `<a href="${escapeHtml(item.url)}" style="display:inline-block;margin:6px 8px 6px 0;padding:11px 18px;border-radius:8px;text-decoration:none;font-weight:700;${primary ? 'background:#2f6b3f;color:#ffffff' : 'background:#eef4ec;color:#2f5039'}">${escapeHtml(item.label)}</a>`;
  return `<!doctype html><html><body style="margin:0;background:#f2f5f0;font-family:Arial,Helvetica,sans-serif;color:#1f2c24">
<div style="max-width:560px;margin:0 auto;padding:24px">
<div style="font-weight:700;letter-spacing:.08em;color:#2f6b3f;font-size:12px">JEWISH HORSE</div>
<div style="background:#ffffff;border:1px solid #d7e0d4;border-radius:12px;padding:22px;margin-top:10px">
<h1 style="font-size:20px;margin:0 0 12px">${escapeHtml(title)}</h1>
${lines.map(line => `<p style="margin:0 0 10px;line-height:1.6">${line}</p>`).join('\n')}
${action ? button(action, true) : ''}${secondary ? button(secondary, false) : ''}
</div></div></body></html>`;
}

const plain = (title: string, lines: string[], links: {label: string; url: string}[]) =>
  [title, '', ...lines.map(line => line.replace(/<[^>]+>/g, '')), '', ...links.map(link => `${link.label}: ${link.url}`)].join('\n');

type Slot = {start: Date | string; end: Date | string};

export function adminPaymentReported(input: {code: string; customerName: string; customerEmail: string; totalVnd: number; crypto?: {amount: string; address: string; txid: string | null} | null; items: string[]; slots: Slot[]; orderUrl: string}): EmailContent {
  const title = `Đơn ${input.code} đã báo ${input.crypto ? 'gửi Litecoin' : 'chuyển khoản'}`;
  const lines = [
    input.crypto
      ? `Khách <strong>${escapeHtml(input.customerName)}</strong> (${escapeHtml(input.customerEmail)}) báo đã gửi <strong>${escapeHtml(input.crypto.amount)} LTC</strong> (≈ ${formatVnd(input.totalVnd)}) tới ví <strong>${escapeHtml(input.crypto.address)}</strong>.${input.crypto.txid ? ` TXID: ${escapeHtml(input.crypto.txid)}` : ''}`
      : `Khách <strong>${escapeHtml(input.customerName)}</strong> (${escapeHtml(input.customerEmail)}) báo đã chuyển <strong>${formatVnd(input.totalVnd)}</strong> với nội dung <strong>${input.code}</strong>.`,
    `Sản phẩm: ${input.items.map(escapeHtml).join('; ')}`,
    `Khung giờ khách rảnh (giờ Việt Nam):<br>${input.slots.map(slot => `• ${escapeHtml(formatRange(slot.start, slot.end, VN_TIME_ZONE))}`).join('<br>')}`,
    input.crypto ? 'Hãy kiểm tra giao dịch trên blockchain (link trong trang đơn), rồi xác nhận và chọn giờ hẹn.' : 'Hãy đối chiếu sao kê ngân hàng, rồi xác nhận tiền và chọn giờ hẹn trong trang đơn.'
  ];
  const link = {label: 'Mở đơn để xác nhận', url: input.orderUrl};
  return {subject: `[Jewish Horse] ${title} ${input.crypto ? `${input.crypto.amount} LTC` : formatVnd(input.totalVnd)}`, html: layout(title, lines, link), text: plain(title, lines, [link])};
}

export function adminAppointmentAssigned(input: {code: string; customerName: string; start: Date; end: Date; orderUrl: string; calendarUrl: string}): EmailContent {
  const title = `Lịch hẹn đơn ${input.code}`;
  const lines = [`Bạn phụ trách đơn <strong>${input.code}</strong> với khách <strong>${escapeHtml(input.customerName)}</strong>.`, `Thời gian: <strong>${escapeHtml(formatRange(input.start, input.end, VN_TIME_ZONE))}</strong>.`, 'Đến giờ, mở chat của khách trong trang đơn để trao đổi. File lịch được đính kèm.'];
  const links = [{label: 'Mở đơn', url: input.orderUrl}, {label: 'Thêm vào Google Calendar', url: input.calendarUrl}];
  return {subject: `[Jewish Horse] ${title}`, html: layout(title, lines, links[0], links[1]), text: plain(title, lines, links)};
}

export function customerPaymentConfirmed(input: {code: string; name: string; orderUrl: string}): EmailContent {
  const title = `Payment received for order ${input.code}`;
  const lines = [`Hi ${escapeHtml(input.name)},`, 'We have received your payment. We will confirm one of your chosen times shortly and let you know here and in your Inbox on our website.'];
  const link = {label: 'View your order', url: input.orderUrl};
  return {subject: `Jewish Horse: ${title}`, html: layout(title, lines, link), text: plain(title, lines, [link])};
}

export function customerAppointment(input: {code: string; name: string; start: Date; end: Date; timeZone: string; orderUrl: string; calendarUrl: string; rescheduled: boolean}): EmailContent {
  const title = input.rescheduled ? `Your appointment has changed · order ${input.code}` : `Your appointment is booked · order ${input.code}`;
  const lines = [
    `Hi ${escapeHtml(input.name)},`,
    input.rescheduled ? 'Your appointment time has been updated.' : 'Thank you. Your payment is confirmed and your appointment is booked.',
    `<strong>${escapeHtml(formatRange(input.start, input.end, input.timeZone))}</strong>`,
    'At that time, sign in to our website and open Chat. We will deliver your order with you there. A calendar file is attached so your phone can remind you.'
  ];
  const links = [{label: 'Open your order', url: input.orderUrl}, {label: 'Add to Google Calendar', url: input.calendarUrl}];
  return {subject: `Jewish Horse: ${title}`, html: layout(title, lines, links[0], links[1]), text: plain(title, lines, links)};
}

export function customerCompleted(input: {code: string; name: string; orderUrl: string}): EmailContent {
  const title = `Order ${input.code} is complete`;
  const lines = [`Hi ${escapeHtml(input.name)},`, 'Your order has been delivered. For your security, the delivery details are only shown on your order page after you sign in.'];
  const link = {label: 'View delivery details', url: input.orderUrl};
  return {subject: `Jewish Horse: ${title}`, html: layout(title, lines, link), text: plain(title, lines, [link])};
}

export function customerCancelled(input: {code: string; name: string; reason: string; paid: boolean; orderUrl: string}): EmailContent {
  const title = `Order ${input.code} was cancelled`;
  const lines = [`Hi ${escapeHtml(input.name)},`, `Your order was cancelled${input.reason ? `: ${escapeHtml(input.reason)}` : '.'}`, input.paid ? 'If you already transferred money, we will contact you in Chat to arrange the refund.' : 'No payment was taken.'];
  const link = {label: 'View your order', url: input.orderUrl};
  return {subject: `Jewish Horse: ${title}`, html: layout(title, lines, link), text: plain(title, lines, [link])};
}

export function adminTestEmail(input: {sender: string; adminUrl: string}): EmailContent {
  const title = 'Email thử từ Jewish Horse';
  const lines = [`Gmail <strong>${escapeHtml(input.sender)}</strong> đã được kết nối và gửi thư thành công.`, 'Thư báo đơn mới sẽ được gửi tới tất cả email Admin.'];
  const link = {label: 'Mở Admin', url: input.adminUrl};
  return {subject: `[Jewish Horse] ${title}`, html: layout(title, lines, link), text: plain(title, lines, [link])};
}
