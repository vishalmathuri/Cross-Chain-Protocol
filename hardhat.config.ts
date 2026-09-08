import 'dotenv/config'

import 'hardhat-deploy'
import 'hardhat-contract-sizer'
import '@nomiclabs/hardhat-ethers'
import '@layerzerolabs/toolbox-hardhat'

import {
    HardhatUserConfig,
    HttpNetworkAccountsUserConfig,
} from 'hardhat/types'

import { EndpointId } from '@layerzerolabs/lz-definitions'

const MNEMONIC = process.env.MNEMONIC
const PRIVATE_KEY = process.env.PRIVATE_KEY

const accounts: HttpNetworkAccountsUserConfig | undefined =
    MNEMONIC
        ? { mnemonic: MNEMONIC }
        : PRIVATE_KEY
          ? [PRIVATE_KEY]
          : undefined

if (accounts == null) {
    console.warn(
        'Could not find MNEMONIC or PRIVATE_KEY environment variables. Deployment transactions will not be available.'
    )
}

const config: HardhatUserConfig = {
    paths: {
        cache: 'cache/hardhat',
    },

    solidity: {
        compilers: [
            {
                version: '0.8.22',
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 1000,
                    },
                },
            },
        ],
    },

    networks: {
        'base-sepolia': {
            eid: EndpointId.BASESEP_V2_TESTNET,
            url:
                process.env.RPC_URL_BASE_SEPOLIA ||
                'https://base-sepolia.gateway.tenderly.co',
            accounts,
        },

        'arbitrum-sepolia': {
            eid: EndpointId.ARBSEP_V2_TESTNET,
            url:
                process.env.RPC_URL_ARB_SEPOLIA ||
                'https://arbitrum-sepolia.gateway.tenderly.co',
            accounts,
        },

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