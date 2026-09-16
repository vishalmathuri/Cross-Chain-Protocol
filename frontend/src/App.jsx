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

import {
  CCT_ABI,
  ETHEREUM,
  SOLANA,
} from './config/protocol'

// ============================================================
// WALLET HELPERS
// ============================================================

function getMetaMaskProvider() {
  if (typeof window === 'undefined') {
    return null
  }

  const ethereum = window.ethereum

  if (!ethereum) {
    return null
  }

  if (
    Array.isArray(ethereum.providers) &&
    ethereum.providers.length > 0
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
  if (typeof window === 'undefined') {
    return null
  }

  if (
    window.phantom?.solana?.isPhantom
  ) {
    return window.phantom.solana
  }

  if (
    window.solana?.isPhantom
  ) {
    return window.solana
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

  const isSepolia =
    evmChainId === ETHEREUM.chainId

  // ==========================================================
  // SWITCH DIRECTION
  // ==========================================================

  const switchDirection = () => {
    setFrom(to)
    setTo(from)
    setAmount('')
  }

  // ==========================================================
  // ETHEREUM DATA
  // ==========================================================

  const loadEthereumAccount =
    useCallback(async (address) => {
      const ethereum =
        getMetaMaskProvider()

      if (!ethereum || !address) {
        return
      }

      try {
        setEthBalanceLoading(true)
        setWalletError('')

        const chainIdHex =
          await ethereum.request({
            method: 'eth_chainId',
          })

        const chainId =
          Number.parseInt(
            chainIdHex,
            16,
          )

        setEvmChainId(chainId)

        const provider =
          new BrowserProvider(
            ethereum,
          )

        const nativeBalance =
          await provider.getBalance(
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
          setEthCctBalance('0')
          return
        }

        const token =
          new Contract(
            ETHEREUM.token,
            CCT_ABI,
            provider,
          )

        const [
          tokenBalance,
          decimals,
        ] = await Promise.all([
          token.balanceOf(address),
          token.decimals(),
        ])

        const formatted =
          formatUnits(
            tokenBalance,
            decimals,
          )

        setEthCctBalance(
          Number(
            formatted,
          ).toLocaleString(
            undefined,
            {
              maximumFractionDigits: 6,
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
        setEthBalanceLoading(false)
      }
    }, [])

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
        setWalletLoading(true)

        let accounts =
          await ethereum.request({
            method:
              'eth_accounts',
          })

        if (!accounts.length) {
          accounts =
            await ethereum.request({
              method:
                'eth_requestAccounts',
            })
        }

        const address =
          accounts?.[0]

        if (!address) {
          throw new Error(
            'MetaMask did not return an account.',
          )
        }

        setEvmAddress(address)

        setWalletLoading(false)

        await loadEthereumAccount(
          address,
        )
      } catch (error) {
        console.error(
          'MetaMask connection error:',
          error,
        )

        setWalletError(
          error?.code === 4001
            ? 'MetaMask connection was rejected.'
            : error?.message ||
                'Unable to connect MetaMask.',
        )

        setWalletLoading(false)
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

        await ethereum.request({
          method:
            'wallet_switchEthereumChain',

          params: [
            {
              chainId:
                ETHEREUM.chainIdHex,
            },
          ],
        })

        if (evmAddress) {
          await loadEthereumAccount(
            evmAddress,
          )
        }
      } catch (error) {
        if (
          error?.code === 4902
        ) {
          try {
            await ethereum.request({
              method:
                'wallet_addEthereumChain',

              params: [
                {
                  chainId:
                    ETHEREUM.chainIdHex,

                  chainName:
                    'Ethereum Sepolia',

                  nativeCurrency: {
                    name:
                      'Sepolia ETH',
                    symbol:
                      'ETH',
                    decimals:
                      18,
                  },

                  rpcUrls: [
                    ETHEREUM.rpcUrl,
                  ],

                  blockExplorerUrls: [
                    ETHEREUM.explorer,
                  ],
                },
              ],
            })

            return
          } catch (addError) {
            setWalletError(
              addError?.message ||
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
  // SOLANA DATA
  // ==========================================================

  const loadSolanaAccount =
    useCallback(async (address) => {
      if (!address) {
        return
      }

      try {
        setSolBalanceLoading(true)
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

        // ---------------------------
        // SOL balance
        // ---------------------------

        const lamports =
          await connection.getBalance(
            publicKey,
          )

        setSolBalance(
          (
            lamports /
            LAMPORTS_PER_SOL
          ).toFixed(4),
        )

        // ---------------------------
        // CCT ATA
        // ---------------------------

        const mint =
          new PublicKey(
            SOLANA.mint,
          )

        const ata =
          getAssociatedTokenAddressSync(
            mint,
            publicKey,
          )

        setSolAta(
          ata.toBase58(),
        )

        // ---------------------------
        // CCT balance
        // ---------------------------

        const accountInfo =
          await connection.getAccountInfo(
            ata,
          )

        if (!accountInfo) {
          setSolCctBalance('0')
          return
        }

        const tokenBalance =
          await connection
            .getTokenAccountBalance(
              ata,
            )

        setSolCctBalance(
          tokenBalance
            .value
            .uiAmountString ||
            '0',
        )
      } catch (error) {
        console.error(
          'Solana balance error:',
          error,
        )

        setPhantomError(
          'Phantom connected, but Solana balances could not be loaded.',
        )
      } finally {
        setSolBalanceLoading(false)
      }
    }, [])

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
          'Phantom was not detected. Install or enable the Phantom browser extension.',
        )
        return
      }

      try {
        setPhantomLoading(true)

        const response =
          await phantom.connect()

        const address =
          response.publicKey
            .toString()

        setSolAddress(
          address,
        )

        setPhantomLoading(false)

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

        setPhantomLoading(false)
      }
    }

  // ==========================================================
  // METAMASK RESTORE + EVENTS
  // ==========================================================

  useEffect(() => {
    const ethereum =
      getMetaMaskProvider()

    if (!ethereum) {
      return
    }

    const restoreWallet =
      async () => {
        try {
          const accounts =
            await ethereum.request({
              method:
                'eth_accounts',
            })

          if (
            accounts.length > 0
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

    const handleAccountsChanged =
      async (accounts) => {
        if (!accounts.length) {
          setEvmAddress('')
          setEvmChainId(null)
          setEthBalance('0')
          setEthCctBalance('0')

          return
        }

        const address =
          accounts[0]

        setEvmAddress(
          address,
        )

        await loadEthereumAccount(
          address,
        )
      }

    const handleChainChanged =
      async () => {
        const accounts =
          await ethereum.request({
            method:
              'eth_accounts',
          })

        if (
          accounts.length > 0
        ) {
          await loadEthereumAccount(
            accounts[0],
          )
        }
      }

    restoreWallet()

    ethereum.on?.(
      'accountsChanged',
      handleAccountsChanged,
    )

    ethereum.on?.(
      'chainChanged',
      handleChainChanged,
    )

    return () => {
      ethereum.removeListener?.(
        'accountsChanged',
        handleAccountsChanged,
      )

      ethereum.removeListener?.(
        'chainChanged',
        handleChainChanged,
      )
    }
  }, [loadEthereumAccount])

  // ==========================================================
  // PHANTOM RESTORE + EVENTS
  // ==========================================================

  useEffect(() => {
    const phantom =
      getPhantomProvider()

    if (!phantom) {
      return
    }

    const restorePhantom =
      async () => {
        try {
          const response =
            await phantom.connect({
              onlyIfTrusted: true,
            })

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
          // Normal when the user has not
          // previously connected Phantom.
        }
      }

    const handleAccountChanged =
      async (publicKey) => {
        if (!publicKey) {
          setSolAddress('')
          setSolBalance('0')
          setSolCctBalance('0')
          setSolAta('')

          return
        }

        const address =
          publicKey.toString()

        setSolAddress(
          address,
        )

        await loadSolanaAccount(
          address,
        )
      }

    const handleDisconnect =
      () => {
        setSolAddress('')
        setSolBalance('0')
        setSolCctBalance('0')
        setSolAta('')
      }

    restorePhantom()

    phantom.on?.(
      'accountChanged',
      handleAccountChanged,
    )

    phantom.on?.(
      'disconnect',
      handleDisconnect,
    )

    return () => {
      phantom.removeListener?.(
        'accountChanged',
        handleAccountChanged,
      )

      phantom.removeListener?.(
        'disconnect',
        handleDisconnect,
      )
    }
  }, [loadSolanaAccount])

  // ==========================================================
  // BALANCE DISPLAY
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
              LayerZero OFT Bridge
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

      <main className="main">
        {/* HERO */}

        <section className="hero">
          <span className="eyebrow">
            Ethereum ↔ Solana
          </span>

          <h2>
            Bridge CCT across
            <span>
              {' '}
              multiple chains.
            </span>
          </h2>

          <p>
            Transfer CrossChain Token
            between Ethereum Sepolia
            and Solana Devnet through
            LayerZero V2.
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

        {/* WRONG EVM NETWORK */}

        {evmAddress &&
          !isSepolia && (
            <div className="wallet-alert warning">
              <div>
                <strong>
                  Wrong Ethereum network
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

        <section className="bridge-layout">
          {/* BRIDGE CARD */}

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
                      {
                        from.shortName
                      }
                    </strong>

                    <small>
                      {
                        from.networkName
                      }
                    </small>
                  </div>
                </div>

                <div className="amount-wrap">
                  <input
                    value={
                      amount
                    }
                    onChange={(
                      event,
                    ) =>
                      setAmount(
                        event.target
                          .value,
                      )
                    }
                    placeholder="0.0"
                    inputMode="decimal"
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
                      {
                        to.shortName
                      }
                    </strong>

                    <small>
                      {
                        to.networkName
                      }
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
                  --
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
                disabled={
                  phantomLoading
                }
              >
                {phantomLoading
                  ? 'Connecting Phantom...'
                  : 'Connect Phantom'}
              </button>
            ) : (
              <button
                className="bridge-button"
                disabled
              >
                Wallets Connected — Bridge Coming Next
              </button>
            )}

            <p className="helper-text">
              Both wallets must be
              connected before
              cross-chain transfers
              are enabled.
            </p>
          </div>

          {/* SIDE PANEL */}

          <aside className="protocol-panel">
            {/* ETHEREUM WALLET */}

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

                    <strong>
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
                        : `Chain ${evmChainId}`}
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
                <>
                  <h3>
                    Not connected
                  </h3>

                  <p>
                    Connect MetaMask.
                  </p>
                </>
              )}
            </div>

            {/* SOLANA WALLET */}

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
                        title={
                          solAta
                        }
                      >
                        {shortenAddress(
                          solAta,
                        )}
                      </strong>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <h3>
                    Not connected
                  </h3>

                  <p>
                    Connect Phantom
                    to load Solana
                    Devnet balances.
                  </p>
                </>
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

            {/* ETH */}

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

            {/* SOL */}

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