require('dotenv').config()

const { ethers } = require('ethers')

const deployment =
    require('../deployments/sepolia/CrossChainRouter.json')

const DST_EID = 40168

// Solana OApp Store PDA represented as bytes32.
const SOLANA_RECEIVER =
    '0xc5b7a1acc6eea838c256de0231e20c5caa0da1d0887805894ffeb2d814cfc792'

const MESSAGE =
    'Hello from Ethereum Sepolia to Solana Devnet'

async function main() {
    if (!process.env.RPC_URL_SEPOLIA) {
        throw new Error('RPC_URL_SEPOLIA is not set')
    }

    if (!process.env.PRIVATE_KEY) {
        throw new Error('PRIVATE_KEY is not set')
    }

    const provider =
        new ethers.providers.JsonRpcProvider(
            process.env.RPC_URL_SEPOLIA
        )

    const wallet =
        new ethers.Wallet(
            process.env.PRIVATE_KEY,
            provider
        )

    const router =
        new ethers.Contract(
            deployment.address,
            deployment.abi,
            wallet
        )

    console.log(
        'Router:',
        deployment.address
    )

    console.log(
        'Sender:',
        wallet.address
    )

    console.log(
        'Destination EID:',
        DST_EID
    )

    console.log(
        'Solana receiver:',
        SOLANA_RECEIVER
    )

    console.log(
        'Message:',
        MESSAGE
    )

    const data =
        ethers.utils.toUtf8Bytes(MESSAGE)

    // Enforced LayerZero execution options are already
    // configured on-chain, so no extra options are needed.
    const extraOptions = '0x'

    const nonceBefore =
        await router.outboundNonce()

    console.log(
        'Outbound nonce before:',
        nonceBefore.toString()
    )

    const fee =
        await router.quoteMessage(
            DST_EID,
            SOLANA_RECEIVER,
            data,
            extraOptions
        )

    const nativeFee =
        fee.nativeFee !== undefined
            ? fee.nativeFee
            : fee[0]

    const lzTokenFee =
        fee.lzTokenFee !== undefined
            ? fee.lzTokenFee
            : fee[1]

    console.log(
        'Native fee:',
        ethers.utils.formatEther(nativeFee),
        'ETH'
    )

    console.log(
        'Native fee wei:',
        nativeFee.toString()
    )

    console.log(
        'LZ token fee:',
        lzTokenFee.toString()
    )

    console.log(
        '\nSending message...'
    )

    const tx =
        await router.sendMessage(
            DST_EID,
            SOLANA_RECEIVER,
            data,
            extraOptions,
            {
                value: nativeFee,
            }
        )

    console.log(
        'Sepolia transaction:',
        tx.hash
    )

    console.log(
        'Waiting for confirmation...'
    )

    const receipt =
        await tx.wait()

    console.log(
        'Transaction status:',
        receipt.status
    )

    console.log(
        'Block:',
        receipt.blockNumber
    )

    const nonceAfter =
        await router.outboundNonce()

    console.log(
        'Outbound nonce after:',
        nonceAfter.toString()
    )

    console.log(
        '\nMessage submitted to LayerZero successfully.'
    )
}

main().catch((error) => {
    console.error(error)
    process.exitCode = 1
})