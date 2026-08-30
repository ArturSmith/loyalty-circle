import * as React from 'react'
import { Body, Container, Head, Heading, Hr, Html, Link, Preview, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  name?: string
  email?: string
  message?: string
}

const SUPPORT_EMAIL = 'support@clubcarder.com'

const ContactMessage = ({ name, email, message }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{`New contact form message from ${name || 'a visitor'}`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={heading}>New contact message</Heading>
        <Text style={meta}>
          From: <strong>{name || 'Unknown'}</strong>
        </Text>
        <Text style={meta}>
          Email: {email ? <Link href={`mailto:${email}`}>{email}</Link> : '—'}
        </Text>
        <Hr style={hr} />
        <Text style={body}>{message || '(empty message)'}</Text>
        <Hr style={hr} />
        <Text style={footer}>
          Sent from the ClubCarder contact form. Reply directly to this email to respond to the sender.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: ContactMessage,
  subject: (d: Record<string, any>) => `ClubCarder contact — message from ${d?.name || 'visitor'}`,
  displayName: 'Contact form message',
  previewData: { name: 'Jane Doe', email: 'jane@example.com', message: 'Hi! I have a question about loyalty cards.' },
  to: SUPPORT_EMAIL,
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px 25px' }
const heading = { fontSize: '22px', margin: '0 0 16px' }
const meta = { fontSize: '14px', color: '#333333', margin: '4px 0' }
const body = { fontSize: '15px', lineHeight: '24px', color: '#111111', whiteSpace: 'pre-wrap' as const }
const hr = { borderColor: '#e6e6e6', margin: '20px 0' }
const footer = { fontSize: '12px', color: '#888888' }
