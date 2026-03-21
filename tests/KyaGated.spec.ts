import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Cell, toNano, beginCell, Address } from '@ton/core';
import { AgentRegistry, buildAgentContentCell } from '../wrappers/AgentRegistry';
import { AgentSBT } from '../wrappers/AgentSBT';
import { KyaGated } from '../wrappers/KyaGated';
import { compile } from '@ton/blueprint';
import '@ton/test-utils';

describe('KyaGated', () => {
    let registryCode: Cell;
    let sbtCode: Cell;
    let gatedCode: Cell;
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let agentOwner: SandboxContract<TreasuryContract>;
    let registry: SandboxContract<AgentRegistry>;
    let gated: SandboxContract<KyaGated>;
    let sbtAddress: Address;

    beforeAll(async () => {
        registryCode = await compile('AgentRegistry');
        sbtCode = await compile('AgentSBT');
        gatedCode = await compile('KyaGated');
    });

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        deployer = await blockchain.treasury('deployer');
        agentOwner = await blockchain.treasury('agent-owner');

        // Deploy KYA Registry
        const collectionContent = beginCell()
            .storeUint(0x01, 8)
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
        await registry.sendDeploy(deployer.getSender(), toNano('0.5'));

        // Mint Agent SBT
        const agentContent = buildAgentContentCell({
            name: 'Test Agent',
            description: 'KYA-gated vault test',
            telegramBotId: '123456',
            walletAddress: agentOwner.address.toString(),
            capabilities: 'balance,deposit',
        });

        await registry.sendMintAgent(deployer.getSender(), {
            itemIndex: 0,
            amount: toNano('0.05'),
            agentContent,
            agentOwner: agentOwner.address,
        });

        sbtAddress = await registry.getNftAddressByIndex(0);

        // Deploy KYA-Gated Vault
        gated = blockchain.openContract(
            KyaGated.createFromConfig(
                {
                    owner: deployer.address,
                    registryAddress: registry.address,
                },
                gatedCode
            )
        );
        await gated.sendDeploy(deployer.getSender(), toNano('0.5'));
    });

    it('should deploy gated vault', async () => {
        const data = await gated.getVaultData();
        expect(data.totalDeposits).toBe(0n);
        expect(data.registry.equals(registry.address)).toBe(true);
    });

    it('should accept deposit from KYA-verified agent via SBT proof', async () => {
        const sbt = blockchain.openContract(AgentSBT.createFromAddress(sbtAddress));

        // Agent sends prove_ownership to their SBT, with vault as destination
        // forward_payload contains deposit amount
        const depositAmount = toNano('0.5');
        const forwardPayload = beginCell().storeCoins(depositAmount).endCell();

        const result = await sbt.sendProveOwnership(
            agentOwner.getSender(),
            gated.address,        // dest = vault
            forwardPayload,
            false,
            toNano('1')           // enough for deposit + gas
        );

        // Flow: agentOwner -> SBT (prove_ownership) -> Vault (ownership_proof)
        expect(result.transactions).toHaveTransaction({
            from: agentOwner.address,
            to: sbt.address,
            success: true,
        });

        expect(result.transactions).toHaveTransaction({
            from: sbt.address,
            to: gated.address,
            success: true,
        });

        // Verify deposit was credited
        const data = await gated.getVaultData();
        expect(data.totalDeposits).toBeGreaterThan(0n);
    });

    it('should reject deposit from non-KYA address (no SBT)', async () => {
        const outsider = await blockchain.treasury('outsider');

        // Outsider tries to deposit with a fake SBT address
        const fakeAddress = await blockchain.treasury('fake-sbt');
        const result = await gated.sendDeposit(
            outsider.getSender(),
            fakeAddress.address,
            toNano('0.5')
        );

        // The prove_ownership message to fake address should bounce
        // because fakeAddress is not an SBT contract
        const data = await gated.getVaultData();
        expect(data.totalDeposits).toBe(0n);
    });

    it('should allow owner to withdraw', async () => {
        // First, deposit from verified agent
        await gated.sendDeposit(
            agentOwner.getSender(),
            sbtAddress,
            toNano('0.5')
        );

        // Owner withdraws
        const withdrawResult = await gated.sendWithdraw(deployer.getSender());
        expect(withdrawResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: gated.address,
            success: true,
        });
    });

    it('should reject withdraw from non-owner', async () => {
        const notOwner = await blockchain.treasury('not-owner');
        const result = await gated.sendWithdraw(notOwner.getSender());
        expect(result.transactions).toHaveTransaction({
            from: notOwner.address,
            to: gated.address,
            success: false,
            exitCode: 401,
        });
    });
});
