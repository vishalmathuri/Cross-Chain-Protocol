import {
  useEffect,
  useMemo,
  useState,
} from 'react'

import {
  ETHEREUM,
  SOLANA,
} from '../config/protocol'

import {
  getEthereumMessagingReceivedCount,
  quoteEvmMessageToSolana,
  sendEvmMessageToSolana,
} from '../lib/evmMessaging'

import {
  getSolanaMessagingReceivedCount,
  quoteSolanaMessageToEvm,
  sendSolanaMessageToEvm,
} from '../lib/solanaMessaging'

import './MessageBridge.css'

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
    )
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

  return phantom?.isPhantom
    ? phantom
    : null
}

function shortenAddress(
  address,
) {
  if (!address) {
    return '--'
  }

  return `${address.slice(
    0,
    6,
  )}...${address.slice(-4)}`
}

function sleep(ms) {
  return new Promise(
    (resolve) =>
      setTimeout(
        resolve,
        ms,
      ),
  )
}

function MessageBridge() {
  const [
    direction,
    setDirection,
  ] = useState(
    'evm-sol',
  )

  const [
    evmAddress,
    setEvmAddress,
  ] = useState('')

  const [
    evmChainId,
    setEvmChainId,
  ] = useState(null)

  const [
    solAddress,
    setSolAddress,
  ] = useState('')

  const [
    message,
    setMessage,
  ] = useState('')

  const [
    quote,
    setQuote,
  ] = useState(null)

  const [
    quoteLoading,
    setQuoteLoading,
  ] = useState(false)

  const [
    sendLoading,
    setSendLoading,
  ] = useState(false)

  const [
    error,
    setError,
  ] = useState('')

  const [
    result,
    setResult,
  ] = useState(null)

  const [
    deliveryStatus,
    setDeliveryStatus,
  ] = useState('idle')

  const isEvmToSolana =
    direction ===
    'evm-sol'

  const routeLabel =
    isEvmToSolana
      ? 'Ethereum Sepolia → Solana Devnet'
      : 'Solana Devnet → Ethereum Sepolia'

  const byteLength =
    useMemo(
      () =>
        new TextEncoder()
          .encode(
            message,
          )
          .length,
      [
        message,
      ],
    )

  const isSepolia =
    evmChainId ===
    ETHEREUM.chainId

  const resetTransfer = () => {
    setQuote(null)
    setResult(null)
    setError('')
    setDeliveryStatus(
      'idle',
    )
  }

  useEffect(() => {
    resetTransfer()
  }, [
    direction,
    message,
  ])

  useEffect(() => {
    const ethereum =
      getMetaMaskProvider()

    if (ethereum) {
      ethereum
        .request({
          method:
            'eth_accounts',
        })
        .then(
          async (
            accounts,
          ) => {
            if (
              accounts?.[0]
            ) {
              setEvmAddress(
                accounts[0],
              )
            }

            const chainId =
              await ethereum
                .request({
                  method:
                    'eth_chainId',
                })

            setEvmChainId(
              Number(
                chainId,
              ),
            )
          },
        )
        .catch(
          () => {},
        )
    }

    const phantom =
      getPhantomProvider()

    if (
      phantom?.publicKey
    ) {
      setSolAddress(
        phantom
          .publicKey
          .toString(),
      )
    }
  }, [])

  const connectMetaMask =
    async () => {
      setError('')

      const ethereum =
        getMetaMaskProvider()

      if (!ethereum) {
        setError(
          'MetaMask was not detected.',
        )

        return
      }

      try {
        const accounts =
          await ethereum
            .request({
              method:
                'eth_requestAccounts',
            })

        const chainId =
          await ethereum
            .request({
              method:
                'eth_chainId',
            })

        setEvmAddress(
          accounts?.[0] ||
          '',
        )

        setEvmChainId(
          Number(
            chainId,
          ),
        )
      } catch (connectError) {
        setError(
          connectError?.message ||
          'Unable to connect MetaMask.',
        )
      }
    }

  const switchToSepolia =
    async () => {
      const ethereum =
        getMetaMaskProvider()

      if (!ethereum) {
        setError(
          'MetaMask was not detected.',
        )

        return
      }

      try {
        await ethereum
          .request({
            method:
              'wallet_switchEthereumChain',
            params: [
              {
                chainId:
                  ETHEREUM.chainIdHex,
              },
            ],
          })

        setEvmChainId(
          ETHEREUM.chainId,
        )
      } catch (switchError) {
        setError(
          switchError?.message ||
          'Unable to switch MetaMask to Sepolia.',
        )
      }
    }

  const connectPhantom =
    async () => {
      setError('')

      const phantom =
        getPhantomProvider()

      if (!phantom) {
        setError(
          'Phantom was not detected.',
        )

        return
      }

      try {
        const response =
          phantom.publicKey
            ? {
                publicKey:
                  phantom.publicKey,
              }
            : await phantom
                .connect()

        const address =
          response
            ?.publicKey
            ?.toString()

        if (!address) {
          throw new Error(
            'Phantom did not return an address.',
          )
        }

        setSolAddress(
          address,
        )
      } catch (connectError) {
        setError(
          connectError?.message ||
          'Unable to connect Phantom.',
        )
      }
    }

  const validateReady =
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

      if (
        byteLength === 0
      ) {
        throw new Error(
          'Enter a message.',
        )
      }

      if (
        byteLength >
        4096
      ) {
        throw new Error(
          'Message exceeds the 4096-byte protocol limit.',
        )
      }
    }

  const quoteFee =
    async () => {
      setError('')
      setResult(null)
      setQuote(null)

      try {
        validateReady()

        setQuoteLoading(
          true,
        )

        if (
          isEvmToSolana
        ) {
          const response =
            await quoteEvmMessageToSolana({
              ethereumProvider:
                getMetaMaskProvider(),
              message,
              solanaReceiver:
                solAddress,
            })

          setQuote({
            route:
              direction,
            value:
              response
                .nativeFeeEth,
            symbol:
              'ETH',
          })
        } else {
          const response =
            await quoteSolanaMessageToEvm({
              phantomProvider:
                getPhantomProvider(),
              message,
              evmReceiver:
                evmAddress,
            })

          setQuote({
            route:
              direction,
            value:
              response
                .nativeFeeSol,
            symbol:
              'SOL',
          })
        }
      } catch (quoteError) {
        setError(
          quoteError
            ?.shortMessage ||
          quoteError
            ?.reason ||
          quoteError
            ?.message ||
          'Unable to quote the LayerZero fee.',
        )
      } finally {
        setQuoteLoading(
          false,
        )
      }
    }

  const waitForDelivery =
    async (
      previousCount,
    ) => {
      setDeliveryStatus(
        'pending',
      )

      for (
        let attempt = 1;
        attempt <= 60;
        attempt += 1
      ) {
        await sleep(
          5000,
        )

        try {
          const current =
            isEvmToSolana
              ? await getSolanaMessagingReceivedCount()
              : await getEthereumMessagingReceivedCount()

          if (
            current >
            previousCount
          ) {
            setDeliveryStatus(
              'delivered',
            )

            return
          }
        } catch {
          // Keep polling until the
          // delivery window expires.
        }
      }

      setDeliveryStatus(
        'timeout',
      )
    }

  const sendMessage =
    async () => {
      setError('')
      setResult(null)

      try {
        validateReady()

        if (
          !quote ||
          quote.route !==
            direction
        ) {
          throw new Error(
            'Quote the LayerZero fee again before sending.',
          )
        }

        const confirmed =
          window.confirm(
            [
              'Send cross-chain message?',
              '',
              routeLabel,
              '',
              `Message: ${message}`,
              '',
              `LayerZero fee: ~${quote.value} ${quote.symbol}`,
            ].join(
              '\n',
            ),
          )

        if (!confirmed) {
          return
        }

        setSendLoading(
          true,
        )

        const beforeCount =
          isEvmToSolana
            ? await getSolanaMessagingReceivedCount()
            : await getEthereumMessagingReceivedCount()

        const response =
          isEvmToSolana
            ? await sendEvmMessageToSolana({
                ethereumProvider:
                  getMetaMaskProvider(),
                evmAddress,
                message,
                solanaReceiver:
                  solAddress,
              })
            : await sendSolanaMessageToEvm({
                phantomProvider:
                  getPhantomProvider(),
                message,
                evmReceiver:
                  evmAddress,
              })

        setResult({
          ...response,
          route:
            routeLabel,
          message,
        })

        setQuote(null)

        waitForDelivery(
          beforeCount,
        )
      } catch (sendError) {
        setError(
          sendError
            ?.shortMessage ||
          sendError
            ?.reason ||
          sendError
            ?.message ||
          'Cross-chain message failed.',
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

  const flipDirection =
    () => {
      setDirection(
        (current) =>
          current ===
          'evm-sol'
            ? 'sol-evm'
            : 'evm-sol',
      )
    }

  const quoteReady =
    quote?.route ===
    direction

  return (
    <section
      className="message-section"
      id="messaging"
    >
      <div className="message-heading">
        <span className="message-kicker">
          Application Messaging
        </span>

        <h2>
          Send a cross-chain
          message
        </h2>

        <p>
          Send structured UTF-8
          application data through
          the deployed LayerZero V2
          messaging protocol.
        </p>
      </div>

      <div className="message-grid">
        <div className="message-card">
          <div className="message-route">
            <div>
              <span>
                Source
              </span>

              <strong>
                {isEvmToSolana
                  ? 'Ethereum Sepolia'
                  : 'Solana Devnet'}
              </strong>
            </div>

            <button
              type="button"
              className="message-flip"
              onClick={
                flipDirection
              }
              disabled={
                sendLoading ||
                deliveryStatus ===
                  'pending'
              }
              aria-label="Reverse message direction"
            >
              ⇄
            </button>

            <div>
              <span>
                Destination
              </span>

              <strong>
                {isEvmToSolana
                  ? 'Solana Devnet'
                  : 'Ethereum Sepolia'}
              </strong>
            </div>
          </div>

          <div className="message-wallets">
            <button
              type="button"
              onClick={
                connectMetaMask
              }
              className={
                evmAddress
                  ? 'message-wallet connected'
                  : 'message-wallet'
              }
            >
              MetaMask:{' '}
              {evmAddress
                ? shortenAddress(
                    evmAddress,
                  )
                : 'Connect'}
            </button>

            {!isSepolia &&
              evmAddress && (
                <button
                  type="button"
                  className="message-wallet warning"
                  onClick={
                    switchToSepolia
                  }
                >
                  Switch to Sepolia
                </button>
              )}

            <button
              type="button"
              onClick={
                connectPhantom
              }
              className={
                solAddress
                  ? 'message-wallet connected'
                  : 'message-wallet'
              }
            >
              Phantom:{' '}
              {solAddress
                ? shortenAddress(
                    solAddress,
                  )
                : 'Connect'}
            </button>
          </div>

          <label
            className="message-label"
            htmlFor="cross-chain-message"
          >
            Message
          </label>

          <textarea
            id="cross-chain-message"
            className="message-input"
            value={
              message
            }
            onChange={
              (event) =>
                setMessage(
                  event
                    .target
                    .value,
                )
            }
            placeholder={
              isEvmToSolana
                ? 'Hello from Ethereum Sepolia to Solana Devnet'
                : 'Hello from Solana Devnet to Ethereum Sepolia'
            }
            rows={5}
            disabled={
              sendLoading ||
              deliveryStatus ===
                'pending'
            }
          />

          <div className="message-meta">
            <span>
              {byteLength} / 4096
              bytes
            </span>

            <span>
              {routeLabel}
            </span>
          </div>

          {quoteReady && (
            <div className="message-quote">
              <span>
                Estimated LayerZero
                fee
              </span>

              <strong>
                ~{quote.value}{' '}
                {quote.symbol}
              </strong>
            </div>
          )}

          {error && (
            <div className="message-error">
              {error}
            </div>
          )}

          <div className="message-actions">
            <button
              type="button"
              className="message-secondary"
              onClick={
                quoteFee
              }
              disabled={
                quoteLoading ||
                sendLoading ||
                byteLength ===
                  0 ||
                deliveryStatus ===
                  'pending'
              }
            >
              {quoteLoading
                ? 'Quoting...'
                : 'Quote LayerZero Fee'}
            </button>

            <button
              type="button"
              className="message-primary"
              onClick={
                sendMessage
              }
              disabled={
                !quoteReady ||
                sendLoading ||
                deliveryStatus ===
                  'pending'
              }
            >
              {sendLoading
                ? isEvmToSolana
                  ? 'Waiting for MetaMask...'
                  : 'Waiting for Phantom...'
                : 'Send Message'}
            </button>
          </div>

          {result && (
            <div className="message-result">
              <strong>
                Source transaction
                confirmed ✅
              </strong>

              <span>
                {result.route}
              </span>

              <code>
                {result.message}
              </code>

              {deliveryStatus ===
                'pending' && (
                <span>
                  ⏳ Waiting for
                  LayerZero delivery...
                </span>
              )}

              {deliveryStatus ===
                'delivered' && (
                <span>
                  ✅ Destination
                  protocol received
                  the message.
                </span>
              )}

              {deliveryStatus ===
                'timeout' && (
                <span>
                  ⏳ Delivery was
                  not detected within
                  five minutes. Check
                  LayerZero Scan.
                </span>
              )}

              <a
                href={
                  result.explorer
                }
                target="_blank"
                rel="noreferrer"
              >
                View source
                transaction on{' '}
                {
                  result.explorerName
                }{' '}
                ↗
              </a>

              <a
                href={
                  result.layerZeroScan
                }
                target="_blank"
                rel="noreferrer"
              >
                Track on LayerZero
                Scan ↗
              </a>
            </div>
          )}
        </div>

        <aside className="message-info">
          <div>
            <span>
              Ethereum Router
            </span>

            <strong>
              {shortenAddress(
                '0x355BD2bdF11D4B2528BC465422AB97EA9843f5a5',
              )}
            </strong>
          </div>

          <div>
            <span>
              Solana OApp
            </span>

            <strong>
              {shortenAddress(
                '86twc7j7pKySmWBV7pRBFkDkxqKs3bzJMjLCatjaKLSi',
              )}
            </strong>
          </div>

          <div>
            <span>
              Ethereum EID
            </span>

            <strong>
              {ETHEREUM.eid}
            </strong>
          </div>

          <div>
            <span>
              Solana EID
            </span>

            <strong>
              {SOLANA.eid}
            </strong>
          </div>

          <p>
            Messages use application
            nonces, peer validation,
            LayerZero GUID replay
            protection and
            destination delivery
            tracking.
          </p>
        </aside>
      </div>
    </section>
  )
}

export default MessageBridge
