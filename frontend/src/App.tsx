import { useState } from 'react';

export default function App() {
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  const handleRunCadence = async () => {
    setLoading(true);
    setLogs((prev) => [...prev, '🚀 [UI] Disparando cadência autônoma...']);

    try {
      const response = await fetch('http://localhost:3001/api/run-cadence', {
        method: 'POST',
      });
      const data = await response.json();

      if (data.success) {
        setLogs((prev) => [...prev, '✅ Cadência finalizada com sucesso!']);
      } else {
        setLogs((prev) => [...prev, `❌ Erro: ${data.error}`]);
      }
    } catch (err) {
      setLogs((prev) => [...prev, '❌ Falha ao conectar ao servidor API (server.ts).']);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Topbar */}
      <header className="border-b border-slate-800 bg-slate-900/50 px-8 py-4 flex justify-between items-center">
        <h1 className="text-xl font-bold text-indigo-400">ASL Soluções Tech <span className="text-xs font-normal text-slate-400 bg-slate-800 px-2 py-1 rounded ml-2">Dashboard V1</span></h1>
        <button
          onClick={handleRunCadence}
          disabled={loading}
          className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 text-white font-semibold px-5 py-2.5 rounded-lg shadow-lg shadow-indigo-600/20 transition-all cursor-pointer flex items-center gap-2"
        >
          {loading ? '⏳ Processando...' : '▶️ Iniciar Cadência Autônoma'}
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-8 max-w-7xl mx-auto w-full space-y-6">
        {/* Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Status do Robô</p>
            <p className="text-2xl font-bold text-indigo-400 mt-2">Pronto para Operar</p>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Última Execução</p>
            <p className="text-2xl font-bold text-emerald-400 mt-2">Sucesso (Handoff)</p>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Canal Ativo</p>
            <p className="text-2xl font-bold text-violet-400 mt-2">Instagram CDP</p>
          </div>
        </div>

        {/* Live Terminal Log Viewer */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-md">
          <h2 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Logs de Execução em Tempo Real
          </h2>
          <div className="bg-slate-950 rounded-lg p-4 font-mono text-sm text-slate-300 h-64 overflow-y-auto border border-slate-800/80 space-y-1">
            {logs.length === 0 ? (
              <p className="text-slate-600 italic">Clique no botão "Iniciar Cadência Autônoma" para visualizar os logs...</p>
            ) : (
              logs.map((log, index) => <div key={index}>{log}</div>)
            )}
          </div>
        </div>
      </main>
    </div>
  );
}