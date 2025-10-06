// pages/dashboard/index.js
// Protected Sales Dashboard with Filters and Charts

import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../../lib/supabaseClient'
import MarketFilter from '../../components/MarketFilter'
import SalesChart from '../../components/SalesChart'
import TopSkusBar from '../../components/TopSkusBar'

export default function Dashboard({ session }) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [dashboardData, setDashboardData] = useState({
    metrics: {
      revenue: 0,
      orders: 0,
      unitsSold: 0,
      conversionRate: 0,
      adSpend: 0,
      acos: 0
    },
    salesData: [],
    topSkus: []
  })
  const [filters, setFilters] = useState({
    marketplace: 'US',
    sku: '',
    fromDate: '2024-01-01',
    toDate: '2024-12-31'
  })
  const [userProfile, setUserProfile] = useState(null)
  const [error, setError] = useState(null)

  // Session check and redirect
  useEffect(() => {
    if (!session) {
      router.push('/')
      return
    }
    
    // Load initial data
    loadUserProfile()
    loadDashboardData()
  }, [session, router])

  // Load user profile
  const loadUserProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .single()
      
      if (error && error.code !== 'PGRST116') {
        throw error
      }
      
      setUserProfile(data)
    } catch (err) {
      console.error('Error loading profile:', err)
      setError('Failed to load user profile')
    }
  }

  // Load dashboard data from API
  const loadDashboardData = async (newFilters = filters) => {
    try {
      setLoading(true)
      setError(null)

      // Get current session for API calls
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        throw new Error('No active session')
      }

      // Call the sales summary API
      const params = new URLSearchParams({
        marketplace: newFilters.marketplace,
        sku: newFilters.sku,
        from: newFilters.fromDate,
        to: newFilters.toDate
      })

      const response = await fetch(`/api/sales/summary?${params}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to fetch dashboard data')
      }

      const data = await response.json()
      
      if (!data.success) {
        throw new Error(data.message || 'API returned unsuccessful response')
      }

      setDashboardData(data)
      
    } catch (err) {
      console.error('Error loading dashboard data:', err)
      setError(err.message)
      
      // Set fallback data on error
      setDashboardData({
        metrics: {
          revenue: 0,
          orders: 0,
          unitsSold: 0,
          conversionRate: 0,
          adSpend: 0,
          acos: 0
        },
        salesData: [],
        topSkus: []
      })
    } finally {
      setLoading(false)
    }
  }

  // Handle filter changes
  const handleFilterChange = (newFilters) => {
    setFilters(newFilters)
    loadDashboardData(newFilters)
  }

  // Handle sign out
  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  // Loading state
  if (loading && !dashboardData.salesData.length) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        backgroundColor: '#f9fafb', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center' 
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '48px',
            height: '48px',
            border: '4px solid #f3f4f6',
            borderTop: '4px solid #3b82f6',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px'
          }}></div>
          <p style={{ color: '#6b7280' }}>Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb' }}>
      {/* Header */}
      <header style={{ 
        backgroundColor: 'white', 
        boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)', 
        borderBottom: '1px solid #e5e7eb' 
      }}>
        <div style={{ 
          maxWidth: '1280px', 
          margin: '0 auto', 
          padding: '0 16px' 
        }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            padding: '16px 0' 
          }}>
            <div>
              <h1 style={{ 
                fontSize: '24px', 
                fontWeight: 'bold', 
                color: '#111827', 
                margin: '0 0 4px 0' 
              }}>
                Amazon Seller Dashboard
              </h1>
              <p style={{ 
                fontSize: '14px', 
                color: '#6b7280', 
                margin: 0 
              }}>
                {userProfile?.full_name || session.user.email} • 
                {filters.marketplace} • 
                {filters.fromDate} to {filters.toDate}
              </p>
            </div>
            <button
              onClick={handleSignOut}
              style={{
                padding: '8px 16px',
                fontSize: '14px',
                fontWeight: '500',
                color: '#374151',
                backgroundColor: '#f3f4f6',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
              onMouseOver={(e) => e.target.style.backgroundColor = '#e5e7eb'}
              onMouseOut={(e) => e.target.style.backgroundColor = '#f3f4f6'}
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main style={{ 
        maxWidth: '1280px', 
        margin: '0 auto', 
        padding: '32px 16px' 
      }}>
        {/* Error Alert */}
        {error && (
          <div style={{
            marginBottom: '24px',
            padding: '16px',
            borderLeft: '4px solid #f87171',
            backgroundColor: '#fef2f2',
            borderRadius: '6px'
          }}>
            <p style={{ 
              fontSize: '14px', 
              color: '#991b1b', 
              margin: 0 
            }}>
              <strong>Error:</strong> {error}
            </p>
          </div>
        )}

        {/* Filters */}
        <MarketFilter 
          filters={filters}
          onFilterChange={handleFilterChange}
        />

        {/* Key Metrics */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '24px',
          marginBottom: '32px'
        }}>
          <MetricCard 
            title="Revenue" 
            value={`$${dashboardData.metrics.revenue?.toLocaleString('en-US', { 
              minimumFractionDigits: 2, 
              maximumFractionDigits: 2 
            }) || '0.00'}`}
            change={+5.2}
            color="#10b981"
          />
          <MetricCard 
            title="Orders" 
            value={dashboardData.metrics.orders?.toLocaleString() || '0'}
            change={+12.8}
            color="#3b82f6"
          />
          <MetricCard 
            title="Units Sold" 
            value={dashboardData.metrics.unitsSold?.toLocaleString() || '0'}
            change={-2.1}
            color="#8b5cf6"
          />
          <MetricCard 
            title="ACOS" 
            value={`${dashboardData.metrics.acos?.toFixed(1) || '0.0'}%`}
            change={-1.3}
            color="#f59e0b"
            isPercentage
          />
        </div>

        {/* Charts Section */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr',
          gap: '32px',
          marginBottom: '32px'
        }}>
          {/* Sales Chart */}
          <SalesChart 
            data={dashboardData.salesData}
            loading={loading}
          />
        </div>

        {/* Top SKUs Chart */}
        <div style={{ marginBottom: '32px' }}>
          <TopSkusBar 
            data={dashboardData.topSkus}
            loading={loading}
          />
        </div>

        {/* Data Source Information */}
        <div style={{
          textAlign: 'center',
          fontSize: '14px',
          color: '#6b7280'
        }}>
          <p style={{ margin: 0 }}>
            Data source: {dashboardData.dataSource || 'unknown'} • 
            Last updated: {new Date().toLocaleString()} • 
            Showing {dashboardData.salesData?.length || 0} data points
          </p>
        </div>
      </main>

      {/* Add CSS animation for spinner */}
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

// Metric Card Component
const MetricCard = ({ 
  title, 
  value, 
  change, 
  color = "#6b7280", 
  isPercentage = false 
}) => {
  const changeColor = change > 0 ? '#10b981' : change < 0 ? '#ef4444' : '#6b7280'
  const changeIcon = change > 0 ? '↗' : change < 0 ? '↘' : '→'
  
  return (
    <div style={{
      backgroundColor: 'white',
      padding: '24px',
      borderRadius: '8px',
      boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
      border: '1px solid #e5e7eb'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div>
          <p style={{
            fontSize: '14px',
            fontWeight: '500',
            color: '#6b7280',
            margin: '0 0 4px 0'
          }}>
            {title}
          </p>
          <p style={{
            fontSize: '32px',
            fontWeight: 'bold',
            color: color,
            margin: 0
          }}>
            {value}
          </p>
        </div>
        <div style={{
          fontSize: '14px',
          color: changeColor,
          textAlign: 'right'
        }}>
          <span style={{ display: 'inline-block' }}>{changeIcon}</span>
          <span style={{ marginLeft: '4px' }}>
            {Math.abs(change).toFixed(1)}{isPercentage ? 'pp' : '%'}
          </span>
        </div>
      </div>
    </div>
  )
}