import { fetchTonApi } from '../ton/client.js';

interface AccountInfo {
  balance: number;
  status: string;
  address: string;
  name?: string;
  interfaces?: string[];
}

interface JettonBalance {
  balance: string;
  jetton: {
    address: string;
    name: string;
    symbol: string;
    decimals: number;
    image?: string;
  };
}

interface JettonBalancesResponse {
  balances: JettonBalance[];
}

export async function getTonBalance(address: string): Promise<string> {
  const data = await fetchTonApi<AccountInfo>(`/v2/accounts/${encodeURIComponent(address)}`);
  const balanceTon = data.balance / 1_000_000_000;
  return JSON.stringify({
    address: data.address,
    balance: balanceTon.toFixed(4),
    balance_usd: null,
    status: data.status,
  });
}

export async function getJettonBalances(address: string): Promise<string> {
  const data = await fetchTonApi<JettonBalancesResponse>(
    `/v2/accounts/${encodeURIComponent(address)}/jettons`
  );

  const balances = data.balances.map((jb) => {
    const decimals = jb.jetton.decimals || 9;
    const amount = Number(jb.balance) / Math.pow(10, decimals);
    return {
      name: jb.jetton.name,
      symbol: jb.jetton.symbol,
      balance: amount.toFixed(4),
      jetton_address: jb.jetton.address,
    };
  });

  return JSON.stringify({ address, jettons: balances });
}
