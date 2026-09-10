import { readFileSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'

import {
    createSignerFromKeypair,
    publicKey,
    signerIdentity,
    transactionBuilder,
} from '@metaplex-foundation/umi'

import { createUmi } from '@metaplex-foundation/umi-bundle-defaults'

import { MyOApp } from '../lib/client/myoapp'

const PROGRAM_ID =
    '86twc7j7pKySmWBV7pRBFkDkxqKs3bzJMjLCatjaKLSi'

const EXPECTED_INITIALIZER =
    'FfWFHtyP9Z1bfqxeyxZhYZX7YXXgQRnGkkuMXfuLZepS'

const RPC_URL =
    process.env.RPC_URL_SOLANA_TESTNET ??
    'https://api.devnet.solana.com'

const KEYPAIR_PATH =
    process.env.SOLANA_KEYPAIR_PATH ??
    join(
        homedir(),
        '.config',
        'solana',
        'id.json'
    )

async function main() {
    console.log('RPC:', RPC_URL)
    console.log('Program:', PROGRAM_ID)
    console.log('Keypair path:', KEYPAIR_PATH)

    const umi = createUmi(RPC_URL)

    const secretKey = Uint8Array.from(
        JSON.parse(
            readFileSync(
                KEYPAIR_PATH,
                'utf8'
            )
        )
    )

    const keypair =
        umi.eddsa.createKeypairFromSecretKey(
            secretKey
        )

    const signer =
        createSignerFromKeypair(
            umi,
            keypair
        )

    if (
        signer.publicKey.toString() !==
        EXPECTED_INITIALIZER
    ) {
        throw new Error(
            `Wrong initialization wallet.

Expected:
${EXPECTED_INITIALIZER}

Got:
${signer.publicKey}`
        )
    }

    umi.use(
        signerIdentity(signer)
    )

    const oapp =
        new MyOApp(
            publicKey(PROGRAM_ID),
            undefined,
            umi.rpc
        )

    const [storePda] =
        oapp.pda.oapp()

    const [receiveTypesPda] =
        oapp.pda
            .lzReceiveTypesAccounts()

    console.log(
        'Initializer:',
        signer.publicKey
    )

    console.log(
        'Store PDA:',
        storePda
    )

    console.log(
        'LzReceiveTypes PDA:',
        receiveTypesPda
    )

    const existingStore =
        await oapp.getStore(
            umi.rpc
        )

    if (existingStore) {
        console.log(
            'Store is already initialized.'
        )

        console.log(
            'Admin:',
            existingStore.admin
        )

        console.log(
            'Endpoint:',
            existingStore.endpointProgram
        )

        console.log(
            'Outbound nonce:',
            existingStore.outboundNonce.toString()
        )

        console.log(
            'Received count:',
            existingStore.receivedCount.toString()
        )

        return
    }

    console.log(
        'Store does not exist. Initializing...'
    )

    const initInstruction =
        oapp.initStore(
            signer,
            signer.publicKey
        )

    const builder =
        transactionBuilder()
            .add(initInstruction)

    const result =
        await builder.sendAndConfirm(
            umi,
            {
                confirm: {
                    commitment: 'confirmed',
                },
            }
        )

    console.log(
        'Initialization transaction confirmed.'
    )

    console.log(
        'Signature bytes:',
        Buffer.from(
            result.signature
        ).toString('hex')
    )

    const store =
        await oapp.getStore(
            umi.rpc,
            'confirmed'
        )

    if (!store) {
        throw new Error(
            'Initialization transaction succeeded but Store could not be fetched.'
        )
    }

    console.log('')
    console.log(
        '✅ OApp Store initialized'
    )

    console.log(
        'Store:',
        storePda
    )

    console.log(
        'Admin:',
        store.admin
    )

    console.log(
        'Endpoint:',
        store.endpointProgram
    )

    console.log(
        'Outbound nonce:',
        store.outboundNonce.toString()
    )

    console.log(
        'Received count:',
        store.receivedCount.toString()
    )
}

main().catch((error) => {
    console.error(
        '❌ Store initialization failed'
    )

    console.error(error)

    process.exit(1)
})