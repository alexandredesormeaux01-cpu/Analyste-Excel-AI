import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  LabelList,
  ComposedChart
} from 'recharts';
import { DataView } from './DataView';
import { FileSpreadsheet, BarChart2, AlignLeft, PieChart as PieIcon, TrendingUp, Activity, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';

interface ChartData {
  type: 'bar' | 'line' | 'pie' | 'area';
  data: any[];
  xKey: string;
  yKey?: string;
  series?: string[];
  format?: 'currency' | 'number' | 'percent';
  title: string;
}

interface AnalysisResultViewProps {
  text?: string;
  chart?: ChartData;
  sqlData?: any[];
}

const COLORS = [
  '#6366f1', // Indigo
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#f43f5e', // Rose
  '#06b6d4', // Cyan
  '#8b5cf6', // Violet
  '#84cc16', // Lime
  '#d946ef', // Fuchsia
];

const formatValue = (value: number, format?: string) => {
  if (format === 'currency') {
    return new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(value);
  }
  if (format === 'percent') {
    return new Intl.NumberFormat('fr-CA', { style: 'percent', maximumFractionDigits: 1 }).format(value / 100);
  }
  return new Intl.NumberFormat('fr-CA').format(value);
};

const CustomTooltip = ({ active, payload, label, format }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl">
        <p className="font-medium text-slate-900 dark:text-white mb-2">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-sm" style={{ color: entry.color }}>
            {entry.name}: <span className="font-mono font-semibold">{formatValue(entry.value, format)}</span>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

function ChartRenderer({ chart }: { chart: ChartData }) {
  const [activeType, setActiveType] = useState<string>(chart.type);

  if (!chart) return null;

  // Determine series to plot
  const seriesKeys = chart.series && chart.series.length > 0 
    ? chart.series 
    : (chart.yKey ? [chart.yKey] : []);

  // Prepare data for Pie Chart
  const pieData = activeType === 'pie'
    ? chart.data.filter(item => {
        const val = item[seriesKeys[0]];
        const name = String(item[chart.xKey] || '').toLowerCase();
        // Filter out negative or zero values
        if (typeof val === 'number' && val <= 0) return false;
        // Filter out "Total" rows to avoid double counting
        if (name.includes('total') || name.includes('général')) return false;
        return true;
      })
    : chart.data;

  const ChartComponent = {
    'bar': BarChart,
    'line': LineChart,
    'area': AreaChart,
    'pie': PieChart
  }[activeType] || BarChart;

  return (
    <div className="flex flex-col h-full w-full">
      {/* Chart Controls */}
      <div className="flex justify-end gap-2 mb-4">
        <button 
          onClick={() => setActiveType('bar')}
          className={cn("p-2 rounded-lg transition-colors", activeType === 'bar' ? "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400" : "text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800")}
          title="Barres"
        >
          <BarChart2 className="w-4 h-4" />
        </button>
        <button 
          onClick={() => setActiveType('line')}
          className={cn("p-2 rounded-lg transition-colors", activeType === 'line' ? "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400" : "text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800")}
          title="Lignes"
        >
          <TrendingUp className="w-4 h-4" />
        </button>
        <button 
          onClick={() => setActiveType('area')}
          className={cn("p-2 rounded-lg transition-colors", activeType === 'area' ? "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400" : "text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800")}
          title="Aire"
        >
          <Activity className="w-4 h-4" />
        </button>
        <button 
          onClick={() => setActiveType('pie')}
          className={cn("p-2 rounded-lg transition-colors", activeType === 'pie' ? "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400" : "text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800")}
          title="Camembert"
        >
          <PieIcon className="w-4 h-4" />
        </button>
      </div>

      <div className="h-[400px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          {activeType === 'pie' ? (
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                labelLine={true}
                outerRadius={120}
                fill="#8884d8"
                dataKey={seriesKeys[0]} // Pie only supports one series usually
                nameKey={chart.xKey}
                label={({ name, value }) => `${name} (${formatValue(value, chart.format)})`}
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="rgba(255,255,255,0.1)" strokeWidth={2} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip format={chart.format} />} />
              <Legend wrapperStyle={{ paddingTop: '20px' }} />
            </PieChart>
          ) : (
            // @ts-ignore - Dynamic component props are tricky
            <ChartComponent data={chart.data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <defs>
                {COLORS.map((color, i) => (
                  <linearGradient key={i} id={`gradient-${i}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity={0.8}/>
                    <stop offset="100%" stopColor={color} stopOpacity={0.3}/>
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" className="dark:stroke-slate-700" />
              <XAxis 
                dataKey={chart.xKey} 
                tick={{fontSize: 12, fill: '#94a3b8'}} 
                axisLine={{stroke: '#cbd5e1'}}
                tickLine={{stroke: '#cbd5e1'}}
              />
              <YAxis 
                tick={{fontSize: 12, fill: '#94a3b8'}} 
                axisLine={{stroke: '#cbd5e1'}}
                tickLine={{stroke: '#cbd5e1'}}
                tickFormatter={(value) => formatValue(value, chart.format)}
              />
              <Tooltip content={<CustomTooltip format={chart.format} />} cursor={{fill: 'rgba(99, 102, 241, 0.1)'}} />
              <Legend wrapperStyle={{ paddingTop: '20px' }} />
              
              {seriesKeys.map((key, index) => {
                const color = COLORS[index % COLORS.length];
                if (activeType === 'bar') {
                  return (
                    <Bar key={key} dataKey={key} fill={`url(#gradient-${index})`} radius={[4, 4, 0, 0]} name={key}>
                      <LabelList dataKey={key} position="top" formatter={(val: number) => formatValue(val, chart.format)} style={{ fill: '#94a3b8', fontSize: 10 }} />
                    </Bar>
                  );
                } else if (activeType === 'line') {
                  return (
                    <Line 
                      key={key}
                      type="monotone" 
                      dataKey={key} 
                      stroke={color} 
                      strokeWidth={3} 
                      dot={{r: 4, fill: color, strokeWidth: 2, stroke: '#fff'}} 
                      activeDot={{r: 6, fill: color, strokeWidth: 0}} 
                      name={key} 
                    />
                  );
                } else if (activeType === 'area') {
                  return (
                    <Area 
                      key={key}
                      type="monotone" 
                      dataKey={key} 
                      stroke={color} 
                      fill={`url(#gradient-${index})`} 
                      name={key} 
                    />
                  );
                }
                return null;
              })}
            </ChartComponent>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function AnalysisResultView({ text, chart, sqlData }: AnalysisResultViewProps) {
  if (!text && !chart && !sqlData) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-400 dark:text-slate-500 p-8 text-center bg-gradient-to-b from-white to-slate-50 dark:from-slate-900 dark:to-slate-950">
        <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800/50 rounded-3xl flex items-center justify-center mb-6 shadow-inner">
          <BarChart2 className="w-10 h-10 opacity-30" />
        </div>
        <p className="text-lg font-medium">Les résultats de l'analyse apparaîtront ici</p>
        <p className="text-sm mt-2 opacity-60">Posez une question pour commencer</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white dark:bg-slate-900 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm shrink-0">
        <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 text-sm uppercase tracking-wide">
          <div className="p-1.5 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
            <BarChart2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          Rapport d'analyse
        </h3>
        <div className="text-[10px] font-mono font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 px-2 py-1 rounded-md border border-indigo-100 dark:border-indigo-900/30">
          AUTO-GENERATED
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-gradient-to-b from-slate-50/50 to-white dark:from-slate-950/50 dark:to-slate-900 min-h-0">
        {!chart && !text && (!sqlData || sqlData.length === 0) && (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 dark:text-slate-500">
            <Loader2 className="w-8 h-8 animate-spin mb-4 opacity-20" />
            <p>Aucun résultat trouvé pour cette recherche.</p>
            <p className="text-sm opacity-60">Essayez de reformuler votre question.</p>
          </div>
        )}

        {/* Chart Section */}
        {chart && (
          <div className="bg-white dark:bg-slate-800/50 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-50" />
            <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-8 text-center uppercase tracking-wider flex items-center justify-center gap-2">
              {chart.title}
            </h4>
            <ChartRenderer chart={chart} />
          </div>
        )}

        {/* Text Section */}
        {text && (
          <div className="prose prose-slate dark:prose-invert max-w-none">
            <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-sm uppercase tracking-wide mb-4">
              <div className="p-1.5 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                <AlignLeft className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <span>Insights Clés</span>
            </div>
            <div className="bg-white dark:bg-slate-800/50 p-8 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
              <ReactMarkdown 
                remarkPlugins={[remarkGfm]}
                components={{
                  table: ({node, ...props}) => <div className="overflow-x-auto my-6"><table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden" {...props} /></div>,
                  thead: ({node, ...props}) => <thead className="bg-slate-50 dark:bg-slate-900/50" {...props} />,
                  th: ({node, ...props}) => <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider font-mono" {...props} />,
                  td: ({node, ...props}) => <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-600 dark:text-slate-300 border-t border-slate-100 dark:border-slate-800 font-mono" {...props} />,
                  p: ({node, ...props}) => <p className="mb-4 leading-relaxed text-slate-600 dark:text-slate-300" {...props} />,
                  ul: ({node, ...props}) => <ul className="list-disc pl-5 mb-4 space-y-2 text-slate-600 dark:text-slate-300" {...props} />,
                  ol: ({node, ...props}) => <ol className="list-decimal pl-5 mb-4 space-y-2 text-slate-600 dark:text-slate-300" {...props} />,
                  li: ({node, ...props}) => <li className="pl-1 marker:text-indigo-500" {...props} />,
                  h1: ({node, ...props}) => <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-6 mt-8 tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600 dark:from-indigo-400 dark:to-violet-400" {...props} />,
                  h2: ({node, ...props}) => <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4 mt-6 uppercase tracking-wide flex items-center gap-2 before:content-[''] before:w-1 before:h-4 before:bg-indigo-500 before:rounded-full" {...props} />,
                  h3: ({node, ...props}) => <h3 className="text-base font-bold text-slate-900 dark:text-white mb-3 mt-5" {...props} />,
                  strong: ({node, ...props}) => <strong className="font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/30 px-1.5 py-0.5 rounded text-[0.95em]" {...props} />,
                }}
              >
                {text}
              </ReactMarkdown>
            </div>
          </div>
        )}

        {/* Data Table Section */}
        {sqlData && sqlData.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-sm uppercase tracking-wide">
              <div className="p-1.5 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <FileSpreadsheet className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
              <span>Données Brutes <span className="text-slate-400 dark:text-slate-500 font-normal ml-1 font-mono text-xs">({sqlData.length} lignes)</span></span>
            </div>
            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm bg-white dark:bg-slate-900">
              <DataView data={sqlData} className="max-h-[400px] overflow-auto border-0 shadow-none rounded-none" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
