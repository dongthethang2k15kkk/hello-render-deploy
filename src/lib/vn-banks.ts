// NAPAS bank identification numbers (BIN) used in VietQR codes. Admin can also enter a BIN manually.
export const vnBanks = [
  {bin: '970436', name: 'Vietcombank'},
  {bin: '970415', name: 'VietinBank'},
  {bin: '970418', name: 'BIDV'},
  {bin: '970405', name: 'Agribank'},
  {bin: '970407', name: 'Techcombank'},
  {bin: '970422', name: 'MB Bank'},
  {bin: '970416', name: 'ACB'},
  {bin: '970432', name: 'VPBank'},
  {bin: '970423', name: 'TPBank'},
  {bin: '970403', name: 'Sacombank'},
  {bin: '970441', name: 'VIB'},
  {bin: '970443', name: 'SHB'},
  {bin: '970437', name: 'HDBank'},
  {bin: '970448', name: 'OCB'},
  {bin: '970426', name: 'MSB'},
  {bin: '970440', name: 'SeABank'},
  {bin: '970431', name: 'Eximbank'},
  {bin: '970449', name: 'LPBank'},
  {bin: '970428', name: 'Nam A Bank'},
  {bin: '970454', name: 'BVBank (Viet Capital)'},
  {bin: '970409', name: 'Bac A Bank'},
  {bin: '970412', name: 'PVcomBank'},
  {bin: '970429', name: 'SCB'},
  {bin: '970425', name: 'ABBANK'},
  {bin: '970419', name: 'NCB'},
  {bin: '970452', name: 'KienlongBank'},
  {bin: '970427', name: 'VietABank'},
  {bin: '970433', name: 'Vietbank'},
  {bin: '970438', name: 'BaoViet Bank'},
  {bin: '970430', name: 'PGBank'},
  {bin: '970400', name: 'Saigonbank'},
  {bin: '970424', name: 'Shinhan Bank'},
  {bin: '970457', name: 'Woori Bank'},
  {bin: '970458', name: 'UOB Vietnam'},
  {bin: '422589', name: 'CIMB Vietnam'},
  {bin: '546034', name: 'Cake by VPBank'}
] as const;

export function bankName(bin: string) {
  return vnBanks.find(bank => bank.bin === bin)?.name ?? `Bank ${bin}`;
}
