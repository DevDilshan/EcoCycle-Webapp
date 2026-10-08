import { describe, expect, it } from 'vitest'
import { mapComplaintBackendErrors, validateComplaintForm } from './residentComplaint'

describe('validateComplaintForm', () => {
  const pickups = [{ id: 'pickup-1' }]
  const complaints = [{ pickupRequestId: 'pickup-1', status: 'Open' }]

  it('requires pickup, description, and minimum length', () => {
    const errors = validateComplaintForm({}, { pickups, complaints: [] })
    expect(errors.pickupRequestId).toBeDefined()
    expect(errors.description).toBeDefined()
  })

  it('blocks a second open complaint for the same pickup', () => {
    const errors = validateComplaintForm(
      { pickupRequestId: 'pickup-1', description: 'The crew never arrived yesterday.' },
      { pickups, complaints },
    )
    expect(errors.pickupRequestId).toMatch(/already have an open complaint/)
  })

  it('accepts a valid complaint when no duplicate is open', () => {
    const errors = validateComplaintForm(
      { pickupRequestId: 'pickup-1', description: 'The crew never arrived yesterday.' },
      { pickups, complaints: [{ pickupRequestId: 'pickup-1', status: 'Resolved' }] },
    )
    expect(errors).toEqual({})
  })
})

describe('mapComplaintBackendErrors', () => {
  it('camelCases ASP.NET field names', () => {
    expect(
      mapComplaintBackendErrors({ Description: ['Description must be at least 10 characters.'] }),
    ).toEqual({ description: 'Description must be at least 10 characters.' })
  })
})
