// components/SalesChart.js
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const SalesChart = ({ data, loading }) => {
  if (loading) {
    return <div className="h-64 flex items-center justify-center"><div className="animate-spin h-6 w-6 border-b-2"></div></div>;
  }
  if (!data || data.length === 0) {
    return <div className="h-64 flex items-center justify-center text-gray-500">No data available</div>;
  }

  const chartData = data.map(item => ({
    date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    sales: item.sales,
    adSpend: item.adSpend
  }));

  return (
    <ResponsiveContainer width="100%" height={256}>
      <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" />
        <YAxis tickFormatter={value => `$${value}`} />
        <Tooltip formatter={value => `$${value.toLocaleString()}`} />
        <Legend />
        <Line type="monotone" dataKey="sales" stroke="#10B981" name="Sales" />
        <Line type="monotone" dataKey="adSpend" stroke="#F59E0B" name="Ad Spend" />
      </LineChart>
    </ResponsiveContainer>
  );
};

export default SalesChart;
