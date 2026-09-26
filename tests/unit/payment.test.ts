import {describe, expect, it} from 'vitest';
import {nextPaymentStatus, paymentAmount, quoteMinor, receiverSchema} from '../../src/lib/payment-rules';
import {canManageReceivers, canProcessOrders, paymentRole} from '../../src/lib/payment-auth';

describe('manual payment rules', () => {
  it('quotes using integer arithmetic and rounds upward', () => {
    expect(quoteMinor(1000, '25000').toString()).toBe('250000');
    expect(quoteMinor(101, '123').toString()).toBe('125');
    expect(paymentAmount('123456789', 'ltc')).toBe('1.23456789 LTC');
  });
  it.each(['', '0', '-1', '1.1', '1e5'])('rejects invalid rate %s', rate => {
    expect(() => quoteMinor(1000, rate)).toThrow();
  });
  it('does not mark a reported payment paid', () => {
    expect(nextPaymentStatus('PENDING', 'report')).toBe('REVIEW');
    expect(() => nextPaymentStatus('PENDING', 'confirm')).toThrow();
    expect(() => nextPaymentStatus('REVIEW', 'deliver')).toThrow();
    expect(nextPaymentStatus('REVIEW', 'confirm')).toBe('PAID');
    expect(nextPaymentStatus('PAID', 'deliver')).toBe('DELIVERED');
    expect(() => nextPaymentStatus('DELIVERED', 'confirm')).toThrow();
  });
  it('validates bank details and rejects remote QR URLs', () => {
    const r = {label:'Test', method:'bank', destination:'123456789', bank:'Test bank', holder:'Test', qrPath:'', active:false, pendingLimit:10};
    expect(receiverSchema.safeParse(r).success).toBe(true);
    expect(receiverSchema.safeParse({...r, bank:''}).success).toBe(false);
    expect(receiverSchema.safeParse({...r, qrPath:'https://example.com/qr.png'}).success).toBe(false);
    expect(receiverSchema.safeParse({...r, qrPath:'/payment-qr/test.png'}).success).toBe(true);
    expect(receiverSchema.safeParse({...r, method:'ltc'}).success).toBe(false);
  });
  it('requires a configured strong admin credential', () => {
    const admin = process.env.PAYMENT_ADMIN_KEY;
    try {
      process.env.PAYMENT_ADMIN_KEY = 'a'.repeat(32);
      const req = (token: string) => new Request('http://localhost', {headers:{authorization:`Bearer ${token}`}});
      expect(paymentRole(req(''))).toBe(null);
      expect(paymentRole(req('c'.repeat(32)))).toBe(null);
      expect(paymentRole(req('a'.repeat(32)))).toBe('admin');
      expect(paymentRole(req('b'.repeat(32)))).toBe(null);
      expect(canManageReceivers('admin')).toBe(true);
      expect(canManageReceivers(null)).toBe(false);
      expect(canProcessOrders('admin')).toBe(true);
      expect(canProcessOrders(null)).toBe(false);
    } finally {
      if (admin === undefined) delete process.env.PAYMENT_ADMIN_KEY; else process.env.PAYMENT_ADMIN_KEY = admin;
    }
  });
});