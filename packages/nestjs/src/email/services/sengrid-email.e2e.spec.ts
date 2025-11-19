import { Test, TestingModule } from '@nestjs/testing'
import { EmailService } from './email.service'
import * as path from 'path'
import * as dotenv from 'dotenv'

dotenv.config({ path: path.resolve(__dirname, '../../../.env') })

describe.skip('EmailService (E2E)', () => {
  let service: EmailService

  beforeAll(async () => {
    if (!process.env.SENDGRID_API_KEY) {
      console.warn('Skipping SendGrid E2E test: SENDGRID_API_KEY not found')
      return
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        {
          provide: 'SL_OPTIONS',
          useValue: {
            email: {
              from: 'noreply@nailvision.beauty',
              senderName: 'NailVision E2E Test',
              templates: {},
            },
          },
        },
      ],
    }).compile()

    service = module.get<EmailService>(EmailService)
  })

  it('should send an email using SendGrid', async () => {
    if (!process.env.SENDGRID_API_KEY) {
      return
    }

    const to = ['test@gmail.com'] // change to a valid email
    const subject = 'E2E Test Email from SendGrid'
    const body = '<p>This is an E2E test email sent via SendGrid integration.</p>'

    await service.sendEmail(to, subject, body)
    // If no error is thrown, it means it succeeded (or at least the API accepted it)
  }, 30000) // Increase timeout for network request
})
