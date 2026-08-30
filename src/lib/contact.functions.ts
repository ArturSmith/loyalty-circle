import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

const contactSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(255),
  message: z.string().trim().min(5).max(2000),
})

export const sendContactMessage = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => contactSchema.parse(data))
  .handler(async ({ data }) => {
    const { sendTemplateEmail } = await import('@/lib/email-templates/send-email')
    const result = await sendTemplateEmail('contact-message', 'support@clubcarder.com', {
      templateData: { name: data.name, email: data.email, message: data.message },
      replyTo: data.email,
      idempotencyKey: `contact-${data.email}-${Math.floor(Date.now() / 60000)}`,
    })
    return result
  })
