import fs from 'node:fs'

import {
    publicKey,
} from '@metaplex-foundation/umi'

import {
    lzReceive,
} from '@layerzerolabs/lz-solana-sdk-v2/umi'

import {
    deriveConnection,
} from '../tasks/solana'

const STORE =
    'EJoipsNGChK4NPichwUjDXKTeCQ5t9TkgY8Vce7NAnv5'

const PROGRAM =
    '86twc7j7pKySmWBV7pRBFkDkxqKs3bzJMjLCatjaKLSi'

const PAYER =
    'FfWFHtyP9Z1bfqxeyxZhYZX7YXXgQRnGkkuMXfuLZepS'

const SOURCE_ROUTER_BYTES32 =
    '0x000000000000000000000000355bd2bdf11d4b2528bc465422ab97ea9843f5a5'

const GUID =
    '0xebf7a50a51b610d755296cb7eba5baacfc6ba669352185766a32e72b0d753c43'

async function main() {
    const scan = JSON.parse(
        fs.readFileSync(
            '/tmp/lz-blocked.json',
            'utf8'
        )
    )

    const message = scan.data?.[0]

    if (!message) {
        throw new Error(
            'LayerZero Scan JSON contains no message.'
        )
    }

    const payload =
        message.source?.tx?.payload

    if (!payload) {
        throw new Error(
            'Could not find source.tx.payload in Scan response.'
        )
    }

    console.log(
        '===== PACKET ====='
    )

    console.log(
        'srcEid:',
        message.pathway.srcEid
    )

    console.log(
        'LayerZero nonce:',
        message.pathway.nonce
    )

    console.log(
        'sender:',
        SOURCE_ROUTER_BYTES32
    )

    console.log(
        'receiver:',
        STORE
    )

    console.log(
        'GUID:',
        GUID
    )

    console.log(
        'payload bytes:',
        (payload.length - 2) / 2
    )

    // Read-only mode.
    const {
        umi,
    } = await deriveConnection(
        40168,
        true
    )

    console.log(
        '\n===== RECEIVER ACCOUNT ====='
    )

    const receiver =
        publicKey(STORE)

    const receiverInfo =
        await umi.rpc.getAccount(
            receiver,
            {
                commitment: 'confirmed',
            }
        )

    console.log(
        'exists:',
        receiverInfo.exists
    )

    if (!receiverInfo.exists) {
        throw new Error(
            'Store PDA is not visible through the Umi RPC.'
        )
    }

    console.log(
        'owner:',
        receiverInfo.owner
    )

    console.log(
        'expected owner:',
        PROGRAM
    )

    console.log(
        'owner matches:',
        String(receiverInfo.owner) === PROGRAM
            ? 'PASS'
            : 'FAIL'
    )

    console.log(
        '\n===== LAYERZERO SDK DISCOVERY ====='
    )

    // This performs account discovery / simulation only.
    // It does NOT submit a Solana transaction.
    const plan =
        await lzReceive(
            umi.rpc,
            publicKey(PAYER),
            {
                srcEid:
                    message.pathway.srcEid,

                nonce:
                    String(
                        message.pathway.nonce
                    ),

                sender:
                    SOURCE_ROUTER_BYTES32,

                receiver:
                    STORE,

                guid:
                    GUID,

                message:
                    payload,
            }
        )

    console.log(
        '\n✅ LayerZero SDK lzReceive discovery succeeded.'
    )

    console.log(
        'contextVersion:',
        (plan as any).contextVersion
    )

    console.log(
        'V2 execution plan:',
        Array.isArray(
            (plan as any).instructions
        )
            ? 'YES'
            : 'NO'
    )

    if (
        Array.isArray(
            (plan as any).instructions
        )
    ) {
        console.log(
            'instruction count:',
            (plan as any)
                .instructions.length
        )
    }

    console.log(
        '\n===== FULL PLAN ====='
    )

    console.dir(
        plan,
        {
            depth: null,
        }
    )
}

main().catch((error: any) => {
    console.error(
        '\n❌ LayerZero SDK discovery failed.'
    )

    console.error(error)

    if (error?.logs) {
        console.error(
            '\n===== SIMULATION LOGS ====='
        )

        for (
            const line
            of error.logs
        ) {
            console.error(line)
        }
    }

    process.exitCode = 1
})