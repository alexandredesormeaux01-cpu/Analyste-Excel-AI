import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import * as XLSX from 'xlsx';
import { Upload, FileSpreadsheet } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SheetData {
  name: string;
  data: any[];
}

interface FileUploadProps {
  onDataLoaded: (sheets: SheetData[], fileName: string) => void;
  className?: string;
}

export function FileUpload({ onDataLoaded, className }: FileUploadProps) {
  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = e.target?.result;
        if (data) {
          const workbook = XLSX.read(data, { type: 'binary' });
          const sheets: SheetData[] = [];
          
          workbook.SheetNames.forEach(sheetName => {
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet);
            if (jsonData.length > 0) {
              sheets.push({
                name: sheetName,
                data: jsonData
              });
            }
          });

          if (sheets.length > 0) {
            onDataLoaded(sheets, file.name);
          } else {
            alert("Aucune donnée trouvée dans le fichier.");
          }
        }
      };
      reader.readAsBinaryString(file);
    }
  }, [onDataLoaded]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'text/csv': ['.csv']
    },
    multiple: false
  });

  return (
    <div
      {...getRootProps()}
      className={cn(
        "border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-8 text-center transition-colors cursor-pointer group",
        isDragActive 
          ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20" 
          : "hover:border-slate-400 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800/50",
        className
      )}
    >
      <input {...getInputProps()} />
      <div className="flex flex-col items-center gap-4">
        <div className={cn(
          "p-4 rounded-full transition-all",
          isDragActive 
            ? "bg-indigo-100 dark:bg-indigo-900/30" 
            : "bg-slate-100 dark:bg-slate-800 group-hover:bg-white dark:group-hover:bg-slate-700 group-hover:shadow-sm"
        )}>
          <FileSpreadsheet className={cn(
            "w-8 h-8 transition-colors",
            isDragActive 
              ? "text-indigo-600 dark:text-indigo-400" 
              : "text-slate-500 dark:text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400"
          )} />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-slate-900 dark:text-white">
            {isDragActive ? "Déposez le fichier ici" : "Cliquez pour télécharger ou glissez-déposez"}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Fichiers Excel (XLSX, XLS) ou CSV
          </p>
        </div>
      </div>
    </div>
  );
}
