import { EndpointId } from '@layerzerolabs/lz-definitions'

import type {
    OAppOmniGraphHardhat,
    OmniPointHardhat,
} from '@layerzerolabs/toolbox-hardhat'

// =============================================================
//                    ETHEREUM SEPOLIA
// =============================================================

const sepoliaRouter: OmniPointHardhat = {
    eid: EndpointId.SEPOLIA_V2_TESTNET,
    contractName: 'CrossChainRouter',
}

// =============================================================
//                    SOLANA DEVNET
// =============================================================
//
// LayerZero Solana OApp identity = Store PDA.
// This is NOT the Anchor program ID.
//

const solanaOApp: OmniPointHardhat = {
    eid: EndpointId.SOLANA_V2_TESTNET,
    address: 'EJoipsNGChK4NPichwUjDXKTeCQ5t9TkgY8Vce7NAnv5',
}

// =============================================================
//                    MESSAGING GRAPH
// =============================================================
//
// Keep connections empty until:
// - Ethereum peer is configured
// - Solana peer is configured
// - enforced options / pathway config are reviewed
//
// CrossChainToken / Solana OFT will be added later after
// bidirectional arbitrary messaging works.
//

const config: OAppOmniGraphHardhat = {
    contracts: [
        {
            contract: sepoliaRouter,
        },
        {
            contract: solanaOApp,
        },
    ],

    connections: [],
}

export default config