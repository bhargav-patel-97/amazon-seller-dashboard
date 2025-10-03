import { supabaseService } from '../../../lib/supabaseService'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No valid authorization header' })
    }

    const token = authHeader.substring(7)

    // Verify token with Supabase
    const { data: { user }, error } = await supabaseService.auth.getUser(token)

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid or expired token' })
    }

    res.status(200).json({
      user: {
        id: user.id,
        email: user.email,
        user_metadata: user.user_metadata
      },
      authenticated: true
    })

  } catch (error) {
    console.error('Session verification error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}
