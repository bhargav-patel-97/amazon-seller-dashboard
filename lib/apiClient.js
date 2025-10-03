import { supabase } from './supabaseClient'

/**
 * Makes an authenticated API call using the current Supabase session token
 * @param {string} url - API endpoint URL
 * @param {object} options - Fetch options (method, body, etc.)
 * @returns {Promise<Response>} - Fetch response
 */
export async function authenticatedFetch(url, options = {}) {
  // Get current session
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session) {
    throw new Error('No authentication session found')
  }

  // Add Authorization header
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.access_token}`,
    ...options.headers
  }

  return fetch(url, {
    ...options,
    headers
  })
}

/**
 * Makes an authenticated API call and returns JSON response
 * @param {string} url - API endpoint URL  
 * @param {object} options - Fetch options
 * @returns {Promise<object>} - Parsed JSON response
 */
export async function authenticatedFetchJSON(url, options = {}) {
  const response = await authenticatedFetch(url, options)
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Network error' }))
    throw new Error(errorData.error || `HTTP ${response.status}`)
  }
  
  return response.json()
}

/**
 * Example API call functions using the authenticated fetch
 */

// Get user session info
export async function getUserSession() {
  return authenticatedFetchJSON('/api/auth/session')
}

// Test protected endpoint
export async function testProtectedEndpoint() {
  return authenticatedFetchJSON('/api/protected/check')
}

// Example seller data functions (you'll create these API routes later)
export async function getSalesData(dateRange) {
  return authenticatedFetchJSON(`/api/seller/sales?range=${dateRange}`)
}

export async function getInventoryData() {
  return authenticatedFetchJSON('/api/seller/inventory')
}

export async function getCampaignsData() {
  return authenticatedFetchJSON('/api/seller/campaigns')
}

export async function getReviewsData() {
  return authenticatedFetchJSON('/api/seller/reviews')
}

export async function getAlertsData() {
  return authenticatedFetchJSON('/api/seller/alerts')
}