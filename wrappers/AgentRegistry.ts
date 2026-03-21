import {
    Address,
    beginCell,
    Cell,
    Contract,
    contractAddress,
    ContractProvider,
    Dictionary,
    Sender,
    SendMode,
    toNano,
} from '@ton/core';

export type AgentRegistryConfig = {
    owner: Address;
    nextItemIndex: number;
    content: Cell;
    agentSbtCode: Cell;
};

export function agentRegistryConfigToCell(config: AgentRegistryConfig): Cell {
    return beginCell()
        .storeAddress(config.owner)
        .storeUint(config.nextItemIndex, 64)
        .storeRef(config.content)
        .storeRef(config.agentSbtCode)
        .endCell();
}

export type AgentMintParams = {
    queryId?: number;
    itemIndex: number;
    amount: bigint;
    agentContent: Cell;
    agentOwner: Address;
};

export function buildAgentContentCell(params: {
    name: string;
    description: string;
    image?: string;
    telegramBotId: string;
    walletAddress: string;
    capabilities: string;
    reputation?: string;
}): Cell {
    // On-chain content (TEP-64): prefix 0x00 + dictionary
    const dict = Dictionary.empty(Dictionary.Keys.Buffer(32), Dictionary.Values.Cell());

    const storeValue = (key: string, value: string) => {
        const keyBuf = Buffer.alloc(32);
        const keyBytes = Buffer.from(key, 'utf-8');
        keyBytes.copy(keyBuf);

        const valueCell = beginCell()
            .storeUint(0x00, 8) // snake format prefix
            .storeStringTail(value)
            .endCell();
        dict.set(keyBuf, valueCell);
    };

    storeValue('name', params.name);
    storeValue('description', params.description);
    if (params.image) storeValue('image', params.image);
    storeValue('telegram_bot_id', params.telegramBotId);
    storeValue('wallet_address', params.walletAddress);
    storeValue('capabilities', params.capabilities);
    storeValue('reputation', params.reputation || '5000');

    return beginCell()
        .storeUint(0x00, 8) // on-chain prefix
        .storeDict(dict)
        .endCell();
}

export class AgentRegistry implements Contract {
    constructor(
        readonly address: Address,
        readonly init?: { code: Cell; data: Cell }
    ) {}

    static createFromAddress(address: Address) {
        return new AgentRegistry(address);
    }

    static createFromConfig(config: AgentRegistryConfig, code: Cell, workchain = 0) {
        const data = agentRegistryConfigToCell(config);
        const init = { code, data };
        return new AgentRegistry(contractAddress(workchain, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell(),
        });
    }

    // Permissionless self-registration: caller's wallet becomes SBT owner
    // The TX signature cryptographically proves wallet ownership
    async sendRegisterSelf(provider: ContractProvider, via: Sender, agentContent: Cell) {
        const sbtAmount = toNano('0.05');
        await provider.internal(via, {
            value: sbtAmount + toNano('0.1'), // SBT storage + gas
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(2, 32)              // op::register_self
                .storeUint(0, 64)              // query_id
                .storeCoins(sbtAmount)         // amount forwarded to SBT
                .storeRef(agentContent)        // agent metadata
                .endCell(),
        });
    }

    // Admin-only mint (original, for backward compatibility)
    async sendMintAgent(provider: ContractProvider, via: Sender, params: AgentMintParams) {
        await provider.internal(via, {
            value: params.amount + toNano('0.05'), // extra for gas
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(1, 32)                    // op::mint_agent
                .storeUint(params.queryId ?? 0, 64)   // query_id
                .storeUint(params.itemIndex, 64)       // item_index
                .storeCoins(params.amount)             // amount (forwarded to SBT)
                .storeRef(params.agentContent)         // agent metadata
                .storeAddress(params.agentOwner)       // agent owner
                .endCell(),
        });
    }

    async sendChangeOwner(provider: ContractProvider, via: Sender, newOwner: Address) {
        await provider.internal(via, {
            value: toNano('0.02'),
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(3, 32)   // op::change_owner
                .storeUint(0, 64)   // query_id
                .storeAddress(newOwner)
                .endCell(),
        });
    }

    async getCollectionData(provider: ContractProvider) {
        const result = await provider.get('get_collection_data', []);
        const nextItemIndex = result.stack.readNumber();
        const content = result.stack.readCell();
        const owner = result.stack.readAddress();
        return { nextItemIndex, content, owner };
    }

    async getNftAddressByIndex(provider: ContractProvider, index: number) {
        const result = await provider.get('get_nft_address_by_index', [
            { type: 'int', value: BigInt(index) },
        ]);
        return result.stack.readAddress();
    }
}
