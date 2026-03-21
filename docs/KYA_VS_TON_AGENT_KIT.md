# KYA on TON vs TON Agent Kit: Comparison

## What is TON Agent Kit?

[TON Agent Kit](https://github.com/Andy00L/ton-agent-kit) is an open-source TypeScript SDK that gives AI agents full access to TON protocols. It ships 72 actions across 11 plugins, packaged as 18 npm modules, with support for DeFi (DeDust/STON.fi), on-chain escrow, agent-to-agent commerce, MCP server, Telegram bot, and a multi-agent orchestrator. Created March 13, 2026.

It is designed as a **comprehensive SDK** — the "Solana Agent Kit for TON."

## Side-by-Side Comparison

| Aspect | TON Agent Kit | KYA on TON (this project) |
|--------|--------------|---------------------------|
| **Created** | 2026-03-13 | 2026-03-21 |
| **Primary Goal** | AI agent SDK with 72 on-chain actions | AI agent **identity infrastructure** (KYA) |
| **Smart Contracts** | Tact (Reputation + Escrow) | **FunC** (TEP-62/64/85 SBT) |
| **Identity Token** | Score-based reputation (mutable) | **SBT — non-transferable** (TEP-85) |
| **Agent Registration** | `register_agent` (owner-permissioned) | `register_self` (**permissionless**, cryptographic) |
| **Wallet Binding** | Not cryptographically enforced | **TX signature proves ownership** |
| **Metadata** | Off-chain / in-contract state | **On-chain TEP-64 dictionary** |
| **MCP Tools** | 72 actions (all protocols) | 7 focused tools (identity + balance + tx) |
| **Telegram Integration** | grammY bot (standalone) | **Claude Channels** (2026-03-20 launch) |
| **AI Integration** | OpenAI-compatible tools | **Claude-native MCP + Channels** |
| **Provisioning** | Manual SDK setup | **1-command agent-factory CLI** |
| **KYA-Gated Access** | Not supported | **`KyaGated` vault (TEP-85 prove_ownership)** |
| **DeFi Coverage** | Deep (DeDust, STON.fi, DCA, limits, yield) | Minimal (swap estimation only) |
| **Escrow** | Full on-chain (arbiter voting, disputes) | Not included |
| **Multi-Agent** | Orchestrator + planner + dispatcher | Not included |
| **Deployment** | npm package | Clone + 1 command |
| **npm Packages** | 18 scoped packages | 0 (not published) |

## Where They Overlap

Both projects share the following surface area:

- **MCP server** that exposes TON blockchain data as AI tools
- **Balance, price, and swap** queries (subset of ton-agent-kit's Token and DeFi plugins)
- **Agent registry** concept — a way to register and discover agents on-chain
- **Telegram as the user interface** for the AI agent
- **`send_ton`** — executing TON transfers with user confirmation

This overlap is real but narrow. The shared tools (`get_ton_balance`, `get_token_price`, `estimate_swap`, `send_ton`) represent 4 of ton-agent-kit's 72 actions and 4 of our 7 tools.

## Our Differentiation

### 1. KYA Identity is the Product

TON Agent Kit treats identity as one feature among many (the `plugin-identity` package, 9 actions). For us, **KYA identity is the entire product**.

The distinction matters: ton-agent-kit's reputation system tracks task completion scores. Our SBT-based identity answers a different question — *who built this agent, and can I verify it cryptographically?* These are complementary primitives, not duplicates.

### 2. Cryptographic Wallet Binding

TON Agent Kit's `register_agent` stores agent metadata in a Tact contract, but there is no cryptographic enforcement that the registering wallet *is* the agent's wallet.

Our `register_self` (op 0x2) makes the **transaction signature itself the proof**. The caller's address becomes the SBT owner atomically. Combined with TEP-85 `prove_ownership`, there is a complete cryptographic chain: transaction → wallet → SBT → KYA-gated access.

### 3. Non-Transferable Identity

TON Agent Kit's agent records are mutable state in a reputation contract — they can be updated or deleted by the owner. This is appropriate for a scoring system.

Our SBT **always rejects transfer** (exit code 413). An agent's identity is permanently bound to its creator. This is more faithful to the KYA concept: you cannot sell or transfer your accountability.

### 4. Claude Channels Integration

TON Agent Kit ships a grammY-based Telegram bot that connects to OpenAI-compatible models. It requires running a separate bot process.

We integrate with **Claude Channels** (launched March 20, 2026) — Anthropic's native Telegram plugin for Claude Code. The agent runs inside Claude with no separate bot process. The MCP server attaches blockchain data directly to the Claude context.

This is not just a different implementation — it is a different architecture. Claude is the agent runtime; MCP is the data layer; Claude Channels is the Telegram bridge.

### 5. KYA-Gated Smart Contracts

TON Agent Kit does not provide a mechanism for other smart contracts to gate access based on agent identity.

We ship `KyaGated` — a vault contract that only accepts deposits from agents who pass TEP-85 `prove_ownership`. The pattern:

```
Agent → AgentSBT (prove_ownership) → KyaGated (ownership_proof) → access granted
```

Any DeFi protocol, DAO, or on-chain service can adopt this pattern to gate operations to KYA-verified agents.

### 6. On-Chain Metadata Storage

TON Agent Kit stores agent metadata in Tact contract state (maps), which is efficient but not accessible via standard TEP-64 token metadata queries.

Our SBT stores all metadata **as TEP-64 on-chain content** — the same format used by TON NFTs. This means any TON explorer, wallet, or tool that understands TEP-64 can read agent metadata without custom integration.

### 7. 1-Command Provisioning

TON Agent Kit is an SDK — developers install npm packages and write integration code.

Agent Factory provisions a complete agent stack from a single command:

```bash
bun run agent-factory/src/index.ts create \
  --token <TELEGRAM_BOT_TOKEN> \
  --name "DeFi Agent" \
  --registry <REGISTRY_ADDRESS>
```

This validates the bot, generates a TON wallet, mints the SBT, configures Claude Channels, registers the MCP server, and writes the AI persona — all automated.

## Where TON Agent Kit is Ahead

### 1. DeFi Depth

TON Agent Kit covers DeDust, STON.fi, Omniston, DCA, limit orders, yield pools (2000+, 16 protocols), and staking. Our DeFi support is limited to swap estimation via the MCP server.

### 2. Escrow and Agent Commerce

TON Agent Kit ships a full on-chain escrow with arbiter voting, dispute resolution, and an intent/offer marketplace protocol. We have no equivalent.

### 3. Multi-Agent Orchestration

TON Agent Kit has a planner + dispatcher + agent manager for coordinating multiple agents in parallel. We focus on single-agent provisioning.

### 4. Test Coverage

TON Agent Kit has 28 test suites covering the full SDK. We have 14 contract tests focused on the FunC smart contracts.

### 5. npm Ecosystem

TON Agent Kit publishes 18 scoped npm packages. Our project is not published to npm.

## Positioning

TON Agent Kit is a **DeFi-first agent SDK** — its core value is giving agents access to 72 on-chain actions with minimal setup. Identity is one plugin.

KYA on TON is an **identity-first agent infrastructure** — its core value is cryptographically provable, non-transferable identity for AI agents, with KYA-gated access control and 1-command provisioning. DeFi is a minimal tool layer.

They solve different problems and are more complementary than competing. A production deployment could use both: ton-agent-kit for on-chain DeFi actions, kya-on-ton for the identity and trust layer.

## Summary

| What you need | Use |
|---|---|
| Agent executes DeFi operations (swap, stake, escrow) | TON Agent Kit |
| Agent needs verifiable, non-transferable on-chain identity | KYA on TON |
| Smart contract that gates access to verified agents | KYA on TON (`KyaGated`) |
| Multi-agent coordination and planning | TON Agent Kit |
| 1-command Claude × Telegram × TON agent setup | KYA on TON |
| OpenAI-compatible agent with 72 actions | TON Agent Kit |

## References

- [TON Agent Kit (GitHub)](https://github.com/Andy00L/ton-agent-kit)
- [TON Agent Kit npm — @ton-agent-kit/core](https://www.npmjs.com/package/@ton-agent-kit/core)
- [TEP-85: SBT Standard](https://github.com/ton-blockchain/TEPs/blob/master/text/0085-sbt-standard.md)
- [TEP-62: NFT Standard](https://github.com/ton-blockchain/TEPs/blob/master/text/0062-nft-standard.md)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [KYA vs ERC-8004 comparison](./KYA_VS_ERC8004.md)
- [Security Model](./SECURITY_MODEL.md)
