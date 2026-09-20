export function getMetaMaskProvider() {
  if (typeof window === 'undefined') return null

  const ethereum = window.ethereum

  if (!ethereum) return null

  if (
    Array.isArray(ethereum.providers) &&
    ethereum.providers.length > 0
  ) {
    const metamask = ethereum.providers.find(
      (provider) =>
        provider.isMetaMask &&
        !provider.isPhantom
    )

    if (metamask) return metamask
  }

  if (
    ethereum.isMetaMask &&
    !ethereum.isPhantom
  ) {
    return ethereum
  }

  return null
}