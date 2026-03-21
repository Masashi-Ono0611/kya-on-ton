import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { getTonBalance, getJettonBalances } from './tools/balance.js';
import { getTokenPrice, estimateSwap } from './tools/price.js';
import { getAgentProfile, verifyAgent } from './tools/kya.js';
import { sendTon } from './tools/transfer.js';

const server = new Server(
  { name: 'ton-agent-mcp', version: '0.1.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'get_ton_balance',
      description: 'Get TON balance for a wallet address',
      inputSchema: {
        type: 'object' as const,
        properties: {
          address: { type: 'string', description: 'TON wallet address (raw or friendly format)' },
        },
        required: ['address'],
      },
    },
    {
      name: 'get_jetton_balances',
      description: 'Get all Jetton (token) balances for a wallet address',
      inputSchema: {
        type: 'object' as const,
        properties: {
          address: { type: 'string', description: 'TON wallet address' },
        },
        required: ['address'],
      },
    },
    {
      name: 'get_token_price',
      description: 'Get current price and 24h change for a token (TON, USDT, STON, etc.)',
      inputSchema: {
        type: 'object' as const,
        properties: {
          token: { type: 'string', description: 'Token symbol (e.g., TON, USDT) or contract address' },
        },
        required: ['token'],
      },
    },
    {
      name: 'estimate_swap',
      description: 'Estimate swap output between two tokens based on current prices',
      inputSchema: {
        type: 'object' as const,
        properties: {
          from: { type: 'string', description: 'Source token symbol or address' },
          to: { type: 'string', description: 'Destination token symbol or address' },
          amount: { type: 'string', description: 'Amount to swap' },
        },
        required: ['from', 'to', 'amount'],
      },
    },
    {
      name: 'get_agent_profile',
      description: 'Get KYA (Know Your Agent) profile from on-chain SBT by agent ID',
      inputSchema: {
        type: 'object' as const,
        properties: {
          agent_id: { type: 'string', description: 'Agent ID (index in registry)' },
        },
        required: ['agent_id'],
      },
    },
    {
      name: 'verify_agent',
      description: 'Verify if a Telegram bot is a registered and verified AI agent via KYA on-chain registry',
      inputSchema: {
        type: 'object' as const,
        properties: {
          telegram_bot_id: { type: 'string', description: 'Telegram Bot ID to verify' },
        },
        required: ['telegram_bot_id'],
      },
    },
    {
      name: 'send_ton',
      description: 'Send TON from the agent wallet to a destination address. Requires explicit user confirmation before calling. Max 1 TON per tx (testnet safety).',
      inputSchema: {
        type: 'object' as const,
        properties: {
          to: { type: 'string', description: 'Destination TON wallet address' },
          amount: { type: 'string', description: 'Amount of TON to send (max 1.0)' },
          comment: { type: 'string', description: 'Optional transaction comment' },
        },
        required: ['to', 'amount'],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const args = (req.params.arguments ?? {}) as Record<string, string>;

  try {
    let result: string;

    switch (req.params.name) {
      case 'get_ton_balance':
        result = await getTonBalance(args.address);
        break;
      case 'get_jetton_balances':
        result = await getJettonBalances(args.address);
        break;
      case 'get_token_price':
        result = await getTokenPrice(args.token);
        break;
      case 'estimate_swap':
        result = await estimateSwap(args.from, args.to, args.amount);
        break;
      case 'get_agent_profile':
        result = await getAgentProfile(args.agent_id);
        break;
      case 'verify_agent':
        result = await verifyAgent(args.telegram_bot_id);
        break;
      case 'send_ton':
        result = await sendTon(args.to, args.amount, args.comment);
        break;
      default:
        result = JSON.stringify({ error: `Unknown tool: ${req.params.name}` });
    }

    return { content: [{ type: 'text', text: result }] };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { content: [{ type: 'text', text: JSON.stringify({ error: message }) }] };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write('ton-agent-mcp server started\n');
}

main().catch((error) => {
  process.stderr.write(`Fatal error: ${error}\n`);
  process.exit(1);
});
