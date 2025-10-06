// pages/api/auth/session.js
// Session verification endpoint for protected routes

import { supabase } from '../../../lib/supabaseClient'
import jwt from 'jsonwebtoken'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const authHeader = req.headers.authorization
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid authorization header' })
    }

    const token = authHeader.split(' ')[1]
    
    // Verify the JWT token with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token)
    
    if (error) {
      console.error('Token verification failed:', error)
      return res.status(401).json({ error: 'Invalid or expired token' })
    }

    if (!user) {
      return res.status(401).json({ error: 'User not found' })
    }

    // Return user information
    return res.status(200).json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role || 'authenticated'
      },
      message: 'Session valid'
    })

  } catch (error) {
    console.error('Session verification error:', error)
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    })
  }
}