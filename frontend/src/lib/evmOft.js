import {
  BrowserProvider,
  Contract,
  formatEther,
  hexlify,
  parseUnits,
} from 'ethers'

import bs58 from 'bs58'

import {
  ETHEREUM,
  SOLANA,
} from '../config/protocol'

const OFT_ABI = [
  {
    type: 'function',
    name: 'quoteSend',
    stateMutability: 'view',
    inputs: [
      {
        name: '_sendParam',
        type: 'tuple',
        components: [
          {
            name: 'dstEid',
            type: 'uint32',
          },
          {
            name: 'to',
            type: 'bytes32',
          },
          {
            name: 'amountLD',
            type: 'uint256',
          },
          {
            name: 'minAmountLD',
            type: 'uint256',
          },
          {
            name: 'extraOptions',
            type: 'bytes',
          },
          {
            name: 'composeMsg',
            type: 'bytes',
          },
          {
            name: 'oftCmd',
            type: 'bytes',
          },
        ],
      },
      {
        name: '_payInLzToken',
        type: 'bool',
      },
    ],
    outputs: [
      {
        name: 'fee',
        type: 'tuple',
        components: [
          {
            name: 'nativeFee',
            type: 'uint256',
          },
          {
            name: 'lzTokenFee',
            type: 'uint256',
          },
        ],
      },
    ],
  },

  {
    type: 'function',
    name: 'send',
    stateMutability: 'payable',
    inputs: [
      {
        name: '_sendParam',
        type: 'tuple',
        components: [
          {
            name: 'dstEid',
            type: 'uint32',
          },
          {
            name: 'to',
            type: 'bytes32',
          },
          {
            name: 'amountLD',
            type: 'uint256',
          },
          {
            name: 'minAmountLD',
            type: 'uint256',
          },
          {
            name: 'extraOptions',
            type: 'bytes',
          },
          {
            name: 'composeMsg',
            type: 'bytes',
          },
          {
            name: 'oftCmd',
            type: 'bytes',
          },
        ],
      },
      {
        name: '_fee',
        type: 'tuple',
        components: [
          {
            name: 'nativeFee',
            type: 'uint256',
          },
          {
            name: 'lzTokenFee',
            type: 'uint256',
          },
        ],
      },
      {
        name: '_refundAddress',
        type: 'address',
      },
    ],
    outputs: [],
  },
]

function solanaAddressToBytes32(
  address,
) {
  const decoded =
    bs58.decode(address)

  if (decoded.length !== 32) {
    throw new Error(
      'Invalid Solana recipient address.',
    )
  }

  return hexlify(decoded)
}

function validateAmount(amount) {
  if (!amount) {
    throw new Error(
      'Enter an amount to bridge.',
    )
  }

  const value = Number(amount)

  if (
    !Number.isFinite(value) ||
    value <= 0
  ) {
    throw new Error(
      'Enter a valid CCT amount.',
    )
  }

  // The OFT uses 6 shared decimals.
  // Restricting the UI avoids destination
  // precision/dust surprises.
  const [, decimals = ''] =
    String(amount).split('.')

  if (decimals.length > 6) {
    throw new Error(
      'Use at most 6 decimal places for CCT.',
    )
  }
}

function makeSendParam(
  amount,
  solanaRecipient,
) {
  validateAmount(amount)

  const amountLD =
    parseUnits(amount, 18)

  return {
    dstEid: SOLANA.eid,

    to:
      solanaAddressToBytes32(
        solanaRecipient,
      ),

    amountLD,

    minAmountLD: amountLD,

    // Enforced options are already
    // configured on-chain.
    extraOptions: '0x',

    composeMsg: '0x',

    oftCmd: '0x',
  }
}

export async function quoteEvmToSolana({
  ethereumProvider,
  amount,
  solanaRecipient,
}) {
  if (!ethereumProvider) {
    throw new Error(
      'MetaMask is not connected.',
    )
  }

  if (!solanaRecipient) {
    throw new Error(
      'Connect Phantom first.',
    )
  }

  const provider =
    new BrowserProvider(
      ethereumProvider,
    )

  const network =
    await provider.getNetwork()

  if (
    Number(network.chainId) !==
    ETHEREUM.chainId
  ) {
    throw new Error(
      'Switch MetaMask to Ethereum Sepolia.',
    )
  }

  const oft =
    new Contract(
      ETHEREUM.token,
      OFT_ABI,
      provider,
    )

  const sendParam =
    makeSendParam(
      amount,
      solanaRecipient,
    )

  const fee =
    await oft.quoteSend(
      sendParam,
      false,
    )

  return {
    sendParam,

    nativeFee:
      fee.nativeFee,

    lzTokenFee:
      fee.lzTokenFee,

    nativeFeeEth:
      formatEther(
        fee.nativeFee,
      ),
  }
}

export async function sendEvmToSolana({
  ethereumProvider,
  evmAddress,
  amount,
  solanaRecipient,
}) {
  const quote =
    await quoteEvmToSolana({
      ethereumProvider,
      amount,
      solanaRecipient,
    })

  const provider =
    new BrowserProvider(
      ethereumProvider,
    )

  const signer =
    await provider.getSigner()

  const signerAddress =
    await signer.getAddress()

  if (
    signerAddress.toLowerCase() !==
    evmAddress.toLowerCase()
  ) {
    throw new Error(
      'Connected MetaMask account changed.',
    )
  }

  const oft =
    new Contract(
      ETHEREUM.token,
      OFT_ABI,
      signer,
    )

  const tx =
    await oft.send(
      quote.sendParam,
      {
        nativeFee:
          quote.nativeFee,

        lzTokenFee:
          quote.lzTokenFee,
      },

      evmAddress,

      {
        value:
          quote.nativeFee,
      },
    )

  const receipt =
    await tx.wait()

  return {
    hash: receipt.hash,

    etherscan:
      `${ETHEREUM.explorer}/tx/${receipt.hash}`,

    layerZeroScan:
      `https://testnet.layerzeroscan.com/tx/${receipt.hash}`,
  }
}