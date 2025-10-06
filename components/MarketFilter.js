// components/MarketFilter.js
// Marketplace, SKU, and Date Range Filter Component

import { useState } from 'react'

const MarketFilter = ({ filters, onFilterChange }) => {
  const [localFilters, setLocalFilters] = useState(filters || {
    marketplace: 'US',
    sku: '',
    fromDate: '2024-01-01',
    toDate: '2024-12-31'
  })

  const handleFilterChange = (field, value) => {
    const newFilters = { ...localFilters, [field]: value }
    setLocalFilters(newFilters)
    
    // Debounce the callback to prevent excessive API calls
    if (onFilterChange) {
      clearTimeout(handleFilterChange.timeout)
      handleFilterChange.timeout = setTimeout(() => {
        onFilterChange(newFilters)
      }, 300)
    }
  }

  const marketplaces = [
    { value: 'US', label: 'United States', flag: '🇺🇸' },
    { value: 'CA', label: 'Canada', flag: '🇨🇦' },
    { value: 'MX', label: 'Mexico', flag: '🇲🇽' }
  ]

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mb-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Filters</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Marketplace Selector */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Marketplace
          </label>
          <select
            value={localFilters.marketplace}
            onChange={(e) => handleFilterChange('marketplace', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {marketplaces.map((marketplace) => (
              <option key={marketplace.value} value={marketplace.value}>
                {marketplace.flag} {marketplace.label}
              </option>
            ))}
          </select>
        </div>

        {/* SKU Search */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            SKU Search
          </label>
          <input
            type="text"
            placeholder="Enter SKU or product name..."
            value={localFilters.sku}
            onChange={(e) => handleFilterChange('sku', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* From Date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            From Date
          </label>
          <input
            type="date"
            value={localFilters.fromDate}
            onChange={(e) => handleFilterChange('fromDate', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* To Date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            To Date
          </label>
          <input
            type="date"
            value={localFilters.toDate}
            onChange={(e) => handleFilterChange('toDate', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      {/* Quick Date Ranges */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="flex flex-wrap gap-2">
          <span className="text-sm text-gray-600 mr-2">Quick ranges:</span>
          <button
            onClick={() => {
              const today = new Date()
              const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
              handleFilterChange('fromDate', lastWeek.toISOString().split('T')[0])
              handleFilterChange('toDate', today.toISOString().split('T')[0])
            }}
            className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
          >
            Last 7 days
          </button>
          <button
            onClick={() => {
              const today = new Date()
              const lastMonth = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)
              handleFilterChange('fromDate', lastMonth.toISOString().split('T')[0])
              handleFilterChange('toDate', today.toISOString().split('T')[0])
            }}
            className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
          >
            Last 30 days
          </button>
          <button
            onClick={() => {
              const today = new Date()
              const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1)
              handleFilterChange('fromDate', thisMonth.toISOString().split('T')[0])
              handleFilterChange('toDate', today.toISOString().split('T')[0])
            }}
            className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
          >
            This month
          </button>
          <button
            onClick={() => {
              const today = new Date()
              const thisYear = new Date(today.getFullYear(), 0, 1)
              handleFilterChange('fromDate', thisYear.toISOString().split('T')[0])
              handleFilterChange('toDate', today.toISOString().split('T')[0])
            }}
            className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
          >
            This year
          </button>
        </div>
      </div>

      {/* Applied Filters Summary */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="flex items-center text-sm text-gray-600">
          <span className="mr-2">Applied filters:</span>
          <div className="flex flex-wrap gap-2">
            <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-md">
              {marketplaces.find(m => m.value === localFilters.marketplace)?.flag} {localFilters.marketplace}
            </span>
            {localFilters.sku && (
              <span className="px-2 py-1 bg-green-100 text-green-800 rounded-md">
                SKU: {localFilters.sku}
              </span>
            )}
            <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded-md">
              {localFilters.fromDate} to {localFilters.toDate}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default MarketFilter