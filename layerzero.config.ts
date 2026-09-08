import { EndpointId } from '@layerzerolabs/lz-definitions'

import type {
    OAppOmniGraphHardhat,
    OmniPointHardhat,
} from '@layerzerolabs/toolbox-hardhat'

// =============================================================
//                    ETHEREUM SEPOLIA OAPPS
// =============================================================

const sepoliaRouter: OmniPointHardhat = {
    eid: EndpointId.SEPOLIA_V2_TESTNET,
    contractName: 'CrossChainRouter',
}

const sepoliaToken: OmniPointHardhat = {
    eid: EndpointId.SEPOLIA_V2_TESTNET,
    contractName: 'CrossChainToken',
}

// =============================================================
//                    LAYERZERO CONFIG
// =============================================================
//
// Solana is intentionally NOT added yet.
//
// After deploying the Rust/Anchor OApp we will obtain:
//
// 1. Solana OApp Store PDA
// 2. Solana OFT Store address
//
// Those addresses will then be added here as:
//
// {
//     eid: EndpointId.SOLANA_V2_TESTNET,
//     address: '<SOLANA_OAPP_STORE_PDA>',
// }
//
// and
//
// {
//     eid: EndpointId.SOLANA_V2_TESTNET,
//     address: '<SOLANA_OFT_STORE>',
// }
//
// We will then create:
//
// Ethereum Router <-> Solana OApp
// Ethereum OFT    <-> Solana OFT
//

const config: OAppOmniGraphHardhat = {
    contracts: [
        {
            contract: sepoliaRouter,
        },
        {
            contract: sepoliaToken,
        },
    ],

    connections: [],
}

export default config