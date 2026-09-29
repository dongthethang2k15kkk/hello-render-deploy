// VietQR (NAPAS 247) payload: EMVCo merchant-presented QR with the bank BIN, account, amount and transfer note.

/** CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF), as required by EMVCo field 63. */
export function crc16(input: string) {
  let crc = 0xffff;
  for (const char of input) {
    crc ^= char.charCodeAt(0) << 8;
    for (let bit = 0; bit < 8; bit++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc;
}

function field(id: string, value: string) {
  if (value.length > 99) throw new Error(`EMV field ${id} is too long`);
  return `${id}${String(value.length).padStart(2, '0')}${value}`;
}

/** Transfer notes must stay ASCII and short so every banking app keeps them intact. */
export function transferNote(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').replace(/[^A-Za-z0-9 ]/g, '').trim().slice(0, 25);
}

export function vietQrPayload({bankBin, accountNumber, amountVnd, note}: {bankBin: string; accountNumber: string; amountVnd: number; note: string}) {
  if (!/^\d{6}$/.test(bankBin)) throw new Error('Bank BIN must be 6 digits');
  if (!/^[0-9A-Za-z]{4,19}$/.test(accountNumber)) throw new Error('Invalid account number');
  if (!Number.isInteger(amountVnd) || amountVnd <= 0 || amountVnd > 9_999_999_999) throw new Error('Invalid amount');
  const account = field('00', 'A000000727') + field('01', field('00', bankBin) + field('01', accountNumber)) + field('02', 'QRIBFTTA');
  const body = field('00', '01') + field('01', '12') + field('38', account) + field('53', '704') + field('54', String(amountVnd)) + field('58', 'VN') + field('62', field('08', transferNote(note))) + '6304';
  return body + crc16(body).toString(16).toUpperCase().padStart(4, '0');
}
