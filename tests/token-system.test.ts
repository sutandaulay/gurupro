import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  pool: {},
  query: vi.fn(),
}))

import { evaluateTokenAccess } from '@/lib/token-system'

describe('evaluateTokenAccess', () => {
  describe('admin role', () => {
    it('allows admin regardless of token balance', () => {
      const result = evaluateTokenAccess({
        role: 'admin',
        totalPoinAvailable: 0,
        subscriptionEnd: null,
        subscriptionStatus: 'active',
      })
      expect(result.allowed).toBe(true)
      expect(result.reason).toBe('ok')
    })

    it('allows admin with negative tokens', () => {
      const result = evaluateTokenAccess({
        role: 'admin',
        totalPoinAvailable: -10,
        subscriptionEnd: null,
        subscriptionStatus: 'active',
      })
      expect(result.allowed).toBe(true)
      expect(result.remainingTokens).toBe(-10)
    })
  })

  describe('subscription locked', () => {
    it('denies access when subscription is locked', () => {
      const result = evaluateTokenAccess({
        role: 'guru',
        totalPoinAvailable: 100,
        subscriptionEnd: '2025-12-31',
        subscriptionStatus: 'locked',
      })
      expect(result.allowed).toBe(false)
      expect(result.reason).toBe('subscription_expired')
    })
  })

  describe('subscription expired', () => {
    it('denies access when subscription has ended', () => {
      const pastDate = new Date(Date.now() - 86400000).toISOString()
      const result = evaluateTokenAccess({
        role: 'guru',
        totalPoinAvailable: 100,
        subscriptionEnd: pastDate,
        subscriptionStatus: 'active',
      })
      expect(result.allowed).toBe(false)
      expect(result.reason).toBe('subscription_expired')
    })

    it('allows access during grace period', () => {
      const pastDate = new Date(Date.now() - 86400000).toISOString()
      const result = evaluateTokenAccess({
        role: 'guru',
        totalPoinAvailable: 100,
        subscriptionEnd: pastDate,
        subscriptionStatus: 'grace_period',
      })
      expect(result.allowed).toBe(true)
      expect(result.reason).toBe('ok')
    })

    it('allows access when subscription is in future', () => {
      const futureDate = new Date(Date.now() + 86400000).toISOString()
      const result = evaluateTokenAccess({
        role: 'guru',
        totalPoinAvailable: 100,
        subscriptionEnd: futureDate,
        subscriptionStatus: 'active',
      })
      expect(result.allowed).toBe(true)
      expect(result.reason).toBe('ok')
    })
  })

  describe('token depletion', () => {
    it('denies access when tokens are depleted', () => {
      const futureDate = new Date(Date.now() + 86400000).toISOString()
      const result = evaluateTokenAccess({
        role: 'guru',
        totalPoinAvailable: 0,
        subscriptionEnd: futureDate,
        subscriptionStatus: 'active',
      })
      expect(result.allowed).toBe(false)
      expect(result.reason).toBe('token_habis')
    })

    it('denies access when tokens are negative', () => {
      const futureDate = new Date(Date.now() + 86400000).toISOString()
      const result = evaluateTokenAccess({
        role: 'guru',
        totalPoinAvailable: -5,
        subscriptionEnd: futureDate,
        subscriptionStatus: 'active',
      })
      expect(result.allowed).toBe(false)
      expect(result.reason).toBe('token_habis')
    })

    it('allows access when tokens are available', () => {
      const futureDate = new Date(Date.now() + 86400000).toISOString()
      const result = evaluateTokenAccess({
        role: 'guru',
        totalPoinAvailable: 50,
        subscriptionEnd: futureDate,
        subscriptionStatus: 'active',
      })
      expect(result.allowed).toBe(true)
      expect(result.reason).toBe('ok')
      expect(result.remainingTokens).toBe(50)
    })
  })

  describe('default role', () => {
    it('defaults to guru role when not specified', () => {
      const futureDate = new Date(Date.now() + 86400000).toISOString()
      const result = evaluateTokenAccess({
        totalPoinAvailable: 50,
        subscriptionEnd: futureDate,
        subscriptionStatus: 'active',
      })
      expect(result.allowed).toBe(true)
      expect(result.reason).toBe('ok')
    })
  })

  describe('edge cases', () => {
    it('handles null subscriptionEnd', () => {
      const result = evaluateTokenAccess({
        role: 'guru',
        totalPoinAvailable: 100,
        subscriptionEnd: null,
        subscriptionStatus: 'active',
      })
      expect(result.allowed).toBe(true)
      expect(result.reason).toBe('ok')
    })

    it('handles invalid subscriptionEnd', () => {
      const result = evaluateTokenAccess({
        role: 'guru',
        totalPoinAvailable: 100,
        subscriptionEnd: 'invalid-date',
        subscriptionStatus: 'active',
      })
      expect(result.allowed).toBe(true)
      expect(result.reason).toBe('ok')
    })

    it('handles undefined values', () => {
      const result = evaluateTokenAccess({
        role: undefined,
        totalPoinAvailable: undefined,
        subscriptionEnd: undefined,
        subscriptionStatus: undefined,
      })
      expect(result.allowed).toBe(false)
      expect(result.reason).toBe('token_habis')
    })
  })
})