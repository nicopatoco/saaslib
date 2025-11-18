import { Injectable } from '@nestjs/common'

@Injectable()
export class BaseTurnstileService {
  private readonly secretKey: string = process.env.TURNSTILE_SECRET_KEY

  constructor() {}

  private async validateTurnstile(token: string, remoteip: string | null) {
    const formData = new FormData()
    formData.append('secret', this.secretKey)
    formData.append('response', token)
    if (remoteip) {
      formData.append('remoteip', remoteip)
    }

    try {
      const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()
      return result
    } catch (error) {
      console.error('Turnstile validation error:', error)
      return { success: false, 'error-codes': ['internal-error'] }
    }
  }

  async validateTurnstileEnhanced(
    token: string,
    remoteip: string | null,
    expectedAction?: string | null,
    expectedHostname?: string | null,
  ) {
    const validation = await this.validateTurnstile(token, remoteip)

    if (!validation.success) {
      return {
        valid: false,
        reason: 'turnstile_failed',
        errors: validation['error-codes'],
      }
    }

    if (expectedAction && validation.action !== expectedAction) {
      return {
        valid: false,
        reason: 'action_mismatch',
        expected: expectedAction,
        received: validation.action,
      }
    }

    if (expectedHostname && validation.hostname !== expectedHostname) {
      return {
        valid: false,
        reason: 'hostname_mismatch',
        expected: expectedHostname,
        received: validation.hostname,
      }
    }

    const challengeTime = new Date(validation.challenge_ts)
    const now = new Date()
    const ageMinutes = (now.getTime() - challengeTime.getTime()) / (1000 * 60)

    if (ageMinutes > 4) {
      console.warn(`Turnstile token is ${ageMinutes.toFixed(1)} minutes old`)
    }

    return {
      valid: true,
      data: validation,
      tokenAge: ageMinutes,
    }
  }
}
