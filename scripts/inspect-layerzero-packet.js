require('dotenv').config()

const { ethers } = require('ethers')

const TX_HASH =
    '0xd3106079d13800336e948e526e6dbc0311dfd6976add1aadc5c12338942bf38f'

const ENDPOINT =
    '0x6EDCE65403992e310A62460808c4b910D972f10f'

const provider =
    new ethers.providers.JsonRpcProvider(
        process.env.RPC_URL_SEPOLIA
    )

const iface =
    new ethers.utils.Interface([
        'event PacketSent(bytes encodedPayload, bytes options, address sendLibrary)'
    ])

function hexSlice(bytes, start, end) {
    return ethers.utils.hexlify(
        bytes.slice(start, end)
    )
}

function uintBE(bytes) {
    return BigInt(
        ethers.utils.hexlify(bytes)
    )
}

async function main() {
    const receipt =
        await provider.getTransactionReceipt(
            TX_HASH
        )

    if (!receipt) {
        throw new Error(
            'Transaction receipt not found'
        )
    }

    console.log(
        'Transaction status:',
        receipt.status
    )

    console.log(
        'Block:',
        receipt.blockNumber
    )

    const endpointLogs =
        receipt.logs.filter(
            (log) =>
                log.address.toLowerCase() ===
                ENDPOINT.toLowerCase()
        )

    console.log(
        'Endpoint logs:',
        endpointLogs.length
    )

    let packet = null

    for (const log of endpointLogs) {
        try {
            const parsed =
                iface.parseLog(log)

            if (
                parsed.name ===
                'PacketSent'
            ) {
                packet = parsed.args

                break
            }
        } catch (_) {}
    }

    if (!packet) {
        throw new Error(
            'PacketSent event was not found'
        )
    }

    const encoded =
        ethers.utils.arrayify(
            packet.encodedPayload
        )

    console.log(
        '\n===== PACKET SENT ====='
    )

    console.log(
        'Encoded packet length:',
        encoded.length
    )

    console.log(
        'Options:',
        packet.options
    )

    console.log(
        'Send library:',
        packet.sendLibrary
    )

    // LayerZero PacketV1 layout:
    //
    // byte 0       version
    // 1..9         nonce
    // 9..13        srcEid
    // 13..45       sender bytes32
    // 45..49       dstEid
    // 49..81       receiver bytes32
    // 81..113      GUID
    // 113..end     message

    const version =
        encoded[0]

    const nonce =
        uintBE(
            encoded.slice(1, 9)
        )

    const srcEid =
        Number(
            uintBE(
                encoded.slice(9, 13)
            )
        )

    const sender =
        hexSlice(
            encoded,
            13,
            45
        )

    const dstEid =
        Number(
            uintBE(
                encoded.slice(45, 49)
            )
        )

    const receiver =
        hexSlice(
            encoded,
            49,
            81
        )

    const guid =
        hexSlice(
            encoded,
            81,
            113
        )

    const message =
        hexSlice(
            encoded,
            113,
            encoded.length
        )

    console.log(
        'Version:',
        version
    )

    console.log(
        'LayerZero nonce:',
        nonce.toString()
    )

    console.log(
        'Source EID:',
        srcEid
    )

    console.log(
        'Sender:',
        sender
    )

    console.log(
        'Destination EID:',
        dstEid
    )

    console.log(
        'Receiver:',
        receiver
    )

    console.log(
        'GUID:',
        guid
    )

    console.log(
        'LayerZero message length:',
        ethers.utils.arrayify(
            message
        ).length
    )

    const computedGuid =
        ethers.utils.keccak256(
            ethers.utils.solidityPack(
                [
                    'uint64',
                    'uint32',
                    'bytes32',
                    'uint32',
                    'bytes32',
                ],
                [
                    nonce,
                    srcEid,
                    sender,
                    dstEid,
                    receiver,
                ]
            )
        )

    console.log(
        'Computed GUID:',
        computedGuid
    )

    console.log(
        'GUID matches:',
        computedGuid.toLowerCase() ===
            guid.toLowerCase()
            ? 'PASS'
            : 'FAIL'
    )

    // Decode your application-level
    // CrossChainMessage.
    const decoded =
        ethers.utils.defaultAbiCoder.decode(
            [
                'uint8',
                'uint8',
                'uint64',
                'bytes32',
                'bytes32',
                'uint64',
                'bytes',
            ],
            message
        )

    console.log(
        '\n===== APPLICATION MESSAGE ====='
    )

    console.log(
        'version:',
        decoded[0]
    )

    console.log(
        'messageType:',
        decoded[1]
    )

    console.log(
        'app nonce:',
        decoded[2].toString()
    )

    console.log(
        'sender:',
        decoded[3]
    )

    console.log(
        'receiver:',
        decoded[4]
    )

    console.log(
        'timestamp:',
        decoded[5].toString()
    )

    console.log(
        'data:',
        ethers.utils.toUtf8String(
            decoded[6]
        )
    )

    console.log(
        '\nGUID_FOR_SCAN=' + guid
    )
}

main().catch((error) => {
    console.error(error)
    process.exitCode = 1
})