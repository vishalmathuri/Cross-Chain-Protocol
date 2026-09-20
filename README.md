# Cross-Chain Protocol

A bidirectional cross-chain protocol connecting **Ethereum Sepolia** and **Solana Devnet** using **LayerZero V2**.

The project implements two interoperability layers:

1. **Cross-chain application messaging**
2. **Bidirectional CCT token transfers using LayerZero OFT**

It includes EVM smart contracts, a Solana program, LayerZero configuration, automated verification scripts, and a browser frontend with **MetaMask** and **Phantom** wallet integration.

## Live Demo

**Frontend:** https://cross-chain-protocol.vercel.app/

The browser app exposes two protocol modes from one interface:

- **Token Bridge** — bidirectional CCT transfers between Ethereum Sepolia and Solana Devnet
- **Messaging** — bidirectional application messages between Ethereum Sepolia and Solana Devnet

---

## Current Status

| Feature | Status |
| --- | --- |
| Ethereum Sepolia → Solana messaging | ✅ Working |
| Solana Devnet → Ethereum messaging | ✅ Working |
| Ethereum Sepolia → Solana CCT bridge | ✅ Working |
| Solana Devnet → Ethereum CCT bridge | ✅ Working |
| MetaMask integration | ✅ Working |
| Phantom integration | ✅ Working |
| LayerZero fee quoting | ✅ Working |
| Source-chain confirmation | ✅ Working |
| Destination balance tracking | ✅ Working |
| Solana transaction simulation | ✅ Working |
| Phantom LayerZero ALT workaround | ✅ Working |
| Cross-chain messaging frontend | ✅ Working |
| Unified Token Bridge / Messaging workspace | ✅ Working |
| Public Vercel deployment | ✅ Live |
| Mainnet deployment | ❌ Not deployed |
| Independent security audit | ❌ Not audited |

> This project currently operates on **Ethereum Sepolia** and **Solana Devnet** for development, testing, and portfolio demonstration.

---

# Architecture

## Token Bridge

```text
                         LayerZero V2
            ┌─────────────────────────────────┐
            │                                 │
            │                                 │
            ▼                                 ▼

┌──────────────────────────┐       ┌──────────────────────────┐
│    Ethereum Sepolia      │       │      Solana Devnet       │
│                          │       │                          │
│ CCT ERC-20 / OFT         │       │ CCT SPL / OFT           │
│ Solidity                 │       │ LayerZero Solana OFT     │
│                          │       │                          │
│ EID: 40161               │       │ EID: 40168               │
└────────────┬─────────────┘       └────────────┬─────────────┘
             │                                  │
          MetaMask                           Phantom
             │                                  │
             └───────────┐          ┌───────────┘
                         │          │
                         ▼          ▼
                    React / Vite Frontend
````

The bridge supports both directions:

```text
Ethereum Sepolia
CCT ERC-20 / OFT
       │
       │ debit / burn
       ▼
 LayerZero V2
       │
       ▼
Solana Devnet
CCT SPL / OFT
       │
       │ credit / mint
       ▼
   Recipient
```

and:

```text
Solana Devnet
CCT SPL / OFT
       │
       │ debit / burn
       ▼
 LayerZero V2
       │
       ▼
Ethereum Sepolia
CCT ERC-20 / OFT
       │
       │ credit / mint
       ▼
   Recipient
```

---

# Cross-Chain Messaging Architecture

The repository also contains an application-level messaging protocol implemented independently of the token bridge.

```text
                    LayerZero V2
        ┌─────────────────────────────────┐
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
```

The messaging layer includes:

* structured cross-chain messages
* application-level nonces
* replay protection
* peer validation
* LayerZero GUID tracking
* payload validation
* rate limiting
* pause controls
* compact Solana receipt accounts

---

# Tech Stack

## Ethereum / EVM

* Solidity
* LayerZero V2
* LayerZero OFT
* OpenZeppelin
* Foundry
* Hardhat
* Ethers.js

## Solana

* Rust
* Anchor
* Solana
* SPL Token
* LayerZero Solana OFT SDK
* Metaplex UMI
* Address Lookup Tables
* Versioned Transactions

## Frontend

* React
* Vite
* JavaScript
* Ethers.js
* Solana Web3.js
* MetaMask
* Phantom
* LayerZero OFT Solana SDK

---

# Networks

| Network          | LayerZero EID |
| ---------------- | ------------: |
| Ethereum Sepolia |       `40161` |
| Solana Devnet    |       `40168` |

---

# OFT Deployments

## Ethereum Sepolia

### CCT LayerZero OFT

```text
0x012F1BD82Ab77aAF810A0A7fD3F8776759A4E8A3
```

Network:

```text
Ethereum Sepolia
```

LayerZero EID:

```text
40161
```

---

## Solana Devnet

### CCT Mint

```text
JV3naK5XLVeFPknMmUUQvBKa8MWTnNRFUTYRCWEVcRU
```

### OFT Store

```text
ChH5mhTYjQZd2CjCMTcS7SHRsDHrF2qRKvEFkzM7ZZiL
```

### OFT Program

```text
GTWBLZr6jumUR8NqSv6RdHya8WNUwxBcKs4GkSJgMjx6
```

### LayerZero Address Lookup Table

```text
9thqPdbR27A1yLWw2spwJLySemiGMXxPnEvfmXVk4KuK
```

LayerZero EID:

```text
40168
```

---

# Messaging Deployments

The repository also contains the earlier arbitrary messaging implementation.

## Ethereum Sepolia

### CrossChainRouter

```text
0x355BD2bdF11D4B2528BC465422AB97EA9843f5a5
```

### LayerZero Endpoint V2

```text
0x6EDCE65403992e310A62460808c4b910D972f10f
```

---

## Solana Devnet

### Messaging Program ID

```text
86twc7j7pKySmWBV7pRBFkDkxqKs3bzJMjLCatjaKLSi
```

### Store PDA

```text
EJoipsNGChK4NPichwUjDXKTeCQ5t9TkgY8Vce7NAnv5
```

### LzReceiveTypes PDA

```text
Hpoa7jJwJBVWDXkuxt416QdLH95VHX4w1oT4JyH2vroY
```

### LayerZero Solana Endpoint

```text
76y77prsiCMvXMjuoZ5VRrhG5qYBrUMYTE5WgHqgjEn6
```

---

# Browser Frontend

The `frontend/` application provides a unified LayerZero workspace with two top-level modes:

```text
┌──────────────────────────────────────────────┐
│ Token Bridge            Messaging            │
│ Transfer CCT            Send app data        │
└──────────────────────────────────────────────┘
```

Users connect both:

```text
MetaMask
   +
Phantom
```

and can switch between token transfer and arbitrary application messaging without leaving the app.

## Token Bridge Mode

Supports CCT transfers in both directions:

```text
Ethereum Sepolia → Solana Devnet
Solana Devnet → Ethereum Sepolia
```

The bridge frontend:

* detects MetaMask and Phantom
* validates connected networks
* loads native balances
* loads CCT balances
* quotes current LayerZero fees
* validates bridge amounts
* requests wallet signatures
* waits for source-chain confirmation
* tracks destination CCT balance
* exposes block explorer links
* exposes LayerZero Scan links

## Messaging Mode

Supports application messages in both directions:

```text
Ethereum Sepolia → Solana Devnet
Solana Devnet → Ethereum Sepolia
```

The messaging frontend:

* accepts UTF-8 application payloads
* enforces the protocol payload-size limit
* quotes the LayerZero native fee before sending
* uses the connected MetaMask account as the EVM application sender/receiver
* uses the connected Phantom account as the Solana application sender/receiver
* submits messages through the deployed `CrossChainRouter` and Solana OApp
* confirms the source-chain transaction
* polls the destination protocol state to detect delivery
* exposes Etherscan, Solscan, and LayerZero Scan links

The browser implementation is split into:

```text
frontend/src/components/MessageBridge.jsx
frontend/src/lib/evmMessaging.js
frontend/src/lib/solanaMessaging.js
```

---

# Ethereum → Solana Flow

The Ethereum route is implemented in:

```text
frontend/src/lib/evmOft.js
```

The frontend:

1. Validates MetaMask
2. Ensures MetaMask is on Ethereum Sepolia
3. Validates the Solana recipient
4. Builds the OFT `SendParam`
5. Calls `quoteSend`
6. Displays the estimated LayerZero native fee
7. Re-quotes immediately before sending
8. Calls the OFT `send` function
9. Waits for the Ethereum source transaction
10. Polls the Solana destination CCT balance

The frontend restricts bridge amounts to a maximum of **6 decimal places** to remain aligned with the OFT shared-decimal configuration.

---

# Solana → Ethereum Flow

The Solana route is implemented in:

```text
frontend/src/lib/solanaOft.js
```

The frontend:

1. Validates Phantom
2. Loads the OFT Store
3. Loads the CCT mint and token account
4. Validates the Ethereum recipient
5. Builds the LayerZero send parameters
6. Loads the LayerZero Address Lookup Table
7. Quotes the LayerZero fee
8. Builds the OFT send instruction
9. Simulates the transaction
10. Prepares a Phantom-compatible transaction
11. Requests the Phantom signature
12. Broadcasts the transaction
13. Confirms the Solana source transaction
14. Polls the Ethereum destination balance

---

# Phantom + LayerZero ALT Signing Problem

One of the main engineering challenges in the project occurred on the:

```text
Solana Devnet → Ethereum Sepolia
```

route.

LayerZero generated a valid **Solana v0 VersionedTransaction** containing a LayerZero Address Lookup Table.

The transaction itself was valid:

```text
Transaction version:      0
Required signer count:    1
Fee payer:                Phantom wallet
LayerZero ALT count:      1
Transaction size:         771 bytes
Simulation:               passed
```

However, Phantom's injected wallet returned:

```text
-32603
Unexpected error
```

when signing the transaction.

Multiple isolated tests established that:

```text
Legacy Solana transaction       ✅ Phantom signed
v0 transaction                  ✅ Phantom signed
v0 + LayerZero ALT              ❌ Phantom returned -32603
```

This isolated the failure to Phantom signing of the LayerZero ALT transaction.

---

# Phantom ALT Workaround

Instead of changing the LayerZero instructions, the frontend keeps the original LayerZero transaction and transforms its account representation before Phantom signing.

The implementation:

1. Builds the original LayerZero transaction using the official ALT
2. Resolves the ALT from Solana Devnet
3. Decompiles the versioned message
4. Expands ALT addresses into static account keys
5. Recompiles the message as a v0 transaction without an ALT
6. Verifies the final transaction contains no lookup tables
7. Checks the transaction remains below Solana's maximum transaction size
8. Simulates the exact final transaction
9. Requests the Phantom signature
10. Broadcasts and confirms the signed transaction

Observed result:

```text
Original LayerZero transaction:
771 bytes
ALT count: 1

Expanded Phantom transaction:
1171 bytes
ALT count: 0
Static accounts: 29

Solana transaction limit:
1232 bytes
```

The rebuilt transaction remained within the Solana size limit:

```text
1171 < 1232
```

and Phantom successfully signed it.

---

# Successful Phantom Bridge Transaction

Example confirmed Solana Devnet source transaction:

```text
4oyrab8vcVR7mSbgCa8WXymWNugn3Ng2rYvi76WTtodSTnFd5pdyXf9xbvyhKzuJsCfKXL8cQEw3yJwz6xZ7MS4F
```

The execution sequence completed:

```text
LayerZero transaction built
        ↓
Original ALT transaction simulated
        ↓
ALT expanded
        ↓
1171-byte no-ALT transaction created
        ↓
Final transaction simulated
        ↓
Phantom signed
        ↓
Transaction broadcast
        ↓
Solana source transaction confirmed
```

---

# Destination Delivery Tracking

After a source transaction is confirmed, the frontend does not immediately assume that the cross-chain transfer has completed.

Instead, it tracks the destination CCT balance.

The frontend:

```text
records destination balance before send
            ↓
submits source transaction
            ↓
waits for source confirmation
            ↓
polls destination balance
            ↓
detects credited CCT
            ↓
marks transfer delivered
```

The current frontend checks the destination approximately every:

```text
5 seconds
```

for up to:

```text
60 attempts
```

which provides an approximately **5-minute delivery observation window**.

---

# Browser Messaging Transaction Flow

## Ethereum → Solana

```text
MetaMask
   ↓
CrossChainRouter.quoteMessage()
   ↓
display LayerZero native fee
   ↓
CrossChainRouter.sendMessage()
   ↓
Ethereum source confirmation
   ↓
LayerZero V2
   ↓
Solana OApp receipt/state update
   ↓
frontend detects destination delivery
```

## Solana → Ethereum

```text
Phantom
   ↓
resolve LayerZero send accounts
   ↓
quote native fee
   ↓
build Solana OApp send instruction
   ↓
simulate transaction
   ↓
refresh recent blockhash
   ↓
Phantom signs
   ↓
Solana source confirmation
   ↓
LayerZero V2
   ↓
CrossChainRouter receives message
   ↓
frontend detects destination delivery
```

During browser integration, the Solana messaging route also required handling two testnet-specific integration details:

* the LayerZero endpoint SDK's send-library discovery could encounter a missing default `SendLibraryConfig` account, so the frontend falls back to the known ULN v3 program for this deployed pathway
* the final transaction is rebuilt with a fresh blockhash after simulation before Phantom signs, avoiding stale-blockhash simulation/signing failures

---

# Cross-Chain Message Format

The application messaging layer uses the following logical message structure:

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

Both chains operate on the same logical representation.

This allows the Solana program to decode messages originating from Ethereum while maintaining compatible state and validation rules.

---

# Messaging Verification

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

Verified receipt:

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

Ethereum verification:

```text
receivedCount = 1
applicationNonce = 1
sourceEid = 40168
```

---

# Verification Commands

The repository contains read-only verification scripts for the application messaging layer.

## Ethereum → Solana

```bash
npm run verify:evm-to-solana
```

Successful verification includes:

```text
✅ Sepolia → Solana delivery verified.
```

## Solana → Ethereum

```bash
npm run verify:solana-to-evm
```

Successful verification includes:

```text
SOLANA -> ETHEREUM VERIFICATION: PASS
```

These verification commands inspect previously executed on-chain messages and do not submit another cross-chain transaction.

---

# Smart Contract Testing

## Foundry

Run:

```bash
forge test
```

The Solidity test suite covers areas including:

* unit tests
* messaging behavior
* OFT-related EVM behavior
* fuzz testing
* invariants
* rate limits
* pause controls
* malformed payload validation
* supply-related invariants

The previously verified Foundry suite completed with:

```text
21 tests passed
0 failed
0 skipped
```

---

# Compile

Compile the EVM project with:

```bash
npm run compile
```

This invokes both:

```text
Foundry
Hardhat
```

You can also run them individually:

```bash
npm run compile:forge
```

```bash
npm run compile:hardhat
```

---

# Root Test Command

```bash
npm test
```

The root project runs:

```text
Foundry tests
+
Hardhat tests
```

---

# Frontend Commands

Move into the frontend:

```bash
cd frontend
```

Install dependencies:

```bash
npm install
```

Start development mode:

```bash
npm run dev
```

Build the production bundle:

```bash
npm run build
```

Run frontend linting:

```bash
npm run lint
```

---

# Development Setup

## Requirements

Install:

```text
Node.js >= 18
Foundry
Rust
Solana CLI
Anchor CLI
MetaMask
Phantom
```

---

## Clone

```bash
git clone https://github.com/vishalmathuri/Cross-Chain-Protocol.git
```

```bash
cd Cross-Chain-Protocol
```

---

## Install Root Dependencies

```bash
npm install
```

---

## Root Environment

The repository contains:

```text
.env.example
```

Copy it:

```bash
cp .env.example .env
```

Configure either a development mnemonic or private key when required by deployment scripts.

Example:

```env
MNEMONIC=
PRIVATE_KEY=
```

Never commit:

```text
.env
private keys
seed phrases
wallet recovery phrases
Solana keypair files
```

---

# Frontend Environment

Move into:

```bash
cd frontend
```

Create:

```text
.env.local
```

Example:

```env
VITE_SOLANA_RPC_URL=https://your-solana-devnet-rpc.example
```

The frontend falls back to:

```text
https://api.devnet.solana.com
```

when `VITE_SOLANA_RPC_URL` is not configured.

> Important: Vite variables beginning with `VITE_` are included in the browser application. They should not be treated as server-side secrets. Use an RPC endpoint/key that is suitable for browser exposure, apply provider-side restrictions where available, or route production RPC access through infrastructure designed for that purpose.

The repository ignores local environment files.

---

# Repository Structure

```text
Cross-Chain-Protocol/
│
├── contracts/
│   ├── CrossChainRouter.sol
│   ├── CrossChainToken.sol
│   └── libraries/
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
├── deploy/
│
├── deployments/
│
├── solana-oapp/
│   ├── programs/
│   ├── scripts/
│   ├── tasks/
│   └── lib/
│
├── solana-oft/
│
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── config/
│   │   │   └── protocol.js
│   │   ├── components/
│   │   │   ├── MessageBridge.jsx
│   │   │   └── MessageBridge.css
│   │   ├── lib/
│   │   │   ├── evmOft.js
│   │   │   ├── solanaOft.js
│   │   │   ├── evmMessaging.js
│   │   │   └── solanaMessaging.js
│   │   ├── App.jsx
│   │   ├── App.css
│   │   └── main.jsx
│   │
│   ├── package.json
│   └── vite.config.js
│
├── layerzero.config.ts
├── foundry.toml
├── hardhat.config.ts
├── package.json
└── README.md
```

---

# Security Design

## Trusted Peers

LayerZero peers are explicitly configured between the two chains.

The Ethereum contracts trust the configured Solana application.

The Solana application trusts the configured Ethereum application.

---

## Replay Protection

The messaging layer records LayerZero GUIDs and logical message identifiers to prevent duplicate processing.

---

## Application Nonces

Outbound application messages use application-level nonces so logical messages remain uniquely identifiable.

---

## Payload Validation

Cross-chain messages are validated for properties including:

* protocol version
* message type
* receiver
* payload contents
* maximum payload size

---

## Rate Limiting

The Ethereum messaging router supports configurable per-destination limits.

---

## Pause Controls

The Ethereum messaging router includes owner-controlled pause functionality for emergency response.

---

## Transaction Simulation

The Solana token bridge simulates transactions before Phantom is asked to sign them.

For the Phantom workaround, the frontend performs simulation twice:

```text
Original LayerZero ALT transaction
        ↓
simulation
        ↓
ALT expansion
        ↓
final Phantom transaction
        ↓
simulation
        ↓
wallet signature
```

This verifies that the transaction remains valid after account representation is changed.

---

## Transaction Size Validation

The Phantom-compatible transaction is explicitly checked against:

```text
1232 bytes
```

before wallet signing and broadcasting.

If expanding the ALT causes the transaction to exceed this limit, the bridge stops rather than requesting an invalid transaction signature.

---

# Solana Compact Receipt Design

The messaging protocol uses compact Solana receipt accounts instead of storing complete payload data.

A receipt contains information such as:

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

Observed receipt size:

```text
227 bytes
```

This reduces Solana account storage requirements while preserving the information required to verify message delivery.

---

# Key Engineering Challenges

This project involved more than deploying standard contracts.

Notable integration and debugging work included:

### EVM ↔ Solana Interoperability

The protocol connects two different execution environments:

```text
EVM / Solidity
        ↕
LayerZero
        ↕
Solana / Rust
```

---

### Wallet Provider Separation

The frontend distinguishes MetaMask and Phantom when multiple browser wallets inject providers into the same page.

---

### Solana RPC Reliability

Browser development required moving away from rate-limited public RPC usage for repeated quote, simulation, balance, and transaction requests.

---

### Versioned Transaction Handling

LayerZero's Solana integration uses versioned transactions and Address Lookup Tables.

The frontend validates:

```text
transaction version
required signers
fee payer
lookup tables
transaction size
```

before sending transactions to Phantom.

---

### Phantom ALT Failure Isolation

The Phantom signing failure was isolated through progressively controlled tests:

```text
simple legacy transaction
        ✅

simple v0 transaction
        ✅

v0 transaction using LayerZero ALT
        ❌ -32603
```

This allowed the issue to be solved without changing the LayerZero OFT instructions themselves.

---

# Development Milestones

| Phase                                | Status                                  |
| ------------------------------------ | --------------------------------------- |
| EVM architecture                     | ✅ Complete                              |
| Solana Anchor OApp                   | ✅ Complete                              |
| LayerZero V2 wiring                  | ✅ Complete                              |
| Ethereum → Solana messaging          | ✅ Complete                              |
| Solana → Ethereum messaging          | ✅ Complete                              |
| Bidirectional messaging verification | ✅ Complete                              |
| Ethereum OFT deployment              | ✅ Complete                              |
| Solana OFT deployment                | ✅ Complete                              |
| Ethereum → Solana token bridge       | ✅ Complete                              |
| Solana → Ethereum token bridge       | ✅ Complete                              |
| MetaMask frontend integration        | ✅ Complete                              |
| Phantom frontend integration         | ✅ Complete                              |
| Phantom ALT signing workaround       | ✅ Complete                              |
| Frontend cleanup                     | ✅ Complete                              |
| Cross-chain messaging frontend       | ✅ Complete                              |
| Unified Bridge / Messaging UI         | ✅ Complete                              |
| Frontend public deployment           | ✅ Complete                              |
| Wallet domain/reputation review       | In progress                              |
| Independent security audit           | Not completed                           |
| Mainnet deployment                   | Not planned for current testnet version |

---

# Limitations

The current implementation is intended for testnet experimentation and portfolio demonstration.

Important limitations include:

* Ethereum Sepolia and Solana Devnet only
* no independent smart contract audit
* no mainnet deployment
* browser RPC reliability depends on the configured Solana RPC provider
* Phantom ALT compatibility required an application-side transaction reconstruction workaround
* bridge behavior depends on the configured LayerZero testnet infrastructure
* test tokens have no real-world monetary value
* wallet security/reputation providers may temporarily warn on the newly deployed public domain until domain/project verification and reputation review are completed

---

# Disclaimer

This repository is a development and portfolio project deployed on public test networks.

It has **not** undergone an independent production security audit and should not be used to secure real-value assets.

Do not use production private keys, seed phrases, or wallets containing real funds with development scripts.

---

# Author

**Vishal Kumar Mathuri**

Blockchain Developer focused on:

* Ethereum
* Solidity
* Foundry
* LayerZero
* Cross-chain infrastructure
* Rust
* Solana
* Anchor
* Web3 wallet integrations

GitHub:

```text
https://github.com/vishalmathuri
```

Portfolio:

```text
https://vishal-website-beta.vercel.app/
```

---

## Project Highlights

This project demonstrates:

```text
Solidity + Ethereum
        +
Rust + Solana
        +
LayerZero V2
        +
Cross-chain messaging
        +
LayerZero OFT
        +
MetaMask
        +
Phantom
        +
Versioned Solana transactions
        +
Address Lookup Tables
        +
Frontend wallet integration
```

with working bidirectional testnet interoperability between **Ethereum Sepolia** and **Solana Devnet**.

````