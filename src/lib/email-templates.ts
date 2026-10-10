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

export type ReportedPayment = {kind: 'crypto'; amount: string; coin: string; network: string; address: string; txid: string | null} | {kind: 'paypal'; amount: string; paypalMe: string; txid: string | null};

export function adminPaymentReported(input: {code: string; customerName: string; customerEmail: string; totalVnd: number; payment?: ReportedPayment | null; items: string[]; slots: Slot[]; orderUrl: string}): EmailContent {
  const payment = input.payment;
  const customer = `Khách <strong>${escapeHtml(input.customerName)}</strong> (${escapeHtml(input.customerEmail)})`;
  const title = `Đơn ${input.code} đã báo ${payment?.kind === 'crypto' ? `gửi ${payment.coin}` : payment ? 'gửi PayPal' : 'chuyển khoản'}`;
  const lines = [
    payment?.kind === 'crypto'
      ? `${customer} báo đã gửi <strong>${escapeHtml(payment.amount)} ${payment.coin}</strong> (mạng ${escapeHtml(payment.network)}, ≈ ${formatVnd(input.totalVnd)}) tới ví <strong>${escapeHtml(payment.address)}</strong>.${payment.txid ? ` TXID: ${escapeHtml(payment.txid)}` : ''}`
      : payment?.kind === 'paypal'
        ? `${customer} báo đã gửi <strong>${escapeHtml(payment.amount)} USD</strong> qua PayPal (≈ ${formatVnd(input.totalVnd)}) tới <strong>paypal.me/${escapeHtml(payment.paypalMe)}</strong>, ghi chú <strong>${input.code}</strong>.${payment.txid ? ` Mã giao dịch PayPal: ${escapeHtml(payment.txid)}` : ''}`
        : `${customer} báo đã chuyển <strong>${formatVnd(input.totalVnd)}</strong> với nội dung <strong>${input.code}</strong>.`,
    `Sản phẩm: ${input.items.map(escapeHtml).join('; ')}`,
    `Khung giờ khách rảnh (giờ Việt Nam):<br>${input.slots.map(slot => `• ${escapeHtml(formatRange(slot.start, slot.end, VN_TIME_ZONE))}`).join('<br>')}`,
    payment?.kind === 'crypto' ? 'Hãy kiểm tra giao dịch trên blockchain (link trong trang đơn), rồi xác nhận và chọn giờ hẹn.'
      : payment?.kind === 'paypal' ? `Hãy mở PayPal, kiểm tra đã nhận đúng <strong>${escapeHtml(payment.amount)} USD</strong> (ghi chú ${input.code}), rồi xác nhận tiền và chọn giờ hẹn trong trang đơn.`
      : 'Hãy đối chiếu sao kê ngân hàng, rồi xác nhận tiền và chọn giờ hẹn trong trang đơn.'
  ];
  lines.push('Admin nào bấm <strong>Nhận đơn</strong> trong Workspace trước sẽ phụ trách khách này (chat, xác nhận tiền, giao hàng).');
  const link = {label: 'Nhận đơn trong Workspace', url: input.orderUrl};
  const amount = payment?.kind === 'crypto' ? `${payment.amount} ${payment.coin}` : payment ? `${payment.amount} USD` : formatVnd(input.totalVnd);
  return {subject: `[Jewish Horse] ${title} ${amount}`, html: layout(title, lines, link), text: plain(title, lines, [link])};
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
  // An Admin who is free can start right away ("Start now"); the email then says so instead of naming a later time.
  const startsNow = input.start.getTime() - Date.now() <= 2 * 60_000;
  const title = startsNow ? `We are ready for you now · order ${input.code}` : input.rescheduled ? `Your appointment has changed · order ${input.code}` : `Your appointment is booked · order ${input.code}`;
  const lines = [
    `Hi ${escapeHtml(input.name)},`,
    startsNow ? 'An Admin is available now to deliver your order.' : input.rescheduled ? 'Your appointment time has been updated.' : 'Thank you. Your payment is confirmed and your appointment is booked.',
    `<strong>${escapeHtml(formatRange(input.start, input.end, input.timeZone))}</strong>`,
    startsNow ? 'Sign in to our website and open Chat now. We are waiting for you there.' : 'At that time, sign in to our website and open Chat. We will deliver your order with you there. A calendar file is attached so your phone can remind you.'
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

export function customerLuckySpinGranted(input: {name: string; wheelUrl: string}): EmailContent {
  const title = 'Your free spin is ready';
  const lines = [
    `Hi ${escapeHtml(input.name)},`,
    'Thank you for your completed purchase. We have added <strong>one Lucky Wheel spin</strong> to your Jewish Horse account.',
    'Sign in and open Lucky Drop to use it. Your prize will be added to the wheel-coin balance shown in the header.',
    'On a future order, choose <strong>“Receive all wheel winnings”</strong> if you want the Admin to include that balance with your package.'
  ];
  const link = {label: 'Open the Lucky Wheel', url: input.wheelUrl};
  return {subject: `Jewish Horse: ${title}`, html: layout(title, lines, link), text: plain(title, lines, [link])};
}

export function adminTestEmail(input: {sender: string; adminUrl: string}): EmailContent {
  const title = 'Email thử từ Jewish Horse';
  const lines = [`Gmail <strong>${escapeHtml(input.sender)}</strong> đã được kết nối và gửi thư thành công.`, 'Thư báo đơn mới sẽ được gửi tới tất cả email Admin.'];
  const link = {label: 'Mở Admin', url: input.adminUrl};
  return {subject: `[Jewish Horse] ${title}`, html: layout(title, lines, link), text: plain(title, lines, [link])};
}

// ---------- Automatic payment detection, ASAP appointments and reminders ----------

export function adminPaymentDetected(input: {code: string; customerName: string; amountLabel: string; network: string; slots: Slot[]; asap: boolean; orderUrl: string}): EmailContent {
  const title = `Đơn ${input.code} đã thanh toán (tự động)`;
  const lines = [
    `Hệ thống đã tự nhận giao dịch ${escapeHtml(input.network)} trên blockchain: <strong>${escapeHtml(input.amountLabel)}</strong> từ khách <strong>${escapeHtml(input.customerName)}</strong>.`,
    ...(input.asap ? ['<strong>Khách muốn giao dịch NGAY BÂY GIỜ.</strong> Nếu bạn rảnh, nhận đơn trong Workspace và bấm "Start now".'] : []),
    input.slots.length ? `Khung giờ khách rảnh (giờ Việt Nam):<br>${input.slots.map(slot => `• ${escapeHtml(formatRange(slot.start, slot.end, VN_TIME_ZONE))}`).join('<br>')}` : 'Khách chưa chọn giờ; web đã nhắc khách chọn.',
    'Hãy chốt lịch hẹn trong trang đơn.'
  ];
  const link = {label: 'Mở đơn', url: input.orderUrl};
  return {subject: `[Jewish Horse] ${title}${input.asap ? ' · khách rảnh ngay' : ''}`, html: layout(title, lines, link), text: plain(title, lines, [link])};
}

export function adminTimesAdded(input: {code: string; customerName: string; slots: Slot[]; asap: boolean; orderUrl: string}): EmailContent {
  const title = `Đơn ${input.code}: khách đã chọn giờ`;
  const lines = [`Khách <strong>${escapeHtml(input.customerName)}</strong> vừa chọn thời gian nhận hàng.`, input.asap ? '<strong>Khách đang rảnh NGAY BÂY GIỜ.</strong>' : input.slots.map(slot => `• ${escapeHtml(formatRange(slot.start, slot.end, VN_TIME_ZONE))}`).join('<br>')];
  const link = {label: 'Mở đơn để chốt lịch', url: input.orderUrl};
  return {subject: `[Jewish Horse] ${title}${input.asap ? ' · rảnh ngay' : ''}`, html: layout(title, lines, link), text: plain(title, lines, [link])};
}

export function customerReminder(input: {code: string; name: string; start: Date; end: Date; timeZone: string; orderUrl: string; now: boolean}): EmailContent {
  const title = input.now ? `We are ready for you now · order ${input.code}` : `Your appointment starts soon · order ${input.code}`;
  const lines = [
    `Hi ${escapeHtml(input.name)},`,
    input.now ? 'The shop is ready to deliver your order now.' : 'Your appointment is coming up:',
    `<strong>${escapeHtml(formatRange(input.start, input.end, input.timeZone))}</strong>`,
    'Sign in to our website and open Chat. We have also left you a message there.'
  ];
  const link = {label: 'Open chat', url: input.orderUrl.replace(/\/orders\/.*$/, '/workspace')};
  return {subject: `Jewish Horse: ${title}`, html: layout(title, lines, link, {label: 'View order', url: input.orderUrl}), text: plain(title, lines, [link, {label: 'View order', url: input.orderUrl}])};
}

export function adminReminder(input: {code: string; customerName: string; start: Date; end: Date; orderUrl: string}): EmailContent {
  const title = `Sắp tới giờ hẹn đơn ${input.code}`;
  const lines = [`Khách <strong>${escapeHtml(input.customerName)}</strong> · <strong>${escapeHtml(formatRange(input.start, input.end, VN_TIME_ZONE))}</strong>.`, 'Web đã nhắn nhắc khách trong chat. Mở chat của khách từ trang đơn.'];
  const link = {label: 'Mở đơn', url: input.orderUrl};
  return {subject: `[Jewish Horse] ${title}`, html: layout(title, lines, link), text: plain(title, lines, [link])};
}
