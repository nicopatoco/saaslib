import { Test, TestingModule } from '@nestjs/testing'
import * as dotenv from 'dotenv'
import * as path from 'path'
import { EmailService } from './email.service'

dotenv.config({ path: path.resolve(__dirname, '../../../.env') })

const buildEmail = (title: string, content: string) => `
  <!DOCTYPE html>
  <html>
  <head>
    <title>${title}</title>
    <meta charset="utf-8" />
  </head>
  <body style="font-family: sans-serif;">
    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
      ${content}
    </div>
  </body>
  </html>
`

describe.skip('EmailService (MailerSend E2E)', () => {
  let service: EmailService

  beforeAll(async () => {
    if (!process.env.MAILERSEND_API_KEY) {
      console.warn('Skipping MailerSend E2E test: MAILERSEND_API_KEY not found')
      return
    }

    // Set necessary env vars for templates
    process.env.VERIFY_EMAIL_URL = 'https://nailvision.beauty/verify'

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        {
          provide: 'SL_OPTIONS',
          useValue: {
            email: {
              from: 'noreply@nailvision.beauty',
              senderName: 'NailVision',
              templates: {
                verification: {
                  subject: () => 'Verify your email for NailVision',
                  html: (vars: any) =>
                    buildEmail(
                      'Verify your email',
                      `
                      <h1 style="margin:0 0 16px;font-size:22px;color:#111827;">Confirm your email</h1>
                      <p>Hi ${vars.user?.name ?? 'there'},</p>
                      <p>
                        Thanks for signing up to <strong>NailVision</strong>. Please verify your email address to
                        secure your account and start using the platform.
                      </p>
                      <p style="margin:24px 0;">
                        <a href="${vars.link}" 
                           style="display:inline-block;padding:10px 18px;border-radius:999px;background-color:#f43f5e;color:#ffffff;
                                  text-decoration:none;font-weight:600;font-size:14px;">
                          Verify email
                        </a>
                      </p>
                    `,
                    ),
                },
              },
            },
          },
        },
      ],
    }).compile()

    service = module.get<EmailService>(EmailService)
  })

  it('should send a verification email using MailerSend', async () => {
    if (!process.env.MAILERSEND_API_KEY) {
      return
    }

    const user: any = {
      _id: 'test-user-id',
      email: 'test@gmail.com',
      name: 'test',
    }
    const code = '123456'

    console.log(`Sending verification email to ${user.email}...`)
    await service.sendVerificationEmail(user, code)
    console.log('Verification email sent successfully.')
  }, 30000)
})
