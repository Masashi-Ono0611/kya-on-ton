import { mnemonicNew, mnemonicToPrivateKey, KeyPair } from '@ton/crypto';
import { WalletContractV5R1 } from '@ton/ton';
import { Address } from '@ton/core';

export interface WalletInfo {
  mnemonic: string[];
  keypair: KeyPair;
  address: Address;
  friendlyAddress: string;
  rawAddress: string;
}

export async function generateWallet(): Promise<WalletInfo> {
  // Generate 24-word mnemonic
  const mnemonic = await mnemonicNew(24);

  // Derive keypair
  const keypair = await mnemonicToPrivateKey(mnemonic);

  // Create V5R1 wallet (latest standard)
  const wallet = WalletContractV5R1.create({
    workchain: 0,
    publicKey: keypair.publicKey,
  });

  return {
    mnemonic,
    keypair,
    address: wallet.address,
    friendlyAddress: wallet.address.toString({ testOnly: true, bounceable: false }),
    rawAddress: wallet.address.toRawString(),
  };
}
