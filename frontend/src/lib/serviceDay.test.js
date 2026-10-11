import { describe, expect, it } from 'vitest'
import { sameDayOpen, serviceNow, serviceToday } from './serviceDay'

describe('the service day runs on Sri Lanka time', () => {
  it('is already tomorrow in Colombo while UTC is still on today', () => {
    // 20:00 UTC on 10 Oct is 01:30 on 11 Oct in Colombo.
    const now = new Date('2026-10-10T20:00:00Z')
    expect(serviceNow(now)).toMatchObject({ year: 2026, month: 10, day: 11, hour: 1, minute: 30 })
    const today = serviceToday(now)
    expect([today.getFullYear(), today.getMonth() + 1, today.getDate()]).toEqual([2026, 10, 11])
  })

  it('allows a same-day pickup until noon in Colombo, whatever the device clock says', () => {
    expect(sameDayOpen(new Date('2026-10-11T06:29:00Z'))).toBe(true)   // 11:59 in Colombo
    expect(sameDayOpen(new Date('2026-10-11T06:30:00Z'))).toBe(false)  // 12:00 in Colombo
    expect(sameDayOpen(new Date('2026-10-10T18:30:00Z'))).toBe(true)   // 00:00 in Colombo
    expect(sameDayOpen(new Date('2026-10-11T10:30:00Z'))).toBe(false)  // 16:00 in Colombo
  })
})
