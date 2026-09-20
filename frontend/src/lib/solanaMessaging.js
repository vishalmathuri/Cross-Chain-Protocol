import { Buffer } from 'buffer'

import {
  getBytes,
  isAddress,
  zeroPadValue,
} from 'ethers'

import {
  ComputeBudgetProgram,
  Connection,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js'

import {
  publicKey,
} from '@metaplex-foundation/umi'

import {
  bool,
  bytes,
  struct,
  u32,
  u64,
} from '@metaplex-foundation/umi/serializers'

import {
  createUmi,
} from '@metaplex-foundation/umi-bundle-defaults'

import {
  toWeb3JsInstruction,
} from '@metaplex-foundation/umi-web3js-adapters'

import {
  EndpointProgram,
  OmniAppPDA,
  SimpleMessageLibProgram,
  UlnProgram,
  simulateWeb3JsTransaction,
} from '@layerzerolabs/lz-solana-sdk-v2/umi'

import {
  ETHEREUM,
  SOLANA,
  MESSAGING,
} from '../config/protocol'

const SEND_COMPUTE_UNITS =
  400_000

const PRIORITY_FEE_MICROLAMPORTS =
  1_000

const MAX_TRANSACTION_SIZE =
  1232

const QUOTE_DISCRIMINATOR =
  new Uint8Array([
    207,
    0,
    49,
    214,
    160,
    211,
    76,
    211,
  ])

const SEND_DISCRIMINATOR =
  new Uint8Array([
    102,
    251,
    20,
    187,
    65,
    75,
    12,
    69,
  ])

const quoteSerializer =
  struct([
    [
      'discriminator',
      bytes({
        size: 8,
      }),
    ],
    [
      'dstEid',
      u32(),
    ],
    [
      'sender',
      bytes({
        size: 32,
      }),
    ],
    [
      'receiver',
      bytes({
        size: 32,
      }),
    ],
    [
      'data',
      bytes({
        size: u32(),
      }),
    ],
    [
      'options',
      bytes({
        size: u32(),
      }),
    ],
    [
      'payInLzToken',
      bool(),
    ],
  ])

const sendSerializer =
  struct([
    [
      'discriminator',
      bytes({
        size: 8,
      }),
    ],
    [
      'dstEid',
      u32(),
    ],
    [
      'receiver',
      bytes({
        size: 32,
      }),
    ],
    [
      'data',
      bytes({
        size: u32(),
      }),
    ],
    [
      'options',
      bytes({
        size: u32(),
      }),
    ],
    [
      'nativeFee',
      u64(),
    ],
    [
      'lzTokenFee',
      u64(),
    ],
  ])

function validatePhantom(
  phantomProvider,
) {
  if (
    !phantomProvider ||
    !phantomProvider.isPhantom ||
    !phantomProvider.publicKey
  ) {
    throw new Error(
      'Connect Phantom first.',
    )
  }

  if (
    typeof phantomProvider
      .signTransaction !==
    'function'
  ) {
    throw new Error(
      'Phantom does not support transaction signing.',
    )
  }
}

function validateMessage(
  message,
) {
  const value =
    String(message || '').trim()

  const data =
    new TextEncoder()
      .encode(value)

  if (data.length === 0) {
    throw new Error(
      'Enter a message to send.',
    )
  }

  if (data.length > 4096) {
    throw new Error(
      'Message exceeds the protocol limit of 4096 bytes.',
    )
  }

  return data
}

function evmAddressToBytes32(
  address,
) {
  if (!isAddress(address)) {
    throw new Error(
      'Invalid Ethereum destination address.',
    )
  }

  return new Uint8Array(
    getBytes(
      zeroPadValue(
        address,
        32,
      ),
    ),
  )
}

function derivePeerPda(
  remoteEid,
) {
  const programId =
    new PublicKey(
      MESSAGING.solanaProgramId,
    )

  const store =
    new PublicKey(
      MESSAGING.solanaStore,
    )

  const eid =
    Buffer.alloc(4)

  eid.writeUInt32BE(
    remoteEid,
    0,
  )

  const [
    peer,
  ] =
    PublicKey
      .findProgramAddressSync(
        [
          Buffer.from(
            OmniAppPDA.PEER_SEED,
          ),
          store.toBuffer(),
          eid,
        ],
        programId,
      )

  return peer
}

function formatLamports(
  value,
) {
  const amount =
    BigInt(value)

  const whole =
    amount / 1_000_000_000n

  const fraction =
    (
      amount %
      1_000_000_000n
    )
      .toString()
      .padStart(
        9,
        '0',
      )
      .replace(
        /0+$/,
        '',
      )

  return fraction
    ? `${whole}.${fraction}`
    : whole.toString()
}

function makeContext(
  phantomProvider,
) {
  validatePhantom(
    phantomProvider,
  )

  const connection =
    new Connection(
      SOLANA.rpcUrl,
      'confirmed',
    )

  const umi =
    createUmi(
      SOLANA.rpcUrl,
    )

  const endpoint =
    new EndpointProgram.Endpoint()

  const senderWeb3 =
    new PublicKey(
      phantomProvider
        .publicKey
        .toString(),
    )

  const senderUmi =
    publicKey(
      senderWeb3.toBase58(),
    )

  const storeWeb3 =
    new PublicKey(
      MESSAGING.solanaStore,
    )

  const storeUmi =
    publicKey(
      storeWeb3.toBase58(),
    )

  const programIdUmi =
    publicKey(
      MESSAGING.solanaProgramId,
    )

  const peerWeb3 =
    derivePeerPda(
      ETHEREUM.eid,
    )

  const peerUmi =
    publicKey(
      peerWeb3.toBase58(),
    )

  return {
    connection,
    umi,
    endpoint,
    senderWeb3,
    senderUmi,
    storeWeb3,
    storeUmi,
    programIdUmi,
    peerWeb3,
    peerUmi,
  }
}

async function getSendLibraryProgram({
  umi,
  endpoint,
  senderUmi,
  storeUmi,
}) {
  const sendLibrary =
    await endpoint
      .getSendLibrary(
        umi.rpc,
        storeUmi,
        ETHEREUM.eid,
      )

  if (!sendLibrary.programId) {
    throw new Error(
      'LayerZero send library is not configured.',
    )
  }

  const version =
    await endpoint
      .getMessageLibVersion(
        umi.rpc,
        senderUmi,
        sendLibrary.programId,
      )

  if (
    version.major === 0n &&
    version.minor === 0 &&
    version.endpointVersion ===
      2
  ) {
    return new SimpleMessageLibProgram.SimpleMessageLib(
      sendLibrary.programId,
    )
  }

  if (
    version.major === 3n &&
    version.minor === 0 &&
    version.endpointVersion ===
      2
  ) {
    return new UlnProgram.Uln(
      sendLibrary.programId,
    )
  }

  throw new Error(
    'Unsupported LayerZero Solana message library version.',
  )
}

async function getMessageContext(
  phantomProvider,
) {
  const context =
    makeContext(
      phantomProvider,
    )

  const {
    connection,
    umi,
    endpoint,
    senderUmi,
    storeUmi,
    peerWeb3,
  } = context

  const peerAccount =
    await connection
      .getAccountInfo(
        peerWeb3,
        'confirmed',
      )

  if (
    !peerAccount ||
    peerAccount.data.length <
      40
  ) {
    throw new Error(
      'Solana messaging peer configuration was not found.',
    )
  }

  const remotePeer =
    new Uint8Array(
      peerAccount.data.slice(
        8,
        40,
      ),
    )

  if (
    remotePeer.every(
      (byte) =>
        byte === 0,
    )
  ) {
    throw new Error(
      'Ethereum messaging peer is not configured on Solana.',
    )
  }

  const msgLibProgram =
    await getSendLibraryProgram(
      context,
    )

  const packetPath = {
    dstEid:
      ETHEREUM.eid,
    sender:
      storeUmi,
    receiver:
      remotePeer,
  }

  return {
    ...context,
    remotePeer,
    msgLibProgram,
    packetPath,
    endpointSetting:
      endpoint
        .pda
        .setting()[0],
    umi,
    senderUmi,
  }
}

function toQuoteInstruction({
  programIdUmi,
  storeUmi,
  peerUmi,
  endpointSetting,
  senderUmi,
  receiver,
  data,
  remainingAccounts,
}) {
  const instruction = {
    programId:
      programIdUmi,
    keys: [
      {
        pubkey:
          storeUmi,
        isSigner:
          false,
        isWritable:
          false,
      },
      {
        pubkey:
          peerUmi,
        isSigner:
          false,
        isWritable:
          false,
      },
      {
        pubkey:
          endpointSetting,
        isSigner:
          false,
        isWritable:
          false,
      },
      ...remainingAccounts,
    ],
    data:
      quoteSerializer
        .serialize({
          discriminator:
            QUOTE_DISCRIMINATOR,
          dstEid:
            ETHEREUM.eid,
          sender:
            new PublicKey(
              senderUmi,
            ).toBytes(),
          receiver,
          data,
          options:
            new Uint8Array(),
          payInLzToken:
            false,
        }),
  }

  return toWeb3JsInstruction(
    instruction,
  )
}

function toSendInstruction({
  programIdUmi,
  storeUmi,
  peerUmi,
  endpointSetting,
  senderUmi,
  receiver,
  data,
  nativeFee,
  remainingAccounts,
}) {
  const instruction = {
    programId:
      programIdUmi,
    keys: [
      {
        pubkey:
          senderUmi,
        isSigner:
          true,
        isWritable:
          false,
      },
      {
        pubkey:
          peerUmi,
        isSigner:
          false,
        isWritable:
          false,
      },
      {
        pubkey:
          storeUmi,
        isSigner:
          false,
        isWritable:
          true,
      },
      {
        pubkey:
          endpointSetting,
        isSigner:
          false,
        isWritable:
          false,
      },
      ...remainingAccounts,
    ],
    data:
      sendSerializer
        .serialize({
          discriminator:
            SEND_DISCRIMINATOR,
          dstEid:
            ETHEREUM.eid,
          receiver,
          data,
          options:
            new Uint8Array(),
          nativeFee,
          lzTokenFee:
            0n,
        }),
  }

  return toWeb3JsInstruction(
    instruction,
  )
}

export async function quoteSolanaMessageToEvm({
  phantomProvider,
  message,
  evmReceiver,
}) {
  const receiver =
    evmAddressToBytes32(
      evmReceiver,
    )

  const data =
    validateMessage(
      message,
    )

  const context =
    await getMessageContext(
      phantomProvider,
    )

  const {
    umi,
    endpoint,
    senderUmi,
    storeUmi,
    packetPath,
    msgLibProgram,
  } = context

  const remainingAccounts =
    await endpoint
      .getQuoteIXAccountMetaForCPI(
        umi.rpc,
        senderUmi,
        {
          path:
            packetPath,
          msgLibProgram,
        },
      )

  if (!remainingAccounts) {
    throw new Error(
      'LayerZero quote accounts could not be resolved.',
    )
  }

  const quoteInstruction =
    toQuoteInstruction({
      ...context,
      receiver,
      data,
      remainingAccounts,
    })

  const fee =
    await simulateWeb3JsTransaction(
      umi.rpc,
      [
        ComputeBudgetProgram
          .setComputeUnitLimit({
            units:
              SEND_COMPUTE_UNITS,
          }),
        quoteInstruction,
      ],
      context.programIdUmi,
      senderUmi,
      EndpointProgram
        .types
        .getMessagingFeeSerializer(),
      'confirmed',
    )

  return {
    nativeFee:
      BigInt(
        fee.nativeFee,
      ),
    nativeFeeSol:
      formatLamports(
        fee.nativeFee,
      ),
  }
}

async function simulateFinalTransaction(
  connection,
  transaction,
) {
  const simulation =
    await connection
      .simulateTransaction(
        transaction,
        {
          commitment:
            'confirmed',
          sigVerify:
            false,
          replaceRecentBlockhash:
            false,
        },
      )

  if (simulation.value.err) {
    throw new Error(
      `Solana messaging transaction simulation failed: ${
        simulation.value.logs
          ?.slice(-8)
          .join(' | ') ||
        JSON.stringify(
          simulation.value.err,
        )
      }`,
    )
  }
}

export async function sendSolanaMessageToEvm({
  phantomProvider,
  message,
  evmReceiver,
}) {
  validatePhantom(
    phantomProvider,
  )

  const receiver =
    evmAddressToBytes32(
      evmReceiver,
    )

  const data =
    validateMessage(
      message,
    )

  const context =
    await getMessageContext(
      phantomProvider,
    )

  const {
    connection,
    umi,
    endpoint,
    senderWeb3,
    senderUmi,
    packetPath,
    msgLibProgram,
  } = context

  const quote =
    await quoteSolanaMessageToEvm({
      phantomProvider,
      message,
      evmReceiver,
    })

  const remainingAccounts =
    await endpoint
      .getSendIXAccountMetaForCPI(
        umi.rpc,
        senderUmi,
        {
          path:
            packetPath,
          msgLibProgram,
        },
        'confirmed',
      )

  if (!remainingAccounts) {
    throw new Error(
      'LayerZero send accounts could not be resolved.',
    )
  }

  const sendInstruction =
    toSendInstruction({
      ...context,
      receiver,
      data,
      nativeFee:
        quote.nativeFee,
      remainingAccounts,
    })

  const computeLimit =
    ComputeBudgetProgram
      .setComputeUnitLimit({
        units:
          SEND_COMPUTE_UNITS,
      })

  const computePrice =
    ComputeBudgetProgram
      .setComputeUnitPrice({
        microLamports:
          PRIORITY_FEE_MICROLAMPORTS,
      })

  const latestBlockhash =
    await connection
      .getLatestBlockhash(
        'confirmed',
      )

  const messageV0 =
    new TransactionMessage({
      payerKey:
        senderWeb3,
      recentBlockhash:
        latestBlockhash.blockhash,
      instructions: [
        computePrice,
        computeLimit,
        sendInstruction,
      ],
    })
      .compileToV0Message()

  const transaction =
    new VersionedTransaction(
      messageV0,
    )

  const serialized =
    transaction.serialize()

  if (
    serialized.length >
    MAX_TRANSACTION_SIZE
  ) {
    throw new Error(
      `Messaging transaction is ${serialized.length} bytes. Solana maximum is ${MAX_TRANSACTION_SIZE} bytes. Try a shorter message.`,
    )
  }

  await simulateFinalTransaction(
    connection,
    transaction,
  )

  let signed

  try {
    signed =
      await phantomProvider
        .signTransaction(
          transaction,
        )
  } catch (error) {
    if (
      error?.code === 4001
    ) {
      throw new Error(
        'Phantom transaction was rejected.',
      )
    }

    throw new Error(
      error?.message ||
      'Phantom could not sign the messaging transaction.',
    )
  }

  const raw =
    signed.serialize()

  const signature =
    await connection
      .sendRawTransaction(
        raw,
        {
          skipPreflight:
            false,
          preflightCommitment:
            'confirmed',
          maxRetries:
            5,
        },
      )

  const confirmation =
    await connection
      .confirmTransaction(
        {
          signature,
          blockhash:
            latestBlockhash.blockhash,
          lastValidBlockHeight:
            latestBlockhash
              .lastValidBlockHeight,
        },
        'confirmed',
      )

  if (
    confirmation.value.err
  ) {
    throw new Error(
      `Solana messaging transaction failed: ${JSON.stringify(
        confirmation.value.err,
      )}`,
    )
  }

  return {
    hash:
      signature,
    explorer:
      `https://solscan.io/tx/${signature}?cluster=devnet`,
    explorerName:
      'Solscan',
    layerZeroScan:
      `https://testnet.layerzeroscan.com/tx/${signature}`,
  }
}

export async function getSolanaMessagingReceivedCount() {
  const connection =
    new Connection(
      SOLANA.rpcUrl,
      'confirmed',
    )

  const store =
    new PublicKey(
      MESSAGING.solanaStore,
    )

  const account =
    await connection
      .getAccountInfo(
        store,
        'confirmed',
      )

  if (
    !account ||
    account.data.length <
      89
  ) {
    throw new Error(
      'Solana messaging store account could not be read.',
    )
  }

  return Buffer
    .from(account.data)
    .readBigUInt64LE(81)
}
