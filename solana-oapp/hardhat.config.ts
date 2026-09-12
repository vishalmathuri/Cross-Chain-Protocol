// Force ts-node to use CommonJS mode
// This must be set before any imports.
process.env.TS_NODE_COMPILER_OPTIONS = JSON.stringify({
    module: 'commonjs',
    esModuleInterop: true,
})

import 'dotenv/config'

import 'hardhat-deploy'
import '@nomicfoundation/hardhat-ethers'
import 'hardhat-contract-sizer'
import '@nomiclabs/hardhat-ethers'
import 'hardhat-deploy-ethers'
import '@layerzerolabs/toolbox-hardhat'

import {
    HardhatUserConfig,
    HttpNetworkAccountsUserConfig,
} from 'hardhat/types'

import {
    EndpointId,
} from '@layerzerolabs/lz-definitions'

import './tasks/index'

// =============================================================
//                       ACCOUNTS
// =============================================================

const MNEMONIC =
    process.env.MNEMONIC

const PRIVATE_KEY =
    process.env.PRIVATE_KEY

const accounts:
    | HttpNetworkAccountsUserConfig
    | undefined =
    MNEMONIC
        ? {
              mnemonic: MNEMONIC,
          }
        : PRIVATE_KEY
          ? [PRIVATE_KEY]
          : undefined

if (accounts == null) {
    console.warn(
        'Could not find MNEMONIC or PRIVATE_KEY environment variables. EVM transactions will not be available.'
    )
}

// =============================================================
//                    HARDHAT CONFIG
// =============================================================

const config: HardhatUserConfig = {
    paths: {
        cache: 'cache/hardhat',

        // IMPORTANT:
        //
        // Ethereum Sepolia deployments live in the root project:
        //
        // Cross-Chain-Protocol/deployments/sepolia/
        //
        // This lets the Solana Hardhat tooling resolve:
        //
        // CrossChainRouter
        // 0x355BD2bdF11D4B2528BC465422AB97EA9843f5a5
        //
        deployments: '../deployments',
    },

    solidity: {
        compilers: [
            {
                version: '0.8.22',

                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 200,
                    },
                },
            },
        ],
    },

    networks: {
        // =====================================================
        //                 ETHEREUM SEPOLIA
        // =====================================================

        sepolia: {
            eid:
                EndpointId.SEPOLIA_V2_TESTNET,

            url:
                process.env.RPC_URL_SEPOLIA ||
                'https://ethereum-sepolia-rpc.publicnode.com',

            accounts,
        },

        // =====================================================
        //                      LOCAL
        // =====================================================

        hardhat: {
            allowUnlimitedContractSize: true,
        },
    },

    namedAccounts: {
        deployer: {
            default: 0,
        },
    },
}

export default config