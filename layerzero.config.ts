import { EndpointId } from '@layerzerolabs/lz-definitions'

import {
    ExecutorOptionType,
} from '@layerzerolabs/lz-v2-utilities'

import {
    generateConnectionsConfig,
} from '@layerzerolabs/metadata-tools'

import type {
    OAppEnforcedOption,
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
// IMPORTANT:
//
// The Solana LayerZero OApp identity is the Store PDA,
// NOT the Anchor program ID.
//
// Anchor Program:
// 86twc7j7pKySmWBV7pRBFkDkxqKs3bzJMjLCatjaKLSi
//
// OApp Store PDA:
// EJoipsNGChK4NPichwUjDXKTeCQ5t9TkgY8Vce7NAnv5
//

const solanaOApp: OmniPointHardhat = {
    eid: EndpointId.SOLANA_V2_TESTNET,

    address:
        'EJoipsNGChK4NPichwUjDXKTeCQ5t9TkgY8Vce7NAnv5',
}

// =============================================================
//                 ETHEREUM RECEIVE OPTIONS
// =============================================================
//
// These options are used when a message is delivered TO
// Ethereum Sepolia.
//
// Our CrossChainRouter uses:
//     SEND_MESSAGE = 1
//
// 500,000 gas is intentionally conservative for the first
// cross-chain integration tests.
//
// We will profile this later before considering the protocol
// production-ready.
//

const EVM_ENFORCED_OPTIONS: OAppEnforcedOption[] = [
    {
        msgType: 1,

        optionType:
            ExecutorOptionType.LZ_RECEIVE,

        gas: 500_000,

        value: 0,
    },
]

// =============================================================
//                  SOLANA RECEIVE OPTIONS
// =============================================================
//
// On Solana:
//     gas   = compute units
//     value = lamports
//
// We enforce the compute budget here.
//
// value remains 0 for now because our Solana lz_receive creates
// a ReceivedMessage PDA. Before sending the first real
// Ethereum -> Solana message, we will calculate the exact SOL
// required for that PDA and supply it using per-message
// extraOptions.
//
// This prevents us from guessing the account-rent requirement.
//

const SOLANA_ENFORCED_OPTIONS: OAppEnforcedOption[] = [
    {
        msgType: 1,

        optionType:
            ExecutorOptionType.LZ_RECEIVE,

        gas: 500_000,

        value: 1_803_400,
    },
]

// =============================================================
//                    LAYERZERO CONFIG
// =============================================================
//
// generateConnectionsConfig automatically creates:
//
// Ethereum Sepolia -> Solana Devnet
//
// AND
//
// Solana Devnet -> Ethereum Sepolia
//
// We therefore define this pathway only once.
//
// Testnet security configuration:
//     Required DVN: LayerZero Labs
//     Confirmations: 1 / 1
//
// For a production deployment we should use multiple
// independent required DVNs.
//

export default async function () {
    const connections =
        await generateConnectionsConfig([
            [
                // Chain A
                sepoliaRouter,

                // Chain B
                solanaOApp,

                // Security stack:
                //
                // [
                //   required DVNs,
                //   optional DVNs configuration
                // ]
                [
                    ['LayerZero Labs'],
                    [],
                ],

                // Confirmations:
                //
                // [
                //   Ethereum -> Solana,
                //   Solana -> Ethereum
                // ]
                [
                    1,
                    1,
                ],

                // Enforced destination options:
                //
                // [
                //   options when delivering TO Solana,
                //   options when delivering TO Ethereum
                // ]
                [
                    SOLANA_ENFORCED_OPTIONS,
                    EVM_ENFORCED_OPTIONS,
                ],
            ],
        ])

    return {
        contracts: [
            {
                contract: sepoliaRouter,
            },
            {
                contract: solanaOApp,
            },
        ],

        connections,
    }
}