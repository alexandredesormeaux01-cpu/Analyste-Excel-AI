import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Send, Bot, User, Loader2, BarChart2, Lock, ArrowDown } from 'lucide-react';
import { GoogleGenAI, Type } from "@google/genai";
import ReactMarkdown from 'react-markdown';
import { cn } from '../lib/utils';
import { generateMultiSheetProfile, formatProfileForPrompt, executeQuery } from '../lib/dataAnalysis';
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
  Cell
} from 'recharts';

// --- Types ---

interface Message {
  role: 'user' | 'model';
  content: string;
  chart?: ChartData;
  hidden?: boolean;
}

interface ChartData {
  type: 'bar' | 'line' | 'pie' | 'area' | 'composed';
  data: any[];
  xKey: string;
  yKey?: string;
  series?: string[];
  rightSeries?: string[];
  format?: 'currency' | 'number' | 'percent';
  title: string;
}

interface SheetData {
  name: string;
  data: any[];
}

interface ChatInterfaceProps {
  sheets: SheetData[];
  className?: string;
  onResultUpdate: (result: { text: string; chart?: ChartData; sqlData?: any[] }) => void;
}

// --- Main Component ---

export function ChatInterface({ sheets, className, onResultUpdate }: ChatInterfaceProps) {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState(false);
  
  const [messages, setMessages] = useState<Message[]>([
    { role: 'model', content: "Bonjour ! Je suis votre analyste de données. Téléchargez un fichier pour commencer, ou posez-moi des questions sur vos données.", hidden: false }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Reset messages when data changes (new file upload)
  useEffect(() => {
    if (sheets.length > 0) {
      setMessages([
        { role: 'model', content: "Données chargées avec succès. Que souhaitez-vous analyser ?", hidden: false }
      ]);
    } else {
      setMessages([
        { role: 'model', content: "Bonjour ! Je suis votre analyste de données. Téléchargez un fichier pour commencer, ou posez-moi des questions sur vos données.", hidden: false }
      ]);
    }
  }, [sheets.length]);

  // Initialize Gemini
  const geminiApiKey = (import.meta as any).env?.VITE_GEMINI_API_KEY || 
                       (typeof process !== 'undefined' ? (process as any).env?.GEMINI_API_KEY : '') || 
                       '';

  const [isAtBottom, setIsAtBottom] = useState(true);
  const [showScrollButton, setShowScrollButton] = useState(false);

  const handleScroll = () => {
    if (scrollContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
      const atBottom = scrollHeight - scrollTop - clientHeight < 100;
      setIsAtBottom(atBottom);
      setShowScrollButton(!atBottom && scrollHeight > clientHeight);
    }
  };

  const scrollToBottom = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  };

  useEffect(() => {
    if (isAtBottom) {
      const timer = setTimeout(scrollToBottom, 100);
      return () => clearTimeout(timer);
    }
  }, [messages, isLoading, isAtBottom]);

  // Generate data profile when data changes
  const dataProfile = useMemo(() => {
    return generateMultiSheetProfile(sheets);
  }, [sheets]);

  // Define the tool for plotting charts
  const plotChartTool = {
    name: "plot_chart",
    description: "Génère un graphique basé sur les données. Utilisez ceci lorsque l'utilisateur demande une visualisation.",
    parameters: {
      type: "OBJECT",
      properties: {
        type: {
          type: "STRING",
          enum: ["bar", "line", "pie", "area", "composed"],
          description: "Le type de graphique. Utilisez 'composed' pour les graphiques à double axe (ex: Ventes vs Marge)."
        },
        data: {
          type: "STRING",
          description: "Chaîne JSON des points de données. Ex: [{'mois': 'Jan', 'Ventes': 1000, 'Marge': 25}, ...]"
        },
        xKey: {
          type: "STRING",
          description: "La clé pour l'axe X (catégories)."
        },
        yKey: {
          type: "STRING",
          description: "La clé pour l'axe Y (valeurs). Ignoré si 'series' est fourni."
        },
        series: {
          type: "ARRAY",
          items: { type: "STRING" },
          description: "Liste des clés de données pour l'axe GAUCHE (ex: ['Ventes'])."
        },
        rightSeries: {
          type: "ARRAY",
          items: { type: "STRING" },
          description: "Liste des clés de données pour l'axe DROIT (ex: ['Marge %']). Utilisez ceci pour les pourcentages ou les unités différentes."
        },
        format: {
          type: "STRING",
          enum: ["currency", "number", "percent"],
          description: "Le format des valeurs (ex: 'currency' pour les montants en $)."
        },
        title: {
          type: "STRING",
          description: "Un titre descriptif pour le graphique."
        }
      },
      required: ["type", "data", "xKey", "title"]
    }
  };

  // Define the tool for SQL queries
  const runSqlTool = {
    name: "run_sql_query",
    description: "Exécute une requête SQL sur les données. Utilisez les noms de tables fournis dans le contexte (ex: 'Sheet1'). Utilisez ceci pour filtrer, agréger ou rechercher des informations spécifiques.",
    parameters: {
      type: "OBJECT",
      properties: {
        query: {
          type: "STRING",
          description: "La requête SQL à exécuter. Utilisez les noms de tables exacts (ex: 'SELECT * FROM Ventes_2024')."
        }
      },
      required: ["query"]
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', content: input };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey: geminiApiKey });
      // Prepare context
      const profileSummary = sheets.length > 0 
        ? formatProfileForPrompt(dataProfile)
        : "Aucune donnée téléchargée pour le moment.";

      const systemInstruction = `Vous êtes un expert analyste de données parlant français.
      Vous avez accès à un fichier Excel contenant plusieurs onglets, accessibles via SQL.
      
      CONTEXTE DES DONNÉES :
      ${profileSummary}

      INSTRUCTIONS CRITIQUES :
      1. Votre objectif est de fournir une ANALYSE COMPLÈTE et VISUELLE dans le panneau de résultats.
      2. Pour TOUTE question impliquant des chiffres, des comparaisons ou des tendances, VOUS DEVEZ GÉNÉRER UN GRAPHIQUE avec 'plot_chart'. C'est prioritaire.
      3. Utilisez 'run_sql_query' pour extraire les données exactes.
      4. RECHERCHE FLOU : Si l'utilisateur cherche un terme (ex: "clous"), utilisez TOUJOURS 'LIKE' avec des jokers '%' dans votre SQL. 
         Ex: SELECT * FROM [NomTable] WHERE [Nom Colonne] LIKE '%clous%'
      5. RÉPONSE TEXTUELLE OBLIGATOIRE : Vous devez TOUJOURS fournir une explication textuelle détaillée de vos conclusions, même si vous générez un graphique. Ne laissez jamais le texte vide.
      6. Les tables SQL correspondent aux noms des onglets (nettoyés). Référez-vous au CONTEXTE DES DONNÉES pour les noms exacts des tables.
      7. Si les noms de colonnes contiennent des espaces, utilisez des crochets. Ex: 'SELECT [Nom Produit] FROM [Ma_Table]'.
      
      RÈGLES POUR LES GRAPHIQUES :
      - Pour les montants monétaires ($), définissez TOUJOURS "format": "currency".
      - Pour comparer plusieurs années ou catégories (ex: Ventes 2024 vs 2025), utilisez le champ "series": ["2024", "2025"] et structurez "data" en conséquence.
      - Pour les pourcentages, utilisez "format": "percent".
      
      FORMATAGE :
      - Utilisez des listes à puces pour énumérer des points.
      - Utilisez du GRAS (**gras**) pour les chiffres clés.
      - Aérez le texte avec des sauts de ligne.
      `;

      // Build conversation history for generateContent
      const contents: any[] = messages.map(m => ({
        role: m.role,
        parts: [{ text: m.content }]
      }));
      
      // Add current user message
      contents.push({ role: 'user', parts: [{ text: input }] });

      let text = "";
      let chartData: ChartData | undefined;
      let lastSqlData: any[] | undefined;
      
      // Loop for tool calls
      let loopCount = 0;
      const MAX_LOOPS = 5;
      let continueLoop = true;

      while (continueLoop && loopCount < MAX_LOOPS) {
        loopCount++;
        console.log(`Loop ${loopCount}: Calling Gemini...`);
        
        const result = await ai.models.generateContent({
          model: "gemini-2.0-flash",
          config: {
            systemInstruction: systemInstruction,
            tools: [{ functionDeclarations: [plotChartTool, runSqlTool] }]
          },
          contents: contents
        });

        const response = result;
        const responseContent = response.candidates?.[0]?.content;
        
        if (!responseContent) {
          throw new Error("No content in response");
        }

        // Add model response to history for next turn in loop
        contents.push(responseContent);

        // Extract text from this turn
        const currentText = responseContent.parts
          ?.map((p: any) => p.text || "")
          .join("");
        
        if (currentText) {
          console.log("Received text:", currentText);
          // Only append if it's not just whitespace
          if (currentText.trim()) {
             text += (text ? "\n" : "") + currentText;
          }
        }

        const functionCalls = response.functionCalls;
        
        if (functionCalls && functionCalls.length > 0) {
          console.log("Received function calls:", functionCalls);
          // Execute all function calls
          const functionResponses = [];
          
          for (const call of functionCalls) {
            let functionResponse;
            
            if (call.name === 'run_sql_query') {
              const args = call.args as any;
              try {
                console.log("Executing SQL:", args.query);
                const sqlResult = executeQuery(args.query, sheets);
                console.log("SQL Result (first 5):", sqlResult.slice(0, 5));
                
                lastSqlData = sqlResult; // Store the raw result

                const limitedResult = sqlResult.slice(0, 100); 
                functionResponse = {
                  name: call.name,
                  response: { result: JSON.stringify(limitedResult), truncated: sqlResult.length > 100 }
                };
              } catch (e: any) {
                console.error("SQL Error:", e);
                functionResponse = {
                  name: call.name,
                  response: { error: e.message }
                };
              }
            } else if (call.name === 'plot_chart') {
              const args = call.args as any;
              try {
                chartData = {
                  type: args.type,
                  data: typeof args.data === 'string' ? JSON.parse(args.data) : args.data,
                  xKey: args.xKey,
                  yKey: args.yKey,
                  series: args.series,
                  rightSeries: args.rightSeries,
                  format: args.format,
                  title: args.title
                };
                functionResponse = {
                  name: call.name,
                  response: { success: true, message: "Graphique généré avec succès. MAINTENANT, générez une analyse textuelle détaillée des données affichées pour expliquer les tendances à l'utilisateur." }
                };
                // Only add the marker if it's not already there, but don't rely on it for content
                if (!text.includes("Graphique généré")) {
                   // We don't add it to 'text' here to avoid polluting the analysis if the model does its job.
                   // The AnalysisResultView will show the chart anyway.
                }
              } catch (e: any) {
                 functionResponse = {
                  name: call.name,
                  response: { error: e.message }
                };
              }
            }
            
            if (functionResponse) {
              functionResponses.push({
                functionResponse: functionResponse
              });
            }
          }

          // Send function responses back
          if (functionResponses.length > 0) {
             contents.push({
               role: 'tool', 
               parts: functionResponses
             });
          } else {
            continueLoop = false;
          }
        } else {
          // No function calls, we are done
          continueLoop = false;
        }
      }

      setMessages(prev => [...prev, { 
        role: 'model', 
        content: text || "Analyse terminée. Voici les résultats.", 
        hidden: true // HIDE from chat UI
      }]);

      // Update parent with the full result
      onResultUpdate({
        text: text || "Analyse terminée. Voici les résultats générés.",
        chart: chartData,
        sqlData: lastSqlData
      });

    } catch (error: any) {
      console.error("Error calling Gemini:", error);
      let errorMessage = error.message || error;
      
      if (errorMessage.includes("503") || errorMessage.includes("UNAVAILABLE")) {
        errorMessage = "Le service Gemini est actuellement saturé. Veuillez patienter une minute et réessayer. (Erreur 503: Service Unavailable)";
      }
      
      setMessages(prev => [...prev, { role: 'model', content: `Désolé, une erreur est survenue lors de l'analyse : ${errorMessage}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    // Use environment variable or default password for the prototype
    const correctPassword = (import.meta as any).env.VITE_CHAT_PASSWORD || 'admin123';
    if (passwordInput === correctPassword) {
      setIsUnlocked(true);
      setPasswordError(false);
    } else {
      setPasswordError(true);
    }
  };

  try {
    if (!isUnlocked) {
      return (
        <div className={cn("flex flex-col h-full bg-white dark:bg-slate-900 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 items-center justify-center p-6", className)}>
          <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl flex items-center justify-center mb-6">
            <Lock className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2 text-center">Accès Restreint</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 text-center mb-6">
            Veuillez entrer le mot de passe pour débloquer l'assistant IA.
          </p>
          <form onSubmit={handleUnlock} className="w-full max-w-xs space-y-4">
            <div>
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="Mot de passe"
                className={cn(
                  "w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20",
                  passwordError ? "border-red-500 focus:border-red-500" : "border-slate-200 dark:border-slate-700 focus:border-indigo-500"
                )}
              />
              {passwordError && <p className="text-xs text-red-500 mt-1">Mot de passe incorrect</p>}
            </div>
            <button
              type="submit"
              className="w-full py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 transition-colors"
            >
              Débloquer
            </button>
          </form>
        </div>
      );
    }

    return (
      <div className={cn("flex flex-col h-full bg-slate-900 border border-indigo-500/30 shadow-[0_0_20px_rgba(79,70,229,0.1)] rounded-2xl overflow-hidden relative group/chat", className)}>
        {/* Glow effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 pointer-events-none" />
        
        {/* Header */}
        <div className="bg-slate-900/80 backdrop-blur-md border-b border-indigo-500/20 p-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.8)] animate-pulse" />
            </div>
            <h2 className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400 text-xs tracking-[0.2em] uppercase">
              Terminal d'Analyse
            </h2>
          </div>
          <div className="flex items-center gap-2">
             <div className="h-1 w-12 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-500 w-1/3 animate-[loading_2s_infinite_linear]" />
             </div>
          </div>
        </div>

        {/* Messages */}
        <div 
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth z-0 custom-scrollbar"
        >
          {messages.filter(m => !m.hidden).map((m, i) => (
            <div key={i} className={cn("flex gap-4 group/msg", m.role === 'user' ? "ml-auto flex-row-reverse" : "")}>
              <div className={cn(
                "w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform group-hover/msg:scale-110",
                m.role === 'user' 
                  ? "bg-indigo-600 shadow-[0_0_12px_rgba(79,70,229,0.4)] text-white" 
                  : "bg-slate-800 border border-indigo-500/20 text-indigo-400 shadow-inner"
              )}>
                {m.role === 'user' ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
              </div>
              <div className={cn(
                "p-4 rounded-2xl text-[13px] leading-relaxed max-w-[85%] relative",
                m.role === 'user' 
                  ? "bg-indigo-600 text-white shadow-xl" 
                  : "bg-slate-800/50 border border-indigo-500/10 text-slate-300 backdrop-blur-sm"
              )}>
                {/* Message glow (neon style) */}
                {m.role === 'user' && (
                  <div className="absolute inset-0 rounded-2xl bg-indigo-400/10 blur-md -z-10 opacity-0 group-hover/msg:opacity-100 transition-opacity" />
                )}
                <div className="prose prose-sm prose-invert max-w-none">
                  <ReactMarkdown>{m.content}</ReactMarkdown>
                </div>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex gap-4 animate-pulse">
              <div className="w-9 h-9 rounded-xl bg-slate-800 border border-indigo-500/20 flex items-center justify-center flex-shrink-0 text-indigo-400">
                <Bot className="w-5 h-5" />
              </div>
              <div className="p-4 bg-slate-800/30 border border-indigo-500/10 rounded-2xl flex items-center gap-4">
                <div className="flex gap-1">
                  <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" />
                </div>
                <span className="text-[10px] font-mono text-indigo-400/60 uppercase tracking-widest">Calcul matriciel en cours...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Scroll To Bottom Button */}
        {showScrollButton && (
          <button 
            onClick={scrollToBottom}
            className="absolute bottom-24 right-6 p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full shadow-lg shadow-indigo-500/20 transition-all hover:scale-110 active:scale-95 z-20 border border-indigo-400/30 animate-bounce"
          >
            <ArrowDown className="w-5 h-5" />
          </button>
        )}

        {/* Input Area */}
        <div className="p-4 bg-slate-900/80 backdrop-blur-md border-t border-indigo-500/20 z-10">
          <div className="relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Commande système..."
              className="w-full pl-5 pr-12 py-3.5 bg-slate-800/50 border border-indigo-500/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition-all text-[13px] font-medium placeholder:text-slate-600 text-indigo-50 placeholder:font-mono"
              disabled={isLoading}
            />
            <button
              onClick={handleSend}
              disabled={isLoading || !input.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-[0_0_10px_rgba(79,70,229,0.3)] hover:shadow-[0_0_15px_rgba(79,70,229,0.5)]"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          <div className="mt-3 flex items-center justify-between px-2">
            <span className="text-[9px] text-indigo-500/50 font-mono tracking-tighterUppercase">
              SECURE LINK // 256-BIT
            </span>
            <span className="text-[9px] text-slate-500 font-mono">
              IA POWERED // CORE 3.0
            </span>
          </div>
        </div>
      </div>
    );
  } catch (err: any) {
    return (
      <div className="p-10 bg-red-50 text-red-700 border border-red-200 rounded-xl overflow-auto">
        <h2 className="font-bold mb-2">DEBUG: Erreur dans ChatInterface</h2>
        <pre className="text-xs">{err.stack || err.message || err}</pre>
      </div>
    );
  }
}
