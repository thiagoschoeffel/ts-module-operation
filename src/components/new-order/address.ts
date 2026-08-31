import type { CustomerAddress } from './types'

export function formatAddressStreet(address: CustomerAddress) {
  return [
    address.number ? `${address.street}, ${address.number}` : address.street,
    address.complement
  ].filter(Boolean).join(' · ')
}

export function formatAddressLocation(address: CustomerAddress) {
  return [
    address.neighborhood,
    address.city && address.state ? `${address.city}/${address.state}` : undefined,
    address.postalCode ? `CEP ${address.postalCode}` : undefined
  ].filter(Boolean).join(' · ')
}
