import { Test, TestingModule } from '@nestjs/testing'
import { BaseTurnstileService } from './base-turnstile.service'

describe('BaseTurnstileService', () => {
  let service: BaseTurnstileService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BaseTurnstileService],
    }).compile()

    service = module.get<BaseTurnstileService>(BaseTurnstileService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  it('returns valid=true when Turnstile succeeds and action/hostname match', async () => {
    const now = new Date()
    // Optional: freeze Date so tokenAge is deterministic
    const realDate = globalThis.Date

    globalThis.Date = class extends Date {} as any

    const mockResponse = {
      success: true,
      action: 'signup',
      hostname: 'example.com',
      challenge_ts: now.toISOString(),
    }

    jest.spyOn(service as any, 'validateTurnstile').mockResolvedValue(mockResponse)

    const result = await service.validateTurnstileEnhanced('token123', '1.2.3.4', 'signup', 'example.com')

    expect(result.valid).toBe(true)
    expect(result.data).toEqual(mockResponse)
    expect(typeof result.tokenAge).toBe('number')
    expect(result.tokenAge).toBeGreaterThanOrEqual(0)

    globalThis.Date = realDate
  })

  it('returns turnstile_failed when success=false', async () => {
    const mockResponse = {
      success: false,
      'error-codes': ['invalid-input-response'],
    }

    jest.spyOn(service as any, 'validateTurnstile').mockResolvedValue(mockResponse)

    const result = await service.validateTurnstileEnhanced('token123', '1.2.3.4', 'signup', 'example.com')

    expect(result.valid).toBe(false)
    expect(result.reason).toBe('turnstile_failed')
    expect(result.errors).toEqual(['invalid-input-response'])
  })

  it('returns action_mismatch when action does not match', async () => {
    const mockResponse = {
      success: true,
      action: 'login',
      hostname: 'example.com',
      challenge_ts: new Date().toISOString(),
    }

    jest.spyOn(service as any, 'validateTurnstile').mockResolvedValue(mockResponse)

    const result = await service.validateTurnstileEnhanced('token123', '1.2.3.4', 'signup', 'example.com')

    expect(result.valid).toBe(false)
    expect(result.reason).toBe('action_mismatch')
    expect(result.expected).toBe('signup')
    expect(result.received).toBe('login')
  })

  it('returns hostname_mismatch when hostname does not match', async () => {
    const mockResponse = {
      success: true,
      action: 'signup',
      hostname: 'another.com',
      challenge_ts: new Date().toISOString(),
    }

    jest.spyOn(service as any, 'validateTurnstile').mockResolvedValue(mockResponse)

    const result = await service.validateTurnstileEnhanced('token123', '1.2.3.4', 'signup', 'example.com')

    expect(result.valid).toBe(false)
    expect(result.reason).toBe('hostname_mismatch')
    expect(result.expected).toBe('example.com')
    expect(result.received).toBe('another.com')
  })
})
