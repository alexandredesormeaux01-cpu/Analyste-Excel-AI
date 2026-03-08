import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Send, Bot, User, Loader2, BarChart2, Lock } from 'lucide-react';
import { GoogleGenAI, Type } from "@google/genai";
import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';
import { generateMultiSheetProfile, formatProfileForPrompt, executeQuery } from '@/lib/dataAnalysis';
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
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Generate data profile when data changes
  const dataProfile = useMemo(() => {
    return generateMultiSheetProfile(sheets);
  }, [sheets]);

  // Define the tool for plotting charts
  const plotChartTool = {
    name: "plot_chart",
    description: "Génère un graphique basé sur les données. Utilisez ceci lorsque l'utilisateur demande une visualisation.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        type: {
          type: Type.STRING,
          enum: ["bar", "line", "pie", "area", "composed"],
          description: "Le type de graphique. Utilisez 'composed' pour les graphiques à double axe (ex: Ventes vs Marge)."
        },
        data: {
          type: Type.STRING,
          description: "Chaîne JSON des points de données. Ex: [{'mois': 'Jan', 'Ventes': 1000, 'Marge': 25}, ...]"
        },
        xKey: {
          type: Type.STRING,
          description: "La clé pour l'axe X (catégories)."
        },
        yKey: {
          type: Type.STRING,
          description: "La clé pour l'axe Y (valeurs). Ignoré si 'series' est fourni."
        },
        series: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "Liste des clés de données pour l'axe GAUCHE (ex: ['Ventes'])."
        },
        rightSeries: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "Liste des clés de données pour l'axe DROIT (ex: ['Marge %']). Utilisez ceci pour les pourcentages ou les unités différentes."
        },
        format: {
          type: Type.STRING,
          enum: ["currency", "number", "percent"],
          description: "Le format des valeurs (ex: 'currency' pour les montants en $)."
        },
        title: {
          type: Type.STRING,
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
      type: Type.OBJECT,
      properties: {
        query: {
          type: Type.STRING,
          description: "La requête SQL à exécuter. Utilisez les noms de tables exacts (ex: 'SELECT * FROM Ventes_2024')."
        }
      },
      required: ["query"]
    }
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = { role: 'user' as const, content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
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
          model: "gemini-3-flash-preview",
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
      setMessages(prev => [...prev, { role: 'model', content: `Désolé, une erreur est survenue lors de l'analyse : ${error.message || error}` }]);
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
    <div className={cn("flex flex-col h-full bg-white dark:bg-slate-900 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800", className)}>
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 p-4 flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        <h2 className="font-semibold text-slate-900 dark:text-white text-sm tracking-wide uppercase">Terminal de Commande</h2>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {messages.filter(m => !m.hidden).map((m, i) => (
          <div key={i} className={cn("flex gap-3", m.role === 'user' ? "ml-auto flex-row-reverse" : "")}>
            <div className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm",
              m.role === 'user' ? "bg-indigo-600 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
            )}>
              {m.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
            </div>
            <div className={cn(
              "p-3 rounded-lg text-sm leading-relaxed max-w-[90%]",
              m.role === 'user' 
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/10" 
                : "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-100 dark:border-slate-700"
            )}>
              <ReactMarkdown>{m.content}</ReactMarkdown>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 flex items-center justify-center flex-shrink-0">
              <Bot className="w-4 h-4" />
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-lg flex items-center gap-3">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-600 dark:text-indigo-400" />
              <span className="text-xs font-mono text-slate-500 dark:text-slate-400 uppercase tracking-wider">Traitement des données...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800">
        <div className="relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Entrez votre commande d'analyse..."
            className="w-full pl-4 pr-12 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:focus:border-indigo-400 transition-all text-sm font-medium placeholder:text-slate-400 dark:placeholder:text-slate-500 text-slate-900 dark:text-white"
            disabled={isLoading}
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-50 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors border border-slate-200 dark:border-slate-600 shadow-sm"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <div className="mt-2 text-[10px] text-slate-400 dark:text-slate-500 text-center font-mono">
          IA POWERED // GEMINI 3.0
        </div>
      </div>
    </div>
  );
}
