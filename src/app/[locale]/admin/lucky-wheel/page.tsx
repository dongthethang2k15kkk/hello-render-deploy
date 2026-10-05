import LuckyWheelAdmin from '@/components/lucky-wheel-admin';

export default function LuckyWheelPage() {
  return <div className="page-heading"><p className="eyebrow">ADMIN / LUCKY WHEEL</p><h1>Lucky wheel</h1><p className="notice">Configure prize amounts and weights, then review every spin. A paid order grants one spin; the result is selected on the server.</p><LuckyWheelAdmin/></div>;
}
