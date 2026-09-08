import {
    EndpointId,
} from '@layerzerolabs/lz-definitions'

import {
    ExecutorOptionType,
} from '@layerzerolabs/lz-v2-utilities'

import {
    TwoWayConfig,
    generateConnectionsConfig,
} from '@layerzerolabs/metadata-tools'

import {
    OAppEnforcedOption,
    OmniPointHardhat,
} from '@layerzerolabs/toolbox-hardhat'

// =============================================================
//                         ROUTERS
// =============================================================

const baseRouter: OmniPointHardhat = {
    eid: EndpointId.BASESEP_V2_TESTNET,
    contractName: 'CrossChainRouter',
}

const arbitrumRouter: OmniPointHardhat = {
    eid: EndpointId.ARBSEP_V2_TESTNET,
    contractName: 'CrossChainRouter',
}

// =============================================================
//                          TOKENS
// =============================================================

const baseToken: OmniPointHardhat = {
    eid: EndpointId.BASESEP_V2_TESTNET,
    contractName: 'CrossChainToken',
}

const arbitrumToken: OmniPointHardhat = {
    eid: EndpointId.ARBSEP_V2_TESTNET,
    contractName: 'CrossChainToken',
}

// =============================================================
//                   EXECUTION OPTIONS
// =============================================================

// CrossChainRouter performs several destination storage writes,
// replay checks and event emission, so give it comfortable
// destination execution headroom.

const ROUTER_OPTIONS: OAppEnforcedOption[] = [
    {
        msgType: 1,
        optionType:
            ExecutorOptionType.LZ_RECEIVE,
        gas: 500000,
        value: 0,
    },
]

// Our OFT tests successfully execute with 100k.
// Use 200k on testnet for additional execution headroom.

const TOKEN_OPTIONS: OAppEnforcedOption[] = [
    {
        msgType: 1,
        optionType:
            ExecutorOptionType.LZ_RECEIVE,
        gas: 200000,
        value: 0,
    },
]

// =============================================================
//                         PATHWAYS
// =============================================================

// TESTNET security configuration.
//
// One required LayerZero Labs DVN is sufficient for this
// portfolio/testnet deployment.
//
// A production deployment should use multiple independent
// required DVNs.

const pathways: TwoWayConfig[] = [
    // ---------------------------------------------------------
    // CrossChainRouter
    // Base Sepolia <-> Arbitrum Sepolia
    // ---------------------------------------------------------
    [
        baseRouter,
        arbitrumRouter,

        [
            ['LayerZero Labs'],
            [],
        ],

        [
            1,
            1,
        ],

        [
            ROUTER_OPTIONS,
            ROUTER_OPTIONS,
        ],
    ],

    // ---------------------------------------------------------
    // CrossChainToken OFT
    // Base Sepolia <-> Arbitrum Sepolia
    // ---------------------------------------------------------
    [
        baseToken,
        arbitrumToken,

        [
            ['LayerZero Labs'],
            [],
        ],

        [
            1,
            1,
        ],

        [
            TOKEN_OPTIONS,
            TOKEN_OPTIONS,
        ],
    ],
]

export default async function () {
    const connections =
        await generateConnectionsConfig(
            pathways
        )

    return {
        contracts: [
            {
                contract: baseRouter,
            },
            {
                contract: arbitrumRouter,
            },
            {
                contract: baseToken,
            },
            {
                contract: arbitrumToken,
            },
        ],

        connections,
    }
}