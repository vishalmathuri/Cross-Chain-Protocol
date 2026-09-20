import { Buffer } from 'buffer'

import {
  getBytes,
  isAddress,
  zeroPadValue,
} from 'ethers'

import {
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token'

import {
  Connection,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js'

import {
  fetchAddressLookupTable,
  fetchMint,
  fetchToken,
  findAssociatedTokenPda,
  mplToolbox,
  setComputeUnitLimit,
  setComputeUnitPrice,
} from '@metaplex-foundation/mpl-toolbox'

import {
  createNoopSigner,
  publicKey,
  signerIdentity,
  transactionBuilder,
} from '@metaplex-foundation/umi'

import {
  createUmi,
} from '@metaplex-foundation/umi-bundle-defaults'

import {
  fromWeb3JsPublicKey,
  toWeb3JsTransaction,
} from '@metaplex-foundation/umi-web3js-adapters'

import {
  oft,
} from '@layerzerolabs/oft-v2-solana-sdk'

import {
  ETHEREUM,
  SOLANA,
} from '../config/protocol'

// ============================================================
// CONFIG
// ============================================================

const SOLANA_DEVNET_LOOKUP_TABLE =
  '9thqPdbR27A1yLWw2spwJLySemiGMXxPnEvfmXVk4KuK'

const SEND_COMPUTE_UNITS =
  253_000

const PRIORITY_FEE_MICROLAMPORTS =
  1_000n

const MAX_TRANSACTION_SIZE =
  1232

// ============================================================
// AMOUNT HELPERS
// ============================================================

function validateAmountString(
  amount,
) {
  const value =
    String(amount).trim()

  if (
    !/^\d+(\.\d+)?$/.test(
      value,
    )
  ) {
    throw new Error(
      'Enter a valid CCT amount.',
    )
  }

  const numeric =
    Number(value)

  if (
    !Number.isFinite(
      numeric,
    ) ||
    numeric <= 0
  ) {
    throw new Error(
      'CCT amount must be greater than zero.',
    )
  }

  const [
    ,
    fraction = '',
  ] =
    value.split('.')

  if (
    fraction.length >
    6
  ) {
    throw new Error(
      'CCT supports at most 6 decimal places for cross-chain transfers.',
    )
  }

  return value
}

function parseDecimalToUnits(
  amount,
  decimals,
) {
  const normalized =
    validateAmountString(
      amount,
    )

  const [
    whole,
    fraction = '',
  ] =
    normalized.split('.')

  const wholeUnits =
    BigInt(whole) *
    10n **
      BigInt(
        decimals,
      )

  const paddedFraction =
    fraction
      .padEnd(
        decimals,
        '0',
      )
      .slice(
        0,
        decimals,
      )

  const fractionUnits =
    paddedFraction
      ? BigInt(
          paddedFraction,
        )
      : 0n

  return (
    wholeUnits +
    fractionUnits
  )
}

function formatBaseUnits(
  value,
  decimals,
) {
  const amount =
    BigInt(value)

  const divisor =
    10n **
    BigInt(
      decimals,
    )

  const whole =
    amount /
    divisor

  const remainder =
    amount %
    divisor

  if (
    remainder === 0n
  ) {
    return whole.toString()
  }

  const fraction =
    remainder
      .toString()
      .padStart(
        decimals,
        '0',
      )
      .replace(
        /0+$/,
        '',
      )

  return `${whole}.${fraction}`
}

// ============================================================
// ADDRESS HELPERS
// ============================================================

function evmAddressToBytes32(
  address,
) {
  if (
    !isAddress(
      address,
    )
  ) {
    throw new Error(
      'Invalid Ethereum recipient address.',
    )
  }

  return Buffer.from(
    getBytes(
      zeroPadValue(
        address,
        32,
      ),
    ),
  )
}

// ============================================================
// PHANTOM
// ============================================================

function validatePhantom(
  phantomProvider,
) {
  if (!phantomProvider) {
    throw new Error(
      'Phantom is not connected.',
    )
  }

  if (
    !phantomProvider.isPhantom
  ) {
    throw new Error(
      'The supplied provider is not Phantom.',
    )
  }

  if (
    !phantomProvider.publicKey
  ) {
    throw new Error(
      'Phantom does not have a connected Solana account.',
    )
  }

  if (
    typeof phantomProvider
      .signTransaction !==
    'function'
  ) {
    throw new Error(
      'Phantom does not support signTransaction.',
    )
  }
}

// ============================================================
// UMI
// ============================================================

function createPhantomUmi(
  phantomProvider,
) {
  validatePhantom(
    phantomProvider,
  )

  const walletAddress =
    phantomProvider
      .publicKey
      .toString()

  const signer =
    createNoopSigner(
      publicKey(
        walletAddress,
      ),
    )

  const umi =
    createUmi(
      SOLANA.rpcUrl,
    )
      .use(
        mplToolbox(),
      )
      .use(
        signerIdentity(
          signer,
        ),
      )

  return {
    umi,
    signer,
  }
}

// ============================================================
// OFT CONTEXT
// ============================================================

async function getOftContext(
  phantomProvider,
) {
  const {
    umi,
    signer,
  } =
    createPhantomUmi(
      phantomProvider,
    )

  const programId =
    publicKey(
      SOLANA.programId,
    )

  const storePda =
    publicKey(
      SOLANA.oftStore,
    )

  const storeInfo =
    await oft.accounts
      .fetchOFTStore(
        umi,
        storePda,
      )

  const tokenMint =
    publicKey(
      storeInfo.tokenMint,
    )

  const tokenEscrow =
    publicKey(
      storeInfo.tokenEscrow,
    )

  const tokenProgramId =
    fromWeb3JsPublicKey(
      TOKEN_PROGRAM_ID,
    )

  const tokenSource =
    findAssociatedTokenPda(
      umi,
      {
        mint:
          tokenMint,

        owner:
          signer.publicKey,

        tokenProgramId,
      },
    )

  let tokenAccount

  try {
    tokenAccount =
      await fetchToken(
        umi,
        tokenSource,
      )
  } catch {
    throw new Error(
      'The connected Phantom wallet does not have a CCT token account.',
    )
  }

  const mintInfo =
    await fetchMint(
      umi,
      tokenMint,
    )

  return {
    umi,
    signer,

    programId,

    tokenMint,
    tokenEscrow,

    tokenProgramId,

    tokenSource,
    tokenAccount,

    mintInfo,
  }
}

// ============================================================
// SEND PARAM
// ============================================================

function buildSendParam({
  amount,
  decimals,
  balance,
  evmRecipient,
}) {
  const amountLd =
    parseDecimalToUnits(
      amount,
      decimals,
    )

  if (
    amountLd <= 0n
  ) {
    throw new Error(
      'Amount must be greater than zero.',
    )
  }

  if (
    amountLd >
    BigInt(
      balance,
    )
  ) {
    throw new Error(
      'Insufficient CCT balance in Phantom.',
    )
  }

  return {
    dstEid:
      ETHEREUM.eid,

    to:
      evmAddressToBytes32(
        evmRecipient,
      ),

    amountLd,

    minAmountLd:
      amountLd,

    options:
      undefined,

    composeMsg:
      undefined,
  }
}

// ============================================================
// LAYERZERO ALT
// ============================================================

async function getLookupTable(
  umi,
) {
  const address =
    publicKey(
      SOLANA_DEVNET_LOOKUP_TABLE,
    )

  const table =
    await fetchAddressLookupTable(
      umi,
      address,
    )

  if (!table) {
    throw new Error(
      'LayerZero Solana address lookup table could not be loaded.',
    )
  }

  return {
    address,
    table,
  }
}

// ============================================================
// QUOTE
// ============================================================

export async function quoteSolanaToEvm({
  phantomProvider,
  amount,
  evmRecipient,
}) {
  const context =
    await getOftContext(
      phantomProvider,
    )

  const {
    umi,
    signer,
    programId,
    tokenMint,
    tokenEscrow,
    tokenAccount,
    mintInfo,
  } =
    context

  const sendParam =
    buildSendParam({
      amount,

      decimals:
        mintInfo.decimals,

      balance:
        tokenAccount.amount,

      evmRecipient,
    })

  const {
    address:
      lookupTableAddress,
  } =
    await getLookupTable(
      umi,
    )

  const result =
    await oft.quote(
      umi.rpc,

      {
        payer:
          signer.publicKey,

        tokenMint,

        tokenEscrow,
      },

      {
        payInLzToken:
          false,

        ...sendParam,
      },

      {
        oft:
          programId,
      },

      [],

      [
        lookupTableAddress,
      ],
    )

  const nativeFee =
    BigInt(
      result.nativeFee,
    )

  return {
    nativeFee,

    nativeFeeSol:
      formatBaseUnits(
        nativeFee,
        9,
      ),

    sendParam,
  }
}

// ============================================================
// SIMULATION
// ============================================================

async function simulateTransaction(
  transaction,
) {
  const connection =
    new Connection(
      SOLANA.rpcUrl,
      'confirmed',
    )

  let simulation

  try {
    simulation =
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
  } catch (error) {
    throw new Error(
      `Could not simulate Solana transaction: ${
        error?.message ||
        error
      }`,
    )
  }

  if (
    simulation.value.err
  ) {
    const logs =
      simulation
        .value
        .logs ||
      []

    console.error(
      'Solana simulation error:',
      simulation.value.err,
    )

    console.error(
      'Solana simulation logs:',
      logs,
    )

    throw new Error(
      `Solana transaction simulation failed: ${
        logs
          .slice(-10)
          .join(' | ') ||
        JSON.stringify(
          simulation.value.err,
        )
      }`,
    )
  }

  console.log(
    '✅ Solana simulation passed.',
  )

  return simulation
}

// ============================================================
// NORMALIZE
// ============================================================

function normalizeVersionedTransaction(
  transaction,
) {
  return VersionedTransaction
    .deserialize(
      transaction.serialize(),
    )
}

// ============================================================
// EXPAND ALT
// ============================================================
//
// This is the important workaround.
//
// LayerZero first builds its normal transaction using the
// official lookup table.
//
// Then we resolve all ALT accounts and rebuild the exact
// message WITHOUT a lookup table.
//
// Phantom has already proven it can sign normal v0 messages.
// ============================================================

async function expandLookupTableTransaction(
  transaction,
) {
  const connection =
    new Connection(
      SOLANA.rpcUrl,
      'confirmed',
    )

  const lookups =
    transaction
      .message
      .addressTableLookups ||
    []

  console.log(
    'Original ALT count:',
    lookups.length,
  )

  if (
    lookups.length === 0
  ) {
    console.log(
      'Transaction already has no ALT.',
    )

    return transaction
  }

  const lookupTableAccounts =
    []

  for (
    const lookup of lookups
  ) {
    const address =
      lookup.accountKey

    console.log(
      'Resolving ALT:',
      address.toBase58(),
    )

    const result =
      await connection
        .getAddressLookupTable(
          address,
        )

    if (!result.value) {
      throw new Error(
        `Could not resolve address lookup table ${address.toBase58()}.`,
      )
    }

    lookupTableAccounts
      .push(
        result.value,
      )
  }

  const decompiled =
    TransactionMessage
      .decompile(
        transaction.message,
        {
          addressLookupTableAccounts:
            lookupTableAccounts,
        },
      )

  const noAltMessage =
    decompiled
      .compileToV0Message()

  const noAltTransaction =
    new VersionedTransaction(
      noAltMessage,
    )

  let serialized

  try {
    serialized =
      noAltTransaction
        .serialize()
  } catch (error) {
    console.error(
      'No-ALT serialization failed:',
      error,
    )

    throw new Error(
      'The LayerZero transaction becomes too large after expanding the address lookup table. ' +
      'Phantom currently rejects the ALT version of this Devnet transaction.',
    )
  }

  console.log(
    '================ NO-ALT TX DEBUG ================',
  )

  console.log(
    'Original transaction size:',
    transaction
      .serialize()
      .length,
  )

  console.log(
    'No-ALT transaction size:',
    serialized.length,
  )

  console.log(
    'No-ALT lookup tables:',
    noAltTransaction
      .message
      .addressTableLookups,
  )

  console.log(
    'Static account count:',
    noAltTransaction
      .message
      .staticAccountKeys
      .length,
  )

  console.log(
    '=================================================',
  )

  if (
    noAltTransaction
      .message
      .addressTableLookups
      .length !== 0
  ) {
    throw new Error(
      'Failed to remove the address lookup table.',
    )
  }

  if (
    serialized.length >
    MAX_TRANSACTION_SIZE
  ) {
    throw new Error(
      `LayerZero transaction is ${serialized.length} bytes without ALT. ` +
      `Solana maximum is ${MAX_TRANSACTION_SIZE} bytes.`,
    )
  }

  return noAltTransaction
}

// ============================================================
// INSPECT FINAL TRANSACTION
// ============================================================

function inspectFinalTransaction(
  transaction,
  phantomProvider,
) {
  const phantomAddress =
    phantomProvider
      .publicKey
      .toBase58()

  const message =
    transaction.message

  const requiredSignerCount =
    message
      .header
      .numRequiredSignatures

  const requiredSigners =
    message
      .staticAccountKeys
      .slice(
        0,
        requiredSignerCount,
      )
      .map(
        (key) =>
          key.toBase58(),
      )

  const feePayer =
    message
      .staticAccountKeys[0]
      .toBase58()

  const lookupTables =
    message
      .addressTableLookups
      .map(
        (lookup) =>
          lookup
            .accountKey
            .toBase58(),
      )

  const size =
    transaction
      .serialize()
      .length

  console.log(
    '================ FINAL PHANTOM TX ================',
  )

  console.log(
    'Transaction version:',
    transaction.version,
  )

  console.log(
    'Phantom wallet:',
    phantomAddress,
  )

  console.log(
    'Required signer count:',
    requiredSignerCount,
  )

  console.log(
    'Required signers:',
    requiredSigners,
  )

  console.log(
    'Fee payer:',
    feePayer,
  )

  console.log(
    'Lookup tables:',
    lookupTables,
  )

  console.log(
    'Transaction size:',
    size,
  )

  console.log(
    '==================================================',
  )

  if (
    requiredSignerCount !==
    1
  ) {
    throw new Error(
      `Unexpected signer count: ${requiredSignerCount}.`,
    )
  }

  if (
    requiredSigners[0] !==
    phantomAddress
  ) {
    throw new Error(
      'Phantom is not the required transaction signer.',
    )
  }

  if (
    feePayer !==
    phantomAddress
  ) {
    throw new Error(
      'Phantom is not the transaction fee payer.',
    )
  }

  if (
    lookupTables.length !==
    0
  ) {
    throw new Error(
      'Final Phantom transaction still contains an ALT.',
    )
  }

  if (
    size >
    MAX_TRANSACTION_SIZE
  ) {
    throw new Error(
      `Transaction is too large: ${size} bytes.`,
    )
  }
}

// ============================================================
// SEND SOLANA -> ETHEREUM
// ============================================================

export async function sendSolanaToEvm({
  phantomProvider,
  amount,
  evmRecipient,
}) {
  validatePhantom(
    phantomProvider,
  )

  const context =
    await getOftContext(
      phantomProvider,
    )

  const {
    umi,
    signer,
    programId,
    tokenMint,
    tokenEscrow,
    tokenProgramId,
    tokenSource,
    tokenAccount,
    mintInfo,
  } =
    context

  const sendParam =
    buildSendParam({
      amount,

      decimals:
        mintInfo.decimals,

      balance:
        tokenAccount.amount,

      evmRecipient,
    })

  const {
    address:
      lookupTableAddress,

    table:
      lookupTable,
  } =
    await getLookupTable(
      umi,
    )

  // ==========================================================
  // REQUOTE
  // ==========================================================

  console.log(
    'Quoting LayerZero fee immediately before send...',
  )

  const quote =
    await oft.quote(
      umi.rpc,

      {
        payer:
          signer.publicKey,

        tokenMint,

        tokenEscrow,
      },

      {
        payInLzToken:
          false,

        ...sendParam,
      },

      {
        oft:
          programId,
      },

      [],

      [
        lookupTableAddress,
      ],
    )

  const nativeFee =
    BigInt(
      quote.nativeFee,
    )

  console.log(
    'LayerZero native fee:',
    nativeFee.toString(),
  )

  // ==========================================================
  // SEND INSTRUCTION
  // ==========================================================

  console.log(
    'Building LayerZero OFT send instruction...',
  )

  const sendInstruction =
    await oft.send(
      umi.rpc,

      {
        payer:
          signer,

        tokenMint,

        tokenEscrow,

        tokenSource:
          tokenSource[0],
      },

      {
        nativeFee,

        ...sendParam,
      },

      {
        oft:
          programId,

        token:
          tokenProgramId,
      },
    )

  // ==========================================================
  // BUILD ORIGINAL LAYERZERO TX WITH ALT
  // ==========================================================

  let builder =
    transactionBuilder()
      .add(
        setComputeUnitPrice(
          umi,
          {
            microLamports:
              PRIORITY_FEE_MICROLAMPORTS,
          },
        ),
      )
      .add(
        setComputeUnitLimit(
          umi,
          {
            units:
              SEND_COMPUTE_UNITS,
          },
        ),
      )
      .setAddressLookupTables(
        [
          lookupTable,
        ],
      )
      .add(
        [
          sendInstruction,
        ],
      )

  const latestBlockhash =
    await umi.rpc
      .getLatestBlockhash({
        commitment:
          'confirmed',
      })

  builder =
    builder
      .setBlockhash(
        latestBlockhash,
      )

  const umiTransaction =
    builder
      .build(
        umi,
      )

  const originalTransaction =
    normalizeVersionedTransaction(
      toWeb3JsTransaction(
        umiTransaction,
      ),
    )

  console.log(
    'LayerZero ALT transaction size:',
    originalTransaction
      .serialize()
      .length,
  )

  console.log(
    'LayerZero ALT count:',
    originalTransaction
      .message
      .addressTableLookups
      .length,
  )

  // ==========================================================
  // SIMULATE ORIGINAL LAYERZERO TX
  // ==========================================================

  console.log(
    'Simulating original LayerZero ALT transaction...',
  )

  await simulateTransaction(
    originalTransaction,
  )

  // ==========================================================
  // REMOVE / EXPAND ALT
  // ==========================================================

  console.log(
    'Expanding LayerZero ALT for Phantom...',
  )

  const phantomTransaction =
    await expandLookupTableTransaction(
      originalTransaction,
    )

  inspectFinalTransaction(
    phantomTransaction,
    phantomProvider,
  )

  // ==========================================================
  // SIMULATE EXACT NO-ALT TRANSACTION
  // ==========================================================

  console.log(
    'Simulating final no-ALT transaction...',
  )

  await simulateTransaction(
    phantomTransaction,
  )

  // ==========================================================
  // PHANTOM SIGN
  // ==========================================================

  console.log(
    'Requesting Phantom signature for no-ALT transaction...',
  )

  let signedTransaction

  try {
    signedTransaction =
      await phantomProvider
        .signTransaction(
          phantomTransaction,
        )
  } catch (error) {
    console.error(
      'Phantom signing failed:',
      error,
    )

    console.error(
      'Phantom error code:',
      error?.code,
    )

    console.error(
      'Phantom error message:',
      error?.message,
    )

    if (
      error?.code ===
      4001
    ) {
      throw new Error(
        'Phantom transaction was rejected.',
      )
    }

    if (
      error?.code ===
      -32603
    ) {
      throw new Error(
        'Phantom still returned -32603 even after removing the address lookup table.',
      )
    }

    throw new Error(
      error?.message ||
      'Phantom could not sign the transaction.',
    )
  }

  if (!signedTransaction) {
    throw new Error(
      'Phantom did not return a signed transaction.',
    )
  }

  console.log(
    '✅ Phantom signed the no-ALT LayerZero transaction.',
  )

  // ==========================================================
  // BROADCAST
  // ==========================================================

  const connection =
    new Connection(
      SOLANA.rpcUrl,
      'confirmed',
    )

  const rawTransaction =
    signedTransaction
      .serialize()

  console.log(
    'Signed transaction size:',
    rawTransaction.length,
  )

  if (
    rawTransaction.length >
    MAX_TRANSACTION_SIZE
  ) {
    throw new Error(
      `Signed transaction exceeds Solana maximum size: ${rawTransaction.length} bytes.`,
    )
  }

  console.log(
    'Broadcasting LayerZero transaction...',
  )

  const txHash =
    await connection
      .sendRawTransaction(
        rawTransaction,
        {
          skipPreflight:
            false,

          preflightCommitment:
            'confirmed',

          maxRetries:
            5,
        },
      )

  console.log(
    '✅ Solana transaction submitted:',
    txHash,
  )

  // ==========================================================
  // CONFIRM
  // ==========================================================

  const confirmation =
    await connection
      .confirmTransaction(
        {
          signature:
            txHash,

          blockhash:
            latestBlockhash
              .blockhash,

          lastValidBlockHeight:
            Number(
              latestBlockhash
                .lastValidBlockHeight,
            ),
        },

        'confirmed',
      )

  if (
    confirmation.value.err
  ) {
    throw new Error(
      `Solana source transaction failed: ${JSON.stringify(
        confirmation
          .value
          .err,
      )}`,
    )
  }

  console.log(
    '✅ Solana source transaction confirmed:',
    txHash,
  )

  return {
    hash:
      txHash,

    solscan:
      `https://solscan.io/tx/${txHash}?cluster=devnet`,

    layerZeroScan:
      `https://testnet.layerzeroscan.com/tx/${txHash}`,
  }
}