import test from 'node:test'
import assert from 'node:assert/strict'
import { pickupDirections, pickupPoint } from './mapLocation.js'

test('pins require a valid numeric pair; missing coordinates never turn into zero', () => {
  for (const value of [{}, { latitude: null, longitude: null }, { latitude: 6.9 },
    { latitude: 91, longitude: 79 }, { latitude: 6, longitude: NaN }, { latitude: '6.9', longitude: 79 }]) {
    assert.equal(pickupPoint(value), null)
  }
  assert.deepEqual(pickupPoint({ latitude: 0, longitude: 0 }), [0, 0])
})
test('directions prefer a confirmed pin and safely fall back to the address', () => {
  const pin = new URL(pickupDirections({ latitude: 6.9, longitude: 79.8, address: 'Old address' }))
  assert.equal(pin.searchParams.get('destination'), '6.9,79.8')
  const address = '14/2 Park Road & Lane, Colombo'
  assert.equal(new URL(pickupDirections({ address })).searchParams.get('destination'), address)
  assert.equal(pickupDirections({ address: ' ' }), null)
})
