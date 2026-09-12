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

import {
    arrayify,
    hexZeroPad,
    isAddress,
} from 'ethers/lib/utils'

import { MyOApp, accounts } from '../lib/client/myoapp'

// =============================================================
//                       CONFIGURATION
// =============================================================

const PROGRAM_ID =
    '86twc7j7pKySmWBV7pRBFkDkxqKs3bzJMjLCatjaKLSi'

const EXPECTED_ADMIN =
    'FfWFHtyP9Z1bfqxeyxZhYZX7YXXgQRnGkkuMXfuLZepS'

const ETHEREUM_SEPOLIA_EID = 40_161

const ETHEREUM_ROUTER =
    '0x355BD2bdF11D4B2528BC465422AB97EA9843f5a5'

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

// =============================================================
//                         HELPERS
// =============================================================

function ethereumAddressToBytes32(
    address: string
): Uint8Array {
    if (!isAddress(address)) {
        throw new Error(
            `Invalid Ethereum address: ${address}`
        )
    }

    // LayerZero represents EVM OApp addresses as bytes32.
    // The 20-byte Ethereum address is left-padded with 12
    // zero bytes.
    return Uint8Array.from(
        arrayify(
            hexZeroPad(
                address,
                32
            )
        )
    )
}

function bytesToHex(
    value: Uint8Array
): string {
    return (
        '0x' +
        Buffer.from(value).toString('hex')
    )
}

// =============================================================
//                           MAIN
// =============================================================

async function main() {
    console.log('RPC:', RPC_URL)
    console.log('Program:', PROGRAM_ID)
    console.log(
        'Remote EID:',
        ETHEREUM_SEPOLIA_EID
    )
    console.log(
        'Ethereum Router:',
        ETHEREUM_ROUTER
    )

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
        EXPECTED_ADMIN
    ) {
        throw new Error(
            `Wrong Solana admin.

Expected:
${EXPECTED_ADMIN}

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

    // ---------------------------------------------------------
    // Verify Store
    // ---------------------------------------------------------

    const store =
        await oapp.getStore(
            umi.rpc,
            'confirmed'
        )

    if (!store) {
        throw new Error(
            'OApp Store is not initialized.'
        )
    }

    if (
        store.admin.toString() !==
        EXPECTED_ADMIN
    ) {
        throw new Error(
            `Unexpected Store admin: ${store.admin}`
        )
    }

    const [storePda] =
        oapp.pda.oapp()

    const [peerPda] =
        oapp.pda.peer(
            ETHEREUM_SEPOLIA_EID
        )

    const ethereumPeer =
        ethereumAddressToBytes32(
            ETHEREUM_ROUTER
        )

    console.log(
        'Solana Store:',
        storePda
    )

    console.log(
        'Peer PDA:',
        peerPda
    )

    console.log(
        'Expected peer bytes32:',
        bytesToHex(ethereumPeer)
    )

    // ---------------------------------------------------------
    // Check existing peer
    // ---------------------------------------------------------

    const existingPeer =
        await accounts.safeFetchPeerConfig(
            { rpc: umi.rpc },
            peerPda,
            {
                commitment: 'confirmed',
            }
        )

    if (existingPeer) {
        const currentPeer =
            bytesToHex(
                existingPeer.peerAddress
            )

        console.log(
            'Current peer:',
            currentPeer
        )

        const expectedPeer =
            bytesToHex(
                ethereumPeer
            )

        if (
            currentPeer.toLowerCase() ===
            expectedPeer.toLowerCase()
        ) {
            console.log(
                '✅ Ethereum peer is already configured correctly.'
            )

            return
        }

        console.log(
            'Existing peer differs. Updating it...'
        )
    } else {
        console.log(
            'Peer account does not exist. Creating it...'
        )
    }

    // ---------------------------------------------------------
    // Configure Ethereum peer
    // ---------------------------------------------------------

    const instruction =
        oapp.setPeerConfig(
            {
                admin: signer,
            },
            {
                remote:
                    ETHEREUM_SEPOLIA_EID,

                __kind:
                    'PeerAddress',

                peer:
                    ethereumPeer,
            }
        )

    const tx =
        await transactionBuilder()
            .add(instruction)
            .sendAndConfirm(
                umi,
                {
                    confirm: {
                        commitment:
                            'confirmed',
                    },
                }
            )

    console.log(
        'Transaction signature bytes:',
        Buffer.from(
            tx.signature
        ).toString('hex')
    )

    // ---------------------------------------------------------
    // Verify
    // ---------------------------------------------------------

    const configuredPeer =
        await accounts.safeFetchPeerConfig(
            { rpc: umi.rpc },
            peerPda,
            {
                commitment: 'confirmed',
            }
        )

    if (!configuredPeer) {
        throw new Error(
            'Peer PDA was not created.'
        )
    }

    const configuredHex =
        bytesToHex(
            configuredPeer.peerAddress
        )

    const expectedHex =
        bytesToHex(
            ethereumPeer
        )

    console.log(
        'Configured peer:',
        configuredHex
    )

    if (
        configuredHex.toLowerCase() !==
        expectedHex.toLowerCase()
    ) {
        throw new Error(
            `Peer verification failed.

Expected:
${expectedHex}

Got:
${configuredHex}`
        )
    }

    console.log('')
    console.log(
        '✅ Solana → Ethereum peer configured successfully'
    )
}

main().catch((error) => {
    console.error(
        '❌ Failed to configure Ethereum peer'
    )

    console.error(error)

    process.exit(1)
})