/** Run async work in fixed-size parallel batches (avoids flooding the API). */
export async function mapInBatches(items, batchSize, mapper) {
  const results = []
  for (let i = 0; i < items.length; i += batchSize) {
    const chunk = items.slice(i, i + batchSize)
    const batch = await Promise.all(chunk.map(mapper))
    results.push(...batch)
  }
  return results
}
