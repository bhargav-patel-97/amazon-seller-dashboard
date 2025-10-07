import { supabase } from '../../../lib/supabaseClient'
import cookie from 'cookie'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { code, error: authError } = req.query
  const cookies = cookie.parse(req.headers.cookie || '')
  const hasPkce = Boolean(cookies['pkce_code_verifier'])

  if (authError) {
    console.error('OAuth callback error:', authError)
    return res.redirect(`/?error=${encodeURIComponent(authError)}`)
  }

  if (!code) {
    return res.redirect('/')
  }

  try {
    let data, error

    // Use raw code string for both PKCE and non-PKCE flows
    ;({ data, error } = await supabase.auth.exchangeCodeForSession(code))

    // Clear PKCE verifier if it existed
    if (hasPkce) {
      res.setHeader('Set-Cookie', cookie.serialize('pkce_code_verifier', '', {
        maxAge: 0,
        path: '/'
      }))
    }

    if (error) {
      console.error('OAuth callback error:', error)
      return res.redirect(`/?error=${encodeURIComponent(error.message)}`)
    }

    if (data.session) {
      // Log Amazon Ads refresh token if available
      if (data.session.provider_refresh_token) {
        console.log('AMAZON_ADS_REFRESH_TOKEN:', data.session.provider_refresh_token)
      }

      // Set Supabase auth cookie
      const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7,
        path: '/'
      }
      res.setHeader('Set-Cookie',
        cookie.serialize(
          'supabase-auth-token',
          data.session.access_token,
          cookieOptions
        )
      )

      return res.redirect('/dashboard')
    }
  } catch (err) {
    console.error('Unexpected callback error:', err)
    return res.redirect(`/?error=${encodeURIComponent('Authentication failed')}`)
  }

  return res.redirect('/')
}
