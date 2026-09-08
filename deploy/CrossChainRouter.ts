import assert from 'assert'

import { EndpointId } from '@layerzerolabs/lz-definitions'
import { type DeployFunction } from 'hardhat-deploy/types'

const contractName = 'CrossChainRouter'

const deploy: DeployFunction = async (hre) => {
    const {
        getNamedAccounts,
        deployments,
        ethers,
    } = hre

    const { deploy, get } = deployments

    const { deployer } =
        await getNamedAccounts()

    assert(
        deployer,
        'Missing named deployer account'
    )

    if (hre.network.name !== 'sepolia') {
        throw new Error(
            `Unsupported network: ${hre.network.name}. CrossChainRouter EVM deployment is intended for Ethereum Sepolia.`
        )
    }

    console.log(
        `Network: ${hre.network.name}`
    )

    console.log(
        `Deployer: ${deployer}`
    )

    const endpointV2Deployment =
        await get('EndpointV2')

    const deployment =
        await deploy(contractName, {
            from: deployer,

            args: [
                endpointV2Deployment.address,
                deployer,
            ],

            log: true,

            skipIfAlreadyDeployed: true,
        })

    console.log(
        `CrossChainRouter deployed: ${deployment.address}`
    )

    const remoteEid =
        EndpointId.SOLANA_V2_TESTNET

    const signer =
        await ethers.getSigner(deployer)

    const router =
        await ethers.getContractAt(
            contractName,
            deployment.address,
            signer
        )

    console.log(
        `Configuring Solana Devnet destination EID ${remoteEid}...`
    )

    const tx =
        await router.configureDestination(
            remoteEid,
            true,
            100,
            3600
        )

    await tx.wait()

    console.log(
        `Solana Devnet destination ${remoteEid} enabled: 100 messages/hour`
    )
}

deploy.tags = [
    'CrossChainRouter',
]

export default deploy