require('dotenv').config()

const { ethers } = require('ethers')

const {
    PublicKey,
} = require('../solana-oapp/node_modules/@solana/web3.js')

const deployment =
    require('../deployments/sepolia/CrossChainRouter.json')

// ---------------------------------------------------------------------
// Verified Solana Devnet -> Ethereum Sepolia message
// ---------------------------------------------------------------------

const DESTINATION_TX =
    '0xb6e1a69676e6ad8c5570ddbe29ae8604e7e5284d90e430a99744058974c92f32'

const EXPECTED_GUID =
    '0xed86f0b1a5255d633d85765cc3490ae8529244528f71403e51cefc725dc9828b'

const SRC_EID = 40168

const APP_NONCE = 1

const SOLANA_SENDER =
    new PublicKey(
        'FfWFHtyP9Z1bfqxeyxZhYZX7YXXgQRnGkkuMXfuLZepS'
    )

const MESSAGE =
    'Hello from Solana Devnet to Ethereum Sepolia'

// ---------------------------------------------------------------------

function publicKeyBytes32(publicKey) {
    return (
        '0x' +
        Buffer
            .from(publicKey.toBytes())
            .toString('hex')
    )
}

function topicUint(value) {
    return ethers.utils.hexZeroPad(
        ethers.utils.hexlify(value),
        32
    )
}

async function main() {
    if (!process.env.RPC_URL_SEPOLIA) {
        throw new Error(
            'RPC_URL_SEPOLIA is not set'
        )
    }

    const provider =
        new ethers.providers.JsonRpcProvider(
            process.env.RPC_URL_SEPOLIA
        )

    const routerAddress =
        deployment.address

    const expectedSender =
        publicKeyBytes32(
            SOLANA_SENDER
        )

    const expectedReceiver =
        ethers.utils.hexZeroPad(
            routerAddress,
            32
        )

    console.log(
        '===== SOLANA -> ETHEREUM VERIFICATION ====='
    )

    console.log(
        'Destination transaction:',
        DESTINATION_TX
    )

    console.log(
        'Expected GUID:',
        EXPECTED_GUID
    )

    console.log(
        'Source EID:',
        SRC_EID
    )

    console.log(
        'Application nonce:',
        APP_NONCE
    )

    console.log(
        'Expected sender:',
        expectedSender
    )

    console.log(
        'Expected receiver:',
        expectedReceiver
    )

    console.log(
        'Expected message:',
        MESSAGE
    )

    // -------------------------------------------------------------
    // Verify successful Sepolia destination transaction.
    // -------------------------------------------------------------

    const receipt =
        await provider.getTransactionReceipt(
            DESTINATION_TX
        )

    if (!receipt) {
        throw new Error(
            'Destination transaction receipt was not found.'
        )
    }

    console.log(
        '\nTransaction block:',
        receipt.blockNumber
    )

    console.log(
        'Transaction status:',
        receipt.status
    )

    if (receipt.status !== 1) {
        throw new Error(
            'Destination transaction did not succeed.'
        )
    }

    // -------------------------------------------------------------
    // Find our MessageReceived-style router log.
    //
    // topics:
    //   [0] event signature
    //   [1] GUID
    //   [2] srcEid
    //   [3] application nonce
    //
    // data:
    //   sender bytes32
    //   receiver bytes32
    //   bytes payload
    // -------------------------------------------------------------

    const expectedSrcTopic =
        topicUint(SRC_EID)

    const expectedNonceTopic =
        topicUint(APP_NONCE)

    const routerLog =
        receipt.logs.find(
            (log) =>
                log.address.toLowerCase() ===
                    routerAddress.toLowerCase() &&
                log.topics.length >= 4 &&
                log.topics[1].toLowerCase() ===
                    EXPECTED_GUID.toLowerCase() &&
                log.topics[2].toLowerCase() ===
                    expectedSrcTopic.toLowerCase() &&
                log.topics[3].toLowerCase() ===
                    expectedNonceTopic.toLowerCase()
        )

    if (!routerLog) {
        throw new Error(
            'Expected router receive event was not found.'
        )
    }

    console.log(
        '\nRouter receive event: FOUND'
    )

    const [
        sender,
        receiver,
        payload,
    ] =
        ethers.utils.defaultAbiCoder.decode(
            [
                'bytes32',
                'bytes32',
                'bytes',
            ],
            routerLog.data
        )

    const decodedMessage =
        ethers.utils.toUtf8String(
            payload
        )

    console.log(
        'GUID:',
        routerLog.topics[1]
    )

    console.log(
        'Source EID:',
        ethers.BigNumber
            .from(routerLog.topics[2])
            .toString()
    )

    console.log(
        'Application nonce:',
        ethers.BigNumber
            .from(routerLog.topics[3])
            .toString()
    )

    console.log(
        'Sender:',
        sender
    )

    console.log(
        'Receiver:',
        receiver
    )

    console.log(
        'Message:',
        decodedMessage
    )

    if (
        sender.toLowerCase() !==
        expectedSender.toLowerCase()
    ) {
        throw new Error(
            'Application sender mismatch.'
        )
    }

    if (
        receiver.toLowerCase() !==
        expectedReceiver.toLowerCase()
    ) {
        throw new Error(
            'Application receiver mismatch.'
        )
    }

    if (
        decodedMessage !==
        MESSAGE
    ) {
        throw new Error(
            'Application payload mismatch.'
        )
    }

    // -------------------------------------------------------------
    // Supplemental current router state.
    //
    // Historical transaction verification above remains valid even
    // if newer messages are received later.
    // -------------------------------------------------------------

    const router =
        new ethers.Contract(
            routerAddress,
            deployment.abi,
            provider
        )

    const receivedCount =
        await router.receivedCount()

    const lastReceivedGuid =
        await router.lastReceivedGuid()

    console.log(
        '\nCurrent received count:',
        receivedCount.toString()
    )

    console.log(
        'Current last GUID:',
        lastReceivedGuid
    )

    if (
        receivedCount.lt(1)
    ) {
        throw new Error(
            'Router receivedCount is unexpectedly zero.'
        )
    }

    console.log(
        '\n============================================'
    )

    console.log(
        'SOLANA -> ETHEREUM VERIFICATION: PASS'
    )

    console.log(
        '============================================'
    )
}

main().catch((error) => {
    console.error(
        '\nSOLANA -> ETHEREUM VERIFICATION: FAIL'
    )

    console.error(error)

    process.exitCode = 1
})