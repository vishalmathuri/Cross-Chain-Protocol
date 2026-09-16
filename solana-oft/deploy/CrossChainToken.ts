
import assert from 'assert'

import { utils } from 'ethers'
import { type DeployFunction } from 'hardhat-deploy/types'

const contractName = 'CrossChainToken'

const deploy: DeployFunction = async (hre) => {
    const {
        getNamedAccounts,
        deployments,
    } = hre

    const { deploy } = deployments

    const {
        deployer,
    } = await getNamedAccounts()

    assert(
        deployer,
        'Missing named deployer account'
    )

    const endpointV2Deployment =
        await hre.deployments.get(
            'EndpointV2'
        )

    const initialSupplyTokens =
        process.env.INITIAL_SUPPLY_CCT ||
        '100000'

    const initialSupply =
        utils
            .parseUnits(
                initialSupplyTokens,
                18
            )
            .toString()

    console.log(
        `Network: ${hre.network.name}`
    )

    console.log(
        `Deployer: ${deployer}`
    )

    console.log(
        `Endpoint V2: ${endpointV2Deployment.address}`
    )

    console.log(
        `Initial CCT supply: ${initialSupplyTokens}`
    )

    const { address } =
        await deploy(
            contractName,
            {
                from: deployer,

                args: [
                    'CrossChain Token',
                    'CCT',
                    endpointV2Deployment.address,
                    deployer,
                    deployer,
                    initialSupply,
                ],

                log: true,

                skipIfAlreadyDeployed:
                    false,
            }
        )

    console.log(
        `Deployed ${contractName}: ${address}`
    )
}

deploy.tags = [
    contractName,
]

export default deploy