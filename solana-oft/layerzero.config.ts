import {
    EndpointId,
} from '@layerzerolabs/lz-definitions'

import {
    ExecutorOptionType,
} from '@layerzerolabs/lz-v2-utilities'

import {
    generateConnectionsConfig,
} from '@layerzerolabs/metadata-tools'

import {
    OAppEnforcedOption,
    OmniPointHardhat,
} from '@layerzerolabs/toolbox-hardhat'

import {
    getOftStoreAddress,
} from './tasks/solana'

const ethereumContract: OmniPointHardhat = {
    eid:
        EndpointId.SEPOLIA_V2_TESTNET,

    contractName:
        'CrossChainToken',
}

const solanaContract: OmniPointHardhat = {
    eid:
        EndpointId.SOLANA_V2_TESTNET,

    address:
        getOftStoreAddress(
            EndpointId.SOLANA_V2_TESTNET
        ),
}

const EVM_ENFORCED_OPTIONS:
    OAppEnforcedOption[] = [
        {
            msgType: 1,

            optionType:
                ExecutorOptionType.LZ_RECEIVE,

            gas: 80000,

            value: 0,
        },
    ]

const CU_LIMIT =
    200000

const SPL_TOKEN_ACCOUNT_RENT_VALUE =
    2039280

const SOLANA_ENFORCED_OPTIONS:
    OAppEnforcedOption[] = [
        {
            msgType: 1,

            optionType:
                ExecutorOptionType.LZ_RECEIVE,

            gas:
                CU_LIMIT,

            value:
                SPL_TOKEN_ACCOUNT_RENT_VALUE,
        },
    ]

export default async function () {
    const connections =
        await generateConnectionsConfig([
            [
                ethereumContract,

                solanaContract,

                [
                    ['LayerZero Labs'],
                    [],
                ],

                [
                    15,
                    32,
                ],

                [
                    SOLANA_ENFORCED_OPTIONS,
                    EVM_ENFORCED_OPTIONS,
                ],
            ],
        ])

    return {
        contracts: [
            {
                contract:
                    ethereumContract,
            },

            {
                contract:
                    solanaContract,
            },
        ],

        connections,
    }
}