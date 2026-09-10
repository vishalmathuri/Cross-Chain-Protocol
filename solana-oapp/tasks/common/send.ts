import {
    publicKey,
    transactionBuilder,
} from '@metaplex-foundation/umi'
import { setComputeUnitLimit } from '@metaplex-foundation/mpl-toolbox'
import { task, types } from 'hardhat/config'
import { ActionType } from 'hardhat/types'
import {
    arrayify,
    hexZeroPad,
    isAddress,
    isHexString,
    toUtf8Bytes,
} from 'ethers/lib/utils'

import { myoapp } from '../../lib/client'
import {
    deriveConnection,
    getSolanaDeployment,
} from '../solana/index'

interface TaskArguments {
    fromEid: number
    dstEid: number
    receiver: string
    message: string
}

function parseReceiver(value: string): Uint8Array {
    // Ethereum address -> left-padded bytes32.
    if (isAddress(value)) {
        return Uint8Array.from(
            arrayify(
                hexZeroPad(value, 32)
            )
        )
    }

    // Already bytes32.
    if (
        isHexString(value) &&
        arrayify(value).length === 32
    ) {
        return Uint8Array.from(
            arrayify(value)
        )
    }

    throw new Error(
        'receiver must be either a valid Ethereum address or a 32-byte hex value'
    )
}

const action: ActionType<TaskArguments> = async ({
    fromEid,
    dstEid,
    receiver,
    message,
}) => {
    const deployment =
        getSolanaDeployment(fromEid)

    const {
        umi,
        umiWalletSigner,
    } = await deriveConnection(fromEid)

    const oapp =
        new myoapp.MyOApp(
            publicKey(
                deployment.programId
            )
        )

    const applicationReceiver =
        parseReceiver(receiver)

    const data =
        Uint8Array.from(
            toUtf8Bytes(message)
        )

    // Empty caller options.
    // The program combines these with configured
    // enforced LayerZero options.
    const options =
        new Uint8Array()

    console.log(
        '🔍 Quoting LayerZero fee...'
    )

    const fee =
        await oapp.quote(
            umi.rpc,
            umiWalletSigner.publicKey,
            {
                dstEid,
                receiver:
                    applicationReceiver,
                data,
                options,
                payInLzToken: false,
            }
        )

    console.log(
        '🔖 Native fee:',
        fee.nativeFee.toString()
    )

    const sendInstruction =
        await oapp.send(
            umi.rpc,

            // Important:
            // send() requires the complete UMI Signer,
            // not only its public key.
            umiWalletSigner,

            {
                dstEid,

                receiver:
                    applicationReceiver,

                data,
                options,

                nativeFee:
                    fee.nativeFee,

                lzTokenFee: 0n,
            }
        )

    let txBuilder =
        transactionBuilder()

    txBuilder = txBuilder.add(
        setComputeUnitLimit(
            umi,
            {
                units: 400_000,
            }
        )
    )

    txBuilder =
        txBuilder.add(
            sendInstruction
        )

    console.log(
        '🚀 Sending structured cross-chain message...'
    )

    const result =
        await txBuilder.sendAndConfirm(
            umi
        )

    const {
        default: bs58,
    } = await import('bs58')

    const signature =
        bs58.encode(
            result.signature
        )

    console.log(
        '✅ Solana transaction:',
        signature
    )

    console.log(
        '📨 Destination EID:',
        dstEid
    )

    console.log(
        '👤 Application receiver:',
        receiver
    )

    console.log(
        '💬 Payload:',
        message
    )
}

task(
    'lz:oapp:send:solana',
    'Send a structured message from Solana through the cross-chain protocol',
    action
)
    .addParam(
        'fromEid',
        'Solana source LayerZero endpoint ID',
        undefined,
        types.int
    )
    .addParam(
        'dstEid',
        'Destination LayerZero endpoint ID',
        undefined,
        types.int
    )
    .addParam(
        'receiver',
        'Application receiver: EVM address or bytes32',
        undefined,
        types.string
    )
    .addParam(
        'message',
        'UTF-8 application payload',
        undefined,
        types.string
    )