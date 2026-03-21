import {
    Address,
    beginCell,
    Cell,
    Contract,
    contractAddress,
    ContractProvider,
    Sender,
    SendMode,
    toNano,
    Dictionary,
} from '@ton/core';

export type KyaGatedConfig = {
    owner: Address;
    registryAddress: Address;
};

export function kyaGatedConfigToCell(config: KyaGatedConfig): Cell {
    return beginCell()
        .storeAddress(config.owner)
        .storeAddress(config.registryAddress)
        .storeCoins(0)              // total_deposits
        .storeDict(null)            // deposits dict
        .endCell();
}

export class KyaGated implements Contract {
    constructor(
        readonly address: Address,
        readonly init?: { code: Cell; data: Cell }
    ) {}

    static createFromAddress(address: Address) {
        return new KyaGated(address);
    }

    static createFromConfig(config: KyaGatedConfig, code: Cell, workchain = 0) {
        const data = kyaGatedConfigToCell(config);
        const init = { code, data };
        return new KyaGated(contractAddress(workchain, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell(),
        });
    }

    // Agent calls this to deposit via KYA proof
    async sendDeposit(provider: ContractProvider, via: Sender, sbtAddress: Address, depositValue: bigint) {
        await provider.internal(via, {
            value: depositValue + toNano('0.15'), // deposit + gas for prove_ownership round-trip
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(0x10, 32)   // op::deposit
                .storeUint(0, 64)      // query_id
                .storeAddress(sbtAddress)
                .endCell(),
        });
    }

    async sendWithdraw(provider: ContractProvider, via: Sender) {
        await provider.internal(via, {
            value: toNano('0.05'),
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(0x11, 32)   // op::withdraw
                .storeUint(0, 64)      // query_id
                .endCell(),
        });
    }

    async getVaultData(provider: ContractProvider) {
        const result = await provider.get('get_vault_data', []);
        const totalDeposits = result.stack.readBigNumber();
        const registry = result.stack.readAddress();
        return { totalDeposits, registry };
    }

    async getAgentDeposit(provider: ContractProvider, agentAddress: Address) {
        const hash = BigInt('0x' + beginCell().storeAddress(agentAddress).endCell().hash().toString('hex'));
        const result = await provider.get('get_agent_deposit', [
            { type: 'int', value: hash },
        ]);
        return result.stack.readBigNumber();
    }
}
