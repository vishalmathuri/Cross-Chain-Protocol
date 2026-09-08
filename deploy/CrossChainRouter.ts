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

    let remoteEid: number

    if (
        hre.network.name ===
        'base-sepolia'
    ) {
        remoteEid =
            EndpointId.ARBSEP_V2_TESTNET
    } else if (
        hre.network.name ===
        'arbitrum-sepolia'
    ) {
        remoteEid =
            EndpointId.BASESEP_V2_TESTNET
    } else {
        throw new Error(
            `Unsupported network: ${hre.network.name}`
        )
    }

    const signer =
        await ethers.getSigner(deployer)

    const router =
        await ethers.getContractAt(
            contractName,
            deployment.address,
            signer
        )

    console.log(
        `Configuring destination EID ${remoteEid}...`
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
        `Destination ${remoteEid} enabled: 100 messages/hour`
    )
}

deploy.tags = [
    'CrossChainRouter',
]

export default deploy