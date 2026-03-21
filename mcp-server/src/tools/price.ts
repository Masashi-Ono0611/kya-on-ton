import { fetchTonApi } from '../ton/client.js';

interface RatesResponse {
  rates: Record<string, {
    prices?: Record<string, number>;
    diff_24h?: Record<string, string>;
    diff_7d?: Record<string, string>;
    diff_30d?: Record<string, string>;
  }>;
}

const KNOWN_TOKENS: Record<string, string> = {
  'TON': 'TON',
  'USDT': 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs',
  'STON': 'EQA2kCVNwVsil2EM2mB0SkXytxCqQjS4mttjDpnXmwG9T6bO',
  'BOLT': 'EQD0vdSA_NedR9uvbgN9EikRX-suesDxGeFg69XQMavfLqIw',
  'SCALE': 'EQBlqsm144Dq6SjbPI4jjZvA1hqTIP3CvHovbIfW_t-SCALE',
};

export async function getTokenPrice(token: string): Promise<string> {
  // Resolve token symbol to address
  const tokenAddr = KNOWN_TOKENS[token.toUpperCase()] || token;

  const data = await fetchTonApi<RatesResponse>('/v2/rates', {
    tokens: tokenAddr,
    currencies: 'usd',
  });

  const rateInfo = data.rates[tokenAddr];
  if (!rateInfo) {
    return JSON.stringify({ error: `Token not found: ${token}` });
  }

  return JSON.stringify({
    token,
    address: tokenAddr,
    price_usd: rateInfo.prices?.['USD'] ?? null,
    change_24h: rateInfo.diff_24h?.['USD'] ?? null,
    change_7d: rateInfo.diff_7d?.['USD'] ?? null,
  });
}

export async function estimateSwap(from: string, to: string, amount: string): Promise<string> {
  // Resolve symbols
  const fromAddr = KNOWN_TOKENS[from.toUpperCase()] || from;
  const toAddr = KNOWN_TOKENS[to.toUpperCase()] || to;

  // Get prices for both tokens
  const [fromRates, toRates] = await Promise.all([
    fetchTonApi<RatesResponse>('/v2/rates', { tokens: fromAddr, currencies: 'usd' }),
    fetchTonApi<RatesResponse>('/v2/rates', { tokens: toAddr, currencies: 'usd' }),
  ]);

  const fromPrice = fromRates.rates[fromAddr]?.prices?.['USD'];
  const toPrice = toRates.rates[toAddr]?.prices?.['USD'];

  if (!fromPrice || !toPrice) {
    return JSON.stringify({ error: 'Could not fetch prices for swap estimation' });
  }

  const inputValue = parseFloat(amount) * fromPrice;
  const estimatedOutput = inputValue / toPrice;
  // Apply 0.3% DEX fee estimate
  const outputAfterFee = estimatedOutput * 0.997;

  return JSON.stringify({
    from: { token: from, amount, price_usd: fromPrice },
    to: { token: to, estimated_amount: outputAfterFee.toFixed(6), price_usd: toPrice },
    estimated_value_usd: inputValue.toFixed(2),
    fee_estimate: '0.3%',
    note: 'This is a price-based estimate. Actual swap may differ due to slippage and pool liquidity.',
  });
}
