import { toNano, beginCell, Address } from '@ton/core';
import { AgentRegistry } from '../wrappers/AgentRegistry';
import { compile, NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    const registryCode = await compile('AgentRegistry');
    const sbtCode = await compile('AgentSBT');

    const collectionContent = beginCell()
        .storeUint(0x01, 8) // off-chain content prefix
        .storeStringTail('https://kya.ton.org/collection.json')
        .endCell();

    const registry = provider.open(
        AgentRegistry.createFromConfig(
            {
                owner: provider.sender().address!,
                nextItemIndex: 0,
                content: collectionContent,
                agentSbtCode: sbtCode,
            },
            registryCode
        )
    );

    await registry.sendDeploy(provider.sender(), toNano('0.5'));

    await provider.waitForDeploy(registry.address);

    console.log('Registry deployed at:', registry.address.toString());

    const data = await registry.getCollectionData();
    console.log('Collection data:', {
        nextItemIndex: data.nextItemIndex,
        owner: data.owner.toString(),
    });
}
