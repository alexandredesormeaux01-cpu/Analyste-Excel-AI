import React, { useState, useEffect } from 'react';
import { FileUpload } from './components/FileUpload';
import { DataView } from './components/DataView';
import { ChatInterface } from './components/ChatInterface';
import { AnalysisResultView } from './components/AnalysisResultView';
import { LayoutDashboard, FileSpreadsheet, Trash2, Moon, Sun, Link as LinkIcon, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import * as XLSX from 'xlsx';

interface SheetData {
  name: string;
  data: any[];
}

export default function App() {
  const [sheets, setSheets] = useState<SheetData[]>([]);
  const [activeSheetName, setActiveSheetName] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<{ text?: string; chart?: any; sqlData?: any[] } | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isFetchingRemote, setIsFetchingRemote] = useState(false);
  const [remoteUrl, setRemoteUrl] = useState('');
  
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const handleDataLoaded = (loadedSheets: SheetData[], name: string) => {
    setSheets(loadedSheets);
    setActiveSheetName(loadedSheets[0]?.name || null);
    setFileName(name);
    setAnalysisResult(null); // Reset result on new file
  };

  const handleFetchRemote = async () => {
    if (!remoteUrl) return;
    setIsFetchingRemote(true);
    console.log("Tentative de connexion à l'URL :", remoteUrl);
    try {
      const proxyUrl = `/api/proxy-fetch?url=${encodeURIComponent(remoteUrl)}`;
      console.log("Appel du proxy :", proxyUrl);
      
      const response = await fetch(proxyUrl);
      console.log("Réponse du proxy reçue, status :", response.status);
      
      if (!response.ok) {
        let errorMessage = 'Erreur lors de la récupération du fichier';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          const textError = await response.text();
          errorMessage = textError || errorMessage;
        }
        throw new Error(errorMessage);
      }
      
      const blob = await response.blob();
      console.log("Blob reçu, taille :", blob.size, "type :", blob.type);
      
      if (blob.size === 0) {
        throw new Error("Le fichier reçu est vide.");
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result;
        if (result) {
          try {
            console.log("Lecture du fichier Excel...");
            const workbook = XLSX.read(result, { type: 'binary' });
            console.log("Onglets trouvés :", workbook.SheetNames);
            
            const loadedSheets: SheetData[] = [];
            workbook.SheetNames.forEach(sheetName => {
              const worksheet = workbook.Sheets[sheetName];
              const jsonData = XLSX.utils.sheet_to_json(worksheet);
              if (jsonData.length > 0) {
                loadedSheets.push({
                  name: sheetName,
                  data: jsonData
                });
              }
            });
            
            console.log("Nombre d'onglets chargés :", loadedSheets.length);
            
            if (loadedSheets.length === 0) {
              throw new Error("Le fichier semble vide ou l'onglet est incorrect.");
            }
            
            handleDataLoaded(loadedSheets, remoteUrl.split('/').pop()?.split('?')[0] || 'Fichier distant');
          } catch (err: any) {
            console.error("Erreur lecture Excel :", err);
            alert(`Erreur de lecture Excel : ${err.message}`);
          }
        }
      };
      reader.onerror = (err) => {
        console.error("Erreur FileReader :", err);
        alert("Erreur lors de la lecture locale du fichier.");
      };
      reader.readAsBinaryString(blob);
    } catch (error: any) {
      console.error("Erreur complète :", error);
      alert(`Erreur de connexion : ${error.message}`);
    } finally {
      setIsFetchingRemote(false);
    }
  };

  const handleClearData = () => {
    setSheets([]);
    setActiveSheetName(null);
    setFileName(null);
    setAnalysisResult(null);
  };

  const handleResultUpdate = (result: { text: string; chart?: any; sqlData?: any[] }) => {
    setAnalysisResult(result);
  };

  const activeSheetData = sheets.find(s => s.name === activeSheetName)?.data || [];

  return (
    <div className={cn(
      "h-screen h-[100dvh] flex flex-col font-sans transition-colors duration-300 overflow-hidden",
      "bg-slate-50 text-slate-900 selection:bg-indigo-100 selection:text-indigo-900",
      "dark:bg-slate-950 dark:text-slate-100 dark:selection:bg-indigo-900/30 dark:selection:text-indigo-100"
    )}>
      {/* Header */}
      <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-6 py-4 flex items-center justify-between sticky top-0 z-50 transition-colors duration-300">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-lg text-white shadow-lg shadow-indigo-500/20">
            <LayoutDashboard className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight tracking-tight text-slate-900 dark:text-white">
              Analyste<span className="text-indigo-600 dark:text-indigo-400">IA</span>
            </h1>
            <p className="text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400">v2.0 // Analyse Avancée</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          {fileName ? (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100/50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate max-w-[150px]">{fileName}</span>
                <span className="text-xs font-mono text-slate-400 dark:text-slate-500 border-l border-slate-300 dark:border-slate-600 pl-2 ml-1">
                  {activeSheetName} ({activeSheetData.length} LIGNES)
                </span>
              </div>
              <button
                onClick={handleClearData}
                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all duration-200"
                title="Effacer les données"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-2" />
            </div>
          ) : (
             <div />
          )}
          
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="p-2 text-slate-400 hover:text-indigo-600 dark:text-slate-500 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all duration-200"
            title={isDarkMode ? "Passer en mode clair" : "Passer en mode sombre"}
          >
            {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-4 lg:p-6 overflow-hidden bg-slate-50 dark:bg-slate-950">
        <div className="h-full max-w-[1600px] mx-auto flex flex-col lg:grid lg:grid-cols-12 gap-6 min-h-0">
          
          {/* Chat Column */}
          <div className="lg:col-span-3 flex flex-col h-[450px] lg:h-full shrink-0 min-h-0">
            {sheets.length >= 0 ? (
              <ChatInterface 
                sheets={sheets} 
                className="flex-1 shadow-sm border-slate-200/60 dark:border-slate-800/60"
                onResultUpdate={handleResultUpdate}
              />
            ) : (
              <div className="p-4 text-red-500">Erreur de chargement du chat</div>
            )}
          </div>

          {/* Data & Results Column */}
          <div className="lg:col-span-9 flex flex-col h-full min-h-0 overflow-hidden rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            {!sheets.length ? (
              <div className="flex-1 flex flex-col justify-center items-center p-12 text-center overflow-y-auto">
                <div className="max-w-xl w-full space-y-8">
                  <div className="space-y-2">
                    <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
                      <FileSpreadsheet className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Source de données</h2>
                    <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
                      Connectez votre fichier Excel (150+ colonnes supportées) pour une analyse en lecture seule.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 text-left">Option 1: Fichier Local</h3>
                      <FileUpload onDataLoaded={handleDataLoaded} className="bg-slate-50/50 dark:bg-slate-800/50 h-full" />
                    </div>
                    
                    <div className="space-y-4">
                      <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 text-left">Option 2: URL Distante</h3>
                      <div className="p-6 bg-slate-50/50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 space-y-4 h-full">
                        <div className="relative">
                          <input 
                            type="text" 
                            placeholder="https://..."
                            value={remoteUrl}
                            onChange={(e) => setRemoteUrl(e.target.value)}
                            className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none"
                          />
                        </div>
                        <button 
                          onClick={handleFetchRemote}
                          disabled={isFetchingRemote || !remoteUrl}
                          className="w-full py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          {isFetchingRemote ? <Loader2 className="w-4 h-4 animate-spin" /> : <LinkIcon className="w-4 h-4" />}
                          {isFetchingRemote ? 'Connexion...' : 'Connecter'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              // If we have an analysis result, show it. Otherwise show the data preview.
              analysisResult ? (
                <AnalysisResultView 
                  text={analysisResult.text} 
                  chart={analysisResult.chart} 
                  sqlData={analysisResult.sqlData} 
                />
              ) : (
                <div className="flex flex-col h-full">
                  <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900">
                    <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2 text-sm uppercase tracking-wide">
                      <FileSpreadsheet className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      Aperçu des données
                    </h3>
                    <div className="flex items-center gap-2">
                       <div className="text-[10px] font-mono text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20">
                        CONNECTED // READ-ONLY
                      </div>
                    </div>
                  </div>
                  <div className="flex-1 overflow-hidden p-0">
                    <DataView 
                      sheets={sheets} 
                      activeSheetName={activeSheetName || ''} 
                      onSheetChange={setActiveSheetName}
                      className="border-0 shadow-none rounded-none h-full" 
                    />
                  </div>
                </div>
              )
            )}
          </div>

        </div>
      </main>
    </div>
  );
}
