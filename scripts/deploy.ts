/**
 * Programmatic testnet deployment script (non-interactive)
 * Usage: bun run scripts/deploy.ts
 */
import { TonClient, WalletContractV5R1 } from '@ton/ton';
import { mnemonicToPrivateKey } from '@ton/crypto';
import { toNano, beginCell, internal } from '@ton/core';
import { readFileSync } from 'fs';
import { AgentRegistry } from '../wrappers/AgentRegistry';

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function main() {
    // Load mnemonic
    const mnemonicStr = readFileSync('.secrets/masa_claude_bot_mnemonic.txt', 'utf-8').trim();
    const mnemonic = mnemonicStr.split(' ');
    const keypair = await mnemonicToPrivateKey(mnemonic);

    // Connect to testnet (with rate limit handling via longer timeout)
    const client = new TonClient({
        endpoint: 'https://testnet.toncenter.com/api/v2/jsonRPC',
        httpAdapter: 'fetch' as any,
    });

    // Open deployer wallet
    const wallet = WalletContractV5R1.create({
        workchain: 0,
        publicKey: keypair.publicKey,
    });
    const walletContract = client.open(wallet);

    console.log(`Deployer: ${wallet.address.toString({ testOnly: true, bounceable: false })}`);

    // Rate-limit-aware balance check
    await sleep(1500);
    const balance = await client.getBalance(wallet.address);
    console.log(`Balance:  ${Number(balance) / 1e9} TON`);

    if (balance < toNano('0.5')) {
        console.error('\nInsufficient balance. Need at least 0.5 TON.');
        process.exit(1);
    }

    // Load compiled contracts
    const registryCompiled = JSON.parse(readFileSync('build/AgentRegistry.compiled.json', 'utf-8'));
    const sbtCompiled = JSON.parse(readFileSync('build/AgentSBT.compiled.json', 'utf-8'));

    const { Cell } = await import('@ton/core');
    const registryCode = Cell.fromBoc(Buffer.from(registryCompiled.hex, 'hex'))[0];
    const sbtCode = Cell.fromBoc(Buffer.from(sbtCompiled.hex, 'hex'))[0];

    // Collection metadata
    const collectionContent = beginCell()
        .storeUint(0x01, 8)
        .storeStringTail('https://kya.ton.org/collection.json')
        .endCell();

    // Create registry
    const registry = client.open(
        AgentRegistry.createFromConfig(
            {
                owner: wallet.address,
                nextItemIndex: 0,
                content: collectionContent,
                agentSbtCode: sbtCode,
            },
            registryCode
        )
    );

    console.log(`\nRegistry address: ${registry.address.toString({ testOnly: true, bounceable: true })}`);

    // Check if already deployed
    await sleep(1500);
    const state = await client.getContractState(registry.address);
    if (state.state === 'active') {
        console.log('Registry already deployed!');
        await sleep(1500);
        const data = await registry.getCollectionData();
        console.log(`  next_item_index: ${data.nextItemIndex}`);
        console.log(`  owner: ${data.owner.toString()}`);
        return;
    }

    // Deploy
    console.log('\nDeploying registry...');
    await sleep(1500);
    const seqno = await walletContract.getSeqno();

    await sleep(1500);
    await walletContract.sendTransfer({
        seqno,
        secretKey: keypair.secretKey,
        messages: [
            internal({
                to: registry.address,
                value: toNano('0.5'),
                init: registry.init,
                body: beginCell().endCell(),
            }),
        ],
    });

    // Wait for deployment
    console.log('Waiting for confirmation...');
    for (let i = 0; i < 30; i++) {
        await sleep(3000);
        try {
            const currentSeqno = await walletContract.getSeqno();
            if (currentSeqno > seqno) {
                console.log('Transaction confirmed!');
                break;
            }
        } catch {
            // rate limit, retry
        }
        if (i === 29) {
            console.error('Timeout waiting for transaction. Check explorer.');
            process.exit(1);
        }
    }

    // Verify
    await sleep(5000);
    const deployedState = await client.getContractState(registry.address);
    if (deployedState.state === 'active') {
        console.log('\n✅ Registry deployed successfully!');
        console.log(`   Address: ${registry.address.toString({ testOnly: true, bounceable: true })}`);

        await sleep(1500);
        const data = await registry.getCollectionData();
        console.log(`   next_item_index: ${data.nextItemIndex}`);
        console.log(`   owner: ${data.owner.toString()}`);
    } else {
        console.error(`\nDeployment may have failed. State: ${deployedState.state}`);
    }
}

main().catch(e => {
    console.error(e);
    process.exit(1);
});
