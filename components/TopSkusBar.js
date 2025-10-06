// components/TopSkusBar.js
// Bar Chart Component for Top SKUs using Recharts

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

const TopSkusBar = ({ data, loading }) => {
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
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Top SKUs by Performance</h3>
        <div className="h-64 flex items-center justify-center text-gray-500">
          No SKU data available
        </div>
      </div>
    )
  }

  // Sort data by value and take top 8 for better visualization
  const sortedData = [...data]
    .sort((a, b) => b.value - a.value)
    .slice(0, 8)
    .map(item => ({
      ...item,
      sku: item.sku.length > 10 ? item.sku.substring(0, 10) + '...' : item.sku,
      name: item.name.length > 15 ? item.name.substring(0, 15) + '...' : item.name,
      value: Number(item.value || 0),
      units: Number(item.units || 0),
      price: Number(item.price || 0)
    }))

  // Custom tooltip to show full information
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="text-sm font-medium text-gray-900 mb-1">{data.name}</p>
          <p className="text-xs text-gray-600 mb-2">{`SKU: ${data.sku}`}</p>
          <p className="text-sm text-blue-600 font-medium">
            {`Total Value: $${data.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          </p>
          <p className="text-xs text-gray-600">
            {`${data.units} units × $${data.price.toFixed(2)}`}
          </p>
        </div>
      )
    }
    return null
  }

  const totalValue = sortedData.reduce((sum, item) => sum + item.value, 0)
  const totalUnits = sortedData.reduce((sum, item) => sum + item.units, 0)

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
      {/* Header with metrics */}
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold text-gray-800">Top SKUs by Performance</h3>
        <div className="flex space-x-4 text-sm">
          <div className="text-center">
            <p className="text-gray-500">Total Value</p>
            <p className="font-semibold text-blue-600">
              ${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="text-center">
            <p className="text-gray-500">Total Units</p>
            <p className="font-semibold text-green-600">
              {totalUnits.toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={350}>
        <BarChart
          data={sortedData}
          margin={{
            top: 20,
            right: 30,
            left: 20,
            bottom: 60,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
          <XAxis 
            dataKey="sku" 
            tick={{ fontSize: 11 }}
            tickLine={{ stroke: '#e5e7eb' }}
            angle={-45}
            textAnchor="end"
            height={60}
          />
          <YAxis 
            tick={{ fontSize: 12 }}
            tickLine={{ stroke: '#e5e7eb' }}
            tickFormatter={(value) => `$${value.toLocaleString()}`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar 
            dataKey="value" 
            fill="#3b82f6"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>

      {/* Performance insights */}
      <div className="mt-4 space-y-3">
        <div className="p-3 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-800">
            <span className="font-medium">Top Performer:</span> {sortedData[0]?.name} 
            ({sortedData[0]?.sku}) with ${sortedData[0]?.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} in value
          </p>
        </div>
        
        {sortedData.length >= 3 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            {sortedData.slice(0, 3).map((item, index) => {
              const rank = index + 1
              const percentage = totalValue > 0 ? ((item.value / totalValue) * 100).toFixed(1) : 0
              return (
                <div key={item.sku} className="p-2 bg-gray-50 rounded">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">#{rank} {item.sku}</span>
                    <span className="text-gray-600">{percentage}%</span>
                  </div>
                  <div className="text-gray-500 mt-1">
                    {item.units} units @ ${item.price.toFixed(2)}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default TopSkusBar