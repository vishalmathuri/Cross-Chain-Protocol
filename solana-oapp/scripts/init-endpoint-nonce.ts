import {
    publicKey,
    transactionBuilder,
} from '@metaplex-foundation/umi'

import {
    arrayify,
    hexZeroPad,
} from 'ethers/lib/utils'

import {
    myoapp,
} from '../lib/client'

import {
    deriveConnection,
    getSolanaDeployment,
} from '../tasks/solana'

const SOLANA_EID = 40168
const REMOTE_EID = 40161

const REMOTE_OAPP =
    '0x355BD2bdF11D4B2528BC465422AB97EA9843f5a5'

async function main() {
    const deployment =
        getSolanaDeployment(
            SOLANA_EID
        )

    console.log(
        '===== PATHWAY ====='
    )

    console.log(
        'Solana OApp:',
        deployment.oapp
    )

    console.log(
        'Remote EID:',
        REMOTE_EID
    )

    console.log(
        'Remote OApp:',
        REMOTE_OAPP
    )

    const {
        umi,
        umiWalletSigner,
    } = await deriveConnection(
        SOLANA_EID
    )

    console.log(
        'Delegate/payer:',
        umiWalletSigner.publicKey
    )

    const remoteOAppBytes =
        Uint8Array.from(
            arrayify(
                hexZeroPad(
                    REMOTE_OAPP,
                    32
                )
            )
        )

    const instruction =
        myoapp.initOAppNonce(
            {
                admin:
                    umiWalletSigner,

                oapp:
                    publicKey(
                        deployment.oapp
                    ),
            },

            REMOTE_EID,

            remoteOAppBytes
        )

    console.log(
        '\nInitializing LayerZero Endpoint nonce accounts...'
    )

    const result =
        await transactionBuilder()
            .add(instruction)
            .sendAndConfirm(umi)

    const {
        default: bs58,
    } = await import('bs58')

    console.log(
        '\n✅ Endpoint nonce initialized'
    )

    console.log(
        'Transaction:',
        bs58.encode(
            result.signature
        )
    )
}

main().catch((error) => {
    console.error(
        '\n❌ Endpoint nonce initialization failed'
    )

    console.error(error)

    process.exitCode = 1
})
