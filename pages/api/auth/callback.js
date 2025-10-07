import { supabase } from '../../../lib/supabaseClient'
import cookie from 'cookie'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { code } = req.query
  const cookies = cookie.parse(req.headers.cookie || '')
  const codeVerifier = cookies['pkce_code_verifier']

  if (code) {
    if (!codeVerifier) {
      console.error('Missing PKCE code_verifier')
      return res.redirect(`/?error=${encodeURIComponent('Missing code_verifier')}`)
    }

    try {
      // Exchange code for session with PKCE verifier
      const { data, error } = await supabase.auth.exchangeCodeForSession({
        code,
        codeVerifier
      })

      if (error) {
        console.error('OAuth callback error:', error)
        return res.redirect(`/?error=${encodeURIComponent(error.message)}`)
      }

      if (data.session) {
        // Clean up PKCE verifier cookie
        res.setHeader('Set-Cookie', cookie.serialize('pkce_code_verifier', '', {
          maxAge: 0,
          path: '/'
        }))

        // Extract Amazon Ads refresh token
        const amazonAdsRefreshToken = data.session.provider_refresh_token
        console.log('AMAZON_ADS_REFRESH_TOKEN:', amazonAdsRefreshToken)

        // OPTIONAL: Persist to Vercel via API (requires VERCEL_TOKEN, project & team IDs)
        /*
        await fetch('https://api.vercel.com/v8/projects/YOUR_PROJECT_ID/env', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.VERCEL_TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            key: 'ADS_REFRESH_TOKEN',
            value: amazonAdsRefreshToken,
            target: ['production']
          })
        })
        */

        // Set secure HTTP-only Supabase auth cookie
        const cookieOptions = {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 60 * 60 * 24 * 7, // 7 days
          path: '/'
        }
        res.setHeader('Set-Cookie',
          cookie.serialize(
            'supabase-auth-token',
            data.session.access_token,
            cookieOptions
          )
        )

        // Redirect to dashboard
        return res.redirect('/dashboard')
      }
    } catch (error) {
      console.error('Unexpected callback error:', error)
      return res.redirect(`/?error=${encodeURIComponent('Authentication failed')}`)
    }
  }

  res.redirect('/')
}
