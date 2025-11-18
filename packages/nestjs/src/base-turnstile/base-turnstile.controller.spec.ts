import { Test, TestingModule } from '@nestjs/testing'
import { BaseTurnstileController } from './base-turnstile.controller'
import { BaseTurnstileService } from './base-turnstile.service'
import { BadRequestException } from '@nestjs/common'
import { Request } from 'express'

describe('BaseTurnstileController', () => {
  let controller: BaseTurnstileController
  let turnstileService: {
    validateTurnstileEnhanced: jest.Mock
  }

  beforeEach(async () => {
    turnstileService = {
      validateTurnstileEnhanced: jest.fn(),
    }

    const module: TestingModule = await Test.createTestingModule({
      controllers: [BaseTurnstileController],
      providers: [
        {
          provide: BaseTurnstileService,
          useValue: turnstileService,
        },
      ],
    }).compile()

    controller = module.get<BaseTurnstileController>(BaseTurnstileController)
  })

  it('should be defined', () => {
    expect(controller).toBeDefined()
  })

  it('returns { ok: true } when Turnstile is valid', async () => {
    process.env.FRONTEND_ENDPOINT = 'https://example.com'

    const req = {
      headers: {
        'cf-connecting-ip': '1.2.3.4',
      },
      ip: '5.6.7.8',
    } as unknown as Request

    turnstileService.validateTurnstileEnhanced.mockResolvedValue({
      valid: true,
      data: {},
      tokenAge: 0,
    })

    const result = await controller.handleFormSubmission(req, 'token123')

    expect(result).toEqual({ ok: true })
    expect(turnstileService.validateTurnstileEnhanced).toHaveBeenCalledWith(
      'token123',
      '1.2.3.4',
      'signup',
      'example.com',
    )
  })

  it('throws BadRequestException when Turnstile is invalid', async () => {
    process.env.FRONTEND_ENDPOINT = 'https://example.com'

    const req = {
      headers: {
        'cf-connecting-ip': '1.2.3.4',
      },
      ip: '5.6.7.8',
    } as unknown as Request

    const errors = ['invalid-input-response']

    turnstileService.validateTurnstileEnhanced.mockResolvedValue({
      valid: false,
      reason: 'turnstile_failed',
      errors,
    })

    await expect(controller.handleFormSubmission(req, 'token123')).rejects.toBeInstanceOf(BadRequestException)

    await expect(controller.handleFormSubmission(req, 'token123')).rejects.toMatchObject({
      response: {
        message: 'Invalid Turnstile verification',
        reason: 'turnstile_failed',
        errors,
      },
    })
  })
})
