import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiRequest } from '../lib/api'
import { pickupLabel, toSelectOptions } from '../lib/catalog'

export function useCollectorPickups(statuses = ['Pending', 'Classified', 'Approved', 'Scheduled']) {
  const [pickups, setPickups] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const statusKey = statuses.join(',')

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const statusList = statusKey.split(',').filter(Boolean)
      const lists = await Promise.all(
        statusList.map(async (status) => {
          const query = new URLSearchParams({ pageSize: '100', status })
          const data = await apiRequest(`/pickuprequests?${query}`)
          return data.items ?? []
        }),
      )
      const merged = lists.flat()
      setPickups([...new Map(merged.map((p) => [p.id, p])).values()])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [statusKey])

  useEffect(() => { refresh() }, [refresh])

  const pickupOptions = useMemo(
    () => toSelectOptions(pickups, pickupLabel),
    [pickups],
  )

  return { pickups, pickupOptions, loading, error, refresh, pickupLabel }
}
