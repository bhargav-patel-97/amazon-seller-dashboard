Here is the updated `pages/api/auth/callback.js` file with the Amazon Ads refresh token extraction and optional Vercel environment update logic included. Deploy this version to capture and log the `ADS_REFRESH_TOKEN`.

```javascript
import { supabase } from '../../../lib/supabaseClient'
import cookie from 'cookie'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { code } = req.query

  if (code) {
    try {
      // Exchange code for session
      const { data, error } = await supabase.auth.exchangeCodeForSession(code)

      if (error) {
        console.error('OAuth callback error:', error)
        return res.redirect(`/?error=${encodeURIComponent(error.message)}`)
      }

      if (data.session) {
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

        // Set secure HTTP-only cookie
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
```