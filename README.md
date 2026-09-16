# Cross-Chain Protocol

A production-oriented cross-chain messaging protocol connecting **Ethereum Sepolia** and **Solana Devnet** using **LayerZero V2**.

The project demonstrates real bidirectional interoperability between EVM and Solana environments using:

- Solidity
- Rust + Anchor
- LayerZero V2
- Ethereum Sepolia
- Solana Devnet
- Foundry
- Hardhat
- TypeScript / JavaScript

The protocol currently supports verified arbitrary cross-chain messaging in both directions.

> Cross-chain token transfers using LayerZero OFT / SPL are the next development phase.

---

## Architecture

```text
                    LayerZero V2
        ┌─────────────────────────────────┐
        │                                 │
        │                                 │
        ▼                                 ▼
┌───────────────────┐            ┌───────────────────┐
│ Ethereum Sepolia  │            │   Solana Devnet   │
│                   │            │                   │
│ CrossChainRouter  │◄──────────►│ Anchor OApp       │
│ Solidity          │            │ Rust              │
│                   │            │                   │
│ EID: 40161        │            │ EID: 40168        │
└───────────────────┘            └───────────────────┘
        │                                 │
        │ Structured Message              │
        │ Nonce Tracking                  │
        │ Replay Protection               │
        │                                 │
        └──────── LayerZero V2 ────────────┘
````

---

## Current Status

### Bidirectional Messaging

| Direction                        | Status          |
| -------------------------------- | --------------- |
| Ethereum Sepolia → Solana Devnet | ✅ Live verified |
| Solana Devnet → Ethereum Sepolia | ✅ Live verified |

The protocol has successfully delivered structured application messages across both chains.

---

## Core Features

### Ethereum

The EVM side is implemented using `CrossChainRouter.sol`.

Features include:

* LayerZero V2 OApp integration
* Structured cross-chain messages
* Application-level nonce tracking
* LayerZero GUID tracking
* Logical message replay protection
* Destination configuration
* Per-destination rate limiting
* Payload size validation
* Pause / unpause controls
* Peer validation
* Enforced LayerZero execution options

---

### Solana

The Solana side is implemented as an Anchor OApp.

Features include:

* LayerZero V2 Endpoint integration
* Ethereum peer validation
* Structured message decoding
* Application nonce handling
* Replay protection
* Compact `ReceivedMessage` receipt accounts
* Persistent Store PDA state
* LayerZero Endpoint nonce initialization
* Cross-chain sender / receiver validation

---

## Cross-Chain Message Format

Both chains use the same logical message structure:

```solidity
struct CrossChainMessage {
    uint8 version;
    uint8 messageType;
    uint64 nonce;
    bytes32 sender;
    bytes32 receiver;
    uint64 timestamp;
    bytes data;
}
```

Messages are encoded using Solidity-compatible ABI encoding.

This allows the Solana program to decode messages originating from Ethereum while maintaining the same logical structure in the reverse direction.

---

## Networks

| Network          | LayerZero EID |
| ---------------- | ------------: |
| Ethereum Sepolia |       `40161` |
| Solana Devnet    |       `40168` |

---

## Deployed Contracts

### Ethereum Sepolia

**CrossChainRouter**

```text
0x355BD2bdF11D4B2528BC465422AB97EA9843f5a5
```

LayerZero Endpoint V2:

```text
0x6EDCE65403992e310A62460808c4b910D972f10f
```

---

### Solana Devnet

**Program ID**

```text
86twc7j7pKySmWBV7pRBFkDkxqKs3bzJMjLCatjaKLSi
```

**Store PDA**

```text
EJoipsNGChK4NPichwUjDXKTeCQ5t9TkgY8Vce7NAnv5
```

**LzReceiveTypes PDA**

```text
Hpoa7jJwJBVWDXkuxt416QdLH95VHX4w1oT4JyH2vroY
```

LayerZero Solana Endpoint:

```text
76y77prsiCMvXMjuoZ5VRrhG5qYBrUMYTE5WgHqgjEn6
```

---

# Live Cross-Chain Verification

## Ethereum → Solana

Ethereum source transaction:

```text
0xd3106079d13800336e948e526e6dbc0311dfd6976add1aadc5c12338942bf38f
```

LayerZero GUID:

```text
0xebf7a50a51b610d755296cb7eba5baacfc6ba669352185766a32e72b0d753c43
```

Solana receipt PDA:

```text
8PnLzPSYUqzZ6jZ7FJub67WoyPsAxf85mBTZws98wEGk
```

Message:

```text
Hello from Ethereum Sepolia to Solana Devnet
```

The Solana receipt verifies:

```text
Source EID:        40161
Version:           1
Message Type:      1
Application Nonce: 1
Receipt Size:      227 bytes
```

---

## Solana → Ethereum

Solana source transaction:

```text
4yhNmLBQzH3N8RUibMvYpfqGiktNctJK4MxWbPFb7Qv9SKjAfBqphLu2pUDyaQuqYno3doJxzATSBjYM2ijGodJ5
```

LayerZero GUID:

```text
0xed86f0b1a5255d633d85765cc3490ae8529244528f71403e51cefc725dc9828b
```

Ethereum destination transaction:

```text
0xb6e1a69676e6ad8c5570ddbe29ae8604e7e5284d90e430a99744058974c92f32
```

Message:

```text
Hello from Solana Devnet to Ethereum Sepolia
```

The Ethereum router confirms:

```text
receivedCount = 1
applicationNonce = 1
sourceEid = 40168
```

---

# Verification Commands

The repository includes read-only verification scripts for both directions.

### Ethereum → Solana

```bash
npm run verify:evm-to-solana
```

Successful output includes:

```text
✅ Sepolia → Solana delivery verified.
```

### Solana → Ethereum

```bash
npm run verify:solana-to-evm
```

Successful output includes:

```text
SOLANA -> ETHEREUM VERIFICATION: PASS
```

These scripts do not send additional cross-chain transactions.

They verify already-executed on-chain messages.

---

# Testing

## Foundry

Run:

```bash
forge test
```

Current result:

```text
21 tests passed
0 failed
0 skipped
```

Testing includes:

* unit tests
* cross-chain messaging tests
* OFT-related EVM tests
* fuzz tests
* invariant tests
* rate-limit tests
* pause / unpause tests
* malformed payload validation
* supply conservation invariants

---

## Compile

```bash
npm run compile
```

This builds both:

```text
Foundry contracts
Hardhat contracts
```

---

## Full Test Command

```bash
npm test
```

The primary Solidity test suite is implemented using Foundry.

---

# Security Design

The protocol includes several security controls.

### Replay Protection

Incoming LayerZero GUIDs are recorded to prevent the same packet from being processed more than once.

Application-level message IDs are also tracked.

Logical message IDs are derived from:

```text
source EID
+
source OApp
+
application nonce
```

---

### Nonce Tracking

Each chain maintains application-level outbound nonces.

This prevents multiple messages from sharing the same logical identity.

---

### Peer Validation

Each OApp explicitly configures its trusted remote peer.

Ethereum trusts the Solana Store OApp.

Solana trusts the Ethereum `CrossChainRouter`.

---

### Payload Validation

Messages are validated for:

* protocol version
* message type
* non-zero receiver
* non-empty payload
* maximum payload size

---

### Rate Limiting

The Ethereum router supports configurable per-destination message limits.

This provides protection against excessive message submission.

---

### Pause Controls

The Ethereum router can be paused by the owner during emergencies.

---

# Solana Compact Receipt Design

Instead of storing the complete message payload in every Solana account, the protocol stores a compact receipt containing:

```text
Source EID
Source OApp
LayerZero GUID
Logical Message ID
Version
Message Type
Nonce
Sender
Receiver
Timestamp
Data Hash
Data Length
Bump
```

Receipt size:

```text
227 bytes
```

This reduces Solana account rent requirements while preserving cryptographic proof of the received payload.

---

# LayerZero Configuration

The integration uses LayerZero V2 components including:

* Endpoint V2
* Send Library
* Receive Library
* DVN
* Executor
* enforced execution options
* peer configuration
* OApp nonce initialization

---

# Repository Structure

```text
Cross-Chain-Protocol/
│
├── contracts/
│   ├── CrossChainRouter.sol
│   ├── CrossChainToken.sol
│   └── libraries/
│       └── MessageCodec.sol
│
├── test/
│   └── foundry/
│
├── scripts/
│   ├── send-sepolia-to-solana.js
│   ├── verify-sepolia-to-solana.js
│   ├── verify-solana-to-sepolia.js
│   └── inspect-layerzero-packet.js
│
├── solana-oapp/
│   ├── programs/
│   ├── scripts/
│   ├── tasks/
│   └── lib/
│
├── deployments/
│   └── sepolia/
│
├── layerzero.config.ts
├── foundry.toml
├── hardhat.config.ts
└── package.json
```

---

# Development Setup

## Requirements

Recommended environment:

```text
Node.js >= 18
Foundry
Rust
Solana CLI
Anchor CLI
```

The project was developed and tested using:

```text
Node.js 24
Foundry
Rust 1.97
Solana CLI 2.1
Anchor 0.31
```

---

## Install Dependencies

Root project:

```bash
npm install
```

Solana project:

```bash
cd solana-oapp
npm install
```

---

## Environment Variables

Create a `.env` file containing your RPC configuration.

Example:

```text
RPC_URL_SEPOLIA=<your-sepolia-rpc>
PRIVATE_KEY=<your-development-wallet-private-key>
```

Never commit:

```text
.env
private keys
seed phrases
Solana keypair files
```

---

# Current Development Milestones

### Phase 1 — EVM Architecture

✅ Complete

### Phase 2 — Solana Anchor OApp

✅ Complete

### Phase 3 — LayerZero V2 Wiring

✅ Complete

### Phase 4 — Ethereum → Solana Messaging

✅ Complete

### Phase 5 — Solana → Ethereum Messaging

✅ Complete

### Phase 6 — Bidirectional On-Chain Verification

✅ Complete

### Phase 7 — Cross-Chain OFT / SPL Token Transfer

🚧 Next

### Phase 8 — Final Audit / Cleanup

Planned

---

# Next Phase

The next protocol milestone is real token interoperability:

```text
Ethereum Sepolia
ERC-20 / LayerZero OFT
        │
        │ debit / burn
        ▼
   LayerZero V2
        │
        ▼
Solana Devnet
SPL / OFT
        │
        │ credit / mint
        ▼
     Receiver
```

The reverse pathway will also be implemented:

```text
Solana SPL
     │
     ▼
LayerZero
     │
     ▼
Ethereum OFT
```

The final implementation will verify cross-chain supply conservation in addition to successful delivery.

---

# Disclaimer

This repository is currently deployed on test networks for development and portfolio demonstration purposes.

It has not undergone an independent production security audit and should not be used to secure real-value assets.

---

## Author

**Vishal Kumar Mathuri**

Blockchain Developer focused on:

* Ethereum
* Solidity
* Foundry
* Rust
* Solana
* Anchor
* LayerZero
* Cross-chain infrastructure

GitHub:

```text
https://github.com/vishalmathuri
```

Portfolio:

```text
https://vishal-website-beta.vercel.app/
