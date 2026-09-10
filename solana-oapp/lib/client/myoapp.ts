import {
    AccountMeta,
    Cluster,
    ClusterFilter,
    Commitment,
    Program,
    ProgramError,
    ProgramRepositoryInterface,
    PublicKey,
    RpcInterface,
    Signer,
    WrappedInstruction,
    createNullRpc,
    publicKeyBytes,
} from '@metaplex-foundation/umi'
import { createDefaultProgramRepository } from '@metaplex-foundation/umi-program-repository'
import { toWeb3JsInstruction } from '@metaplex-foundation/umi-web3js-adapters'
import { ComputeBudgetProgram } from '@solana/web3.js'
import { hexlify } from 'ethers/lib/utils'

import {
    EndpointProgram,
    EventPDA,
    MessageLibInterface,
    SimpleMessageLibProgram,
    SolanaPacketPath,
    UlnProgram,
    simulateWeb3JsTransaction,
} from '@layerzerolabs/lz-solana-sdk-v2/umi'

import * as accounts from './generated/my_oapp/accounts'
import * as errors from './generated/my_oapp/errors'
import * as instructions from './generated/my_oapp/instructions'
import * as types from './generated/my_oapp/types'
import { MyOAppPDA } from './pda'
import {
    QuoteCrossChainMessageInput,
    SendCrossChainMessageInput,
    SetPeerAddressParam,
    SetPeerEnforcedOptionsParam,
} from './types'

export { accounts, errors, instructions, types }
export { MY_OAPP_PROGRAM_ID } from './generated/my_oapp'

const ENDPOINT_PROGRAM_ID: PublicKey = EndpointProgram.ENDPOINT_PROGRAM_ID

const MAX_DATA_SIZE = 4096

export enum MessageType {
    VANILLA = 1,
    COMPOSED_TYPE = 2,
}

function validateApplicationMessage(receiver: Uint8Array, data: Uint8Array): void {
    if (receiver.length !== 32) {
        throw new Error('Application receiver must be exactly 32 bytes')
    }

    if (receiver.every((byte) => byte === 0)) {
        throw new Error('Application receiver cannot be zero')
    }

    if (data.length === 0) {
        throw new Error('Message data cannot be empty')
    }

    if (data.length > MAX_DATA_SIZE) {
        throw new Error(
            `Message data exceeds maximum size: ${data.length} > ${MAX_DATA_SIZE}`
        )
    }
}

export class MyOApp {
    public readonly pda: MyOAppPDA
    public readonly eventAuthority: PublicKey
    public readonly programRepo: ProgramRepositoryInterface
    public readonly endpointSDK: EndpointProgram.Endpoint

    constructor(
        public readonly programId: PublicKey,
        public endpointProgramId: PublicKey = EndpointProgram.ENDPOINT_PROGRAM_ID,
        rpc?: RpcInterface
    ) {
        this.pda = new MyOAppPDA(programId)

        if (rpc === undefined) {
            rpc = createNullRpc()

            rpc.getCluster = (): Cluster => 'custom'
        }

        this.programRepo = createDefaultProgramRepository(
            { rpc },
            [
                {
                    name: 'myOapp',
                    publicKey: programId,

                    getErrorFromCode(
                        code: number,
                        cause?: Error
                    ): ProgramError | null {
                        return errors.getMyOappErrorFromCode(
                            code,
                            this,
                            cause
                        )
                    },

                    getErrorFromName(
                        name: string,
                        cause?: Error
                    ): ProgramError | null {
                        return errors.getMyOappErrorFromName(
                            name,
                            this,
                            cause
                        )
                    },

                    isOnCluster(): boolean {
                        return true
                    },
                } satisfies Program,
            ]
        )

        this.eventAuthority = new EventPDA(
            programId
        ).eventAuthority()[0]

        this.endpointSDK = new EndpointProgram.Endpoint(
            endpointProgramId
        )
    }

    async getEnforcedOptions(
        rpc: RpcInterface,
        remoteEid: number
    ): Promise<types.EnforcedOptions> {
        const [peer] = this.pda.peer(remoteEid)

        const peerInfo = await accounts.fetchPeerConfig(
            { rpc },
            peer
        )

        return peerInfo.enforcedOptions
    }

    getProgram(
        clusterFilter: ClusterFilter = 'custom'
    ): Program {
        return this.programRepo.get(
            'myOapp',
            clusterFilter
        )
    }

    async getStore(
        rpc: RpcInterface,
        commitment: Commitment = 'confirmed'
    ): Promise<accounts.Store | null> {
        const [store] = this.pda.oapp()

        return accounts.safeFetchStore(
            { rpc },
            store,
            { commitment }
        )
    }

    initStore(
        payer: Signer,
        admin: PublicKey,
        alt?: PublicKey
    ): WrappedInstruction {
        if (
            String(payer.publicKey) !== String(admin)
        ) {
            throw new Error(
                'Store admin must be the same signer as the initialization payer'
            )
        }

        const [oapp] = this.pda.oapp()

        const remainingAccounts =
            this.endpointSDK.getRegisterOappIxAccountMetaForCPI(
                payer.publicKey,
                oapp
            )

        return instructions
            .initStore(
                {
                    payer,
                    programs: this.programRepo,
                },
                {
                    payer,
                    store: oapp,

                    lzReceiveTypesAccounts:
                        this.pda
                            .lzReceiveTypesAccounts()[0],

                    alt,

                    admin,
                    endpoint:
                        this.endpointSDK.programId,
                }
            )
            .addRemainingAccounts(
                remainingAccounts
            ).items[0]
    }

    async send(
        rpc: RpcInterface,
        sender: Signer,
        params: SendCrossChainMessageInput,
        remainingAccounts?: AccountMeta[],
        commitment: Commitment = 'confirmed'
    ): Promise<WrappedInstruction> {
        const {
            dstEid,
            receiver,
            data,
            options,
            nativeFee,
            lzTokenFee,
        } = params

        validateApplicationMessage(
            receiver,
            data
        )

        const payer = sender.publicKey

        const msgLibProgram =
            await this.getSendLibraryProgram(
                rpc,
                payer,
                dstEid
            )

        const [oapp] = this.pda.oapp()
        const [peer] = this.pda.peer(dstEid)

        const receiverInfo =
            await accounts.fetchPeerConfig(
                { rpc },
                peer,
                { commitment }
            )

        if (
            receiverInfo.peerAddress.every(
                (byte) => byte === 0
            )
        ) {
            throw new Error(
                `Peer for destination EID ${dstEid} is not configured`
            )
        }

        const packetPath: SolanaPacketPath = {
            dstEid,

            // LayerZero transport sender is the
            // Solana OApp Store PDA.
            sender: oapp,

            // LayerZero transport receiver is
            // the configured Ethereum peer.
            receiver:
                receiverInfo.peerAddress,
        }

        remainingAccounts =
            remainingAccounts ??
            (await this.endpointSDK
                .getSendIXAccountMetaForCPI(
                    rpc,
                    payer,
                    {
                        path: packetPath,
                        msgLibProgram,
                    },
                    commitment
                ))

        if (
            remainingAccounts === undefined
        ) {
            throw new Error(
                'Failed to get remaining accounts for send instruction'
            )
        }

        return instructions
            .send(
                {
                    programs: this.programRepo,
                },
                {
                    // Actual application sender.
                    sender,

                    peer,
                    store: oapp,

                    endpoint:
                        this.endpointSDK
                            .pda
                            .setting()[0],

                    dstEid,

                    // Application-level receiver.
                    receiver,

                    data,
                    options,

                    nativeFee,
                    lzTokenFee:
                        lzTokenFee ?? 0n,
                }
            )
            .addRemainingAccounts(
                remainingAccounts
            ).items[0]
    }

    async quote(
        rpc: RpcInterface,
        sender: PublicKey,
        params: QuoteCrossChainMessageInput,
        remainingAccounts?: AccountMeta[],
        commitment: Commitment = 'confirmed'
    ): Promise<EndpointProgram.types.MessagingFee> {
        const {
            dstEid,
            receiver,
            data,
            options,
            payInLzToken,
        } = params

        validateApplicationMessage(
            receiver,
            data
        )

        const msgLibProgram =
            await this.getSendLibraryProgram(
                rpc,
                sender,
                dstEid
            )

        const [oapp] = this.pda.oapp()
        const [peer] = this.pda.peer(dstEid)

        const receiverInfo =
            await accounts.fetchPeerConfig(
                { rpc },
                peer,
                { commitment }
            )

        if (
            receiverInfo.peerAddress.every(
                (byte) => byte === 0
            )
        ) {
            throw new Error(
                `Peer for destination EID ${dstEid} is not configured`
            )
        }

        const packetPath: SolanaPacketPath = {
            dstEid,

            // LayerZero sender.
            sender: oapp,

            // LayerZero remote OApp.
            receiver:
                receiverInfo.peerAddress,
        }

        remainingAccounts =
            remainingAccounts ??
            (await this.endpointSDK
                .getQuoteIXAccountMetaForCPI(
                    rpc,
                    sender,
                    {
                        path: packetPath,
                        msgLibProgram,
                    }
                ))

        if (
            remainingAccounts === undefined
        ) {
            throw new Error(
                'Failed to get remaining accounts for quote instruction'
            )
        }

        const applicationSender =
            publicKeyBytes(sender)

        const ix = instructions
            .quoteSend(
                {
                    programs: this.programRepo,
                },
                {
                    store: oapp,
                    peer,

                    endpoint:
                        this.endpointSDK
                            .pda
                            .setting()[0],

                    dstEid,

                    // Same sender bytes that Send
                    // will encode on-chain.
                    sender: applicationSender,

                    // Application-level receiver.
                    receiver,

                    data,
                    options,
                    payInLzToken,
                }
            )
            .addRemainingAccounts(
                remainingAccounts
            ).items[0]

        const modifyComputeUnits =
            ComputeBudgetProgram
                .setComputeUnitLimit({
                    units: 400000,
                })

        return simulateWeb3JsTransaction(
            rpc,
            [
                modifyComputeUnits,
                toWeb3JsInstruction(
                    ix.instruction
                ),
            ],
            this.programId,
            sender,
            EndpointProgram.types
                .getMessagingFeeSerializer(),
            'confirmed'
        )
    }

    setPeerConfig(
        accountParams: {
            admin: Signer
        },
        param:
            (
                | SetPeerAddressParam
                | SetPeerEnforcedOptionsParam
            ) & {
                remote: number
            }
    ): WrappedInstruction {
        const { admin } = accountParams
        const { remote } = param

        let config:
            types.PeerConfigParamArgs

        if (
            param.__kind ===
            'PeerAddress'
        ) {
            if (
                param.peer.length !== 32
            ) {
                throw new Error(
                    'Peer must be exactly 32 bytes'
                )
            }

            if (
                param.peer.every(
                    (byte) => byte === 0
                )
            ) {
                throw new Error(
                    'Peer cannot be zero'
                )
            }

            config =
                types.peerConfigParam(
                    'PeerAddress',
                    [param.peer]
                )
        } else if (
            param.__kind ===
            'EnforcedOptions'
        ) {
            config = {
                __kind:
                    'EnforcedOptions',

                send:
                    param.send,

                sendAndCall:
                    param.sendAndCall,
            }
        } else {
            throw new Error(
                'Invalid peer config'
            )
        }

        return instructions
            .setPeerConfig(
                {
                    programs:
                        this.programRepo,
                },
                {
                    admin,

                    store:
                        this.pda.oapp()[0],

                    peer:
                        this.pda.peer(
                            remote
                        )[0],

                    remoteEid:
                        remote,

                    config,
                }
            ).items[0]
    }

    async getSendLibraryProgram(
        rpc: RpcInterface,
        payer: PublicKey,
        dstEid: number
    ): Promise<
        | SimpleMessageLibProgram.SimpleMessageLib
        | UlnProgram.Uln
    > {
        const [oapp] = this.pda.oapp()

        const sendLibInfo =
            await this.endpointSDK
                .getSendLibrary(
                    rpc,
                    oapp,
                    dstEid
                )

        if (
            !sendLibInfo.programId
        ) {
            throw new Error(
                'Send library not initialized or blocked message library'
            )
        }

        const {
            programId: msgLibProgram,
        } = sendLibInfo

        const msgLibVersion =
            await this.endpointSDK
                .getMessageLibVersion(
                    rpc,
                    payer,
                    msgLibProgram
                )

        if (
            msgLibVersion.major === 0n &&
            msgLibVersion.minor === 0 &&
            msgLibVersion.endpointVersion ===
                2
        ) {
            return new SimpleMessageLibProgram.SimpleMessageLib(
                msgLibProgram
            )
        }

        if (
            msgLibVersion.major === 3n &&
            msgLibVersion.minor === 0 &&
            msgLibVersion.endpointVersion ===
                2
        ) {
            return new UlnProgram.Uln(
                msgLibProgram
            )
        }

        throw new Error(
            `Unsupported message library version: ${JSON.stringify(
                msgLibVersion,
                null,
                2
            )}`
        )
    }
}

export async function getPeer(
    rpc: RpcInterface,
    dstEid: number,
    oappProgramId: PublicKey
): Promise<string> {
    const [peer] =
        new MyOAppPDA(
            oappProgramId
        ).peer(dstEid)

    const info =
        await accounts.fetchPeerConfig(
            { rpc },
            peer
        )

    return hexlify(
        info.peerAddress
    )
}

export function initConfig(
    programId: PublicKey,
    accountParams: {
        admin: Signer
        payer: Signer
    },
    remoteEid: number,
    programs?: {
        msgLib?: PublicKey
        endpoint?: PublicKey
    }
): WrappedInstruction {
    const {
        admin,
        payer,
    } = accountParams

    const pda =
        new MyOAppPDA(programId)

    let msgLibProgram: PublicKey
    let endpointProgram: PublicKey

    if (
        programs === undefined
    ) {
        msgLibProgram =
            UlnProgram.ULN_PROGRAM_ID

        endpointProgram =
            EndpointProgram
                .ENDPOINT_PROGRAM_ID
    } else {
        msgLibProgram =
            programs.msgLib ??
            UlnProgram.ULN_PROGRAM_ID

        endpointProgram =
            programs.endpoint ??
            EndpointProgram
                .ENDPOINT_PROGRAM_ID
    }

    const endpoint =
        new EndpointProgram.Endpoint(
            endpointProgram
        )

    let msgLib:
        MessageLibInterface

    if (
        msgLibProgram ===
        SimpleMessageLibProgram
            .SIMPLE_MESSAGELIB_PROGRAM_ID
    ) {
        msgLib =
            new SimpleMessageLibProgram.SimpleMessageLib(
                SimpleMessageLibProgram
                    .SIMPLE_MESSAGELIB_PROGRAM_ID
            )
    } else {
        msgLib =
            new UlnProgram.Uln(
                msgLibProgram
            )
    }

    return endpoint.initOAppConfig(
        {
            delegate: admin,
            payer: payer.publicKey,
        },
        {
            msgLibSDK: msgLib,
            oapp: pda.oapp()[0],
            remote: remoteEid,
        }
    )
}

export function initSendLibrary(
    accountParams: {
        admin: Signer
        oapp: PublicKey
    },
    remoteEid: number,
    endpointProgram: PublicKey =
        ENDPOINT_PROGRAM_ID
): WrappedInstruction {
    const {
        admin,
        oapp,
    } = accountParams

    const endpoint =
        new EndpointProgram.Endpoint(
            endpointProgram
        )

    return endpoint
        .initOAppSendLibrary(
            admin,
            {
                sender: oapp,
                remote: remoteEid,
            }
        )
}

export function initReceiveLibrary(
    accountParams: {
        admin: Signer
        oapp: PublicKey
    },
    remoteEid: number,
    endpointProgram: PublicKey =
        ENDPOINT_PROGRAM_ID
): WrappedInstruction {
    const {
        admin,
        oapp,
    } = accountParams

    const endpoint =
        new EndpointProgram.Endpoint(
            endpointProgram
        )

    return endpoint
        .initOAppReceiveLibrary(
            admin,
            {
                receiver: oapp,
                remote: remoteEid,
            }
        )
}

export function initOAppNonce(
    accountParams: {
        admin: Signer
        oapp: PublicKey
    },
    remoteEid: number,
    remoteOappAddr: Uint8Array,
    endpointProgram: PublicKey =
        ENDPOINT_PROGRAM_ID
): WrappedInstruction {
    if (
        remoteOappAddr.length !== 32
    ) {
        throw new Error(
            'Remote OApp address must be exactly 32 bytes'
        )
    }

    const {
        admin,
        oapp,
    } = accountParams

    const endpoint =
        new EndpointProgram.Endpoint(
            endpointProgram
        )

    return endpoint.initOAppNonce(
        admin,
        {
            localOApp: oapp,
            remote: remoteEid,
            remoteOApp:
                remoteOappAddr,
        }
    )
}