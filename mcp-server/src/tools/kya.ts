import { Address, TonClient, Cell, Dictionary } from '@ton/ton';
import { TONCENTER_ENDPOINT, TONCENTER_API_KEY, KYA_REGISTRY_ADDRESS } from '../ton/constants.js';

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

let _client: TonClient | null = null;

function getClient(): TonClient {
  if (!_client) {
    _client = new TonClient({
      endpoint: TONCENTER_ENDPOINT,
      apiKey: TONCENTER_API_KEY || undefined,
    });
  }
  return _client;
}

function readContentDict(content: Cell): Record<string, string> {
  const result: Record<string, string> = {};
  try {
    const slice = content.beginParse();
    const prefix = slice.loadUint(8);
    if (prefix === 0x00) {
      // On-chain content (TEP-64)
      const dict = slice.loadDict(
        Dictionary.Keys.Buffer(32),
        Dictionary.Values.Cell()
      );
      for (const [key, value] of dict) {
        try {
          const keyStr = key.toString('utf-8').replace(/\0/g, '');
          const vs = value.beginParse();
          vs.loadUint(8); // skip snake prefix
          const valStr = vs.loadStringTail();
          result[keyStr] = valStr;
        } catch {
          // skip malformed entries
        }
      }
    }
  } catch {
    // Not a standard content cell
  }
  return result;
}

export async function getAgentProfile(agentId: string): Promise<string> {
  if (!KYA_REGISTRY_ADDRESS) {
    return JSON.stringify({ error: 'KYA_REGISTRY_ADDRESS not configured' });
  }

  const client = getClient();
  const registryAddr = Address.parse(KYA_REGISTRY_ADDRESS);

  try {
    // Get SBT address from registry
    const index = parseInt(agentId);
    const result = await client.runMethod(registryAddr, 'get_nft_address_by_index', [
      { type: 'int', value: BigInt(index) },
    ]);
    const sbtAddress = result.stack.readAddress();

    // Get NFT data from SBT
    const nftData = await client.runMethod(sbtAddress, 'get_nft_data');
    const init = nftData.stack.readBoolean();
    const nftIndex = nftData.stack.readBigNumber();
    const collection = nftData.stack.readAddress();
    const owner = nftData.stack.readAddress();
    const contentCell = nftData.stack.readCell();

    // Parse content
    const content = readContentDict(contentCell);

    // Get revoke status
    let revokedAt = 0;
    try {
      const revokeResult = await client.runMethod(sbtAddress, 'get_revoked_time');
      revokedAt = Number(revokeResult.stack.readBigNumber());
    } catch {}

    return JSON.stringify({
      agent_id: index,
      sbt_address: sbtAddress.toString(),
      owner: owner.toString(),
      initialized: init,
      revoked: revokedAt > 0,
      revoked_at: revokedAt > 0 ? new Date(revokedAt * 1000).toISOString() : null,
      profile: {
        name: content['name'] || null,
        description: content['description'] || null,
        telegram_bot_id: content['telegram_bot_id'] || null,
        wallet_address: content['wallet_address'] || null,
        capabilities: content['capabilities'] || null,
        reputation: content['reputation'] || '5000',
        image: content['image'] || null,
      },
    });
  } catch (error) {
    return JSON.stringify({
      error: `Failed to get agent profile: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
}

export async function verifyAgent(telegramBotId: string): Promise<string> {
  if (!KYA_REGISTRY_ADDRESS) {
    return JSON.stringify({ verified: false, error: 'KYA_REGISTRY_ADDRESS not configured' });
  }

  const client = getClient();
  const registryAddr = Address.parse(KYA_REGISTRY_ADDRESS);

  try {
    // Get total items in registry
    const collData = await client.runMethod(registryAddr, 'get_collection_data');
    const nextIndex = Number(collData.stack.readBigNumber());

    // Search through agents to find matching telegram_bot_id
    for (let i = 0; i < nextIndex && i < 100; i++) {
      try {
        await sleep(1500); // rate limit
        const result = await client.runMethod(registryAddr, 'get_nft_address_by_index', [
          { type: 'int', value: BigInt(i) },
        ]);
        const sbtAddress = result.stack.readAddress();

        await sleep(1500);
        const nftData = await client.runMethod(sbtAddress, 'get_nft_data');
        nftData.stack.readBoolean(); // init
        nftData.stack.readBigNumber(); // index
        nftData.stack.readAddress(); // collection
        const owner = nftData.stack.readAddress();
        const contentCell = nftData.stack.readCell();

        const content = readContentDict(contentCell);
        if (content['telegram_bot_id'] === telegramBotId) {
          let revokedAt = 0;
          try {
            await sleep(1500);
            const revokeResult = await client.runMethod(sbtAddress, 'get_revoked_time');
            revokedAt = Number(revokeResult.stack.readBigNumber());
          } catch {}

          return JSON.stringify({
            verified: revokedAt === 0,
            agent_id: i,
            sbt_address: sbtAddress.toString(),
            owner: owner.toString(),
            revoked: revokedAt > 0,
            profile: {
              name: content['name'] || null,
              description: content['description'] || null,
              capabilities: content['capabilities'] || null,
              reputation: content['reputation'] || '5000',
              wallet_address: content['wallet_address'] || null,
            },
          });
        }
      } catch {
        continue;
      }
    }

    return JSON.stringify({
      verified: false,
      telegram_bot_id: telegramBotId,
      message: 'No registered agent found with this Telegram Bot ID',
    });
  } catch (error) {
    return JSON.stringify({
      verified: false,
      error: `Verification failed: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
}
