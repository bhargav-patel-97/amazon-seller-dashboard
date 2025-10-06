// components/MarketFilter.js
import { useState, useCallback } from 'react';

const MarketFilter = ({ filters, onFilterChange }) => {
  const [localSku, setLocalSku] = useState(filters.sku);

  const marketplaces = [
    { value: 'US', label: 'United States' },
    { value: 'CA', label: 'Canada' },
    { value: 'MX', label: 'Mexico' }
  ];

  const handleMarketplaceChange = useCallback(
    e => onFilterChange({ marketplace: e.target.value }),
    [onFilterChange]
  );

  const handleDateChange = useCallback(
    e => onFilterChange({ [e.target.name]: e.target.value }),
    [onFilterChange]
  );

  const handleSkuSearch = useCallback(
    e => {
      e.preventDefault();
      onFilterChange({ sku: localSku.trim() });
    },
    [localSku, onFilterChange]
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div>
        <label>Marketplace</label>
        <select
          name="marketplace"
          value={filters.marketplace}
          onChange={handleMarketplaceChange}
          className="w-full border rounded p-2"
        >
          {marketplaces.map(m => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label>SKU</label>
        <form onSubmit={handleSkuSearch} className="flex">
          <input
            type="text"
            value={localSku}
            onChange={e => setLocalSku(e.target.value)}
            className="flex-1 border rounded-l p-2"
            placeholder="Enter SKU"
          />
          <button type="submit" className="bg-gray-200 px-4 rounded-r">
            Search
          </button>
        </form>
      </div>
      <div>
        <label>From</label>
        <input
          type="date"
          name="fromDate"
          value={filters.fromDate}
          onChange={handleDateChange}
          className="w-full border rounded p-2"
          max={filters.toDate}
        />
      </div>
      <div>
        <label>To</label>
        <input
          type="date"
          name="toDate"
          value={filters.toDate}
          onChange={handleDateChange}
          className="w-full border rounded p-2"
          min={filters.fromDate}
          max={new Date().toISOString().split('T')[0]}
        />
      </div>
    </div>
  );
};

export default MarketFilter;
