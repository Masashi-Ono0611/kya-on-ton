import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Cell, toNano, beginCell, Address } from '@ton/core';
import { AgentRegistry, buildAgentContentCell } from '../wrappers/AgentRegistry';
import { AgentSBT } from '../wrappers/AgentSBT';
import { compile } from '@ton/blueprint';
import '@ton/test-utils';

describe('AgentRegistry', () => {
    let registryCode: Cell;
    let sbtCode: Cell;
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let registry: SandboxContract<AgentRegistry>;

    beforeAll(async () => {
        registryCode = await compile('AgentRegistry');
        sbtCode = await compile('AgentSBT');
    });

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        deployer = await blockchain.treasury('deployer');

        const collectionContent = beginCell()
            .storeUint(0x01, 8) // off-chain prefix
            .storeStringTail('https://kya.ton.org/collection.json')
            .endCell();

        registry = blockchain.openContract(
            AgentRegistry.createFromConfig(
                {
                    owner: deployer.address,
                    nextItemIndex: 0,
                    content: collectionContent,
                    agentSbtCode: sbtCode,
                },
                registryCode
            )
        );

        const deployResult = await registry.sendDeploy(deployer.getSender(), toNano('0.5'));
        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: registry.address,
            deploy: true,
            success: true,
        });
    });

    it('should deploy registry', async () => {
        const data = await registry.getCollectionData();
        expect(data.nextItemIndex).toBe(0);
        expect(data.owner.equals(deployer.address)).toBe(true);
    });

    it('should mint an agent SBT', async () => {
        const agentOwner = await blockchain.treasury('agent-owner');

        const agentContent = buildAgentContentCell({
            name: 'DeFi Agent',
            description: 'AI-powered DeFi assistant on TON',
            telegramBotId: '123456789',
            walletAddress: 'EQxxx...test',
            capabilities: 'balance,price,swap',
            reputation: '5000',
        });

        const mintResult = await registry.sendMintAgent(deployer.getSender(), {
            itemIndex: 0,
            amount: toNano('0.05'),
            agentContent,
            agentOwner: agentOwner.address,
        });

        expect(mintResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: registry.address,
            success: true,
        });

        // Verify next_item_index incremented
        const data = await registry.getCollectionData();
        expect(data.nextItemIndex).toBe(1);
    });

    it('should compute deterministic SBT address', async () => {
        const addr0 = await registry.getNftAddressByIndex(0);
        const addr1 = await registry.getNftAddressByIndex(1);

        expect(addr0).toBeTruthy();
        expect(addr1).toBeTruthy();
        expect(addr0.equals(addr1)).toBe(false);
    });

    it('should reject mint from non-owner', async () => {
        const notOwner = await blockchain.treasury('not-owner');

        const agentContent = buildAgentContentCell({
            name: 'Bad Agent',
            description: 'Should not be minted',
            telegramBotId: '999',
            walletAddress: 'EQxxx',
            capabilities: 'none',
        });

        const mintResult = await registry.sendMintAgent(notOwner.getSender(), {
            itemIndex: 0,
            amount: toNano('0.05'),
            agentContent,
            agentOwner: notOwner.address,
        });

        expect(mintResult.transactions).toHaveTransaction({
            from: notOwner.address,
            to: registry.address,
            success: false,
            exitCode: 401,
        });
    });

    it('should reject SBT transfer (TEP-85)', async () => {
        const agentOwner = await blockchain.treasury('agent-owner');
        const recipient = await blockchain.treasury('recipient');

        const agentContent = buildAgentContentCell({
            name: 'Test Agent',
            description: 'SBT transfer test',
            telegramBotId: '111',
            walletAddress: 'EQyyy',
            capabilities: 'balance',
        });

        // Mint SBT first
        await registry.sendMintAgent(deployer.getSender(), {
            itemIndex: 0,
            amount: toNano('0.05'),
            agentContent,
            agentOwner: agentOwner.address,
        });

        // Get SBT address
        const sbtAddress = await registry.getNftAddressByIndex(0);
        const sbt = blockchain.openContract(AgentSBT.createFromAddress(sbtAddress));

        // Verify SBT data
        const nftData = await sbt.getNftData();
        expect(nftData.init).toBe(true);
        expect(nftData.index).toBe(0);
        expect(nftData.owner.equals(agentOwner.address)).toBe(true);
        expect(nftData.collection.equals(registry.address)).toBe(true);

        // Attempt transfer — should fail with exit code 413
        const transferResult = await sbt.sendTransfer(
            agentOwner.getSender(),
            recipient.address
        );

        expect(transferResult.transactions).toHaveTransaction({
            from: agentOwner.address,
            to: sbt.address,
            success: false,
            exitCode: 413,
        });
    });

    it('should allow owner to destroy SBT', async () => {
        const agentOwner = await blockchain.treasury('agent-owner');

        const agentContent = buildAgentContentCell({
            name: 'Destroyable Agent',
            description: 'Will be destroyed',
            telegramBotId: '222',
            walletAddress: 'EQzzz',
            capabilities: 'balance',
        });

        await registry.sendMintAgent(deployer.getSender(), {
            itemIndex: 0,
            amount: toNano('0.05'),
            agentContent,
            agentOwner: agentOwner.address,
        });

        const sbtAddress = await registry.getNftAddressByIndex(0);
        const sbt = blockchain.openContract(AgentSBT.createFromAddress(sbtAddress));

        const destroyResult = await sbt.sendDestroy(agentOwner.getSender());
        expect(destroyResult.transactions).toHaveTransaction({
            from: agentOwner.address,
            to: sbt.address,
            success: true,
        });
    });

    it('should allow authority to revoke SBT', async () => {
        const agentOwner = await blockchain.treasury('agent-owner');

        const agentContent = buildAgentContentCell({
            name: 'Revocable Agent',
            description: 'Will be revoked',
            telegramBotId: '333',
            walletAddress: 'EQaaa',
            capabilities: 'balance',
        });

        await registry.sendMintAgent(deployer.getSender(), {
            itemIndex: 0,
            amount: toNano('0.05'),
            agentContent,
            agentOwner: agentOwner.address,
        });

        const sbtAddress = await registry.getNftAddressByIndex(0);
        const sbt = blockchain.openContract(AgentSBT.createFromAddress(sbtAddress));

        // Authority = owner (set in SBT init)
        const revokeResult = await sbt.sendRevoke(agentOwner.getSender());
        expect(revokeResult.transactions).toHaveTransaction({
            from: agentOwner.address,
            to: sbt.address,
            success: true,
        });

        // Verify revoked
        const revokedTime = await sbt.getRevokedTime();
        expect(revokedTime).toBeGreaterThan(0);
    });

    it('should mint multiple agents sequentially', async () => {
        const owner1 = await blockchain.treasury('owner1');
        const owner2 = await blockchain.treasury('owner2');

        const content1 = buildAgentContentCell({
            name: 'Agent 1',
            description: 'First agent',
            telegramBotId: '100',
            walletAddress: 'EQ100',
            capabilities: 'balance,price',
        });

        const content2 = buildAgentContentCell({
            name: 'Agent 2',
            description: 'Second agent',
            telegramBotId: '200',
            walletAddress: 'EQ200',
            capabilities: 'balance,price,swap',
        });

        await registry.sendMintAgent(deployer.getSender(), {
            itemIndex: 0,
            amount: toNano('0.05'),
            agentContent: content1,
            agentOwner: owner1.address,
        });

        await registry.sendMintAgent(deployer.getSender(), {
            itemIndex: 1,
            amount: toNano('0.05'),
            agentContent: content2,
            agentOwner: owner2.address,
        });

        const data = await registry.getCollectionData();
        expect(data.nextItemIndex).toBe(2);

        const sbt0Addr = await registry.getNftAddressByIndex(0);
        const sbt1Addr = await registry.getNftAddressByIndex(1);
        expect(sbt0Addr.equals(sbt1Addr)).toBe(false);

        const sbt0 = blockchain.openContract(AgentSBT.createFromAddress(sbt0Addr));
        const sbt1 = blockchain.openContract(AgentSBT.createFromAddress(sbt1Addr));

        const data0 = await sbt0.getNftData();
        const data1 = await sbt1.getNftData();

        expect(data0.owner.equals(owner1.address)).toBe(true);
        expect(data1.owner.equals(owner2.address)).toBe(true);
    });

    it('should allow permissionless self-registration (wallet proof)', async () => {
        const agent = await blockchain.treasury('self-registering-agent');

        const agentContent = buildAgentContentCell({
            name: 'Self-Registered Agent',
            description: 'Registered by own wallet — cryptographic proof',
            telegramBotId: '777',
            walletAddress: agent.address.toString(),
            capabilities: 'balance,price',
        });

        const result = await registry.sendRegisterSelf(agent.getSender(), agentContent);

        expect(result.transactions).toHaveTransaction({
            from: agent.address,
            to: registry.address,
            success: true,
        });

        // Verify next_item_index incremented
        const data = await registry.getCollectionData();
        expect(data.nextItemIndex).toBe(1);

        // Verify SBT owner IS the agent's wallet (cryptographic binding)
        const sbtAddress = await registry.getNftAddressByIndex(0);
        const sbt = blockchain.openContract(AgentSBT.createFromAddress(sbtAddress));
        const nftData = await sbt.getNftData();

        expect(nftData.init).toBe(true);
        // KEY: SBT owner == agent's wallet address (cryptographic proof)
        expect(nftData.owner.equals(agent.address)).toBe(true);
    });
});
