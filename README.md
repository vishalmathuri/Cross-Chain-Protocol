# Cross-Chain Protocol

A cross-VM interoperability protocol connecting Ethereum and Solana using LayerZero V2.

## Target Architecture

```text
Ethereum Sepolia
Solidity / EVM
       │
       │ LayerZero V2
       ▼
Solana Devnet
Rust / Anchor
Components
Ethereum
CrossChainRouter.sol
CrossChainToken.sol
MessageCodec.sol
LayerZero V2 OApp
LayerZero OFT
Replay protection
Application-level nonces
Destination rate limiting
Emergency pause controls
Solana

The Solana implementation is being developed using Rust, Anchor, and LayerZero V2.

Planned components:

LayerZero Solana OApp
OApp Store PDA
Peer PDAs
lz_receive
lz_receive_types_v2
Cross-VM message decoding
Replay protection
Solana OFT / SPL token integration
Networks
Network	Environment
Ethereum	Sepolia
Solana	Devnet
Status

Ethereum protocol contracts and local security tests are complete.

Solana integration and Ethereum ↔ Solana public-testnet messaging are currently being implemented.