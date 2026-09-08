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

    console.log(
        `Network: ${hre.network.name}`
    )

    console.log(
        `Deployer: ${deployer}`
    )

    const endpointV2Deployment =
        await get('EndpointV2')

    let initialHolder: string
    let initialSupply

    if (
        hre.network.name ===
        'base-sepolia'
    ) {
        initialHolder = deployer

        initialSupply =
            ethers.utils.parseEther(
                '1000000'
            )
    } else if (
        hre.network.name ===
        'arbitrum-sepolia'
    ) {
        initialHolder =
            ethers.constants.AddressZero

        initialSupply = 0
    } else {
        throw new Error(
            `Unsupported network: ${hre.network.name}`
        )
    }

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

    if (
        hre.network.name ===
        'base-sepolia'
    ) {
        console.log(
            'Initial supply: 1,000,000 CCT'
        )
    } else {
        console.log(
            'Initial supply: 0 CCT'
        )
    }
}

deploy.tags = [
    'CrossChainToken',
]

export default deploy