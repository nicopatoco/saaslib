import { Controller, Post, Body, Req, BadRequestException } from '@nestjs/common'
import { BaseTurnstileService } from './base-turnstile.service'
import { Request } from 'express'

@Controller('base-turnstile')
export class BaseTurnstileController {
  constructor(private readonly turnstileService: BaseTurnstileService) {}

  @Post('submit')
  async handleFormSubmission(@Req() req: Request, @Body('cf-turnstile-response') token: string) {
    const frontendUrl = process.env.FRONTEND_ENDPOINT || ''
    const expectedHostname = new URL(frontendUrl).hostname

    const ip =
      (req.headers['cf-connecting-ip'] as string) || (req.headers['x-forwarded-for'] as string) || req.ip || null

    const result = await this.turnstileService.validateTurnstileEnhanced(
      token,
      ip,
      'signup', // expected action (set same in widget)
      expectedHostname, // expected hostname
    )

    if (!result.valid) {
      throw new BadRequestException({
        message: 'Invalid Turnstile verification',
        reason: result.reason,
        errors: (result as any).errors ?? null,
      })
    }

    return { ok: true }
  }
}
