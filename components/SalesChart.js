// components/SalesChart.js
// Line Chart Component for Sales vs Ad Spend using Recharts

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { format } from 'date-fns'

const SalesChart = ({ data, loading }) => {
  if (loading) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-64 bg-gray-100 rounded"></div>
        </div>
      </div>
    )
  }

  if (!data || data.length === 0) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Sales vs Ad Spend</h3>
        <div className="h-64 flex items-center justify-center text-gray-500">
          No data available for the selected period
        </div>
      </div>
    )
  }

  // Format data for the chart
  const chartData = data.map(item => ({
    ...item,
    date: format(new Date(item.date), 'MMM dd'),
    sales: Number(item.sales || 0),
    adSpend: Number(item.adSpend || 0)
  }))

  // Custom tooltip to show formatted values
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="text-sm font-medium text-gray-900 mb-2">{`Date: ${label}`}</p>
          {payload.map((entry, index) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {`${entry.name}: $${entry.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            </p>
          ))}
        </div>
      )
    }
    return null
  }

  // Calculate summary stats
  const totalSales = chartData.reduce((sum, item) => sum + item.sales, 0)
  const totalAdSpend = chartData.reduce((sum, item) => sum + item.adSpend, 0)
  const acos = totalSales > 0 ? (totalAdSpend / totalSales) * 100 : 0

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
      {/* Header with metrics */}
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold text-gray-800">Sales vs Ad Spend</h3>
        <div className="flex space-x-4 text-sm">
          <div className="text-center">
            <p className="text-gray-500">Total Sales</p>
            <p className="font-semibold text-green-600">
              ${totalSales.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="text-center">
            <p className="text-gray-500">Total Ad Spend</p>
            <p className="font-semibold text-red-600">
              ${totalAdSpend.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="text-center">
            <p className="text-gray-500">ACOS</p>
            <p className="font-semibold text-blue-600">
              {acos.toFixed(1)}%
            </p>
          </div>
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={400}>
        <LineChart
          data={chartData}
          margin={{
            top: 20,
            right: 30,
            left: 20,
            bottom: 5,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
          <XAxis 
            dataKey="date" 
            tick={{ fontSize: 12 }}
            tickLine={{ stroke: '#e5e7eb' }}
          />
          <YAxis 
            tick={{ fontSize: 12 }}
            tickLine={{ stroke: '#e5e7eb' }}
            tickFormatter={(value) => `$${value.toLocaleString()}`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          <Line 
            type="monotone" 
            dataKey="sales" 
            stroke="#10b981"
            strokeWidth={3}
            name="Sales"
            dot={{ fill: '#10b981', strokeWidth: 2, r: 4 }}
            activeDot={{ r: 6, stroke: '#10b981', strokeWidth: 2, fill: '#fff' }}
          />
          <Line 
            type="monotone" 
            dataKey="adSpend" 
            stroke="#ef4444"
            strokeWidth={3}
            name="Ad Spend"
            dot={{ fill: '#ef4444', strokeWidth: 2, r: 4 }}
            activeDot={{ r: 6, stroke: '#ef4444', strokeWidth: 2, fill: '#fff' }}
          />
        </LineChart>
      </ResponsiveContainer>

      {/* Chart insights */}
      <div className="mt-4 p-4 bg-gray-50 rounded-lg">
        <p className="text-sm text-gray-600">
          <span className="font-medium">Insight:</span> {
            acos < 20 
              ? "Your ad spend efficiency is excellent! ACOS is below 20%."
              : acos < 40 
              ? "Your ad performance is good. Consider optimizing for better ACOS."
              : "Your ACOS is high. Review campaign targeting and bidding strategies."
          }
        </p>
      </div>
    </div>
  )
}

export default SalesChart