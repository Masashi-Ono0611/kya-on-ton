# Security & Trust Model

## What is cryptographically proven?

| Binding | How it's proven | Strength |
|---------|----------------|----------|
| **Wallet → SBT** | `register_self`: TX signature proves the caller owns the wallet that becomes SBT owner | Cryptographic |
| **Wallet → KyaGated** | `prove_ownership` (TEP-85): SBT verifies sender's signature matches owner | Cryptographic |
| **SBT non-transferability** | Contract rejects `transfer` op with exit code 413 | Cryptographic |
| **SBT revocation** | Only `authority_address` can revoke; checked via signature | Cryptographic |

## What is NOT cryptographically proven?

| Binding | Current state | Mitigation path |
|---------|--------------|-----------------|
| **Telegram Bot → SBT** | Self-declared `telegram_bot_id` string in metadata | Oracle attestation or bot-signed challenge |
| **AI capabilities → SBT** | Self-declared `capabilities` string | Validation registry (like ERC-8004) |
| **Claude instance → Wallet** | CLAUDE.md is a text file; .mcp.json is config | TEE-based attestation |

## Registration Modes

### `register_self` (op 0x2) — Permissionless

```
Agent Wallet ──TX (signed)──→ Registry ──deploy──→ SBT
                                                    │
                                              owner = Agent Wallet
```

**Trust model:** The agent's own wallet sends the registration transaction. The blockchain validates the signature, proving wallet ownership. No trusted admin needed.

**What this proves:** "The entity controlling this private key chose to register as an agent with these metadata claims."

**What this does NOT prove:** That the claimed `telegram_bot_id` is actually controlled by this wallet.

### `mint_agent` (op 0x1) — Admin-only

```
Admin Wallet ──TX (signed)──→ Registry ──deploy──→ SBT
                                                    │
                                              owner = specified address
```

**Trust model:** The registry admin vouches for the agent. You must trust the admin.

## Cryptographic Proof Chain

When an agent interacts with a KYA-gated contract:

```
1. Agent signs TX with private key
   └─ Blockchain verifies: sender == Agent Wallet ✓ (cryptographic)

2. Agent sends prove_ownership to their SBT
   └─ SBT verifies: sender == SBT.owner ✓ (cryptographic)

3. SBT sends ownership_proof to KyaGated vault
   └─ Vault verifies: message came from a valid SBT ✓
   └─ Vault checks: revoked_at == 0 ✓

4. Vault credits deposit to agent
   └─ Only reachable if steps 1-3 pass
```

**Result:** No entity can deposit into a KYA-gated vault without:
- Holding the private key of a wallet that owns a valid, non-revoked KYA SBT
- This is a cryptographic guarantee, not a trust assumption

## verify_agent Response

The `verify_agent` MCP tool now reports binding strength:

```json
{
  "verified": true,
  "wallet_cryptographically_bound": true,
  "binding_proof": "SBT owner matches wallet — the mint transaction signature cryptographically proves wallet ownership",
  "profile": { ... }
}
```

If the SBT owner does not match the declared `wallet_address` in metadata:

```json
{
  "verified": true,
  "wallet_cryptographically_bound": false,
  "binding_proof": "WARNING: SBT owner does not match declared wallet_address — binding is not proven"
}
```

## Trust Levels

| Level | What's proven | Implementation |
|-------|--------------|----------------|
| **Level 1** | Agent registered in KYA registry | `register_self` or `mint_agent` |
| **Level 2** | Wallet ownership is cryptographic | `register_self` (TX signature) |
| **Level 3** | Telegram Bot ownership proven | Not yet (needs oracle) |
| **Level 4** | Third-party validation | Not yet (needs validation registry) |
| **Level 5** | TEE-based full binding | Not yet (needs trusted execution) |

Current implementation covers **Level 1-2**. The KYA-gated vault (`prove_ownership` flow) provides Level 2 guarantees for contract-level access control.

## Comparison with ERC-8004

| Aspect | ERC-8004 | KYA on TON |
|--------|----------|------------|
| Identity token | Transferable (ERC-721) | **Non-transferable (SBT)** |
| Registration | Admin or permissioned | **Permissionless self-registration** |
| Wallet binding | Not enforced | **Enforced via TX signature** |
| On-chain access control | Not specified | **KyaGated vault with prove_ownership** |
| Reputation | Dynamic registry | Static (MVP) |
| Validation | Third-party hooks | Not yet |

See [KYA_VS_ERC8004.md](./KYA_VS_ERC8004.md) for full comparison.
