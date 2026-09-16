import {
  BrowserProvider,
  Contract,
  formatEther,
  formatUnits,
} from 'ethers'

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

  // Multiple wallet extensions may inject providers.
  // Explicitly select MetaMask.
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

  // Ethereum wallet
  const [evmAddress, setEvmAddress] =
    useState('')

  const [evmChainId, setEvmChainId] =
    useState(null)

  const [ethBalance, setEthBalance] =
    useState('0')

  const [
    ethCctBalance,
    setEthCctBalance,
  ] = useState('0')

  const [
    walletLoading,
    setWalletLoading,
  ] = useState(false)

  const [
    balanceLoading,
    setBalanceLoading,
  ] = useState(false)

  const [
    walletError,
    setWalletError,
  ] = useState('')

  const isSepolia =
    evmChainId === ETHEREUM.chainId

  // ============================================================
  // SWITCH BRIDGE DIRECTION
  // ============================================================

  const switchDirection = () => {
    setFrom(to)
    setTo(from)
    setAmount('')
  }

  // ============================================================
  // LOAD ETHEREUM WALLET DATA
  // ============================================================

  const loadEthereumAccount =
    useCallback(async (address) => {
      const ethereum =
        getMetaMaskProvider()

      if (!ethereum || !address) {
        return
      }

      try {
        setBalanceLoading(true)
        setWalletError('')

        // -----------------------------
        // Chain
        // -----------------------------

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

        // -----------------------------
        // Provider
        // -----------------------------

        const provider =
          new BrowserProvider(
            ethereum,
          )

        // -----------------------------
        // ETH balance
        // -----------------------------

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

        // Don't query CCT on wrong network.
        if (
          chainId !==
          ETHEREUM.chainId
        ) {
          setEthCctBalance('0')
          return
        }

        // -----------------------------
        // CCT balance
        // -----------------------------

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
          'Ethereum balance loading error:',
          error,
        )

        setWalletError(
          'MetaMask connected, but wallet balances could not be loaded.',
        )
      } finally {
        setBalanceLoading(false)
      }
    }, [])

  // ============================================================
  // CONNECT METAMASK
  // ============================================================

  const connectMetaMask =
    async () => {
      setWalletError('')

      const ethereum =
        getMetaMaskProvider()

      if (!ethereum) {
        setWalletError(
          'MetaMask was not detected. Make sure the MetaMask extension is installed and enabled.',
        )

        return
      }

      try {
        setWalletLoading(true)

        // First check whether MetaMask
        // already has permission.
        let accounts =
          await ethereum.request({
            method: 'eth_accounts',
          })

        // If not, request permission.
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

        // Mark wallet connected immediately.
        setEvmAddress(address)

        // Important:
        // don't leave UI stuck on
        // "Connecting..." while balances load.
        setWalletLoading(false)

        await loadEthereumAccount(
          address,
        )
      } catch (error) {
        console.error(
          'MetaMask connection error:',
          error,
        )

        if (
          error?.code === 4001
        ) {
          setWalletError(
            'MetaMask connection request was rejected.',
          )
        } else {
          setWalletError(
            error?.message ||
              'Unable to connect MetaMask.',
          )
        }

        setWalletLoading(false)
      }
    }

  // ============================================================
  // SWITCH METAMASK TO SEPOLIA
  // ============================================================

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

      setWalletError('')

      try {
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
        // Sepolia not added to wallet.
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
                    symbol: 'ETH',
                    decimals: 18,
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

            if (evmAddress) {
              await loadEthereumAccount(
                evmAddress,
              )
            }

            return
          } catch (addError) {
            console.error(
              'Add Sepolia error:',
              addError,
            )

            setWalletError(
              addError?.message ||
                'Unable to add Ethereum Sepolia.',
            )

            return
          }
        }

        console.error(
          'Switch network error:',
          error,
        )

        setWalletError(
          error?.message ||
            'Unable to switch MetaMask to Sepolia.',
        )
      }
    }

  // ============================================================
  // RESTORE WALLET + LISTEN FOR CHANGES
  // ============================================================

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
            'Wallet restore error:',
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

        setEvmAddress(address)

        await loadEthereumAccount(
          address,
        )
      }

    const handleChainChanged =
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
            await loadEthereumAccount(
              accounts[0],
            )
          }
        } catch (error) {
          console.error(
            'Chain change error:',
            error,
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

  // ============================================================
  // BALANCE DISPLAY
  // ============================================================

  const fromBalance =
    from === ETHEREUM
      ? evmAddress &&
        isSepolia
        ? ethCctBalance
        : '--'
      : '--'

  const toBalance =
    to === ETHEREUM
      ? evmAddress &&
        isSepolia
        ? ethCctBalance
        : '--'
      : '--'

  // ============================================================
  // UI
  // ============================================================

  return (
    <div className="app">
      {/* ======================
          HEADER
      ====================== */}

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
                ? shortenAddress(
                    evmAddress,
                  )
                : 'Connect MetaMask'}
          </button>
        </div>
      </header>

      {/* ======================
          MAIN
      ====================== */}

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
            Transfer CrossChain
            Token between Ethereum
            Sepolia and Solana
            Devnet through LayerZero
            V2.
          </p>
        </section>

        {/* ERRORS */}

        {walletError && (
          <div className="wallet-alert error">
            {walletError}
          </div>
        )}

        {/* WRONG NETWORK */}

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
                  Ethereum Sepolia to
                  use CCT.
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

        {/* ======================
            BRIDGE
        ====================== */}

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
                    value={amount}
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
                aria-label="Switch bridge direction"
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
                  {amount || '0'}{' '}
                  CCT
                </strong>
              </div>
            </div>

            {/* ACTION BUTTON */}

            {!evmAddress ? (
              <button
                className="bridge-button"
                onClick={
                  connectMetaMask
                }
                disabled={
                  walletLoading
                }
              >
                {walletLoading
                  ? 'Connecting MetaMask...'
                  : 'Connect MetaMask'}
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
            ) : (
              <button
                className="bridge-button"
                disabled
              >
                Solana Wallet Coming Next
              </button>
            )}

            <p className="helper-text">
              Cross-chain sending
              will be enabled after
              Ethereum and Solana
              wallets are connected.
            </p>
          </div>

          {/* ======================
              SIDE PANEL
          ====================== */}

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
                      ETH balance
                    </span>

                    <strong>
                      {balanceLoading
                        ? 'Loading...'
                        : `${ethBalance} ETH`}
                    </strong>
                  </div>

                  <div className="network-detail">
                    <span>
                      CCT balance
                    </span>

                    <strong>
                      {balanceLoading
                        ? 'Loading...'
                        : isSepolia
                          ? `${ethCctBalance} CCT`
                          : '--'}
                    </strong>
                  </div>
                </>
              ) : (
                <>
                  <h3>
                    Not connected
                  </h3>

                  <p>
                    Connect MetaMask
                    to load your
                    Sepolia balances.
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
                  {
                    ETHEREUM.eid
                  }
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

            {/* SOLANA */}

            <div className="info-card">
              <span className="info-label">
                Solana Devnet
              </span>

              <div className="network-detail">
                <span>
                  Endpoint ID
                </span>

                <strong>
                  {
                    SOLANA.eid
                  }
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

            {/* SUPPLY */}

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

      {/* ======================
          FOOTER
      ====================== */}

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