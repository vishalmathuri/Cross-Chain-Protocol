const crypto = require('crypto')
const { ethers } = require('ethers')

const {
    Connection,
    PublicKey,
} = require('../solana-oapp/node_modules/@solana/web3.js')

// ---------------------------------------------------------------------
// Known deployment values
// ---------------------------------------------------------------------

const SOLANA_RPC =
    'https://api.devnet.solana.com'

const PROGRAM_ID =
    new PublicKey(
        '86twc7j7pKySmWBV7pRBFkDkxqKs3bzJMjLCatjaKLSi'
    )

const STORE =
    new PublicKey(
        'EJoipsNGChK4NPichwUjDXKTeCQ5t9TkgY8Vce7NAnv5'
    )

const SRC_EID = 40161

const ROUTER =
    '0x355BD2bdF11D4B2528BC465422AB97EA9843f5a5'

const EVM_SENDER =
    '0x6495F4e6cf766Bd4CA23BB5CbB90d3CC625e87F2'

const APP_NONCE = 1

const MESSAGE =
    'Hello from Ethereum Sepolia to Solana Devnet'

// Store PDA as raw bytes32.
const SOLANA_RECEIVER =
    '0xc5b7a1acc6eea838c256de0231e20c5caa0da1d0887805894ffeb2d814cfc792'

// ---------------------------------------------------------------------

function hex(buffer) {
    return '0x' + Buffer.from(buffer).toString('hex')
}

function bytes32Address(address) {
    return ethers.utils.hexZeroPad(address, 32)
}

function readU64LE(buffer, offset) {
    return buffer.readBigUInt64LE(offset)
}

async function sleep(ms) {
    return new Promise((resolve) =>
        setTimeout(resolve, ms)
    )
}

async function main() {
    const connection =
        new Connection(
            SOLANA_RPC,
            'confirmed'
        )

    const sourceRouter =
        bytes32Address(ROUTER)

    const expectedSender =
        bytes32Address(EVM_SENDER)

    // Solidity:
    //
    // keccak256(
    //     abi.encode(
    //         srcEid,
    //         sourceRouter,
    //         applicationNonce
    //     )
    // )
    const encoded =
        ethers.utils.defaultAbiCoder.encode(
            [
                'uint32',
                'bytes32',
                'uint64',
            ],
            [
                SRC_EID,
                sourceRouter,
                APP_NONCE,
            ]
        )

    const messageId =
        ethers.utils.keccak256(encoded)

    const messageIdBytes =
        Buffer.from(
            ethers.utils.arrayify(
                messageId
            )
        )

    const [
        receiptPda,
        receiptBump,
    ] =
        PublicKey.findProgramAddressSync(
            [
                Buffer.from(
                    'ReceivedMessage'
                ),
                messageIdBytes,
            ],
            PROGRAM_ID
        )

    const expectedData =
        ethers.utils.toUtf8Bytes(
            MESSAGE
        )

    const expectedDataHash =
        ethers.utils.keccak256(
            expectedData
        )

    console.log(
        'Source EID:',
        SRC_EID
    )

    console.log(
        'Source router bytes32:',
        sourceRouter
    )

    console.log(
        'Application nonce:',
        APP_NONCE
    )

    console.log(
        'Logical message ID:',
        messageId
    )

    console.log(
        'Expected receipt PDA:',
        receiptPda.toBase58()
    )

    console.log(
        'Receipt bump:',
        receiptBump
    )

    console.log(
        'Expected data hash:',
        expectedDataHash
    )

    console.log(
        'Expected data length:',
        expectedData.length
    )

    // -------------------------------------------------------------
    // Wait up to 3 minutes for LayerZero destination execution.
    // -------------------------------------------------------------

    let account = null

    for (
        let attempt = 1;
        attempt <= 18;
        attempt++
    ) {
        account =
            await connection.getAccountInfo(
                receiptPda,
                'confirmed'
            )

        if (account) {
            console.log(
                `\nReceipt found on attempt ${attempt}.`
            )
            break
        }

        console.log(
            `Waiting for destination execution... ${attempt}/18`
        )

        await sleep(10_000)
    }

    if (!account) {
        throw new Error(
            'ReceivedMessage PDA was not found after 3 minutes.'
        )
    }

    console.log(
        'Receipt owner:',
        account.owner.toBase58()
    )

    console.log(
        'Receipt size:',
        account.data.length
    )

    console.log(
        'Receipt lamports:',
        account.lamports
    )

    if (
        !account.owner.equals(
            PROGRAM_ID
        )
    ) {
        throw new Error(
            'Receipt owner does not match OApp program.'
        )
    }

    if (
        account.data.length !== 227
    ) {
        throw new Error(
            `Unexpected receipt size: ${account.data.length}`
        )
    }

    const data = account.data

    // Anchor discriminator:
    // sha256("account:ReceivedMessage")[0..8]
    const expectedDiscriminator =
        crypto
            .createHash('sha256')
            .update(
                'account:ReceivedMessage'
            )
            .digest()
            .subarray(0, 8)

    const discriminator =
        data.subarray(0, 8)

    if (
        !discriminator.equals(
            expectedDiscriminator
        )
    ) {
        throw new Error(
            'Invalid ReceivedMessage account discriminator.'
        )
    }

    // -------------------------------------------------------------
    // Borsh layout for compact ReceivedMessage
    //
    //  0..8     discriminator
    //  8..12    src_eid
    // 12..44    source_oapp
    // 44..76    guid
    // 76..108   message_id
    // 108       version
    // 109       message_type
    // 110..118  nonce
    // 118..150  sender
    // 150..182  receiver
    // 182..190  timestamp
    // 190..222  data_hash
    // 222..226  data_len
    // 226       bump
    // -------------------------------------------------------------

    const receipt = {
        srcEid:
            data.readUInt32LE(8),

        sourceOApp:
            hex(
                data.subarray(
                    12,
                    44
                )
            ),

        guid:
            hex(
                data.subarray(
                    44,
                    76
                )
            ),

        messageId:
            hex(
                data.subarray(
                    76,
                    108
                )
            ),

        version:
            data.readUInt8(108),

        messageType:
            data.readUInt8(109),

        nonce:
            readU64LE(
                data,
                110
            ),

        sender:
            hex(
                data.subarray(
                    118,
                    150
                )
            ),

        receiver:
            hex(
                data.subarray(
                    150,
                    182
                )
            ),

        timestamp:
            readU64LE(
                data,
                182
            ),

        dataHash:
            hex(
                data.subarray(
                    190,
                    222
                )
            ),

        dataLen:
            data.readUInt32LE(
                222
            ),

        bump:
            data.readUInt8(226),
    }

    console.log(
        '\n===== RECEIVED MESSAGE ====='
    )

    console.log(
        'srcEid:',
        receipt.srcEid
    )

    console.log(
        'sourceOApp:',
        receipt.sourceOApp
    )

    console.log(
        'guid:',
        receipt.guid
    )

    console.log(
        'messageId:',
        receipt.messageId
    )

    console.log(
        'version:',
        receipt.version
    )

    console.log(
        'messageType:',
        receipt.messageType
    )

    console.log(
        'nonce:',
        receipt.nonce.toString()
    )

    console.log(
        'sender:',
        receipt.sender
    )

    console.log(
        'receiver:',
        receipt.receiver
    )

    console.log(
        'timestamp:',
        receipt.timestamp.toString()
    )

    console.log(
        'dataHash:',
        receipt.dataHash
    )

    console.log(
        'dataLen:',
        receipt.dataLen
    )

    console.log(
        'bump:',
        receipt.bump
    )

    // -------------------------------------------------------------
    // Verify receipt contents.
    // -------------------------------------------------------------

    const checks = {
        srcEid:
            receipt.srcEid ===
            SRC_EID,

        sourceOApp:
            receipt.sourceOApp
                .toLowerCase() ===
            sourceRouter
                .toLowerCase(),

        messageId:
            receipt.messageId
                .toLowerCase() ===
            messageId
                .toLowerCase(),

        version:
            receipt.version === 1,

        messageType:
            receipt.messageType === 1,

        nonce:
            receipt.nonce ===
            BigInt(APP_NONCE),

        sender:
            receipt.sender
                .toLowerCase() ===
            expectedSender
                .toLowerCase(),

        receiver:
            receipt.receiver
                .toLowerCase() ===
            SOLANA_RECEIVER
                .toLowerCase(),

        dataHash:
            receipt.dataHash
                .toLowerCase() ===
            expectedDataHash
                .toLowerCase(),

        dataLen:
            receipt.dataLen ===
            expectedData.length,

        pdaBump:
            receipt.bump ===
            receiptBump,
    }

    console.log(
        '\n===== RECEIPT CHECKS ====='
    )

    for (
        const [name, passed]
        of Object.entries(checks)
    ) {
        console.log(
            `${name}:`,
            passed ? 'PASS' : 'FAIL'
        )
    }

    if (
        !Object.values(checks)
            .every(Boolean)
    ) {
        throw new Error(
            'One or more receipt checks failed.'
        )
    }

    // -------------------------------------------------------------
    // Decode Store counters.
    // -------------------------------------------------------------

    const storeAccount =
        await connection.getAccountInfo(
            STORE,
            'confirmed'
        )

    if (!storeAccount) {
        throw new Error(
            'Store PDA not found.'
        )
    }

    if (
        storeAccount.data.length !== 153
    ) {
        throw new Error(
            `Unexpected Store size: ${storeAccount.data.length}`
        )
    }

    // Store:
    //
    // discriminator              0..8
    // admin                      8..40
    // bump                       40
    // endpoint_program           41..73
    // outbound_nonce             73..81
    // received_count             81..89
    // last_received_guid         89..121
    // last_received_message_id   121..153

    const storeOutboundNonce =
        readU64LE(
            storeAccount.data,
            73
        )

    const receivedCount =
        readU64LE(
            storeAccount.data,
            81
        )

    const lastGuid =
        hex(
            storeAccount.data.subarray(
                89,
                121
            )
        )

    const lastMessageId =
        hex(
            storeAccount.data.subarray(
                121,
                153
            )
        )

    console.log(
        '\n===== STORE ====='
    )

    console.log(
        'outboundNonce:',
        storeOutboundNonce.toString()
    )

    console.log(
        'receivedCount:',
        receivedCount.toString()
    )

    console.log(
        'lastReceivedGuid:',
        lastGuid
    )

    console.log(
        'lastReceivedMessageId:',
        lastMessageId
    )

    console.log(
        '\nStore message ID matches:',
        lastMessageId.toLowerCase()
            === messageId.toLowerCase()
            ? 'PASS'
            : 'FAIL'
    )

    console.log(
        'Store GUID matches receipt:',
        lastGuid.toLowerCase()
            === receipt.guid.toLowerCase()
            ? 'PASS'
            : 'FAIL'
    )

    console.log(
        '\n✅ Sepolia → Solana delivery verified.'
    )
}

main().catch((error) => {
    console.error(
        '\nVerification failed:'
    )

    console.error(
        error.message ||
        error
    )

    process.exitCode = 1
})