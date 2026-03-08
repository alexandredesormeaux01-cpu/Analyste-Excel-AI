import React from 'react';
import { cn } from '@/lib/utils';
import { FileSpreadsheet } from 'lucide-react';

interface SheetData {
  name: string;
  data: any[];
}

interface DataViewProps {
  data?: any[]; // Single sheet mode (for AnalysisResultView)
  sheets?: SheetData[]; // Multi sheet mode (for App)
  activeSheetName?: string;
  onSheetChange?: (name: string) => void;
  className?: string;
}

export function DataView({ data, sheets, activeSheetName, onSheetChange, className }: DataViewProps) {
  // Determine which data to show
  let displayData: any[] = [];
  let isMultiSheet = false;

  if (sheets && sheets.length > 0) {
    isMultiSheet = true;
    const activeSheet = sheets.find(s => s.name === activeSheetName) || sheets[0];
    displayData = activeSheet.data;
  } else if (data && data.length > 0) {
    displayData = data;
  } else {
    return null;
  }

  const headers = displayData.length > 0 ? Object.keys(displayData[0]) : [];
  const limit = isMultiSheet ? 7 : 100; // Limit to 7 for preview, 100 for results

  return (
    <div className={cn("flex flex-col bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm", className)}>
      {/* Tabs (Only in MultiSheet mode) */}
      {isMultiSheet && sheets && onSheetChange && (
        <div className="flex items-center gap-1 p-2 border-b border-slate-100 dark:border-slate-800 overflow-x-auto">
          {sheets.map((sheet) => (
            <button
              key={sheet.name}
              onClick={() => onSheetChange(sheet.name)}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap",
                activeSheetName === sheet.name
                  ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 ring-1 ring-indigo-200 dark:ring-indigo-800"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
              )}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              {sheet.name}
              <span className="opacity-50 text-[10px] ml-1">({sheet.data.length})</span>
            </button>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10">
            <tr>
              {headers.map((header) => (
                <th key={header} className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap bg-slate-50 dark:bg-slate-800">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {displayData.slice(0, limit).map((row, i) => (
              <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                {headers.map((header) => (
                  <td key={`${i}-${header}`} className="px-4 py-2 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                    {String(row[header] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Footer */}
      <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400 flex justify-between items-center">
        <span>Aperçu des {Math.min(limit, displayData.length)} premières lignes</span>
        <span>Total: {displayData.length} lignes</span>
      </div>
    </div>
  );
}
