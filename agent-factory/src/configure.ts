import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';

interface ConfigureParams {
  botToken: string;
  botUsername: string;
  agentName: string;
  agentDescription: string;
  walletAddress: string;
  sbtAddress: string;
  agentId: number;
  capabilities: string;
  registryAddress: string;
  projectDir: string;
}

export function configureTelegramChannel(params: ConfigureParams) {
  const channelDir = join(homedir(), '.claude', 'channels', 'telegram');
  mkdirSync(channelDir, { recursive: true });

  const envFile = join(channelDir, '.env');

  // Write bot token
  writeFileSync(envFile, `TELEGRAM_BOT_TOKEN=${params.botToken}\n`, { mode: 0o600 });

  console.log(`  ✓ Telegram channel configured: ${envFile}`);
}

export function configureMcpJson(params: ConfigureParams) {
  const mcpPath = join(params.projectDir, '.mcp.json');
  let config: { mcpServers: Record<string, unknown> } = { mcpServers: {} };

  if (existsSync(mcpPath)) {
    try {
      config = JSON.parse(readFileSync(mcpPath, 'utf-8'));
    } catch {}
  }

  config.mcpServers = config.mcpServers || {};
  config.mcpServers['ton-agent'] = {
    command: 'bun',
    args: ['run', './mcp-server/src/index.ts'],
    env: {
      TON_API_BASE_URL: 'https://testnet.tonapi.io',
      TONCENTER_ENDPOINT: 'https://testnet.toncenter.com/api/v2/jsonRPC',
      AGENT_WALLET_ADDRESS: params.walletAddress,
      KYA_REGISTRY_ADDRESS: params.registryAddress,
    },
  };

  writeFileSync(mcpPath, JSON.stringify(config, null, 2) + '\n');
  console.log(`  ✓ MCP server configured: ${mcpPath}`);
}

export function generateClaudeMd(params: ConfigureParams) {
  const claudeMdPath = join(params.projectDir, 'CLAUDE.md');

  const content = `# ${params.agentName}

## Agent Identity
- **Name:** ${params.agentName}
- **Description:** ${params.agentDescription}
- **Telegram Bot:** @${params.botUsername}
- **Agent ID:** ${params.agentId}
- **SBT Address:** ${params.sbtAddress}
- **Wallet Address:** ${params.walletAddress}
- **KYA Registry:** ${params.registryAddress}
- **Capabilities:** ${params.capabilities}

## Persona

You are **${params.agentName}**, an AI-powered agent on the TON blockchain. You have a verified on-chain identity (KYA SBT) that proves your authenticity.

### Core Behaviors
- Always be helpful and provide accurate information about TON blockchain
- Use the \`get_ton_balance\` tool to check wallet balances
- Use the \`get_token_price\` tool to get current token prices
- Use the \`get_jetton_balances\` tool to check token holdings
- Use the \`estimate_swap\` tool to estimate swap outputs
- When asked about your identity, reference your KYA SBT on-chain proof
- Use \`verify_agent\` to verify other agents' authenticity
- Use \`get_agent_profile\` to look up agent profiles

### Identity Verification
When someone asks if you are verified or asks about your identity:
1. Reference your SBT address: \`${params.sbtAddress}\`
2. Explain that your identity is provable on-chain via the KYA registry
3. Invite them to verify you using the \`verify_agent\` tool

### Safety
- Never reveal your mnemonic or private keys
- Never send transactions without explicit user confirmation
- Always clarify that swap estimates are approximations
`;

  writeFileSync(claudeMdPath, content);
  console.log(`  ✓ Agent persona generated: ${claudeMdPath}`);
}
