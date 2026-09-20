export const ETHEREUM = {
  name: 'Ethereum Sepolia',
  shortName: 'Ethereum',
  networkName: 'Sepolia',
  symbol: 'ETH',

  eid: 40161,

  chainId: 11155111,
  chainIdHex: '0xaa36a7',

  rpcUrl:
    'https://ethereum-sepolia-rpc.publicnode.com',

  explorer:
    'https://sepolia.etherscan.io',

  token:
    '0x012F1BD82Ab77aAF810A0A7fD3F8776759A4E8A3',
}

export const SOLANA = {
  name: 'Solana Devnet',
  shortName: 'Solana',
  networkName: 'Devnet',
  symbol: 'SOL',

  eid: 40168,

  rpcUrl:
    import.meta.env.VITE_SOLANA_RPC_URL ||
    'https://api.devnet.solana.com',

  explorer:
    'https://solscan.io',

  mint:
    'JV3naK5XLVeFPknMmUUQvBKa8MWTnNRFUTYRCWEVcRU',

  oftStore:
    'ChH5mhTYjQZd2CjCMTcS7SHRsDHrF2qRKvEFkzM7ZZiL',

  programId:
    'GTWBLZr6jumUR8NqSv6RdHya8WNUwxBcKs4GkSJgMjx6',
}

export const CCT_ABI = [
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
]
