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
} from '@ton/core';

export class AgentSBT implements Contract {
    constructor(
        readonly address: Address,
        readonly init?: { code: Cell; data: Cell }
    ) {}

    static createFromAddress(address: Address) {
        return new AgentSBT(address);
    }

    async getNftData(provider: ContractProvider) {
        const result = await provider.get('get_nft_data', []);
        const init = result.stack.readBoolean();
        const index = result.stack.readNumber();
        const collection = result.stack.readAddress();
        const owner = result.stack.readAddress();
        const content = result.stack.readCell();
        return { init, index, collection, owner, content };
    }

    async getAuthorityAddress(provider: ContractProvider) {
        const result = await provider.get('get_authority_address', []);
        return result.stack.readAddress();
    }

    async getRevokedTime(provider: ContractProvider) {
        const result = await provider.get('get_revoked_time', []);
        return result.stack.readNumber();
    }

    // Attempt transfer — should always throw 413
    async sendTransfer(provider: ContractProvider, via: Sender, to: Address) {
        await provider.internal(via, {
            value: toNano('0.05'),
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(0x5fcc3d14, 32) // op::transfer
                .storeUint(0, 64)          // query_id
                .storeAddress(to)          // new_owner
                .storeAddress(via.address!) // response_destination
                .storeBit(false)           // custom_payload
                .storeCoins(0)             // forward_amount
                .storeBit(false)           // forward_payload
                .endCell(),
        });
    }

    async sendDestroy(provider: ContractProvider, via: Sender) {
        await provider.internal(via, {
            value: toNano('0.02'),
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(0x1f04537a, 32) // op::destroy
                .storeUint(0, 64)          // query_id
                .endCell(),
        });
    }

    // TEP-85: prove_ownership — owner sends this to SBT, SBT forwards ownership_proof to dest
    async sendProveOwnership(
        provider: ContractProvider,
        via: Sender,
        dest: Address,
        forwardPayload: Cell,
        withContent: boolean = false,
        value: bigint = toNano('0.1'),
    ) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(0x04ded148, 32) // op::prove_ownership
                .storeUint(0, 64)          // query_id
                .storeAddress(dest)
                .storeRef(forwardPayload)
                .storeUint(withContent ? 1 : 0, 1)
                .endCell(),
        });
    }

    async sendRevoke(provider: ContractProvider, via: Sender) {
        await provider.internal(via, {
            value: toNano('0.02'),
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(0x6f89f5e3, 32) // op::revoke
                .storeUint(0, 64)          // query_id
                .endCell(),
        });
    }
}
