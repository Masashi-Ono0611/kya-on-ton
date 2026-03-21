/**
 * Mint Agent SBT into the deployed registry
 * Usage: bun run scripts/mintAgent.ts
 */
import { TonClient, WalletContractV5R1 } from '@ton/ton';
import { mnemonicToPrivateKey } from '@ton/crypto';
import { toNano, beginCell, internal, Address } from '@ton/core';
import { readFileSync } from 'fs';
import { buildAgentContentCell } from '../wrappers/AgentRegistry';
import { AgentSBT } from '../wrappers/AgentSBT';

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

const REGISTRY_ADDRESS = process.env.KYA_REGISTRY_ADDRESS || '';

async function main() {
    if (!REGISTRY_ADDRESS) {
        console.error('Set KYA_REGISTRY_ADDRESS environment variable');
        process.exit(1);
    }
    const mnemonicStr = readFileSync('.secrets/mnemonic.txt', 'utf-8').trim();
    const mnemonic = mnemonicStr.split(' ');
    const keypair = await mnemonicToPrivateKey(mnemonic);

    const client = new TonClient({
        endpoint: 'https://testnet.toncenter.com/api/v2/jsonRPC',
    });

    const wallet = WalletContractV5R1.create({
        workchain: 0,
        publicKey: keypair.publicKey,
    });
    const walletContract = client.open(wallet);
    const walletAddr = wallet.address.toString({ testOnly: true, bounceable: false });

    console.log(`Deployer: ${walletAddr}`);
    await sleep(1500);
    const balance = await client.getBalance(wallet.address);
    console.log(`Balance:  ${Number(balance) / 1e9} TON`);

    if (balance < toNano('0.2')) {
        console.error('Insufficient balance for mint');
        process.exit(1);
    }

    // Get current index from registry
    const registryAddr = Address.parse(REGISTRY_ADDRESS);
    await sleep(1500);
    const collResult = await client.runMethod(registryAddr, 'get_collection_data');
    const nextItemIndex = collResult.stack.readNumber();
    console.log(`\nRegistry next_item_index: ${nextItemIndex}`);

    // Build agent content — customize these values
    const AGENT_NAME = process.env.AGENT_NAME || 'My Agent';
    const AGENT_DESC = process.env.AGENT_DESCRIPTION || 'AI-powered agent on TON with KYA identity';
    const BOT_ID = process.env.TELEGRAM_BOT_ID || '';
    if (!BOT_ID) {
        console.error('Set TELEGRAM_BOT_ID environment variable');
        process.exit(1);
    }

    const agentContent = buildAgentContentCell({
        name: AGENT_NAME,
        description: AGENT_DESC,
        telegramBotId: BOT_ID,
        walletAddress: walletAddr,
        capabilities: 'balance,price,swap,verify',
        reputation: '5000',
    });

    // Build mint message
    const mintBody = beginCell()
        .storeUint(1, 32)                      // op::mint_agent
        .storeUint(0, 64)                      // query_id
        .storeUint(nextItemIndex, 64)           // item_index
        .storeCoins(toNano('0.05'))             // amount forwarded to SBT
        .storeRef(agentContent)                 // agent metadata
        .storeAddress(wallet.address)           // agent owner
        .endCell();

    console.log('\nMinting Agent SBT...');
    await sleep(1500);
    const seqno = await walletContract.getSeqno();

    await sleep(1500);
    await walletContract.sendTransfer({
        seqno,
        secretKey: keypair.secretKey,
        messages: [
            internal({
                to: registryAddr,
                value: toNano('0.15'),
                body: mintBody,
            }),
        ],
    });

    console.log('Waiting for confirmation...');
    for (let i = 0; i < 30; i++) {
        await sleep(3000);
        try {
            const currentSeqno = await walletContract.getSeqno();
            if (currentSeqno > seqno) {
                console.log('Transaction confirmed!');
                break;
            }
        } catch { /* rate limit retry */ }
        if (i === 29) {
            console.error('Timeout. Check explorer.');
            process.exit(1);
        }
    }

    // Verify SBT deployment
    await sleep(5000);
    const sbtResult = await client.runMethod(registryAddr, 'get_nft_address_by_index', [
        { type: 'int', value: BigInt(nextItemIndex) },
    ]);
    const sbtAddress = sbtResult.stack.readAddress();
    console.log(`\nSBT Address: ${sbtAddress.toString({ testOnly: true, bounceable: true })}`);

    // Read SBT data
    await sleep(2000);
    try {
        const sbt = client.open(AgentSBT.createFromAddress(sbtAddress));
        const nftData = await sbt.getNftData();
        console.log('\n✅ Agent SBT minted successfully!');
        console.log(`   Agent ID:    ${nftData.index}`);
        console.log(`   Collection:  ${nftData.collection.toString()}`);
        console.log(`   Owner:       ${nftData.owner.toString()}`);
        console.log(`   Initialized: ${nftData.init}`);

        await sleep(1500);
        const revokedTime = await sbt.getRevokedTime();
        console.log(`   Revoked:     ${revokedTime > 0 ? `Yes (${revokedTime})` : 'No (active)'}`);
    } catch (e) {
        console.log(`\nSBT deployed at ${sbtAddress.toString()} — may need a moment to initialize.`);
    }

    console.log(`\n📋 Summary:`);
    console.log(`   Registry:     ${REGISTRY_ADDRESS}`);
    console.log(`   SBT:          ${sbtAddress.toString({ testOnly: true, bounceable: true })}`);
    console.log(`   Agent ID:     ${nextItemIndex}`);
    console.log(`   Bot ID:       8759144516`);
    console.log(`   Explorer:     https://testnet.tonviewer.com/${sbtAddress.toString({ testOnly: true, bounceable: true })}`);
}

main().catch(e => {
    console.error(e);
    process.exit(1);
});
