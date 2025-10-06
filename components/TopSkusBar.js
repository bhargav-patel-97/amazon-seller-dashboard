// components/TopSkusBar.js
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const TopSkusBar = ({ data, loading }) => {
  if (loading) {
    return <div className="h-64 flex items-center justify-center"><div className="animate-spin h-6 w-6 border-b-2"></div></div>;
  }
  if (!data || data.length === 0) {
    return <div className="h-64 flex items-center justify-center text-gray-500">No data available</div>;
  }

  const chartData = data
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10)
    .map(item => ({
      sku: item.sku,
      revenue: item.revenue,
      units: item.units
    }));

  return (
    <ResponsiveContainer width="100%" height={256}>
      <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 80 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="sku" angle={-45} textAnchor="end" interval={0} height={60} />
        <YAxis yAxisId="left" orientation="left" tickFormatter={value => `$${value/1000}k`} />
        <YAxis yAxisId="right" orientation="right" />
        <Tooltip formatter={(value, name) => name === 'revenue' ? `$${value}` : value} />
        <Legend />
        <Bar yAxisId="left" dataKey="revenue" fill="#3B82F6" name="Revenue" />
        <Bar yAxisId="right" dataKey="units" fill="#8B5CF6" name="Units Sold" />
      </BarChart>
    </ResponsiveContainer>
  );
};

export default TopSkusBar;
