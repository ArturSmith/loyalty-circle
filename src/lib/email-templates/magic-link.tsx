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

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
}

export const MagicLinkEmail = ({
  siteName,
  confirmationUrl,
}: MagicLinkEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your sign-in link for {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>{siteName}</Text>
        <Heading style={h1}>Your sign-in link</Heading>
        <Text style={text}>
          Tap the button below to sign in to {siteName}. This link expires
          shortly and can only be used once.
        </Text>
        <Button style={button} href={confirmationUrl}>
          Sign in
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
          If you didn&apos;t request this link, you can safely ignore this
          email.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default MagicLinkEmail
