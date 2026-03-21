import { validateBotToken } from './telegram.js';
import { generateWallet } from './wallet.js';
import { mintAgentSBT } from './deploy.js';
import { configureTelegramChannel, configureMcpJson, generateClaudeMd } from './configure.js';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

export interface ProvisionParams {
  token: string;
  name: string;
  description?: string;
  capabilities?: string;
  registryAddress: string;
  toncenterEndpoint?: string;
  toncenterApiKey?: string;
  projectDir: string;
  skipMint?: boolean;
}

export async function provisionAgent(params: ProvisionParams) {
  const startTime = Date.now();
  console.log('\n🏭 Agent Factory — Provisioning AI Agent\n');
  console.log(`  Agent Name: ${params.name}`);
  console.log('');

  // ===== Step 1: Validate Telegram Bot =====
  console.log('Step 1/6: Validating Telegram Bot...');
  const botInfo = await validateBotToken(params.token);
  console.log(`  ✓ Bot verified: @${botInfo.username} (ID: ${botInfo.id})`);

  // ===== Step 2: Generate TON Wallet =====
  console.log('Step 2/6: Generating TON Wallet...');
  const wallet = await generateWallet();
  console.log(`  ✓ Wallet created: ${wallet.friendlyAddress}`);

  // Save mnemonic securely
  const secretsDir = join(params.projectDir, '.secrets');
  mkdirSync(secretsDir, { recursive: true });
  writeFileSync(
    join(secretsDir, `${botInfo.username}_mnemonic.txt`),
    wallet.mnemonic.join(' ') + '\n',
    { mode: 0o600 }
  );
  console.log(`  ✓ Mnemonic saved to .secrets/ (chmod 600)`);

  // ===== Step 3: Mint Agent SBT =====
  let agentId = 0;
  let sbtAddress = 'pending-deployment';

  if (!params.skipMint) {
    console.log('Step 3/6: Minting Agent SBT on-chain...');
    try {
      const result = await mintAgentSBT({
        registryAddress: params.registryAddress,
        deployerKeypair: wallet.keypair,
        deployerAddress: wallet.address,
        agentName: params.name,
        agentDescription: params.description || `AI Agent: ${params.name}`,
        telegramBotId: String(botInfo.id),
        walletAddress: wallet.friendlyAddress,
        capabilities: params.capabilities || 'balance,price,swap',
        toncenterEndpoint: params.toncenterEndpoint || 'https://testnet.toncenter.com/api/v2/jsonRPC',
        toncenterApiKey: params.toncenterApiKey,
      });
      agentId = result.agentId;
      sbtAddress = result.sbtAddress;
      console.log(`  ✓ Agent SBT minted: ID=${agentId}, SBT=${sbtAddress}`);
    } catch (error) {
      console.log(`  ⚠ SBT mint skipped (wallet needs funding): ${error instanceof Error ? error.message : error}`);
      console.log(`  → Fund wallet ${wallet.friendlyAddress} with testnet TON, then re-run with mint`);
    }
  } else {
    console.log('Step 3/6: Skipping SBT mint (--skip-mint flag)');
  }

  // ===== Step 4: Configure Telegram Channel =====
  console.log('Step 4/6: Configuring Telegram Channel...');
  configureTelegramChannel({
    botToken: params.token,
    botUsername: botInfo.username,
    agentName: params.name,
    agentDescription: params.description || `AI Agent: ${params.name}`,
    walletAddress: wallet.friendlyAddress,
    sbtAddress,
    agentId,
    capabilities: params.capabilities || 'balance,price,swap',
    registryAddress: params.registryAddress,
    projectDir: params.projectDir,
  });

  // ===== Step 5: Configure MCP Server =====
  console.log('Step 5/6: Configuring TON MCP Server...');
  configureMcpJson({
    botToken: params.token,
    botUsername: botInfo.username,
    agentName: params.name,
    agentDescription: params.description || `AI Agent: ${params.name}`,
    walletAddress: wallet.friendlyAddress,
    sbtAddress,
    agentId,
    capabilities: params.capabilities || 'balance,price,swap',
    registryAddress: params.registryAddress,
    projectDir: params.projectDir,
  });

  // ===== Step 6: Generate CLAUDE.md =====
  console.log('Step 6/6: Generating Agent Persona...');
  generateClaudeMd({
    botToken: params.token,
    botUsername: botInfo.username,
    agentName: params.name,
    agentDescription: params.description || `AI Agent: ${params.name}`,
    walletAddress: wallet.friendlyAddress,
    sbtAddress,
    agentId,
    capabilities: params.capabilities || 'balance,price,swap',
    registryAddress: params.registryAddress,
    projectDir: params.projectDir,
  });

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n✅ Agent provisioned in ${elapsed}s\n`);
  console.log('  Summary:');
  console.log(`    Bot:     @${botInfo.username}`);
  console.log(`    Wallet:  ${wallet.friendlyAddress}`);
  console.log(`    Agent:   ID=${agentId}`);
  console.log(`    SBT:     ${sbtAddress}`);
  console.log('');
  console.log('  Next steps:');
  console.log('    1. Fund wallet with testnet TON:');
  console.log(`       https://t.me/testgiver_ton_bot → ${wallet.friendlyAddress}`);
  if (params.skipMint || sbtAddress === 'pending-deployment') {
    console.log('    2. Re-run without --skip-mint to mint SBT');
  }
  console.log('    3. Start Claude with Telegram channel:');
  console.log('       claude --channels plugin:telegram@claude-plugins-official');
  console.log('');
}
