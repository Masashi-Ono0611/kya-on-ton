import { TonClient, WalletContractV5R1 } from '@ton/ton';
import { mnemonicToPrivateKey } from '@ton/crypto';
import { Address, toNano, internal, beginCell } from '@ton/core';
import { readFileSync } from 'fs';
import { TONCENTER_ENDPOINT, TONCENTER_API_KEY, AGENT_MNEMONIC_PATH } from '../ton/constants.js';

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function loadWallet() {
  if (!AGENT_MNEMONIC_PATH) {
    throw new Error('AGENT_MNEMONIC_PATH not configured — cannot sign transactions');
  }

  const mnemonicStr = readFileSync(AGENT_MNEMONIC_PATH, 'utf-8').trim();
  const mnemonic = mnemonicStr.split(' ');
  const keypair = await mnemonicToPrivateKey(mnemonic);

  const client = new TonClient({
    endpoint: TONCENTER_ENDPOINT,
    apiKey: TONCENTER_API_KEY || undefined,
  });

  const wallet = WalletContractV5R1.create({
    workchain: 0,
    publicKey: keypair.publicKey,
  });

  return { client, wallet, keypair, contract: client.open(wallet) };
}

export async function sendTon(toAddress: string, amount: string, comment?: string): Promise<string> {
  const amountNum = parseFloat(amount);
  if (isNaN(amountNum) || amountNum <= 0) {
    return JSON.stringify({ error: 'Invalid amount' });
  }
  if (amountNum > 1) {
    return JSON.stringify({ error: 'Safety limit: maximum 1 TON per transaction on testnet' });
  }

  let to: Address;
  try {
    to = Address.parse(toAddress);
  } catch {
    return JSON.stringify({ error: `Invalid address: ${toAddress}` });
  }

  try {
    const { client, wallet, keypair, contract } = await loadWallet();

    // Check balance
    await sleep(1500);
    const balance = await client.getBalance(wallet.address);
    const balanceTon = Number(balance) / 1e9;

    if (balanceTon < amountNum + 0.05) {
      return JSON.stringify({
        error: `Insufficient balance: ${balanceTon.toFixed(4)} TON (need ${amountNum} + 0.05 gas)`,
      });
    }

    // Send transfer
    await sleep(1500);
    const seqno = await contract.getSeqno();

    const body = comment
      ? beginCell()
          .storeUint(0, 32) // text comment prefix
          .storeStringTail(comment)
          .endCell()
      : undefined;

    await sleep(1500);
    await contract.sendTransfer({
      seqno,
      secretKey: keypair.secretKey,
      messages: [
        internal({
          to,
          value: toNano(amount),
          body,
          bounce: false,
        }),
      ],
    });

    // Wait for confirmation
    for (let i = 0; i < 20; i++) {
      await sleep(3000);
      try {
        const currentSeqno = await contract.getSeqno();
        if (currentSeqno > seqno) {
          return JSON.stringify({
            success: true,
            from: wallet.address.toString({ testOnly: true, bounceable: false }),
            to: toAddress,
            amount: `${amount} TON`,
            comment: comment || null,
            remaining_balance: `~${(balanceTon - amountNum - 0.01).toFixed(4)} TON`,
          });
        }
      } catch { /* rate limit retry */ }
    }

    return JSON.stringify({
      success: false,
      error: 'Transaction sent but confirmation timed out. Check explorer.',
      from: wallet.address.toString({ testOnly: true, bounceable: false }),
    });
  } catch (error) {
    return JSON.stringify({
      error: `Transfer failed: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
}
