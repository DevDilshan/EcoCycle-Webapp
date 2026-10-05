import test from 'node:test'
import assert from 'node:assert/strict'
import { filterServiceAreas } from './serviceAreaSearch.js'

const zones = [
  { id: 1, name: 'Colombo North' }, { id: 2, name: 'Colombo South' },
  { id: 3, name: 'Malabe' }, { id: 4, name: 'Nittambuwa' },
]

test('area search handles partial names, mixed case and multiple words in any order', () => {
  assert.deepEqual(filterServiceAreas(zones, '  COLOM  ').map((zone) => zone.id), [1, 2])
  assert.deepEqual(filterServiceAreas(zones, 'north colombo').map((zone) => zone.id), [1])
  assert.deepEqual(filterServiceAreas(zones, 'nittam').map((zone) => zone.id), [4])
  assert.deepEqual(filterServiceAreas(zones, 'south malabe'), [])
})

test('empty and unmatched searches preserve the source and support international names', () => {
  assert.deepEqual(filterServiceAreas(zones, '  '), zones)
  assert.deepEqual(filterServiceAreas(zones, 'not-a-city'), [])
  assert.equal(filterServiceAreas([{ name: 'São Paulo' }], 'sao').length, 1)
  assert.equal(filterServiceAreas([{ name: 'කොළඹ' }], 'කොළඹ').length, 1)
  assert.equal(filterServiceAreas([{ name: null }], 'colombo').length, 0)
  assert.equal(zones.length, 4)
})
