import {z} from 'zod';

export const MAX_HISTORICAL_TRADES = 100_000_000;

export const tradeCounterSchema = z.object({
  historicalCompleted: z.number().int().min(0).max(MAX_HISTORICAL_TRADES)
});

export type TradeCounterSettings = z.infer<typeof tradeCounterSchema>;

export const defaultTradeCounterSettings: TradeCounterSettings = {historicalCompleted: 0};

export function parseTradeCounterSettings(value: unknown): TradeCounterSettings {
  const parsed = tradeCounterSchema.safeParse(value);
  return parsed.success ? parsed.data : defaultTradeCounterSettings;
}

export function completedTradeTotal(historicalCompleted: number, shopCompleted: number) {
  return Math.max(0, historicalCompleted) + Math.max(0, shopCompleted);
}
