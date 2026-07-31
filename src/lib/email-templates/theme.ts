// Shared inline styles for ClubCarder auth emails.
// Email clients only support inline styles — no external CSS.

export const main = {
  backgroundColor: '#ffffff',
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
}

export const container = {
  padding: '32px 28px',
  maxWidth: '520px',
  margin: '0 auto',
}

export const brand = {
  fontSize: '18px',
  fontWeight: 'bold' as const,
  color: '#7c3aed',
  letterSpacing: '-0.01em',
  margin: '0 0 28px',
  textDecoration: 'none',
}

export const h1 = {
  fontSize: '24px',
  fontWeight: 'bold' as const,
  color: '#16111f',
  lineHeight: '1.25',
  margin: '0 0 18px',
}

export const text = {
  fontSize: '15px',
  color: '#4a4458',
  lineHeight: '1.6',
  margin: '0 0 22px',
}

export const link = { color: '#7c3aed', textDecoration: 'underline' }

export const button = {
  backgroundColor: '#7c3aed',
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: 'bold' as const,
  borderRadius: '10px',
  padding: '14px 26px',
  textDecoration: 'none',
  display: 'inline-block',
}

export const fallbackLabel = {
  fontSize: '13px',
  color: '#6b6478',
  lineHeight: '1.6',
  margin: '28px 0 6px',
}

export const fallbackUrl = {
  fontSize: '13px',
  color: '#7c3aed',
  wordBreak: 'break-all' as const,
  margin: '0 0 8px',
}

export const hr = {
  border: 'none',
  borderTop: '1px solid #eceaf2',
  margin: '32px 0 18px',
}

export const footer = {
  fontSize: '12px',
  color: '#9b95a8',
  lineHeight: '1.6',
  margin: '0',
}

export const codeStyle = {
  fontFamily: "'SF Mono', Consolas, Courier, monospace",
  fontSize: '30px',
  fontWeight: 'bold' as const,
  letterSpacing: '6px',
  color: '#16111f',
  backgroundColor: '#f6f4fb',
  borderRadius: '10px',
  padding: '16px 20px',
  textAlign: 'center' as const,
  margin: '0 0 26px',
}
