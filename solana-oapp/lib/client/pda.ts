import {
    Pda,
    PublicKey,
    publicKeyBytes,
} from '@metaplex-foundation/umi'
import {
    Endian,
    u32,
} from '@metaplex-foundation/umi/serializers'
import { createWeb3JsEddsa } from '@metaplex-foundation/umi-eddsa-web3js'
import {
    arrayify,
    defaultAbiCoder,
    hexlify,
    keccak256,
} from 'ethers/lib/utils'

import { OmniAppPDA } from '@layerzerolabs/lz-solana-sdk-v2/umi'

const eddsa = createWeb3JsEddsa()
const textEncoder = new TextEncoder()

function utf8Seed(value: string): Uint8Array {
    return textEncoder.encode(value)
}

export const LZ_RECEIVE_TYPES_SEED = 'LzReceiveTypes'

export class MyOAppPDA extends OmniAppPDA {
    static STORE_SEED = 'Store'
    static RECEIVED_MESSAGE_SEED = 'ReceivedMessage'

    constructor(public readonly programId: PublicKey) {
        super(programId)
    }

    oapp(): Pda {
        return eddsa.findPda(
            this.programId,
            [
                utf8Seed(MyOAppPDA.STORE_SEED),
            ]
        )
    }

    peer(remoteEid: number): Pda {
        const [store] = this.oapp()

        return eddsa.findPda(
            this.programId,
            [
                utf8Seed(OmniAppPDA.PEER_SEED),
                publicKeyBytes(store),
                u32({
                    endian: Endian.Big,
                }).serialize(remoteEid),
            ]
        )
    }

    lzReceiveTypesAccounts(): Pda {
        const [store] = this.oapp()

        return eddsa.findPda(
            this.programId,
            [
                utf8Seed(LZ_RECEIVE_TYPES_SEED),
                publicKeyBytes(store),
            ]
        )
    }

    receivedMessage(
        srcEid: number,
        sourceOapp: Uint8Array,
        applicationNonce: bigint
    ): Pda {
        if (sourceOapp.length !== 32) {
            throw new Error(
                'sourceOapp must be exactly 32 bytes'
            )
        }

        const encoded = defaultAbiCoder.encode(
            [
                'uint32',
                'bytes32',
                'uint64',
            ],
            [
                srcEid,
                hexlify(sourceOapp),
                applicationNonce.toString(),
            ]
        )

        const hash = arrayify(
            keccak256(encoded)
        )

        const messageId =
            Uint8Array.from(hash)

        return eddsa.findPda(
            this.programId,
            [
                utf8Seed(
                    MyOAppPDA.RECEIVED_MESSAGE_SEED
                ),
                messageId,
            ]
        )
    }
}