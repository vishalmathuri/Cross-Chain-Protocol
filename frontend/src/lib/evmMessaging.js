import {
  BrowserProvider,
  Contract,
  JsonRpcProvider,
  formatEther,
  hexlify,
  toUtf8Bytes,
} from 'ethers'

import bs58 from 'bs58'

import {
  ETHEREUM,
  SOLANA,
  MESSAGING,
} from '../config/protocol'

const ROUTER_ABI = [
  {
    type: 'function',
    name: 'quoteMessage',
    stateMutability: 'view',
    inputs: [
      {
        name: 'dstEid',
        type: 'uint32',
      },
      {
        name: 'receiver',
        type: 'bytes32',
      },
      {
        name: 'data',
        type: 'bytes',
      },
      {
        name: 'options',
        type: 'bytes',
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
    name: 'sendMessage',
    stateMutability: 'payable',
    inputs: [
      {
        name: 'dstEid',
        type: 'uint32',
      },
      {
        name: 'receiver',
        type: 'bytes32',
      },
      {
        name: 'data',
        type: 'bytes',
      },
      {
        name: 'options',
        type: 'bytes',
      },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'receivedCount',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint64',
      },
    ],
  },
]

function validateMessage(message) {
  const data = toUtf8Bytes(
    String(message || '').trim(),
  )

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

function solanaAddressToBytes32(
  address,
) {
  const decoded =
    bs58.decode(address)

  if (decoded.length !== 32) {
    throw new Error(
      'Invalid Solana destination address.',
    )
  }

  return hexlify(decoded)
}

async function getSepoliaProvider(
  ethereumProvider,
) {
  if (!ethereumProvider) {
    throw new Error(
      'MetaMask is not connected.',
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

  return provider
}

export async function quoteEvmMessageToSolana({
  ethereumProvider,
  message,
  solanaReceiver,
}) {
  const provider =
    await getSepoliaProvider(
      ethereumProvider,
    )

  if (!solanaReceiver) {
    throw new Error(
      'Connect Phantom first.',
    )
  }

  const data =
    validateMessage(message)

  const receiver =
    solanaAddressToBytes32(
      solanaReceiver,
    )

  const router =
    new Contract(
      MESSAGING.ethereumRouter,
      ROUTER_ABI,
      provider,
    )

  const fee =
    await router.quoteMessage(
      SOLANA.eid,
      receiver,
      data,
      '0x',
    )

  return {
    nativeFee:
      fee.nativeFee,
    nativeFeeEth:
      formatEther(
        fee.nativeFee,
      ),
  }
}

export async function sendEvmMessageToSolana({
  ethereumProvider,
  evmAddress,
  message,
  solanaReceiver,
}) {
  const quote =
    await quoteEvmMessageToSolana({
      ethereumProvider,
      message,
      solanaReceiver,
    })

  const provider =
    await getSepoliaProvider(
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

  const data =
    validateMessage(message)

  const receiver =
    solanaAddressToBytes32(
      solanaReceiver,
    )

  const router =
    new Contract(
      MESSAGING.ethereumRouter,
      ROUTER_ABI,
      signer,
    )

  const tx =
    await router.sendMessage(
      SOLANA.eid,
      receiver,
      data,
      '0x',
      {
        value:
          quote.nativeFee,
      },
    )

  const receipt =
    await tx.wait()

  return {
    hash:
      receipt.hash,
    explorer:
      `${ETHEREUM.explorer}/tx/${receipt.hash}`,
    explorerName:
      'Etherscan',
    layerZeroScan:
      `https://testnet.layerzeroscan.com/tx/${receipt.hash}`,
  }
}

export async function getEthereumMessagingReceivedCount() {
  const provider =
    new JsonRpcProvider(
      ETHEREUM.rpcUrl,
    )

  const router =
    new Contract(
      MESSAGING.ethereumRouter,
      ROUTER_ABI,
      provider,
    )

  const count =
    await router.receivedCount()

  return BigInt(count)
}
