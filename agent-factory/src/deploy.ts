import { Address, beginCell, toNano, Cell, internal, SendMode } from '@ton/core';
import { TonClient, WalletContractV5R1 } from '@ton/ton';
import { KeyPair } from '@ton/crypto';
import { buildAgentContentCell } from '../../wrappers/AgentRegistry';

export interface DeployParams {
  registryAddress: string;
  deployerMnemonic?: string;
  deployerKeypair: KeyPair;
  deployerAddress: Address;
  agentName: string;
  agentDescription: string;
  telegramBotId: string;
  walletAddress: string;
  capabilities: string;
  toncenterEndpoint: string;
  toncenterApiKey?: string;
}

export interface DeployResult {
  agentId: number;
  sbtAddress: string;
  txHash?: string;
}

export async function mintAgentSBT(params: DeployParams): Promise<DeployResult> {
  const client = new TonClient({
    endpoint: params.toncenterEndpoint,
    apiKey: params.toncenterApiKey,
  });

  const registryAddr = Address.parse(params.registryAddress);

  // Get current next_item_index
  const collectionData = await client.runMethod(registryAddr, 'get_collection_data');
  const nextItemIndex = collectionData.stack.readNumber();

  // Build agent content cell
  const agentContent = buildAgentContentCell({
    name: params.agentName,
    description: params.agentDescription,
    telegramBotId: params.telegramBotId,
    walletAddress: params.walletAddress,
    capabilities: params.capabilities,
  });

  // Build mint message body
  const mintBody = beginCell()
    .storeUint(1, 32)                    // op::mint_agent
    .storeUint(0, 64)                    // query_id
    .storeUint(nextItemIndex, 64)        // item_index
    .storeCoins(toNano('0.05'))          // amount forwarded to SBT
    .storeRef(agentContent)              // agent metadata
    .storeAddress(params.deployerAddress) // agent owner
    .endCell();

  // Open deployer wallet
  const wallet = WalletContractV5R1.create({
    workchain: 0,
    publicKey: params.deployerKeypair.publicKey,
  });

  const contract = client.open(wallet);
  const seqno = await contract.getSeqno();

  // Send mint transaction
  await contract.sendTransfer({
    seqno,
    secretKey: params.deployerKeypair.secretKey,
    messages: [
      internal({
        to: registryAddr,
        value: toNano('0.15'), // 0.05 for SBT + gas
        body: mintBody,
      }),
    ],
  });

  // Wait for transaction to complete
  let currentSeqno = seqno;
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    currentSeqno = await contract.getSeqno();
    if (currentSeqno > seqno) break;
  }

  if (currentSeqno <= seqno) {
    throw new Error('Transaction timed out — check testnet explorer');
  }

  // Get SBT address
  const sbtResult = await client.runMethod(registryAddr, 'get_nft_address_by_index', [
    { type: 'int', value: BigInt(nextItemIndex) },
  ]);
  const sbtAddress = sbtResult.stack.readAddress();

  return {
    agentId: nextItemIndex,
    sbtAddress: sbtAddress.toString(),
  };
}
