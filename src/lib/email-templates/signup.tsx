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

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({
  siteName,
  siteUrl,
  recipient,
  confirmationUrl,
}: SignupEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Confirm your email to start using {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Link href={siteUrl} style={brand}>
          {siteName}
        </Link>
        <Heading style={h1}>Confirm your email</Heading>
        <Text style={text}>
          Thanks for signing up for {siteName}. Confirm {recipient} to activate
          your account and start collecting loyalty cards.
        </Text>
        <Button style={button} href={confirmationUrl}>
          Confirm my email
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
          If you didn&apos;t create a {siteName} account, you can safely ignore
          this email.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default SignupEmail
