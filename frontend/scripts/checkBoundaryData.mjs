import { readFile, readdir } from 'node:fs/promises'
import { normalizeBoundary } from '../src/lib/zoneBoundary.js'

const root = new URL('../public/data/sri-lanka-boundaries/', import.meta.url)
const failures = []
let count = 0
for (const file of await readdir(root)) {
  if (!file.endsWith('.geojson')) continue
  const collection = JSON.parse(await readFile(new URL(file, root), 'utf8'))
  for (const feature of collection.features) {
    count++
    try { normalizeBoundary(feature) }
    catch (error) { failures.push({ code: feature.properties.code, error: error.message }) }
  }
}
console.log(JSON.stringify({ checked: count, failures }, null, 2))
if (failures.length) process.exitCode = 1
