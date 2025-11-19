import { SESClient } from '@aws-sdk/client-ses'
import { Test, TestingModule } from '@nestjs/testing'
import sgMail from '@sendgrid/mail'
import { MailerSend as MailerSendMock, Sender as SenderMock } from 'mailersend'
import { EmailService } from './email.service'

// Mock SendGrid
jest.mock('@sendgrid/mail', () => {
  const mockMails = {
    setApiKey: jest.fn(),
    send: jest.fn().mockResolvedValue([{}, {}]),
  }
  return {
    __esModule: true,
    ...mockMails,
    default: mockMails,
  }
})

// Mock SES
jest.mock('@aws-sdk/client-ses')

// Mock MailerSend
jest.mock('mailersend', () => {
  return {
    MailerSend: jest.fn().mockImplementation(() => ({
      email: {
        send: jest.fn().mockResolvedValue({ statusCode: 202 }),
      },
    })),
    EmailParams: jest.fn().mockImplementation(() => ({
      setFrom: jest.fn().mockReturnThis(),
      setTo: jest.fn().mockReturnThis(),
      setReplyTo: jest.fn().mockReturnThis(),
      setSubject: jest.fn().mockReturnThis(),
      setHtml: jest.fn().mockReturnThis(),
    })),
    Sender: jest.fn(),
    Recipient: jest.fn(),
  }
})

describe('EmailService', () => {
  let service: EmailService
  const mockOptions = {
    email: {
      from: 'test@example.com',
      templates: {},
    },
  }

  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
    jest.clearAllMocks()
  })

  afterAll(() => {
    process.env = originalEnv
  })

  const createService = async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        {
          provide: 'SL_OPTIONS',
          useValue: mockOptions,
        },
      ],
    }).compile()

    return module.get<EmailService>(EmailService)
  }

  it('should initialize MailerSend if MAILERSEND_API_KEY is present', async () => {
    process.env.MAILERSEND_API_KEY = 'mlsn.test-key'
    delete process.env.SENDGRID_API_KEY
    delete process.env.AWS_SES_ACCESS_KEY_ID

    service = await createService()

    // Check if MailerSend constructor was called
    // Check if MailerSend constructor was called
    expect(MailerSendMock).toHaveBeenCalledWith({ apiKey: 'mlsn.test-key' })
    expect(service['mailerSendClient']).toBeDefined()
    expect(service['sendGridEnabled']).toBe(false)
  })

  it('should initialize SendGrid if MAILERSEND_API_KEY is missing and SENDGRID_API_KEY is present', async () => {
    delete process.env.MAILERSEND_API_KEY
    process.env.SENDGRID_API_KEY = 'SG.test-key'
    delete process.env.AWS_SES_ACCESS_KEY_ID

    service = await createService()

    expect(sgMail.setApiKey).toHaveBeenCalledWith('SG.test-key')
    expect(service['sendGridEnabled']).toBe(true)
    expect(service['mailerSendClient']).toBeUndefined()
  })

  it('should initialize SES if both MailerSend and SendGrid are missing', async () => {
    delete process.env.MAILERSEND_API_KEY
    delete process.env.SENDGRID_API_KEY
    process.env.AWS_SES_ACCESS_KEY_ID = 'test-access-key'
    process.env.AWS_SES_SECRET_ACCESS_KEY = 'test-secret-key'
    process.env.AWS_SES_REGION = 'us-east-1'

    service = await createService()

    expect(sgMail.setApiKey).not.toHaveBeenCalled()
    expect(service['sendGridEnabled']).toBe(false)
    expect(service['mailerSendClient']).toBeUndefined()
    expect(SESClient).toHaveBeenCalled()
  })

  it('should send email via MailerSend if enabled', async () => {
    process.env.MAILERSEND_API_KEY = 'mlsn.test-key'
    service = await createService()

    const to = ['recipient@example.com']
    const subject = 'Test Subject'
    const body = '<p>Test Body</p>'

    await service.sendEmail(to, subject, body)

    // Get the instance created
    const mailerSendInstance = (MailerSendMock as unknown as jest.Mock).mock.results[0].value
    expect(mailerSendInstance.email.send).toHaveBeenCalled()
  })

  it('should handle formatted "Name <email>" in config for MailerSend', async () => {
    process.env.MAILERSEND_API_KEY = 'mlsn.test-key'
    mockOptions.email.from = 'Test Sender <test@example.com>'
    service = await createService()

    const to = ['recipient@example.com']
    const subject = 'Test Subject'
    const body = '<p>Test Body</p>'

    await service.sendEmail(to, subject, body)

    // Verify Sender was created with extracted email
    expect(MailerSendMock).toHaveBeenCalled()
    // We can't easily check the Sender constructor arguments because it's instantiated inside the method
    // But we can check if the send method was called, implying no error in Sender creation (if we were running real code)
    // In mock land, we just verify the flow.

    // Actually, we can spy on the Sender import if we exported it or mocked it differently.
    // But since we mocked the whole module, `Sender` is also a mock.
    expect(SenderMock).toHaveBeenCalledWith('test@example.com', 'NailVision')

    // Reset mockOptions
    mockOptions.email.from = 'test@example.com'
  })

  it('should send email via SendGrid if enabled', async () => {
    delete process.env.MAILERSEND_API_KEY
    process.env.SENDGRID_API_KEY = 'SG.test-key'
    service = await createService()

    const to = ['recipient@example.com']
    const subject = 'Test Subject'
    const body = '<p>Test Body</p>'

    await service.sendEmail(to, subject, body)

    expect(sgMail.send).toHaveBeenCalledWith({
      to: to,
      from: mockOptions.email.from,
      subject: subject,
      html: body,
      headers: undefined,
    })
  })

  it('should include unsubscribe headers for SendGrid if unsubscribeUrl is provided', async () => {
    delete process.env.MAILERSEND_API_KEY
    process.env.SENDGRID_API_KEY = 'SG.test-key'
    service = await createService()

    const to = ['recipient@example.com']
    const subject = 'Test Subject'
    const body = '<p>Test Body</p>'
    const unsubscribeUrl = 'https://example.com/unsubscribe'

    await service.sendEmail(to, subject, body, unsubscribeUrl)

    expect(sgMail.send).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: {
          'List-Unsubscribe': `<mailto:${mockOptions.email.from}?subject=unsubscribe>, <${unsubscribeUrl}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
      }),
    )
  })
})
