export interface SetPeerAddressParam {
    peer: Uint8Array
    __kind: 'PeerAddress'
}

export interface SetPeerEnforcedOptionsParam {
    send: Uint8Array
    sendAndCall: Uint8Array
    __kind: 'EnforcedOptions'
}

export interface CrossChainMessageInput {
    receiver: Uint8Array
    data: Uint8Array
    options: Uint8Array
}

export interface SendCrossChainMessageInput extends CrossChainMessageInput {
    dstEid: number
    nativeFee: bigint
    lzTokenFee?: bigint
}

export interface QuoteCrossChainMessageInput extends CrossChainMessageInput {
    dstEid: number
    payInLzToken: boolean
}