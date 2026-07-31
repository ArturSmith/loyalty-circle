import * as React from 'react'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Text,
} from '@react-email/components'

import {
  brand,
  button,
  container,
  fallbackLabel,
  fallbackUrl,
  footer,
  h1,
  hr,
  link,
  main,
  text,
} from './theme'

interface EmailChangeEmailProps {
  siteName: string
  oldEmail: string
  email: string
  newEmail: string
  confirmationUrl: string
}

export const EmailChangeEmail = ({
  siteName,
  oldEmail,
  newEmail,
  confirmationUrl,
}: EmailChangeEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Confirm your new email address for {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>{siteName}</Text>
        <Heading style={h1}>Confirm your email change</Heading>
        <Text style={text}>
          You asked to change the email on your {siteName} account from{' '}
          {oldEmail} to {newEmail}. Confirm the change below.
        </Text>
        <Button style={button} href={confirmationUrl}>
          Confirm email change
        </Button>
        <Text style={fallbackLabel}>
          Button not working? Copy and paste this link into your browser:
        </Text>
        <Text style={fallbackUrl}>
          <Link href={confirmationUrl} style={link}>
            {confirmationUrl}
          </Link>
        </Text>
        <Hr style={hr} />
        <Text style={footer}>
          If you didn&apos;t request this change, please secure your account
          right away.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default EmailChangeEmail
