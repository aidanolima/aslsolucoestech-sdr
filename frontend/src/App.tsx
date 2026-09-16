import { useState, useRef, useEffect } from 'react';

export default function App() {
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const logContainerRef = useRef<HTMLDivElement>(null);

  const chromeCommand = `& "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --remote-debugging-port=9222 --user-data-dir="C:\\chrome-dev-session"`;

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  const handleCopyCommand = () => {
    navigator.clipboard.writeText(chromeCommand);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRunCadence = () => {
    if (loading) return;
    setLoading(true);
    setLogs(['🚀 [UI] Conectando ao motor em tempo real...']);

    const eventSource = new EventSource('http://localhost:3001/api/run-cadence-stream');

    eventSource.onmessage = (event) => {
      const newLog = JSON.parse(event.data);
      setLogs((prev) => [...prev, newLog]);

      if (newLog.includes('Processo finalizado')) {
        eventSource.close();
        setLoading(false);
      }
    };

    eventSource.onerror = () => {
      setLogs((prev) => [...prev, '❌ [UI] Conexão com o servidor encerrada.']);
      eventSource.close();
      setLoading(false);
    };
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Topbar */}
      <header className="border-b border-slate-800 bg-slate-900/50 px-8 py-4 flex justify-between items-center">
        <h1 className="text-xl font-bold text-indigo-400">
          ASL Soluções Tech <span className="text-xs font-normal text-slate-400 bg-slate-800 px-2 py-1 rounded ml-2">Dashboard V1</span>
        </h1>
        <button
          onClick={handleRunCadence}
          disabled={loading}
          className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white font-semibold px-5 py-2.5 rounded-lg shadow-lg shadow-indigo-600/20 transition-all cursor-pointer flex items-center gap-2"
        >
          {loading ? '⏳ Processando...' : '▶️ Iniciar Cadência Autônoma'}
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-8 max-w-7xl mx-auto w-full space-y-6">
        {/* Banner de Alerta Chrome CDP */}
        <div className="bg-amber-950/40 border border-amber-500/30 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-amber-400 font-semibold text-sm">
              <span>⚠️ Pré-requisito de Execução:</span>
              <span className="text-slate-300 font-normal">O Chrome deve estar aberto no modo Debug na porta 9222.</span>
            </div>
            <p className="text-xs text-slate-400">
              Abra o PowerShell no Windows e execute o comando abaixo antes de iniciar a cadência.
            </p>
          </div>
          <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-lg p-1.5 w-full md:w-auto">
            <code className="text-xs font-mono text-indigo-300 px-2 truncate max-w-xs md:max-w-md">
              {chromeCommand}
            </code>
            <button
              onClick={handleCopyCommand}
              className="bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 font-medium px-3 py-1.5 rounded transition-all shrink-0 cursor-pointer"
            >
              {copied ? '✅ Copiado!' : '📋 Copiar'}
            </button>
          </div>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Status da Operação</p>
            <p className={`text-2xl font-bold mt-2 ${loading ? 'text-amber-400' : 'text-emerald-400'}`}>
              {loading ? 'Executando Cadência...' : 'Pronto para Operar'}
            </p>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Última Execução</p>
            <p className="text-2xl font-bold text-indigo-400 mt-2">Handoff & Directs OK</p>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Canal Ativo</p>
            <p className="text-2xl font-bold text-violet-400 mt-2">Instagram CDP Chrome</p>
          </div>
        </div>

        {/* Live Terminal Log Viewer */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-md">
          <h2 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${loading ? 'bg-amber-400 animate-ping' : 'bg-emerald-500'}`}></span>
            Console de Logs ao Vivo (Stdout)
          </h2>
          <div
            ref={logContainerRef}
            className="bg-slate-950 rounded-lg p-4 font-mono text-xs text-slate-300 h-80 overflow-y-auto border border-slate-800/80 space-y-1.5"
          >
            {logs.length === 0 ? (
              <p className="text-slate-600 italic">Aguardando disparo da cadência...</p>
            ) : (
              logs.map((log, index) => (
                <div
                  key={index}
                  className={`py-0.5 ${
                    log.includes('🚀')
                      ? 'text-indigo-400 font-bold'
                      : log.includes('❌') || log.includes('⚠️')
                      ? 'text-amber-400'
                      : log.includes('✅') || log.includes('✨')
                      ? 'text-emerald-400 font-semibold'
                      : 'text-slate-300'
                  }`}
                >
                  {log}
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
}