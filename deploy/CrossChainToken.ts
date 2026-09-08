import assert from 'assert'

import { type DeployFunction } from 'hardhat-deploy/types'

const contractName = 'CrossChainToken'

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
            `Unsupported network: ${hre.network.name}. CrossChainToken EVM deployment is intended for Ethereum Sepolia.`
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

    const initialHolder =
        deployer

    const initialSupply =
        ethers.utils.parseEther(
            '1000000'
        )

    const deployment =
        await deploy(contractName, {
            from: deployer,

            args: [
                'Cross Chain Token',
                'CCT',
                endpointV2Deployment.address,
                deployer,
                initialHolder,
                initialSupply,
            ],

            log: true,

            skipIfAlreadyDeployed: true,
        })

    console.log(
        `CrossChainToken deployed: ${deployment.address}`
    )

    console.log(
        'Initial supply: 1,000,000 CCT on Ethereum Sepolia'
    )
}

deploy.tags = [
    'CrossChainToken',
]

export default deploy