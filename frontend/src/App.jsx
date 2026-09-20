import {
  BrowserProvider,
  Contract,
  formatEther,
  formatUnits,
} from 'ethers'

import {
  Connection,
  LAMPORTS_PER_SOL,
  PublicKey,
} from '@solana/web3.js'

import {
  getAssociatedTokenAddressSync,
} from '@solana/spl-token'

import {
  useCallback,
  useEffect,
  useState,
} from 'react'

import './App.css'

import MessageBridge from './components/MessageBridge'

import {
  CCT_ABI,
  ETHEREUM,
  SOLANA,
} from './config/protocol'

import {
  quoteEvmToSolana,
  sendEvmToSolana,
} from './lib/evmOft'

import {
  quoteSolanaToEvm,
  sendSolanaToEvm,
} from './lib/solanaOft'

// ============================================================
// WALLET HELPERS
// ============================================================

function getMetaMaskProvider() {
  if (
    typeof window ===
    'undefined'
  ) {
    return null
  }

  const ethereum =
    window.ethereum

  if (!ethereum) {
    return null
  }

  if (
    Array.isArray(
      ethereum.providers,
    ) &&
    ethereum.providers.length >
      0
  ) {
    const metamask =
      ethereum.providers.find(
        (provider) =>
          provider.isMetaMask &&
          !provider.isPhantom,
      )

    if (metamask) {
      return metamask
    }
  }

  if (
    ethereum.isMetaMask &&
    !ethereum.isPhantom
  ) {
    return ethereum
  }

  return null
}

function getPhantomProvider() {
  if (
    typeof window ===
    'undefined'
  ) {
    return null
  }

  const phantom =
    window.phantom?.solana

  if (phantom?.isPhantom) {
    return phantom
  }

  return null
}

function shortenAddress(
  address,
  start = 6,
  end = 4,
) {
  if (!address) {
    return ''
  }

  return `${address.slice(
    0,
    start,
  )}...${address.slice(-end)}`
}

function parseDisplayBalance(
  balance,
) {
  const value =
    Number(
      String(
        balance || '0',
      ).replaceAll(',', ''),
    )

  return Number.isFinite(value)
    ? value
    : 0
}

function formatQuoteFee(
  value,
) {
  if (!value) {
    return '--'
  }

  const number =
    Number(value)

  if (
    !Number.isFinite(number)
  ) {
    return value
  }

  return number.toFixed(6)
}

// ============================================================
// APP
// ============================================================

function App() {
  const [from, setFrom] =
    useState(ETHEREUM)

  const [to, setTo] =
    useState(SOLANA)

  const [amount, setAmount] =
    useState('')

  // ==========================================================
  // ETHEREUM STATE
  // ==========================================================

  const [
    evmAddress,
    setEvmAddress,
  ] = useState('')

  const [
    evmChainId,
    setEvmChainId,
  ] = useState(null)

  const [
    ethBalance,
    setEthBalance,
  ] = useState('0')

  const [
    ethCctBalance,
    setEthCctBalance,
  ] = useState('0')

  const [
    walletLoading,
    setWalletLoading,
  ] = useState(false)

  const [
    ethBalanceLoading,
    setEthBalanceLoading,
  ] = useState(false)

  const [
    walletError,
    setWalletError,
  ] = useState('')

  // ==========================================================
  // SOLANA STATE
  // ==========================================================

  const [
    solAddress,
    setSolAddress,
  ] = useState('')

  const [
    solBalance,
    setSolBalance,
  ] = useState('0')

  const [
    solCctBalance,
    setSolCctBalance,
  ] = useState('0')

  const [
    solAta,
    setSolAta,
  ] = useState('')

  const [
    phantomLoading,
    setPhantomLoading,
  ] = useState(false)

  const [
    solBalanceLoading,
    setSolBalanceLoading,
  ] = useState(false)

  const [
    phantomError,
    setPhantomError,
  ] = useState('')

  // ==========================================================
  // CROSS-CHAIN STATE
  // ==========================================================

  const [
    quoteLoading,
    setQuoteLoading,
  ] = useState(false)

  const [
    quote,
    setQuote,
  ] = useState(null)

  const [
    quoteError,
    setQuoteError,
  ] = useState('')

  const [
    sendLoading,
    setSendLoading,
  ] = useState(false)

  const [
    bridgeResult,
    setBridgeResult,
  ] = useState(null)

  const [
    bridgeError,
    setBridgeError,
  ] = useState('')

  const [
    deliveryStatus,
    setDeliveryStatus,
  ] = useState('idle')

  const [
    deliveredAmount,
    setDeliveredAmount,
  ] = useState('')

  const isSepolia =
    evmChainId ===
    ETHEREUM.chainId

  const isEvmToSolana =
    from === ETHEREUM &&
    to === SOLANA

  const isSolanaToEvm =
    from === SOLANA &&
    to === ETHEREUM

  const routeKey =
    isEvmToSolana
      ? 'evm-sol'
      : 'sol-evm'

  // ==========================================================
  // RESET TRANSFER
  // ==========================================================

  const resetTransferState =
    () => {
      setQuote(null)

      setQuoteError('')

      setBridgeError('')

      setBridgeResult(null)

      setDeliveryStatus(
        'idle',
      )

      setDeliveredAmount('')
    }

  // ==========================================================
  // INPUT
  // ==========================================================

  const handleAmountChange =
    (event) => {
      const value =
        event.target.value

      setAmount(value)

      setQuote(null)

      setQuoteError('')

      setBridgeError('')

      if (
        deliveryStatus ===
          'delivered' ||
        deliveryStatus ===
          'timeout'
      ) {
        setBridgeResult(null)

        setDeliveryStatus(
          'idle',
        )

        setDeliveredAmount('')
      }
    }

  // ==========================================================
  // SWITCH DIRECTION
  // ==========================================================

  const switchDirection =
    () => {
      if (
        sendLoading ||
        deliveryStatus ===
          'pending'
      ) {
        return
      }

      setFrom(to)

      setTo(from)

      setAmount('')

      resetTransferState()
    }

  // ==========================================================
  // CURRENT ETHEREUM CCT BALANCE
  // ==========================================================

  const getCurrentEthereumCctBalance =
    useCallback(
      async (address) => {
        const ethereum =
          getMetaMaskProvider()

        if (
          !ethereum ||
          !address
        ) {
          return {
            amount: 0,
            display: '0',
          }
        }

        const provider =
          new BrowserProvider(
            ethereum,
          )

        const network =
          await provider
            .getNetwork()

        if (
          Number(
            network.chainId,
          ) !==
          ETHEREUM.chainId
        ) {
          throw new Error(
            'MetaMask must remain on Ethereum Sepolia.',
          )
        }

        const token =
          new Contract(
            ETHEREUM.token,
            CCT_ABI,
            provider,
          )

        const [
          balance,
          decimals,
        ] =
          await Promise.all([
            token.balanceOf(
              address,
            ),

            token.decimals(),
          ])

        const display =
          formatUnits(
            balance,
            decimals,
          )

        return {
          amount:
            Number(display),

          display,
        }
      },
      [],
    )

  // ==========================================================
  // LOAD ETHEREUM
  // ==========================================================

  const loadEthereumAccount =
    useCallback(
      async (address) => {
        const ethereum =
          getMetaMaskProvider()

        if (
          !ethereum ||
          !address
        ) {
          return
        }

        try {
          setEthBalanceLoading(
            true,
          )

          setWalletError('')

          const chainIdHex =
            await ethereum.request(
              {
                method:
                  'eth_chainId',
              },
            )

          const chainId =
            Number.parseInt(
              chainIdHex,
              16,
            )

          setEvmChainId(
            chainId,
          )

          const provider =
            new BrowserProvider(
              ethereum,
            )

          const nativeBalance =
            await provider
              .getBalance(
                address,
              )

          setEthBalance(
            Number(
              formatEther(
                nativeBalance,
              ),
            ).toFixed(4),
          )

          if (
            chainId !==
            ETHEREUM.chainId
          ) {
            setEthCctBalance(
              '0',
            )

            return
          }

          const current =
            await getCurrentEthereumCctBalance(
              address,
            )

          setEthCctBalance(
            Number(
              current.display,
            ).toLocaleString(
              undefined,
              {
                maximumFractionDigits:
                  6,
              },
            ),
          )
        } catch (error) {
          console.error(
            'Ethereum wallet error:',
            error,
          )

          setWalletError(
            'MetaMask connected, but Ethereum balances could not be loaded.',
          )
        } finally {
          setEthBalanceLoading(
            false,
          )
        }
      },
      [
        getCurrentEthereumCctBalance,
      ],
    )

  // ==========================================================
  // CONNECT METAMASK
  // ==========================================================

  const connectMetaMask =
    async () => {
      setWalletError('')

      const ethereum =
        getMetaMaskProvider()

      if (!ethereum) {
        setWalletError(
          'MetaMask was not detected.',
        )

        return
      }

      try {
        setWalletLoading(
          true,
        )

        let accounts =
          await ethereum.request(
            {
              method:
                'eth_accounts',
            },
          )

        if (
          !accounts.length
        ) {
          accounts =
            await ethereum.request(
              {
                method:
                  'eth_requestAccounts',
              },
            )
        }

        const address =
          accounts?.[0]

        if (!address) {
          throw new Error(
            'MetaMask did not return an account.',
          )
        }

        setEvmAddress(
          address,
        )

        setWalletLoading(
          false,
        )

        await loadEthereumAccount(
          address,
        )
      } catch (error) {
        console.error(
          'MetaMask connection error:',
          error,
        )

        setWalletError(
          error?.code ===
            4001
            ? 'MetaMask connection was rejected.'
            : error?.message ||
                'Unable to connect MetaMask.',
        )

        setWalletLoading(
          false,
        )
      }
    }

  // ==========================================================
  // SWITCH TO SEPOLIA
  // ==========================================================

  const switchToSepolia =
    async () => {
      const ethereum =
        getMetaMaskProvider()

      if (!ethereum) {
        setWalletError(
          'MetaMask was not detected.',
        )

        return
      }

      try {
        setWalletError('')

        await ethereum.request(
          {
            method:
              'wallet_switchEthereumChain',

            params: [
              {
                chainId:
                  ETHEREUM.chainIdHex,
              },
            ],
          },
        )
      } catch (error) {
        if (
          error?.code ===
          4902
        ) {
          try {
            await ethereum.request(
              {
                method:
                  'wallet_addEthereumChain',

                params: [
                  {
                    chainId:
                      ETHEREUM.chainIdHex,

                    chainName:
                      'Ethereum Sepolia',

                    nativeCurrency:
                      {
                        name:
                          'Sepolia ETH',

                        symbol:
                          'ETH',

                        decimals:
                          18,
                      },

                    rpcUrls:
                      [
                        ETHEREUM.rpcUrl,
                      ],

                    blockExplorerUrls:
                      [
                        ETHEREUM.explorer,
                      ],
                  },
                ],
              },
            )

            return
          } catch (
            addError
          ) {
            setWalletError(
              addError
                ?.message ||
                'Unable to add Sepolia.',
            )

            return
          }
        }

        setWalletError(
          error?.message ||
            'Unable to switch to Sepolia.',
        )
      }
    }

  // ==========================================================
  // CURRENT SOLANA CCT BALANCE
  // ==========================================================

  const getCurrentSolanaCctBalance =
    useCallback(
      async (address) => {
        const connection =
          new Connection(
            SOLANA.rpcUrl,
            'confirmed',
          )

        const owner =
          new PublicKey(
            address,
          )

        const mint =
          new PublicKey(
            SOLANA.mint,
          )

        const ata =
          getAssociatedTokenAddressSync(
            mint,
            owner,
          )

        const accountInfo =
          await connection
            .getAccountInfo(
              ata,
            )

        if (!accountInfo) {
          return {
            amount: 0,
            display: '0',
            ata:
              ata.toBase58(),
          }
        }

        const result =
          await connection
            .getTokenAccountBalance(
              ata,
            )

        const display =
          result.value
            .uiAmountString ||
          '0'

        return {
          amount:
            Number(display),

          display,

          ata:
            ata.toBase58(),
        }
      },
      [],
    )

  // ==========================================================
  // LOAD SOLANA
  // ==========================================================

  const loadSolanaAccount =
    useCallback(
      async (address) => {
        if (!address) {
          return
        }

        try {
          setSolBalanceLoading(
            true,
          )

          setPhantomError('')

          const connection =
            new Connection(
              SOLANA.rpcUrl,
              'confirmed',
            )

          const publicKey =
            new PublicKey(
              address,
            )

          const lamports =
            await connection
              .getBalance(
                publicKey,
              )

          setSolBalance(
            (
              lamports /
              LAMPORTS_PER_SOL
            ).toFixed(4),
          )

          const current =
            await getCurrentSolanaCctBalance(
              address,
            )

          setSolAta(
            current.ata,
          )

          setSolCctBalance(
            current.display,
          )
        } catch (error) {
          console.error(
            'Solana wallet error:',
            error,
          )

          setPhantomError(
            'Phantom connected, but Solana balances could not be loaded.',
          )
        } finally {
          setSolBalanceLoading(
            false,
          )
        }
      },
      [
        getCurrentSolanaCctBalance,
      ],
    )

  // ==========================================================
  // CONNECT PHANTOM
  // ==========================================================

  const connectPhantom =
  async () => {
    setPhantomError('')

    const phantom =
      getPhantomProvider()

    if (!phantom) {
      setPhantomError(
        'Phantom was not detected. Install or enable the Phantom extension.',
      )

      return
    }

    try {
      setPhantomLoading(true)

      const timeout =
        new Promise(
          (_, reject) => {
            setTimeout(
              () => {
                reject(
                  new Error(
                    'Phantom did not respond. Unlock or restart the Phantom extension and try again.',
                  ),
                )
              },
              10000,
            )
          },
        )

      const connection =
        phantom.publicKey
          ? {
              publicKey:
                phantom.publicKey,
            }
          : await Promise.race([
              phantom.connect(),
              timeout,
            ])

      const address =
        connection?.publicKey
          ?.toString()

      if (!address) {
        throw new Error(
          'Phantom did not return a Solana address.',
        )
      }

      setSolAddress(
        address,
      )

      await loadSolanaAccount(
        address,
      )
    } catch (error) {
      console.error(
        'Phantom connection error:',
        error,
      )

      setPhantomError(
        error?.code === 4001
          ? 'Phantom connection was rejected.'
          : error?.message ||
              'Unable to connect Phantom.',
      )
    } finally {
      setPhantomLoading(false)
    }
  }

  // ==========================================================
  // VALIDATE BRIDGE
  // ==========================================================

  const validateBridge =
    () => {
      if (!evmAddress) {
        throw new Error(
          'Connect MetaMask first.',
        )
      }

      if (!isSepolia) {
        throw new Error(
          'Switch MetaMask to Ethereum Sepolia.',
        )
      }

      if (!solAddress) {
        throw new Error(
          'Connect Phantom first.',
        )
      }

      if (!amount) {
        throw new Error(
          'Enter a CCT amount.',
        )
      }

      const numeric =
        Number(amount)

      if (
        !Number.isFinite(
          numeric,
        ) ||
        numeric <= 0
      ) {
        throw new Error(
          'Enter a valid CCT amount.',
        )
      }

      const sourceBalance =
        isEvmToSolana
          ? parseDisplayBalance(
              ethCctBalance,
            )
          : parseDisplayBalance(
              solCctBalance,
            )

      if (
        numeric >
        sourceBalance
      ) {
        throw new Error(
          `Insufficient ${
            isEvmToSolana
              ? 'Ethereum'
              : 'Solana'
          } CCT balance.`,
        )
      }
    }

  // ==========================================================
  // QUOTE BOTH DIRECTIONS
  // ==========================================================

  const quoteBridgeFee =
    async () => {
      setQuoteError('')

      setBridgeError('')

      setBridgeResult(null)

      setQuote(null)

      try {
        validateBridge()

        setQuoteLoading(
          true,
        )

        if (
          isEvmToSolana
        ) {
          const result =
            await quoteEvmToSolana(
              {
                ethereumProvider:
                  getMetaMaskProvider(),

                amount,

                solanaRecipient:
                  solAddress,
              },
            )

          setQuote({
            route:
              'evm-sol',

            value:
              result.nativeFeeEth,

            symbol:
              'ETH',
          })
        } else {
          const result =
            await quoteSolanaToEvm(
              {
                phantomProvider:
                  getPhantomProvider(),

                amount,

                evmRecipient:
                  evmAddress,
              },
            )

          setQuote({
            route:
              'sol-evm',

            value:
              result.nativeFeeSol,

            symbol:
              'SOL',
          })
        }
      } catch (error) {
        console.error(
          'LayerZero quote error:',
          error,
        )

        setQuoteError(
          error?.shortMessage ||
            error?.reason ||
            error?.message ||
            'Unable to quote LayerZero fee.',
        )
      } finally {
        setQuoteLoading(
          false,
        )
      }
    }

  // ==========================================================
  // WAIT FOR DESTINATION
  // ==========================================================

  const waitForDelivery =
    async ({
      destination,
      address,
      previousBalance,
      sentAmount,
    }) => {
      setDeliveryStatus(
        'pending',
      )

      const expected =
        Number(
          previousBalance,
        ) +
        Number(
          sentAmount,
        )

      const maxAttempts =
        60

      for (
        let attempt = 1;
        attempt <= maxAttempts;
        attempt += 1
      ) {
        await new Promise(
          (resolve) =>
            setTimeout(
              resolve,
              5000,
            ),
        )

        try {
          const current =
            destination ===
            'solana'
              ? await getCurrentSolanaCctBalance(
                  address,
                )
              : await getCurrentEthereumCctBalance(
                  address,
                )

          if (
            destination ===
            'solana'
          ) {
            setSolCctBalance(
              current.display,
            )
          } else {
            setEthCctBalance(
              Number(
                current.display,
              ).toLocaleString(
                undefined,
                {
                  maximumFractionDigits:
                    6,
                },
              ),
            )
          }

          if (
            current.amount +
              0.000000001 >=
            expected
          ) {
            setDeliveryStatus(
              'delivered',
            )

            setDeliveredAmount(
              sentAmount,
            )

            if (
              destination ===
              'solana'
            ) {
              await loadSolanaAccount(
                address,
              )
            } else {
              await loadEthereumAccount(
                address,
              )
            }

            return
          }
        } catch (error) {
          console.warn(
            `Delivery check ${attempt}/${maxAttempts}:`,
            error,
          )
        }
      }

      setDeliveryStatus(
        'timeout',
      )
    }

  // ==========================================================
  // SEND BOTH DIRECTIONS
  // ==========================================================

  const bridgeCurrentRoute =
    async () => {
      setBridgeError('')

      setBridgeResult(null)

      try {
        validateBridge()

        if (
          !quote ||
          quote.route !==
            routeKey
        ) {
          throw new Error(
            'Quote the LayerZero fee again before sending.',
          )
        }

        const confirmed =
          window.confirm(
            [
              `Bridge ${amount} CCT?`,
              '',
              `From: ${from.name}`,
              '',
              `To: ${to.name}`,
              '',
              `LayerZero fee: ~${formatQuoteFee(
                quote.value,
              )} ${quote.symbol}`,
              '',
              isEvmToSolana
                ? 'MetaMask will ask you to approve the transaction.'
                : 'Phantom will ask you to approve the transaction.',
            ].join('\n'),
          )

        if (!confirmed) {
          return
        }

        setSendLoading(
          true,
        )

        setDeliveryStatus(
          'idle',
        )

        setDeliveredAmount('')

        // ---------------------------------
        // ETHEREUM -> SOLANA
        // ---------------------------------

        if (
          isEvmToSolana
        ) {
          const before =
            await getCurrentSolanaCctBalance(
              solAddress,
            )

          const result =
            await sendEvmToSolana(
              {
                ethereumProvider:
                  getMetaMaskProvider(),

                evmAddress,

                amount,

                solanaRecipient:
                  solAddress,
              },
            )

          setBridgeResult({
            ...result,

            explorer:
              result.etherscan,

            explorerName:
              'Etherscan',

            source:
              'Ethereum Sepolia',

            destination:
              'Solana Devnet',
          })

          await loadEthereumAccount(
            evmAddress,
          )

          setQuote(null)

          waitForDelivery({
            destination:
              'solana',

            address:
              solAddress,

            previousBalance:
              before.amount,

            sentAmount:
              amount,
          })

          return
        }

        // ---------------------------------
        // SOLANA -> ETHEREUM
        // ---------------------------------

        const before =
          await getCurrentEthereumCctBalance(
            evmAddress,
          )

        const result =
          await sendSolanaToEvm(
            {
              phantomProvider:
                getPhantomProvider(),

              amount,

              evmRecipient:
                evmAddress,
            },
          )

        setBridgeResult({
          ...result,

          explorer:
            result.solscan,

          explorerName:
            'Solscan',

          source:
            'Solana Devnet',

          destination:
            'Ethereum Sepolia',
        })

        // Source burn should
        // already be visible.
        await loadSolanaAccount(
          solAddress,
        )

        setQuote(null)

        waitForDelivery({
          destination:
            'ethereum',

          address:
            evmAddress,

          previousBalance:
            before.amount,

          sentAmount:
            amount,
        })
      } catch (error) {
        console.error(
          'Bridge transaction error:',
          error,
        )

        const rejected =
          error?.code ===
            4001 ||
          error?.code ===
            'ACTION_REJECTED'

        setBridgeError(
          rejected
            ? `${
                isEvmToSolana
                  ? 'MetaMask'
                  : 'Phantom'
              } transaction was rejected.`
            : error?.shortMessage ||
                error?.reason ||
                error?.message ||
                'Bridge transaction failed.',
        )

        setDeliveryStatus(
          'idle',
        )
      } finally {
        setSendLoading(
          false,
        )
      }
    }

  // ==========================================================
  // NEW TRANSFER
  // ==========================================================

  const startAnotherTransfer =
    () => {
      setAmount('')

      resetTransferState()
    }

  // ==========================================================
  // METAMASK RESTORE
  // ==========================================================

  useEffect(() => {
    const ethereum =
      getMetaMaskProvider()

    if (!ethereum) {
      return
    }

    const restore =
      async () => {
        try {
          const accounts =
            await ethereum.request(
              {
                method:
                  'eth_accounts',
              },
            )

          if (
            accounts.length >
            0
          ) {
            const address =
              accounts[0]

            setEvmAddress(
              address,
            )

            await loadEthereumAccount(
              address,
            )
          }
        } catch (error) {
          console.error(
            'MetaMask restore error:',
            error,
          )
        }
      }

    const accountsChanged =
      async (accounts) => {
        if (
          !accounts.length
        ) {
          setEvmAddress('')

          setEvmChainId(
            null,
          )

          setEthBalance('0')

          setEthCctBalance(
            '0',
          )

          return
        }

        const address =
          accounts[0]

        setEvmAddress(
          address,
        )

        resetTransferState()

        await loadEthereumAccount(
          address,
        )
      }

    const chainChanged =
      async () => {
        const accounts =
          await ethereum.request(
            {
              method:
                'eth_accounts',
            },
          )

        if (
          accounts.length >
          0
        ) {
          resetTransferState()

          await loadEthereumAccount(
            accounts[0],
          )
        }
      }

    restore()

    ethereum.on?.(
      'accountsChanged',
      accountsChanged,
    )

    ethereum.on?.(
      'chainChanged',
      chainChanged,
    )

    return () => {
      ethereum.removeListener?.(
        'accountsChanged',
        accountsChanged,
      )

      ethereum.removeListener?.(
        'chainChanged',
        chainChanged,
      )
    }
  }, [
    loadEthereumAccount,
  ])

  // ==========================================================
  // PHANTOM RESTORE
  // ==========================================================

  useEffect(() => {
    const phantom =
      getPhantomProvider()

    if (!phantom) {
      return
    }

    const restore =
      async () => {
        try {
          const response =
            await phantom.connect(
              {
                onlyIfTrusted:
                  true,
              },
            )

          if (
            response?.publicKey
          ) {
            const address =
              response.publicKey
                .toString()

            setSolAddress(
              address,
            )

            await loadSolanaAccount(
              address,
            )
          }
        } catch {
          // Normal when Phantom
          // is not trusted yet.
        }
      }

    const accountChanged =
      async (
        publicKey,
      ) => {
        if (!publicKey) {
          setSolAddress('')

          setSolBalance('0')

          setSolCctBalance(
            '0',
          )

          setSolAta('')

          return
        }

        const address =
          publicKey.toString()

        setSolAddress(
          address,
        )

        resetTransferState()

        await loadSolanaAccount(
          address,
        )
      }

    const disconnected =
      () => {
        setSolAddress('')

        setSolBalance('0')

        setSolCctBalance(
          '0',
        )

        setSolAta('')

        resetTransferState()
      }

    restore()

    phantom.on?.(
      'accountChanged',
      accountChanged,
    )

    phantom.on?.(
      'disconnect',
      disconnected,
    )

    return () => {
      phantom.removeListener?.(
        'accountChanged',
        accountChanged,
      )

      phantom.removeListener?.(
        'disconnect',
        disconnected,
      )
    }
  }, [
    loadSolanaAccount,
  ])

  // ==========================================================
  // BALANCES
  // ==========================================================

  const fromBalance =
    from === ETHEREUM
      ? evmAddress &&
        isSepolia
        ? ethCctBalance
        : '--'
      : solAddress
        ? solCctBalance
        : '--'

  const toBalance =
    to === ETHEREUM
      ? evmAddress &&
        isSepolia
        ? ethCctBalance
        : '--'
      : solAddress
        ? solCctBalance
        : '--'

  const quoteReady =
    quote &&
    quote.route ===
      routeKey

  // ==========================================================
  // UI
  // ==========================================================

  return (
    <div className="app">
      {/* HEADER */}

      <header className="navbar">
        <div className="brand">
          <div className="brand-mark">
            C
          </div>

          <div>
            <h1>
              CrossChain
            </h1>

            <p>
              LayerZero Cross-Chain Protocol
            </p>
          </div>
        </div>

        <div className="header-actions">
          <span className="status-pill">
            <span className="status-dot" />

            Testnet
          </span>

          <button
            className="wallet-button"
            onClick={
              evmAddress
                ? undefined
                : connectMetaMask
            }
            disabled={
              walletLoading
            }
          >
            {walletLoading
              ? 'Connecting...'
              : evmAddress
                ? `🦊 ${shortenAddress(
                    evmAddress,
                  )}`
                : '🦊 MetaMask'}
          </button>

          <button
            className="wallet-button"
            onClick={
              solAddress
                ? undefined
                : connectPhantom
            }
            disabled={
              phantomLoading
            }
          >
            {phantomLoading
              ? 'Connecting...'
              : solAddress
                ? `👻 ${shortenAddress(
                    solAddress,
                  )}`
                : '👻 Phantom'}
          </button>
        </div>
      </header>

      {/* MAIN */}

      <main className="main">
        <section className="hero">
          <span className="eyebrow">
            Ethereum ↔ Solana
          </span>

          <h2>
            Bridge tokens and send
            <span>
              {' '}
              cross-chain messages.
            </span>
          </h2>

          <p>
            Transfer CCT and send application messages between Ethereum Sepolia and Solana Devnet through LayerZero V2.
          </p>
        </section>

        {/* ERRORS */}

        {walletError && (
          <div className="wallet-alert error">
            {walletError}
          </div>
        )}

        {phantomError && (
          <div className="wallet-alert error">
            {phantomError}
          </div>
        )}

        {quoteError && (
          <div className="wallet-alert error">
            {quoteError}
          </div>
        )}

        {bridgeError && (
          <div className="wallet-alert error">
            {bridgeError}
          </div>
        )}

        {evmAddress &&
          !isSepolia && (
            <div className="wallet-alert warning">
              <div>
                <strong>
                  Wrong Ethereum
                  network
                </strong>

                <span>
                  Switch MetaMask to
                  Ethereum Sepolia.
                </span>
              </div>

              <button
                onClick={
                  switchToSepolia
                }
              >
                Switch to Sepolia
              </button>
            </div>
          )}

        {/* BRIDGE */}

        <section className="bridge-layout">
          <div className="bridge-card">
            <div className="card-heading">
              <div>
                <h3>
                  Bridge CCT
                </h3>

                <p>
                  Transfer tokens
                  across networks
                </p>
              </div>

              <div className="protocol-badge">
                LayerZero V2
              </div>
            </div>

            {/* FROM */}

            <div className="transfer-box">
              <div className="transfer-label-row">
                <span>
                  From
                </span>

                <span>
                  Balance:{' '}
                  {fromBalance} CCT
                </span>
              </div>

              <div className="chain-row">
                <div className="chain-select">
                  <div
                    className={`chain-icon ${
                      from ===
                      ETHEREUM
                        ? 'ethereum'
                        : 'solana'
                    }`}
                  >
                    {from ===
                    ETHEREUM
                      ? 'Ξ'
                      : 'S'}
                  </div>

                  <div>
                    <strong>
                      {from.shortName}
                    </strong>

                    <small>
                      {from.networkName}
                    </small>
                  </div>
                </div>

                <div className="amount-wrap">
                  <input
                    value={amount}
                    onChange={
                      handleAmountChange
                    }
                    placeholder="0.0"
                    inputMode="decimal"
                    disabled={
                      sendLoading ||
                      deliveryStatus ===
                        'pending'
                    }
                  />

                  <span>
                    CCT
                  </span>
                </div>
              </div>
            </div>

            {/* SWITCH */}

            <div className="switch-row">
              <button
                className="switch-button"
                onClick={
                  switchDirection
                }
                disabled={
                  sendLoading ||
                  deliveryStatus ===
                    'pending'
                }
              >
                ⇅
              </button>
            </div>

            {/* TO */}

            <div className="transfer-box">
              <div className="transfer-label-row">
                <span>
                  To
                </span>

                <span>
                  Balance:{' '}
                  {toBalance} CCT
                </span>
              </div>

              <div className="chain-row">
                <div className="chain-select">
                  <div
                    className={`chain-icon ${
                      to ===
                      ETHEREUM
                        ? 'ethereum'
                        : 'solana'
                    }`}
                  >
                    {to ===
                    ETHEREUM
                      ? 'Ξ'
                      : 'S'}
                  </div>

                  <div>
                    <strong>
                      {to.shortName}
                    </strong>

                    <small>
                      {to.networkName}
                    </small>
                  </div>
                </div>

                <div className="receive-value">
                  {amount || '--'}

                  <span>
                    CCT
                  </span>
                </div>
              </div>
            </div>

            {/* DETAILS */}

            <div className="details">
              <div>
                <span>
                  Route
                </span>

                <strong>
                  {from.shortName}
                  {' → '}
                  {to.shortName}
                </strong>
              </div>

              <div>
                <span>
                  LayerZero fee
                </span>

                <strong>
                  {quoteReady
                    ? `${formatQuoteFee(
                        quote.value,
                      )} ${
                        quote.symbol
                      }`
                    : '--'}
                </strong>
              </div>

              <div>
                <span>
                  Estimated received
                </span>

                <strong>
                  {amount || '0'} CCT
                </strong>
              </div>
            </div>

            {/* TEMPORARY LAYERZERO ALT TEST */}

            {/* ACTION */}

            {!evmAddress ? (
              <button
                className="bridge-button"
                onClick={
                  connectMetaMask
                }
              >
                Connect MetaMask
              </button>
            ) : !isSepolia ? (
              <button
                className="bridge-button"
                onClick={
                  switchToSepolia
                }
              >
                Switch to Sepolia
              </button>
            ) : !solAddress ? (
              <button
                className="bridge-button"
                onClick={
                  connectPhantom
                }
              >
                Connect Phantom
              </button>
            ) : deliveryStatus ===
              'pending' ? (
              <button
                className="bridge-button"
                disabled
              >
                Waiting for LayerZero
                Delivery...
              </button>
            ) : deliveryStatus ===
              'delivered' ? (
              <button
                className="bridge-button"
                onClick={
                  startAnotherTransfer
                }
              >
                {deliveredAmount} CCT
                Delivered ✅ — Bridge
                Again
              </button>
            ) : deliveryStatus ===
              'timeout' ? (
              <button
                className="bridge-button"
                disabled
              >
                Check LayerZero Scan
                Before Retrying
              </button>
            ) : quoteReady ? (
              <button
                className="bridge-button"
                onClick={
                  bridgeCurrentRoute
                }
                disabled={
                  sendLoading
                }
              >
                {sendLoading
                  ? isEvmToSolana
                    ? 'Waiting for MetaMask...'
                    : 'Waiting for Phantom...'
                  : `Bridge ${amount} CCT`}
              </button>
            ) : (
              <button
                className="bridge-button"
                onClick={
                  quoteBridgeFee
                }
                disabled={
                  quoteLoading ||
                  sendLoading ||
                  !amount
                }
              >
                {quoteLoading
                  ? 'Quoting LayerZero Fee...'
                  : 'Quote LayerZero Fee'}
              </button>
            )}

            {/* RESULT */}

            {bridgeResult && (
              <div className="bridge-result">
                <strong>
                  Source transaction
                  confirmed ✅
                </strong>

                <span>
                  {bridgeResult.source}
                  {' → '}
                  {
                    bridgeResult.destination
                  }
                </span>

                {deliveryStatus ===
                  'pending' && (
                  <span>
                    ⏳ LayerZero is
                    delivering the CCT.
                  </span>
                )}

                {deliveryStatus ===
                  'delivered' && (
                  <span>
                    ✅ {deliveredAmount}{' '}
                    CCT received on the
                    destination chain.
                  </span>
                )}

                {deliveryStatus ===
                  'timeout' && (
                  <span>
                    ⏳ Delivery was not
                    detected within five
                    minutes. Check
                    LayerZero Scan
                    before retrying.
                  </span>
                )}

                <a
                  href={
                    bridgeResult.explorer
                  }
                  target="_blank"
                  rel="noreferrer"
                >
                  View source
                  transaction on{' '}
                  {
                    bridgeResult.explorerName
                  }{' '}
                  ↗
                </a>

                <a
                  href={
                    bridgeResult.layerZeroScan
                  }
                  target="_blank"
                  rel="noreferrer"
                >
                  Track delivery on
                  LayerZero Scan ↗
                </a>

                {deliveryStatus ===
                  'pending' && (
                  <span>
                    Do not submit
                    another transfer
                    while delivery is
                    pending.
                  </span>
                )}
              </div>
            )}

            <p className="helper-text">
              {isEvmToSolana
                ? 'MetaMask signs Ethereum → Solana transfers.'
                : 'Phantom signs Solana → Ethereum transfers.'}
            </p>
          </div>

          {/* SIDE PANEL */}

          <aside className="protocol-panel">
            {/* ETH WALLET */}

            <div className="info-card">
              <span className="info-label">
                Ethereum wallet
              </span>

              {evmAddress ? (
                <>
                  <h3>
                    <span className="online-dot" />
                    Connected
                  </h3>

                  <div className="network-detail">
                    <span>
                      Address
                    </span>

                    <strong
                      title={
                        evmAddress
                      }
                    >
                      {shortenAddress(
                        evmAddress,
                      )}
                    </strong>
                  </div>

                  <div className="network-detail">
                    <span>
                      Network
                    </span>

                    <strong>
                      {isSepolia
                        ? 'Sepolia'
                        : evmChainId
                          ? `Chain ${evmChainId}`
                          : '--'}
                    </strong>
                  </div>

                  <div className="network-detail">
                    <span>
                      ETH
                    </span>

                    <strong>
                      {ethBalanceLoading
                        ? 'Loading...'
                        : `${ethBalance} ETH`}
                    </strong>
                  </div>

                  <div className="network-detail">
                    <span>
                      CCT
                    </span>

                    <strong>
                      {ethBalanceLoading
                        ? 'Loading...'
                        : `${ethCctBalance} CCT`}
                    </strong>
                  </div>
                </>
              ) : (
                <p>
                  Connect MetaMask.
                </p>
              )}
            </div>

            {/* SOL WALLET */}

            <div className="info-card">
              <span className="info-label">
                Solana wallet
              </span>

              {solAddress ? (
                <>
                  <h3>
                    <span className="online-dot" />
                    Connected
                  </h3>

                  <div className="network-detail">
                    <span>
                      Address
                    </span>

                    <strong
                      title={
                        solAddress
                      }
                    >
                      {shortenAddress(
                        solAddress,
                      )}
                    </strong>
                  </div>

                  <div className="network-detail">
                    <span>
                      Network
                    </span>

                    <strong>
                      Devnet
                    </strong>
                  </div>

                  <div className="network-detail">
                    <span>
                      SOL
                    </span>

                    <strong>
                      {solBalanceLoading
                        ? 'Loading...'
                        : `${solBalance} SOL`}
                    </strong>
                  </div>

                  <div className="network-detail">
                    <span>
                      CCT
                    </span>

                    <strong>
                      {solBalanceLoading
                        ? 'Loading...'
                        : `${solCctBalance} CCT`}
                    </strong>
                  </div>

                  {solAta && (
                    <div className="network-detail">
                      <span>
                        CCT ATA
                      </span>

                      <strong
                        title={solAta}
                      >
                        {shortenAddress(
                          solAta,
                        )}
                      </strong>
                    </div>
                  )}
                </>
              ) : (
                <p>
                  Connect Phantom.
                </p>
              )}
            </div>

            {/* PROTOCOL */}

            <div className="info-card">
              <span className="info-label">
                Protocol status
              </span>

              <h3>
                <span className="online-dot" />
                Operational
              </h3>

              <p>
                Bidirectional
                LayerZero OFT
                transfers have been
                verified on live
                testnets.
              </p>
            </div>

            {/* ETH NETWORK */}

            <div className="info-card">
              <span className="info-label">
                Ethereum Sepolia
              </span>

              <div className="network-detail">
                <span>
                  Endpoint ID
                </span>

                <strong>
                  {ETHEREUM.eid}
                </strong>
              </div>

              <div className="network-detail">
                <span>
                  CCT Contract
                </span>

                <strong
                  title={
                    ETHEREUM.token
                  }
                >
                  {shortenAddress(
                    ETHEREUM.token,
                  )}
                </strong>
              </div>
            </div>

            {/* SOL NETWORK */}

            <div className="info-card">
              <span className="info-label">
                Solana Devnet
              </span>

              <div className="network-detail">
                <span>
                  Endpoint ID
                </span>

                <strong>
                  {SOLANA.eid}
                </strong>
              </div>

              <div className="network-detail">
                <span>
                  CCT Mint
                </span>

                <strong
                  title={
                    SOLANA.mint
                  }
                >
                  {shortenAddress(
                    SOLANA.mint,
                  )}
                </strong>
              </div>
            </div>

            <div className="security-note">
              <strong>
                Omnichain supply
              </strong>

              <p>
                CCT uses OFT
                burn-and-mint
                accounting to
                preserve supply
                across supported
                networks.
              </p>
            </div>
          </aside>
        </section>

        <MessageBridge />
      </main>

      <footer>
        <span>
          Cross-Chain Protocol
        </span>

        <span>
          Powered by LayerZero V2
        </span>
      </footer>
    </div>
  )
}

export default App