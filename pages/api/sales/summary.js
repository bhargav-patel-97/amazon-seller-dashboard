// pages/api/sales/summary.js
// Sales Summary Aggregation API - Returns metrics with real DB integration

import { supabase } from '../../../lib/supabaseClient'

export default async function handler(req, res) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Extract query parameters
    const { 
      marketplace = 'US', 
      sku = '', 
      from = '2024-01-01', 
      to = '2024-12-31',
      userId 
    } = req.query

    console.log(`API called with: marketplace=${marketplace}, sku=${sku}, from=${from}, to=${to}`)

    // Basic validation
    if (!from || !to) {
      return res.status(400).json({ 
        error: 'Missing required parameters', 
        message: 'from and to dates are required' 
      })
    }

    // Initialize response structure
    const response = {
      success: true,
      metrics: {
        revenue: 0,
        orders: 0,
        unitsSold: 0,
        conversionRate: 0,
        adSpend: 0,
        acos: 0
      },
      salesData: [],
      topSkus: [],
      dateRange: { from, to, marketplace },
      dataSource: 'database'
    }

    try {
      // 1. Fetch sales metrics from database
      let salesQuery = supabase
        .from('sales_metrics')
        .select('*')
        .gte('date', from)
        .lte('date', to)
        .order('date', { ascending: true })

      // Add marketplace filter (map US/CA/MX to marketplace IDs)
      const marketplaceIds = {
        'US': 'ATVPDKIKX0DER',
        'CA': 'A2EUQ1WTGCTBG2', 
        'MX': 'A1AM78C64UM0Y8'
      }
      
      if (marketplace && marketplaceIds[marketplace]) {
        salesQuery = salesQuery.eq('marketplace_id', marketplaceIds[marketplace])
      }

      const { data: salesData, error: salesError } = await salesQuery

      if (salesError) {
        console.error('Sales data query error:', salesError)
        throw salesError
      }

      console.log(`Found ${salesData?.length || 0} sales records`)

      // 2. Fetch ads spend data
      let adsQuery = supabase
        .from('ads_campaigns')
        .select('spend, sales, clicks, impressions, start_date')
        .gte('start_date', from)
        .lte('start_date', to)

      const { data: adsData, error: adsError } = await adsQuery
      
      if (adsError) {
        console.error('Ads data query error:', adsError)
        // Don't fail if ads data is not available
      }

      console.log(`Found ${adsData?.length || 0} ads records`)

      // 3. Fetch inventory/SKU data for top SKUs
      let inventoryQuery = supabase
        .from('inventory')
        .select('sku, product_name, selling_price, quantity_available')
        .order('quantity_available', { ascending: false })
        .limit(10)

      // Add SKU filter if provided
      if (sku && sku.trim()) {
        inventoryQuery = inventoryQuery.ilike('sku', `%${sku.trim()}%`)
      }

      const { data: inventoryData, error: inventoryError } = await inventoryQuery

      if (inventoryError) {
        console.error('Inventory data query error:', inventoryError)
      }

      // 4. Process and aggregate data
      if (salesData && salesData.length > 0) {
        // Calculate totals
        const totals = salesData.reduce((acc, record) => {
          acc.revenue += parseFloat(record.total_sales || 0)
          acc.orders += parseInt(record.order_count || 0)
          acc.unitsSold += parseInt(record.unit_count || 0)
          return acc
        }, { revenue: 0, orders: 0, unitsSold: 0 })

        response.metrics.revenue = Math.round(totals.revenue * 100) / 100
        response.metrics.orders = totals.orders
        response.metrics.unitsSold = totals.unitsSold
        response.metrics.conversionRate = totals.orders > 0 ? 
          Math.round((totals.unitsSold / totals.orders) * 100) / 100 : 0

        // Format sales data for charts
        response.salesData = salesData.map(record => ({
          date: record.date,
          sales: parseFloat(record.total_sales || 0),
          adSpend: 0, // Will be populated from ads data
          units: parseInt(record.unit_count || 0),
          orders: parseInt(record.order_count || 0)
        }))

        response.dataSource = 'database'
      } else {
        console.log('No sales data found, returning sample data')
        response.dataSource = 'sample'
      }

      // 5. Add ads spend data
      if (adsData && adsData.length > 0) {
        const adsTotal = adsData.reduce((acc, record) => {
          acc.spend += parseFloat(record.spend || 0)
          acc.sales += parseFloat(record.sales || 0)
          return acc
        }, { spend: 0, sales: 0 })

        response.metrics.adSpend = Math.round(adsTotal.spend * 100) / 100
        response.metrics.acos = adsTotal.sales > 0 ? 
          Math.round((adsTotal.spend / adsTotal.sales) * 10000) / 100 : 0

        // Merge ads data with sales data by date
        const adsMap = adsData.reduce((map, record) => {
          const dateKey = record.start_date
          if (!map[dateKey]) {
            map[dateKey] = 0
          }
          map[dateKey] += parseFloat(record.spend || 0)
          return map
        }, {})

        response.salesData = response.salesData.map(record => ({
          ...record,
          adSpend: adsMap[record.date] || 0
        }))
      }

      // 6. Process top SKUs data  
      if (inventoryData && inventoryData.length > 0) {
        response.topSkus = inventoryData.map(item => ({
          sku: item.sku,
          name: item.product_name || `Product ${item.sku}`,
          value: parseFloat(item.selling_price || 0) * parseInt(item.quantity_available || 0),
          units: parseInt(item.quantity_available || 0),
          price: parseFloat(item.selling_price || 0)
        }))
      }

      // 7. If no real data, provide sample data for development
      if (response.salesData.length === 0) {
        console.log('No database records found, providing sample data for development')
        
        response.metrics = {
          revenue: 45230.50,
          orders: 342,
          unitsSold: 678,
          conversionRate: 4.2,
          adSpend: 8945.30,
          acos: 19.8
        }

        response.salesData = generateSampleSalesData(from, to)
        response.topSkus = generateSampleSkuData()
        response.dataSource = 'sample'
      }

      // 8. Return successful response
      console.log(`Returning summary: ${response.salesData.length} data points, ${response.topSkus.length} SKUs`)
      return res.status(200).json(response)

    } catch (dbError) {
      console.error('Database query failed:', dbError)
      
      // Fallback to sample data on database error
      response.metrics = {
        revenue: 45230.50,
        orders: 342,
        unitsSold: 678,
        conversionRate: 4.2,
        adSpend: 8945.30,
        acos: 19.8
      }
      response.salesData = generateSampleSalesData(from, to)
      response.topSkus = generateSampleSkuData()
      response.dataSource = 'sample'
      response.warning = 'Using sample data due to database connection issue'

      return res.status(200).json(response)
    }

  } catch (error) {
    console.error('Sales summary API error:', error)
    
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message,
      success: false 
    })
  }
}

// Helper function to generate sample sales data for development
function generateSampleSalesData(fromDate, toDate) {
  const data = []
  const start = new Date(fromDate)
  const end = new Date(toDate)
  const diffTime = Math.abs(end - start)
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  
  // Generate data for up to 30 days to keep response manageable
  const daysToGenerate = Math.min(diffDays, 30)
  
  for (let i = 0; i < daysToGenerate; i++) {
    const date = new Date(start)
    date.setDate(start.getDate() + i)
    
    data.push({
      date: date.toISOString().split('T')[0],
      sales: Math.round((Math.random() * 2000 + 500) * 100) / 100,
      adSpend: Math.round((Math.random() * 400 + 100) * 100) / 100,
      units: Math.floor(Math.random() * 50 + 10),
      orders: Math.floor(Math.random() * 25 + 5)
    })
  }
  
  return data
}

// Helper function to generate sample SKU data
function generateSampleSkuData() {
  const skuNames = [
    'Premium Widget Pro', 
    'Classic Gadget v2', 
    'Essential Tool Kit',
    'Advanced Controller',
    'Standard Accessory',
    'Deluxe Package',
    'Basic Starter Set',
    'Professional Grade'
  ]
  
  return skuNames.map((name, index) => ({
    sku: `SKU-${1000 + index}`,
    name: name,
    value: Math.round((Math.random() * 5000 + 1000) * 100) / 100,
    units: Math.floor(Math.random() * 200 + 50),
    price: Math.round((Math.random() * 80 + 20) * 100) / 100
  }))
}