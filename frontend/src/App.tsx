import { useState, useRef, useEffect } from 'react';

interface Lead {
  id: number;
  instagramId: string;
  username: string;
  fullName: string | null;
  niche: string | null;
  score: number;
  pipelineState: string;
  channelState: string;
  doNotContact: boolean | null;
  createdAt: number | null;
  updatedAt: number | null;
}

export default function App() {
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newLeadsText, setNewLeadsText] = useState('');
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [aiCriteria, setAiCriteria] = useState('Focar em tecnologia');
  const [aiMessage, setAiMessage] = useState('Olá! Notei seu interesse em...');
  const logContainerRef = useRef<HTMLDivElement>(null);

  const handleAddLeads = async () => {
    if (!newLeadsText.trim()) return;

    // Sanitização local antes de enviar
    const rawInputs = newLeadsText.split(/[,\n]/).map(u => u.trim()).filter(u => u);
    
    const usernames = rawInputs.map(input => {
      let cleaned = input;
      // Extrai handle caso o usuário cole uma URL
      if (cleaned.includes('instagram.com/')) {
        const match = cleaned.match(/instagram\.com\/([a-zA-Z0-9_.]+)/);
        if (match && match[1]) cleaned = match[1];
      }
      // Limpa @ duplicados e espaços
      return cleaned.replace(/^@+/, '').trim().toLowerCase();
    }).filter(u => u.length > 0 && !u.includes(' '));

    if (usernames.length === 0) return;

    try {
      const response = await fetch('http://localhost:3001/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usernames }),
      });

      if (response.ok) {
        setNewLeadsText('');
        setIsModalOpen(false);
        await fetchLeads(); // Recarrega a tabela e atualiza os cards no topo
      } else {
        console.error('Erro na resposta do servidor:', response.statusText);
      }
    } catch (error) {
      console.error('Erro de conexão ao adicionar leads:', error);
    }
  };

  const handleClearLeads = async () => {
    if (!confirm('Tem certeza que deseja apagar TODOS os leads da base de testes?')) return;
    
    try {
      const response = await fetch('http://localhost:3001/api/leads', {
        method: 'DELETE',
      });
      if (response.ok) {
        setLeads([]);
        console.log('Base de leads limpa com sucesso');
      }
    } catch (error) {
      console.error('Erro ao limpar leads:', error);
    }
  };

  const chromeCommand = `& "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --remote-debugging-port=9222 --user-data-dir="C:\\chrome-dev-session"`;

  const fetchLeads = async () => {
    setLeadsLoading(true);
    try {
      const response = await fetch('http://localhost:3001/api/leads');
      const json = await response.json();
      if (json.success && Array.isArray(json.data)) {
        setLeads(json.data);
      }
    } catch (error) {
      console.error('Erro ao buscar leads:', error);
    } finally {
      setLeadsLoading(false);
    }
  };

  const totalLeads = leads.length;
  const qualifiedLeads = leads.filter(l => ['qualified', 'contacted', 'replied'].includes(l.pipelineState)).length;
  const contactedLeads = leads.filter(l => ['contacted', 'replied'].includes(l.pipelineState)).length;
  const contactRate = totalLeads > 0 ? ((contactedLeads / totalLeads) * 100).toFixed(1) : '0.0';

  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (loading) {
      interval = setInterval(fetchLeads, 3000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [loading]);

  useEffect(() => {
    fetchLeads();
  }, []);

  const statusMap: Record<string, { label: string; className: string }> = {
    discovered: { label: 'Novo', className: 'bg-slate-800 text-slate-400' },
    new: { label: 'Novo', className: 'bg-slate-800 text-slate-400' },
    qualified: { label: 'Qualificado', className: 'bg-indigo-950 text-indigo-400' },
    contacted: { label: 'Contatado', className: 'bg-violet-950 text-violet-400' },
    replied: { label: 'Respondeu', className: 'bg-emerald-950 text-emerald-400' },
    failed: { label: 'Falha', className: 'bg-amber-950 text-amber-400' },
    converted: { label: 'Convertido', className: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.1)]' },
    convertido: { label: 'Convertido', className: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.1)]' },
  };

  const getStatusBadge = (state: string) => {
    const status = statusMap[state] || { label: state, className: 'bg-slate-800 text-slate-400' };
    return (
      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${status.className}`}>
        {status.label}
      </span>
    );
  };

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
        <div className="flex gap-2">
          <button
            onClick={() => setIsConfigModalOpen(true)}
            className="bg-slate-800 hover:bg-slate-700 text-slate-300 p-2.5 rounded-lg transition-all"
            title="Configurações"
          >
            ⚙️
          </button>
          <button
            onClick={handleRunCadence}
            disabled={loading}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white font-semibold px-5 py-2.5 rounded-lg shadow-lg shadow-indigo-600/20 transition-all cursor-pointer flex items-center gap-2"
          >
            {loading ? '⏳ Processando...' : '▶️ Iniciar Cadência Autônoma'}
          </button>
        </div>
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
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total de Leads</p>
            <p className="text-2xl font-bold mt-2 text-indigo-400">{totalLeads}</p>
            <p className="text-xs text-slate-500 mt-1">Na base de dados</p>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Qualificados para Contato</p>
            <p className="text-2xl font-bold mt-2 text-emerald-400">{qualifiedLeads}</p>
            <p className="text-xs text-slate-500 mt-1">Status: qualificado ou superior</p>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Taxa de Contato</p>
            <p className="text-2xl font-bold mt-2 text-violet-400">{contactRate}%</p>
            <p className="text-xs text-slate-500 mt-1">Leads abordados</p>
          </div>
        </div>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Mesa de CRM */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-md overflow-hidden flex flex-col h-[500px]">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-slate-200">Mesa de CRM</h2>
              <div className="flex gap-2">
                <button onClick={handleClearLeads} className="bg-red-950/30 hover:bg-red-900/40 text-red-400 border border-red-500/20 text-xs font-medium px-3 py-1.5 rounded transition-all">
                  🗑️ Limpar Base
                </button>
                <button onClick={() => setIsModalOpen(true)} className="bg-slate-800 hover:bg-slate-700 text-xs text-white font-medium px-3 py-1.5 rounded transition-all">
                  + Adicionar Leads
                </button>
                <button onClick={fetchLeads} className="text-xs text-indigo-400 hover:text-indigo-300">Atualizar</button>
              </div>
            </div>
            <div className="overflow-y-auto flex-1">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-950 text-slate-400 uppercase text-xs sticky top-0">
                  <tr>
                    <th className="px-6 py-3">Perfil</th>
                    <th className="px-6 py-3">Nicho / Score</th>
                    <th className="px-6 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {leadsLoading ? (
                    <tr><td colSpan={3} className="px-6 py-4 text-center">Carregando...</td></tr>
                  ) : leads.map(lead => (
                  <tr key={lead.id} className="hover:bg-slate-800/50 cursor-pointer" onClick={() => setSelectedLead(lead)}>
                    <td className="px-6 py-4 font-medium text-slate-100">@{lead.username.replace(/^@+/, '').trim()}</td>
                    <td className="px-6 py-4">{lead.niche || 'N/A'} <span className="text-slate-500">({lead.score})</span></td>
                      <td className="px-6 py-4">
                        {getStatusBadge(lead.pipelineState)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Live Terminal Log Viewer */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-md flex flex-col h-[500px]">
            <h2 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${loading ? 'bg-amber-400 animate-ping' : 'bg-emerald-500'}`}></span>
              Console de Logs ao Vivo (Stdout)
            </h2>
            <div
              ref={logContainerRef}
              className="bg-slate-950 rounded-lg p-4 font-mono text-xs text-slate-300 overflow-y-auto flex-1 border border-slate-800/80 space-y-1.5"
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
        </div>

        {/* Drawer Lateral (Slide-over) */}
        {selectedLead && (
          <div className="fixed inset-0 z-50 flex justify-end">
            <div className="fixed inset-0 bg-black/50" onClick={() => setSelectedLead(null)} />
            <div className="relative w-full max-w-lg bg-slate-900 border-l border-slate-700 shadow-2xl p-8 flex flex-col">
              <button onClick={() => setSelectedLead(null)} className="absolute top-4 right-4 text-slate-400 hover:text-white">✕</button>
              <h2 className="text-2xl font-bold text-white mb-6">@{selectedLead.username.replace(/^@+/, '').trim()}</h2>
              <div className="space-y-6 flex-1">
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Status Atual</p>
                  <div className="mt-2">{getStatusBadge(selectedLead.pipelineState)}</div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Score da IA</p>
                  <p className="text-lg text-slate-200 mt-1">{selectedLead.score}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Motivo da Qualificação</p>
                  <p className="text-sm text-slate-300 mt-2 p-3 bg-slate-800 rounded-lg italic">"Lead engajado com conteúdos de tecnologia nos últimos 30 dias."</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Histórico de DM</p>
                  <div className="mt-2 h-40 bg-slate-950 rounded-lg p-3 text-xs text-slate-400 overflow-y-auto">
                    <p>Sem histórico recente...</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal Adicionar Leads */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
            <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-md shadow-2xl">
              <h2 className="text-lg font-bold text-slate-100 mb-4">Adicionar Novos Leads</h2>
              <textarea
                value={newLeadsText}
                onChange={(e) => setNewLeadsText(e.target.value)}
                placeholder="Cole os usernames aqui (separados por vírgula ou linha)..."
                className="w-full h-40 bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-4"
              />
              <div className="flex justify-end gap-3">
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-200 text-sm">Cancelar</button>
                <button onClick={handleAddLeads} className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-4 py-2 rounded-lg text-sm">Adicionar</button>
              </div>
            </div>
          </div>
        )}
        {/* Modal Configurações de IA */}
        {isConfigModalOpen && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 w-full max-w-lg shadow-2xl">
              <h2 className="text-lg font-bold text-slate-100 mb-4">Configurações da Campanha</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Critério de Qualificação</label>
                  <input
                    type="text"
                    value={aiCriteria}
                    onChange={(e) => setAiCriteria(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Mensagem Base para Direct</label>
                  <textarea
                    value={aiMessage}
                    onChange={(e) => setAiMessage(e.target.value)}
                    className="w-full h-32 bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button onClick={() => setIsConfigModalOpen(false)} className="text-slate-400 hover:text-slate-200 text-sm">Fechar</button>
                <button onClick={() => setIsConfigModalOpen(false)} className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-4 py-2 rounded-lg text-sm">Salvar</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}