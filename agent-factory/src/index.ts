#!/usr/bin/env bun
import { provisionAgent } from './provision.js';
import { resolve } from 'path';

function printUsage() {
  console.log(`
Agent Factory — Provision AI Agents with TON wallet + KYA Identity

Usage:
  agent-factory create --token <BOT_TOKEN> --name <AGENT_NAME> [options]

Options:
  --token <token>        Telegram Bot Token (required)
  --name <name>          Agent name (required)
  --description <desc>   Agent description
  --capabilities <caps>  Comma-separated capabilities (default: balance,price,swap)
  --registry <addr>      KYA Registry contract address
  --skip-mint            Skip SBT minting (useful when wallet has no funds)
  --project-dir <dir>    Project directory (default: cwd)
  --toncenter-key <key>  TonCenter API key

Examples:
  bun run agent-factory/src/index.ts create --token 123:ABC --name "DeFi Agent"
  bun run agent-factory/src/index.ts create --token 123:ABC --name "DeFi Agent" --skip-mint
`);
}

function parseArgs(args: string[]): Record<string, string | boolean> {
  const parsed: Record<string, string | boolean> = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      if (key === 'skip-mint') {
        parsed[key] = true;
      } else if (i + 1 < args.length && !args[i + 1].startsWith('--')) {
        parsed[key] = args[++i];
      }
    } else if (!parsed['command']) {
      parsed['command'] = arg;
    }
  }
  return parsed;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args['command'] || args['command'] !== 'create') {
    printUsage();
    process.exit(args['command'] ? 1 : 0);
  }

  const token = args['token'] as string;
  const name = args['name'] as string;

  if (!token || !name) {
    console.error('Error: --token and --name are required');
    printUsage();
    process.exit(1);
  }

  await provisionAgent({
    token,
    name,
    description: args['description'] as string | undefined,
    capabilities: args['capabilities'] as string | undefined,
    registryAddress: (args['registry'] as string) || process.env.KYA_REGISTRY_ADDRESS || '',
    toncenterEndpoint: 'https://testnet.toncenter.com/api/v2/jsonRPC',
    toncenterApiKey: args['toncenter-key'] as string | undefined,
    projectDir: (args['project-dir'] as string) || resolve(process.cwd()),
    skipMint: !!args['skip-mint'],
  });
}

main().catch((error) => {
  console.error(`\n❌ Error: ${error.message || error}`);
  process.exit(1);
});
