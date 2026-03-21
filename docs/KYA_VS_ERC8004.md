# KYA on TON vs ERC-8004: Comparison

## What is ERC-8004?

[ERC-8004 ("Trustless Agents")](https://eips.ethereum.org/EIPS/eip-8004) is an Ethereum standard for AI agent identity and trust, deployed to mainnet on January 29, 2026. Co-authored by contributors from MetaMask, Ethereum Foundation, Google, and Coinbase.

It defines three on-chain registries:

| Registry | Purpose | Implementation |
|----------|---------|----------------|
| **Identity Registry** | Agent identity registration | ERC-721 + URIStorage (**transferable** NFT) |
| **Reputation Registry** | Feedback and trust score accumulation | Standardized interface |
| **Validation Registry** | Third-party verification (zkML, TEE, etc.) | Validator hooks |

## Side-by-Side Comparison

| Aspect | ERC-8004 (Ethereum) | KYA on TON (this project) |
|--------|--------------------|-----------------------------|
| **Chain** | Ethereum / EVM L2 | TON |
| **Identity Token** | ERC-721 (**transferable**) | TEP-85 SBT (**non-transferable**) |
| **Metadata Storage** | Off-chain (IPFS/HTTPS JSON) | **On-chain** (TEP-64 dictionary) |
| **Registries** | 3 (Identity, Reputation, Validation) | 1 (Identity + KYA-Gated access control) |
| **Registration** | Admin or permissioned | **Permissionless self-registration** |
| **Wallet Binding** | Not enforced | **Cryptographic (TX signature)** |
| **Reputation** | Dedicated registry, dynamic updates | Fixed value in SBT (MVP: 5000) |
| **Verification** | Generic validator hooks | `verify_agent` with wallet binding check |
| **Access Control** | Not specified | **KYA-gated contracts (prove_ownership)** |
| **AI Integration** | None (left to app layer) | **Built-in: Claude Channels + MCP Server** |
| **TX Execution** | Not specified | **Built-in: send_ton with confirmation** |
| **Provisioning** | Manual registration to each registry | **1-command full automation** |
| **Telegram** | None | **Native** (Bot ID linked in SBT) |
| **Target Use Case** | General-purpose (Agent-to-Agent coordination) | Telegram AI Agent infrastructure |

## Our Advantages

### 0. Cryptographic Wallet Binding

ERC-8004 does not enforce any relationship between the identity token and the agent's wallet. The identity is an ERC-721 token that can be held by any address.

Our `register_self` operation makes the **transaction signature itself the proof of wallet ownership**. The caller's address automatically becomes the SBT owner — no trusted admin needed. Combined with TEP-85 `prove_ownership`, this creates a full cryptographic chain from wallet to identity to access control.

### 1. Non-Transferable Identity (SBT)

ERC-8004 uses ERC-721, which is **transferable by design** — meaning an agent's identity can be sold or transferred to another party. This undermines the core purpose of KYA: proving *who built this agent*.

Our implementation uses TEP-85 SBT (Soul Bound Token), which **always rejects transfer** (exit code 413). An agent's identity is permanently bound to its creator, just like a passport cannot be sold. This is more faithful to the KYA concept.

### 2. On-Chain Metadata

ERC-8004 stores agent metadata off-chain in IPFS/HTTPS JSON files (pointed to by `tokenURI`). If the hosting goes down, the identity becomes unresolvable.

Our SBT stores all metadata **directly on the TON blockchain** using TEP-64 on-chain content format:
- Agent name, description, capabilities
- Telegram Bot ID, wallet address
- Reputation score

This data is permanent, censorship-resistant, and always available — no external dependencies.

### 3. AI Integration is Built-In

ERC-8004 defines smart contract standards only. How an AI agent actually *uses* the registry is left entirely to the application layer.

Our project ships a complete AI integration stack:
- **MCP Server** with `verify_agent` and `get_agent_profile` tools
- **Claude Channels** for Telegram message handling
- The AI can query the KYA registry as a native tool call — no custom integration needed

### 4. KYA-Gated Smart Contracts

ERC-8004 does not specify how other contracts should check agent identity. Access control is left to the application layer.

We ship `KyaGated` — a vault contract that only accepts deposits from agents who can pass TEP-85 `prove_ownership`. The flow:

```
Agent → SBT (prove_ownership) → Vault (ownership_proof) → deposit credited
```

This is a reusable pattern: any DeFi protocol can gate operations to KYA-verified agents by accepting `ownership_proof` messages.

### 5. 1-Command Provisioning

ERC-8004 is a *standard*, not a tool. Developers must manually deploy contracts and send transactions to each registry.

Agent Factory provisions everything in a single command:
```
agent-factory create --token <BOT_TOKEN> --name "DeFi Agent"
```
Bot validation → wallet generation → SBT minting → AI configuration — all automated.

### 6. Transaction Execution

ERC-8004 defines identity infrastructure only. Whether and how agents execute transactions is out of scope.

Our MCP server includes `send_ton` — the agent can execute TON transfers with user confirmation. Combined with KYA identity, this means a verified agent with an accountable on-chain identity can perform financial operations.

## Where ERC-8004 is Ahead

### 1. Reputation Registry
ERC-8004 has a dedicated registry for dynamic feedback accumulation. Our reputation is a static value (MVP scope).

### 2. Validation Registry
ERC-8004 supports third-party validators (zkML proofs, TEE oracles, staker verification). We have no equivalent.

### 3. Ecosystem
Backed by MetaMask, Google, Coinbase, and the Ethereum Foundation. Deployed on Ethereum mainnet with growing adoption across EVM chains.

### 4. Multi-Chain
Works on any EVM-compatible chain. Our implementation is TON-specific.

## Positioning

ERC-8004 is a **general-purpose standard for the Ethereum ecosystem**. It defines interfaces but leaves the AI integration, messaging layer, and developer tooling to others.

KYA on TON is a **working product specialized for TON × Telegram × Claude**. Rather than proposing a standard, we built the complete stack: cryptographic wallet binding, KYA-gated smart contracts, AI tool integration, transaction execution, and 1-command provisioning.

They are complementary rather than competing: ERC-8004 standardizes the *what*, we demonstrate the *how*.

For the detailed security and trust model, see [SECURITY_MODEL.md](./SECURITY_MODEL.md).

## References

- [ERC-8004: Trustless Agents (Official EIP)](https://eips.ethereum.org/EIPS/eip-8004)
- [ERC-8004 Contracts (GitHub)](https://github.com/erc-8004/erc-8004-contracts)
- [CoinDesk: ERC-8004 aims to put identity and trust behind AI agents](https://www.coindesk.com/markets/2026/01/28/ethereum-s-erc-8004-aims-to-put-identity-and-trust-behind-ai-agents/)
- [QuickNode: ERC-8004 Developer's Guide](https://blog.quicknode.com/erc-8004-a-developers-guide-to-trustless-ai-agent-identity/)
- [Know Your Agent (KYA) — RNWY](https://rnwy.com/learn/know-your-agent)
