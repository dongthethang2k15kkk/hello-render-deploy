import {describe, expect, it} from 'vitest';
import {googleCalendarLink, icsEvent} from '../../src/lib/calendar';
import {adminPaymentReported, customerCompleted, escapeHtml} from '../../src/lib/email-templates';
import {buildMime, encodeHeader, toBase64Url} from '../../src/lib/mail-mime';
import {formatUsdFromVnd, formatVnd, validVndPerUsd, vndToUsdCents} from '../../src/lib/money';
import {appointmentProblem, dateToVietnamLocal, generateOrderCode, holdsStock, nextStatus, orderCodePattern, slotProblem, vietnamLocalToDate} from '../../src/lib/order-rules';
import {crc16, transferNote, vietQrPayload} from '../../src/lib/vietqr';

describe('money', () => {
  it('formats VND with dot grouping and converts to USD by the rate', () => {
    expect(formatVnd(50000)).toBe('50.000 ₫');
    expect(vndToUsdCents(50000, 26000)).toBe(192);
    expect(formatUsdFromVnd(260000, 26000)).toBe('$10.00');
    expect(validVndPerUsd(26000)).toBe(true);
    expect(validVndPerUsd(0)).toBe(false);
  });
});

describe('VietQR', () => {
  it('uses CRC-16/CCITT-FALSE', () => expect(crc16('123456789')).toBe(0x29b1));
  it('builds a NAPAS payload with amount, note and a valid checksum', () => {
    const payload = vietQrPayload({bankBin: '970436', accountNumber: '0123456789', amountVnd: 50000, note: 'JH7K3M9Q'});
    expect(payload.startsWith('000201010212')).toBe(true);
    expect(payload).toContain('0010A000000727');
    expect(payload).toContain('01240006970436' + '0110' + '0123456789');
    expect(payload).toContain('0208QRIBFTTA');
    expect(payload).toContain('5303704' + '540550000' + '5802VN');
    expect(payload).toContain('62120808JH7K3M9Q');
    const body = payload.slice(0, -4);
    expect(body.endsWith('6304')).toBe(true);
    expect(payload.slice(-4)).toBe(crc16(body).toString(16).toUpperCase().padStart(4, '0'));
  });
  it('keeps transfer notes ASCII and short', () => {
    expect(transferNote('Đơn hàng #JH7K!')).toBe('Don hang JH7K');
    expect(transferNote('x'.repeat(40))).toHaveLength(25);
  });
  it('rejects malformed bank details', () => {
    expect(() => vietQrPayload({bankBin: '97', accountNumber: '0123456789', amountVnd: 1000, note: 'X'})).toThrow();
    expect(() => vietQrPayload({bankBin: '970436', accountNumber: '01 23', amountVnd: 1000, note: 'X'})).toThrow();
    expect(() => vietQrPayload({bankBin: '970436', accountNumber: '0123456789', amountVnd: 0, note: 'X'})).toThrow();
  });
});

describe('order lifecycle', () => {
  it('allows only the designed transitions', () => {
    expect(nextStatus('awaiting_payment', 'report')).toBe('payment_reported');
    expect(nextStatus('payment_reported', 'confirm-payment')).toBe('paid');
    expect(nextStatus('expired', 'confirm-payment')).toBe('paid');
    expect(nextStatus('paid', 'schedule')).toBe('scheduled');
    expect(nextStatus('scheduled', 'schedule')).toBe('scheduled');
    expect(nextStatus('scheduled', 'complete')).toBe('completed');
    expect(nextStatus('payment_reported', 'cancel-customer')).toBeNull();
    expect(nextStatus('completed', 'cancel-admin')).toBeNull();
    expect(nextStatus('awaiting_payment', 'complete')).toBeNull();
  });
  it('holds stock only while an order is live', () => {
    expect(holdsStock('awaiting_payment')).toBe(true);
    expect(holdsStock('expired')).toBe(false);
    expect(holdsStock('cancelled')).toBe(false);
  });
  it('generates typable order codes', () => {
    for (let i = 0; i < 50; i++) expect(generateOrderCode()).toMatch(orderCodePattern);
    expect(generateOrderCode(size => new Uint8Array(size))).toBe('JH222222');
  });
});

describe('time windows', () => {
  const now = Date.parse('2026-10-01T03:00:00Z');
  const at = (hours: number) => new Date(now + hours * 3_600_000).toISOString();
  it('accepts future windows between 30 minutes and 12 hours', () => expect(slotProblem([{start: at(2), end: at(4)}], now)).toBeNull());
  it('rejects past, too short, too long and too far windows', () => {
    expect(slotProblem([{start: at(0), end: at(2)}], now)).toMatch(/15 minutes/);
    expect(slotProblem([{start: at(2), end: at(2.2)}], now)).toMatch(/30 minutes/);
    expect(slotProblem([{start: at(2), end: at(20)}], now)).toMatch(/12 hours/);
    expect(slotProblem([{start: at(24 * 31), end: at(24 * 31 + 1)}], now)).toMatch(/30 days/);
  });
  it('validates Admin appointments', () => {
    expect(appointmentProblem(now + 3_600_000, now + 7_200_000, now)).toBeNull();
    expect(appointmentProblem(now - 3_600_000, now, now)).toMatch(/future/);
  });
  it('round-trips Vietnam local times (UTC+7)', () => {
    const date = vietnamLocalToDate('2026-10-02T20:30');
    expect(date.toISOString()).toBe('2026-10-02T13:30:00.000Z');
    expect(dateToVietnamLocal(date)).toBe('2026-10-02T20:30');
    expect(Number.isNaN(vietnamLocalToDate('20:30').getTime())).toBe(true);
  });
});

describe('calendar', () => {
  const event = {uid: 'o1@jh', start: new Date('2026-10-02T13:30:00Z'), end: new Date('2026-10-02T14:30:00Z'), title: 'Order JH222222', description: 'Chat, then deliver; bring notes', url: 'https://shop.example/en/orders/JH222222'};
  it('writes an RFC 5545 event with escaped text and a reminder', () => {
    const ics = icsEvent(event, new Date('2026-10-01T00:00:00Z'));
    expect(ics).toContain('DTSTART:20261002T133000Z');
    expect(ics).toContain('DTEND:20261002T143000Z');
    expect(ics).toContain('DESCRIPTION:Chat\\, then deliver\\; bring notes');
    expect(ics).toContain('TRIGGER:-PT30M');
    expect(ics.split('\r\n').every(line => line.length <= 75)).toBe(true);
  });
  it('builds a Google Calendar template link', () => {
    const link = new URL(googleCalendarLink(event));
    expect(link.searchParams.get('dates')).toBe('20261002T133000Z/20261002T143000Z');
    expect(link.searchParams.get('action')).toBe('TEMPLATE');
  });
});

describe('email', () => {
  it('encodes Vietnamese subjects and strips header injection', () => {
    expect(encodeHeader('Đơn JH222222')).toMatch(/^=\?UTF-8\?B\?/);
    expect(encodeHeader('Order\r\nBcc: evil@example.com')).toBe('Order Bcc: evil@example.com');
    const mime = buildMime({from: 'Shop <shop@gmail.com>', to: ['a@example.com', 'bad address'], subject: 'Hi', text: 'Hello', html: '<p>Hello</p>', attachments: [{filename: 'appointment.ics', contentType: 'text/calendar', content: 'BEGIN:VCALENDAR'}]}, 'fixed');
    expect(mime).toContain('To: a@example.com\r\n');
    expect(mime).toContain('filename="appointment.ics"');
    expect(toBase64Url(mime)).not.toMatch(/[+/=]/);
  });
  it('escapes customer input in templates and keeps delivery details out of email', () => {
    expect(escapeHtml('<b>"x"</b>')).toBe('&lt;b&gt;&quot;x&quot;&lt;/b&gt;');
    const admin = adminPaymentReported({code: 'JH222222', customerName: '<script>', customerEmail: 'a@example.com', totalVnd: 50000, items: ['Pack × 1'], slots: [{start: '2026-10-02T13:30:00Z', end: '2026-10-02T15:30:00Z'}], orderUrl: 'https://shop.example/en/admin/orders/x'});
    expect(admin.html).not.toContain('<script>');
    expect(admin.subject).toContain('50.000 ₫');
    expect(admin.text).toContain('20:30');
    const done = customerCompleted({code: 'JH222222', name: 'Vy', orderUrl: 'https://shop.example/en/orders/JH222222'});
    expect(done.text).toContain('only shown on your order page');
  });
});
