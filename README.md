# KYA on TON

**Know Your Agent (KYA) — 1-command infrastructure to give any Telegram Bot an AI brain, a TON wallet, and an on-chain identity (SBT).**

## The Problem

AI agents operate without verifiable identity. Anyone can impersonate an agent, and there's no on-chain way to verify who built it, what it can do, or whether it should be trusted. a16z calls this **KYA (Know Your Agent)** — a critical unsolved primitive.

## The Solution

Agent Factory provisions a complete AI agent stack in one command:

```
bun run agent-factory/src/index.ts create --token <BOT_TOKEN> --name "DeFi Agent"
```

This single command:
1. **Validates** the Telegram Bot via Bot API
2. **Generates** a TON wallet (Ed25519 keypair, V5R1)
3. **Mints** a KYA SBT (Soul Bound Token) on-chain with agent metadata
4. **Configures** Claude Channels for Telegram message handling
5. **Registers** the TON MCP Server for on-chain data access
6. **Generates** an AI persona (CLAUDE.md) with identity + capabilities

## Architecture

```
User (Telegram)
    │
    ▼
Claude Channels (plugin:telegram)
    │
    ├── TON MCP Server (ton-agent-mcp)
    │   ├── get_ton_balance      — Wallet balance lookup
    │   ├── get_jetton_balances  — Token holdings
    │   ├── get_token_price      — Real-time price data
    │   ├── estimate_swap        — DEX swap estimation
    │   ├── get_agent_profile    — KYA profile from SBT
    │   ├── verify_agent         — On-chain agent verification
    │   └── send_ton             — Execute TON transfer (with confirmation)
    │
    └── KYA Registry (TON Testnet)
        ├── AgentRegistry.fc     — TEP-62 NFT Collection
        └── AgentSBT.fc          — TEP-85 Soul Bound Token
```

## Components

### KYA Smart Contracts (FunC)

| Contract | Standard | Purpose |
|----------|----------|---------|
| `AgentRegistry` | TEP-62 (NFT Collection) | Factory that issues SBT identities for agents |
| `AgentSBT` | TEP-85 (SBT) | Non-transferable identity token storing agent metadata |

SBT on-chain metadata (TEP-64):
- `name`, `description`, `image` — Agent profile
- `telegram_bot_id` — Linked Telegram Bot
- `wallet_address` — Agent's TON wallet
- `capabilities` — What the agent can do (e.g., `balance,price,swap`)
- `reputation` — Trust score (default: 5000)

Transfer is always rejected (exit code 413). Owner can destroy; authority can revoke.

### TON MCP Server

[Model Context Protocol](https://modelcontextprotocol.io/) server that gives Claude real-time access to TON blockchain data and the KYA registry. Uses [tonapi.io](https://tonapi.io) for data and TonCenter for contract calls.

### Agent Factory CLI

Orchestration tool that wires everything together. Generates wallets, mints SBTs, configures Claude Channels + MCP, and writes the AI persona.

## Quick Start

### Prerequisites

- [Bun](https://bun.sh/) runtime
- [Claude Code](https://claude.com/claude-code) v2.1.80+
- A Telegram Bot token (from [@BotFather](https://t.me/BotFather))
- Testnet TON for deployment (from [@testgiver_ton_bot](https://t.me/testgiver_ton_bot))

### Setup

```bash
# Clone
git clone https://github.com/Masashi-Ono0611/kya-on-ton.git
cd kya-on-ton

# Install dependencies
npm install --legacy-peer-deps
cd mcp-server && bun install && cd ..
cd agent-factory && bun install && cd ..

# Build contracts
npx blueprint build AgentRegistry
npx blueprint build AgentSBT

# Run tests (8 tests)
npx jest --verbose
```

### Deploy Registry (once)

```bash
# Save your mnemonic
mkdir -p .secrets
echo "your 24 word mnemonic here" > .secrets/mnemonic.txt
chmod 600 .secrets/mnemonic.txt

# Fund wallet with testnet TON, then deploy
bun run scripts/deploy.ts
```

### Provision an Agent

```bash
# Full provisioning (after registry is deployed)
bun run agent-factory/src/index.ts create \
  --token <TELEGRAM_BOT_TOKEN> \
  --name "DeFi Agent" \
  --registry <REGISTRY_ADDRESS>

# Or skip SBT minting (useful for testing)
bun run agent-factory/src/index.ts create \
  --token <TELEGRAM_BOT_TOKEN> \
  --name "DeFi Agent" \
  --skip-mint
```

### Start the Agent

```bash
claude --channels plugin:telegram@claude-plugins-official
```

Then message your bot on Telegram:
- "What's the price of TON?" → real-time price from blockchain
- "Are you a verified agent?" → on-chain KYA proof from SBT
- "Verify bot 123456789" → checks KYA registry for any bot

## Tech Stack

- **Smart Contracts:** FunC (TEP-62/64/85), Blueprint framework
- **AI Integration:** Claude Channels (Telegram plugin) + MCP Server
- **Blockchain Data:** tonapi.io, TonCenter RPC
- **Runtime:** Bun, TypeScript
- **Wallet:** TON Wallet V5R1, `@ton/crypto`
- **Testing:** Jest + `@ton/sandbox` (8 contract tests)

## MCP Tools (7 total)

| Tool | Type | Description |
|------|------|-------------|
| `get_ton_balance` | Read | Wallet TON balance |
| `get_jetton_balances` | Read | All token holdings |
| `get_token_price` | Read | Real-time token price + 24h change |
| `estimate_swap` | Read | DEX swap output estimation |
| `get_agent_profile` | Read | KYA profile from on-chain SBT |
| `verify_agent` | Read | Verify agent by Telegram Bot ID |
| `send_ton` | **Write** | Execute TON transfer (max 1 TON, requires user confirmation) |

## Project Structure

```
├── contracts/              # FunC smart contracts
│   ├── agent_registry.fc   # NFT Collection (TEP-62)
│   ├── agent_sbt.fc        # SBT Item (TEP-85)
│   └── imports/stdlib.fc
├── wrappers/               # TypeScript contract wrappers
├── tests/                  # Jest contract tests
├── scripts/                # Deploy and mint scripts
├── mcp-server/             # TON MCP Server (6 tools)
│   └── src/
│       ├── index.ts        # MCP entry point
│       ├── tools/          # balance, price, kya
│       └── ton/            # tonapi.io client
├── agent-factory/          # CLI provisioning tool
│   └── src/
│       ├── index.ts        # CLI entry
│       ├── provision.ts    # Orchestration
│       ├── telegram.ts     # Bot validation
│       ├── wallet.ts       # Wallet generation
│       ├── deploy.ts       # SBT minting
│       └── configure.ts    # Config file generation
├── CLAUDE.md               # Agent persona template
└── .mcp.json               # MCP server registration template
```

## What Makes This Novel

- **First KYA implementation on TON** — On-chain verifiable identity for AI agents
- **First Claude Channels × TON integration** — Claude Channels launched March 20, 2026
- **1-command provisioning** — From bare Telegram Bot to fully equipped AI agent in seconds
- **MCP-native** — AI accesses blockchain data through standardized tool protocol
- **SBT > NFT for identity** — Non-transferable tokens are more faithful to KYA than ERC-8004's transferable ERC-721 approach
- **On-chain metadata** — Agent data lives on the blockchain, not on IPFS/HTTPS that can go offline

For a detailed comparison with Ethereum's ERC-8004 standard, see [docs/KYA_VS_ERC8004.md](./docs/KYA_VS_ERC8004.md).

## Contributing

Contributions welcome! Please open an issue or PR.

## License

MIT
