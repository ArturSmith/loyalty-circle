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

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const InviteEmail = ({
  siteName,
  siteUrl,
  confirmationUrl,
}: InviteEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>You&apos;ve been invited to join {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Link href={siteUrl} style={brand}>
          {siteName}
        </Link>
        <Heading style={h1}>You&apos;ve been invited</Heading>
        <Text style={text}>
          You&apos;ve been invited to join {siteName}. Accept the invitation
          below to create your account.
        </Text>
        <Button style={button} href={confirmationUrl}>
          Accept invitation
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
          If you weren&apos;t expecting this invitation, you can safely ignore
          this email.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default InviteEmail
