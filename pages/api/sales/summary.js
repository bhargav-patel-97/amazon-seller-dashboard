// pages/api/sales/summary.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const getSampleData = () => {
  const today = new Date();
  const salesAdSpendData = [];
  const topSkusData = [];
  for (let i = 29; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    salesAdSpendData.push({
      date: date.toISOString().split('T')[0],
      sales: Math.random() * 10000,
      adSpend: Math.random() * 2000
    });
  }
  const skus = ['A001','B002','C003','D004','E005','F006','G007','H008','I009','J010'];
  skus.forEach((sku,i) => {
    topSkusData.push({ sku, revenue: Math.random()*50000, units: Math.random()*500 });
  });
  return {
    metrics: { revenue: 245680, orders: 1834, unitsSold: 3247, conversionRate: 12.5 },
    salesAdSpendData,
    topSkusData
  };
};

const validate = ({ marketplace, sku, from, to }) => {
  const valid = ['US','CA','MX'];
  const m = valid.includes(marketplace) ? marketplace : 'US';
  const today = new Date().toISOString().split('T')[0];
  const ago = new Date(Date.now()-30*24*60*60*1000).toISOString().split('T')[0];
  const f = from || ago;
  const t = to || today;
  return { marketplace: m, sku: sku||'', from: f, to: t };
};

const aggregateMetrics = data => {
  const agg = data.reduce((a,c) => ({
    revenue: a.revenue + c.sales_amount,
    orders: a.orders + c.order_count,
    unitsSold: a.unitsSold + c.units_sold,
    clicks: a.clicks + c.clicks
  }),{ revenue:0, orders:0, unitsSold:0, clicks:0 });
  return { ...agg, conversionRate: agg.clicks ? (agg.orders/agg.clicks*100) : 0 };
};

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error:'Method not allowed' });
  const filters = validate(req.query);
  if (req.query.sample) return res.json(getSampleData());

  const [{ data:salesData },{ data:adData }] = await Promise.all([
    supabase.from('sales_metrics').select('date,sales_amount').eq('marketplace',filters.marketplace).gte('date',filters.from).lte('date',filters.to),
    supabase.from('ads_campaigns').select('date,spend').eq('marketplace',filters.marketplace).gte('date',filters.from).lte('date',filters.to)
  ]);

  const salesAdSpendData = [];
  const dates = new Set([...salesData.map(d=>d.date),...adData.map(d=>d.date)]);
  dates.forEach(date => {
    salesAdSpendData.push({ date, sales: salesData.filter(d=>d.date===date).reduce((a,c)=>a+c.sales_amount,0), adSpend: adData.filter(d=>d.date===date).reduce((a,c)=>a+c.spend,0) });
  });

  const skuDataRaw = await supabase.from('sales_metrics').select('sku,sales_amount,units_sold').eq('marketplace',filters.marketplace).gte('date',filters.from).lte('date',filters.to);
  const skuMap = {};
  skuDataRaw.data.forEach(r=>{ skuMap[r.sku]=skuMap[r.sku]||{sku:r.sku,revenue:0,units:0}; skuMap[r.sku].revenue+=r.sales_amount; skuMap[r.sku].units+=r.units_sold; });
  const topSkusData = Object.values(skuMap).sort((a,b)=>b.revenue-a.revenue).slice(0,10);

  const metricsRaw = await supabase.from('sales_metrics').select('sales_amount,order_count,units_sold,clicks').eq('marketplace',filters.marketplace).gte('date',filters.from).lte('date',filters.to);
  const metrics = metricsRaw.data.length ? aggregateMetrics(metricsRaw.data) : null;
  if (!metrics) return res.json(getSampleData());

  res.json({ metrics, salesAdSpendData, topSkusData });
}