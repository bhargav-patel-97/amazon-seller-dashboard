// pages/api/auth/start.js

import { randomBytes, createHash } from 'crypto'
import cookie from 'cookie'

export default function handler(req, res) {
  // 1. Generate PKCE verifier and challenge
  const codeVerifier = randomBytes(64).toString('hex')
  const hash = createHash('sha256').update(codeVerifier).digest()
  const codeChallenge = hash
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

  // 2. Set PKCE verifier cookie with SameSite=None so it’s sent on redirect back
  res.setHeader('Set-Cookie', cookie.serialize('pkce_code_verifier', codeVerifier, {
    httpOnly: true,
    secure: true,            // must be secure for SameSite=None
    sameSite: 'none',        // allow on cross-site redirects
    maxAge: 300,             // 5 minutes
    path: '/'
  }))

  // 3. Redirect to Amazon’s OAuth endpoint with challenge
  const params = new URLSearchParams({
    client_id: process.env.ADS_CLIENT_ID,
    scope: 'advertising::campaign_management',
    response_type: 'code',
    redirect_uri: `${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/callback`,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256'
  })

  res.redirect(`https://www.amazon.com/ap/oa?${params.toString()}`)
}
