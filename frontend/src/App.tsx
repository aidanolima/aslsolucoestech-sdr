import React, { useState, useRef, useEffect } from 'react';

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
  const [currentView, setCurrentView] = useState<'dashboard' | 'kanban'>('dashboard');
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newLeadsText, setNewLeadsText] = useState('');
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [config, setConfig] = useState({
    businessName: '',
    productOffer: '',
    targetAudience: '',
    aiCriteria: '',
    aiMessage: ''
  });
  
  const [isScrapeModalOpen, setIsScrapeModalOpen] = useState(false);
  const [targetProfile, setTargetProfile] = useState('');
  const [scrapeMaxLeads, setScrapeMaxLeads] = useState(10);
  const [isScraping, setIsScraping] = useState(false);
  const [scrapeLogs, setScrapeLogs] = useState<string[]>([]);

  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' | 'info' } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ isOpen: boolean, title: string, message: string, onAction: () => void } | null>(null);

  const logContainerRef = useRef<HTMLDivElement>(null);
  const scrapeLogContainerRef = useRef<HTMLDivElement>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    if (scrapeLogContainerRef.current) {
      scrapeLogContainerRef.current.scrollTop = scrapeLogContainerRef.current.scrollHeight;
    }
  }, [scrapeLogs]);

  useEffect(() => {
    if (isConfigModalOpen) {
      fetch('http://localhost:3001/api/settings')
        .then(res => res.json())
        .then(res => {
          if (res.success) setConfig(res.data);
        });
    }
  }, [isConfigModalOpen]);

  const handleSaveConfig = async () => {
    try {
      await fetch('http://localhost:3001/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      setIsConfigModalOpen(false);
      showToast('Configurações salvas com sucesso!', 'success');
    } catch (error) {
      console.error('Erro ao salvar configurações:', error);
      showToast('Erro ao salvar configurações.', 'error');
    }
  };

  const handleScrape = () => {
    if (!targetProfile.trim()) return;
    setIsScraping(true);
    setScrapeLogs([`🎯 Inicializando extrator para o perfil @${targetProfile}...`]);

    const eventSource = new EventSource(`http://localhost:3001/api/scrape-stream?targetProfile=${targetProfile}&maxLeads=${scrapeMaxLeads}`);

    eventSource.onmessage = (event) => {
      try {
        const rawData = JSON.parse(event.data);
        const newLog = typeof rawData === 'string' ? rawData : JSON.stringify(rawData);
        
        setScrapeLogs((prev) => [...prev, newLog]);

        if (newLog.includes('[SISTEMA] Processo finalizado') || newLog.includes('Sucesso!')) {
          eventSource.close();
          setScrapeLogs((prev) => [...prev, '⏳ Captação concluída! Fechando janela em 5 segundos...']);
          
          showToast(`Captação no perfil @${targetProfile} finalizada com sucesso!`, 'success');
          
          setTimeout(() => {
            setIsScrapeModalOpen(false);
            setTargetProfile('');
            setIsScraping(false);
            setScrapeLogs([]);
            fetchLeads();
          }, 5000);
        }
      } catch (err) {
        setScrapeLogs((prev) => [...prev, String(event.data)]);
      }
    };

    eventSource.onerror = () => {
      setScrapeLogs((prev) => [...prev, '❌ [UI] Conexão com o servidor encerrada inesperadamente.']);
      eventSource.close();
      setIsScraping(false);
      showToast('Erro na conexão da captação.', 'error');
    };
  };

  const handleAddLeads = async () => {
    if (!newLeadsText.trim()) return;

    const rawInputs = newLeadsText.split(/[,\n]/).map(u => u.trim()).filter(u => u);
    
    const usernames = rawInputs.map(input => {
      let cleaned = input;
      if (cleaned.includes('instagram.com/')) {
        const match = cleaned.match(/instagram\.com\/([a-zA-Z0-9_.]+)/);
        if (match && match[1]) cleaned = match[1];
      }
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
        await fetchLeads();
        showToast(`${usernames.length} leads adicionados manualmente.`, 'success');
      }
    } catch (error) {
      console.error('Erro ao adicionar leads:', error);
      showToast('Erro ao adicionar leads.', 'error');
    }
  };

  const handleClearLeads = () => {
    setConfirmDialog({
      isOpen: true,
      title: 'Limpar Base de Leads',
      message: 'Tem certeza que deseja apagar TODOS os leads da base de testes? Esta ação não pode ser desfeita.',
      onAction: async () => {
        try {
          const response = await fetch('http://localhost:3001/api/leads', { method: 'DELETE' });
          if (response.ok) {
            setLeads([]);
            showToast('Base de leads totalmente limpa.', 'success');
          }
        } catch (error) {
          console.error('Erro ao limpar leads:', error);
          showToast('Erro ao limpar a base.', 'error');
        }
        setConfirmDialog(null);
      }
    });
  };

  const handleDeleteSingleLead = (id: number, username: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Impede que o clique na lixeira abra o drawer lateral do lead
    setConfirmDialog({
      isOpen: true,
      title: 'Excluir Lead',
      message: `Tem certeza que deseja excluir permanentemente o lead @${username}? Ele será removido do Painel e do Pipeline.`,
      onAction: async () => {
        try {
          const response = await fetch(`http://localhost:3001/api/leads/${id}`, { method: 'DELETE' });
          if (response.ok) {
            setLeads(prevLeads => prevLeads.filter(l => l.id !== id));
            showToast(`Lead @${username} excluído com sucesso.`, 'success');
          } else {
            showToast('Erro ao excluir o lead.', 'error');
          }
        } catch (error) {
          console.error('Erro ao excluir lead:', error);
          showToast('Erro na conexão.', 'error');
        }
        setConfirmDialog(null);
      }
    });
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
  const qualifiedLeads = leads.filter(l => ['qualified', 'contacted', 'replied', 'converted', 'convertido'].includes(l.pipelineState)).length;
  const contactedLeads = leads.filter(l => ['contacted', 'replied', 'converted', 'convertido'].includes(l.pipelineState)).length;
  const convertedLeads = leads.filter(l => ['converted', 'convertido'].includes(l.pipelineState)).length;
  const contactRate = totalLeads > 0 ? ((contactedLeads / totalLeads) * 100).toFixed(1) : '0.0';

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
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
      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium tracking-wide uppercase ${status.className}`}>
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
    showToast('Comando copiado para a área de transferência.', 'info');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRunCadence = () => {
    if (loading) return;
    setLoading(true);
    setLogs(['🚀 [UI] Conectando ao motor em tempo real...']);
    showToast('Iniciando Cadência Autônoma...', 'info');

    const eventSource = new EventSource('http://localhost:3001/api/run-cadence-stream');

    eventSource.onmessage = (event) => {
      const newLog = JSON.parse(event.data);
      setLogs((prev) => [...prev, newLog]);

      if (newLog.includes('Processo finalizado')) {
        eventSource.close();
        setLoading(false);
        showToast('Cadência Autônoma finalizada com sucesso!', 'success');
      }
    };

    eventSource.onerror = () => {
      setLogs((prev) => [...prev, '❌ [UI] Conexão com o servidor encerrada.']);
      eventSource.close();
      setLoading(false);
      showToast('A cadência foi interrompida ou encontrou um erro.', 'error');
    };
  };

  const handleDragStart = (e: React.DragEvent, leadId: number) => {
    e.dataTransfer.setData('leadId', leadId.toString());
  };
  const handleDragOver = (e: React.DragEvent) => e.preventDefault();
  const handleDrop = (e: React.DragEvent, newStatus: string) => {
    e.preventDefault();
    const leadId = parseInt(e.dataTransfer.getData('leadId'));
    if (!leadId) return;
    setLeads(prevLeads => prevLeads.map(lead => lead.id === leadId ? { ...lead, pipelineState: newStatus } : lead));
    showToast(`Status do lead atualizado para ${newStatus}.`, 'info');
  };

  const columns = [
    { id: 'new', title: 'Novos Leads', color: 'border-slate-500' },
    { id: 'qualified', title: 'Qualificados', color: 'border-indigo-500' },
    { id: 'contacted', title: 'Contatados', color: 'border-violet-500' },
    { id: 'replied', title: 'Em Negociação', color: 'border-amber-500' },
    { id: 'converted', title: 'Fechados', color: 'border-emerald-500' },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans relative overflow-x-hidden">
      
      {/* Toast Global */}
      {toast && (
        <div className="fixed top-20 right-6 z-9999 transition-all duration-300 ease-out translate-y-0 opacity-100">
          <div className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-2xl border ${
            toast.type === 'success' ? 'bg-emerald-950 border-emerald-800 text-emerald-400' : 
            toast.type === 'error' ? 'bg-red-950 border-red-800 text-red-400' : 
            'bg-indigo-950 border-indigo-800 text-indigo-400'
          }`}>
            <span className="text-lg">{toast.type === 'success' ? '✅' : toast.type === 'error' ? '❌' : 'ℹ️'}</span>
            <span className="text-sm font-medium">{toast.message}</span>
          </div>
        </div>
      )}

      {/* MENU SUPERIOR FIXO (Navbar) */}
      <header className="fixed top-0 w-full z-50 border-b border-slate-800 bg-slate-900/80 backdrop-blur-md px-6 py-3 flex justify-between items-center shadow-lg">
        <div className="flex items-center gap-6">
          <h1 className="text-lg font-bold text-indigo-400 tracking-wide">
            ASL Tech <span className="text-[10px] font-normal text-slate-400 bg-slate-800 px-2 py-0.5 rounded ml-1 align-top">V1</span>
          </h1>
          <nav className="hidden md:flex gap-1 bg-slate-950/50 p-1 rounded-lg border border-slate-800/50">
            <button
              onClick={() => setCurrentView('dashboard')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${currentView === 'dashboard' ? 'bg-slate-800 text-indigo-300 shadow-sm' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'}`}
            >
              📊 PAINEL
            </button>
            <button
              onClick={() => setCurrentView('kanban')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${currentView === 'kanban' ? 'bg-slate-800 text-indigo-300 shadow-sm' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'}`}
            >
              📋 CRM
            </button>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={() => setIsConfigModalOpen(true)} className="text-slate-400 hover:text-slate-200 bg-slate-800/50 hover:bg-slate-700 p-2 rounded-lg transition-all" title="Criar Campanha">
            ⚙️
          </button>
          <button onClick={handleRunCadence} disabled={loading} className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white font-medium px-4 py-2 rounded-lg shadow-lg shadow-indigo-600/20 transition-all cursor-pointer flex items-center gap-2 text-sm">
            {loading ? '⏳ Rodando...' : '▶️ Iniciar Cadência'}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-6 pt-20 max-w-[1600px] mx-auto w-full space-y-4">
        
        {currentView === 'dashboard' && (
          <>
            {/* Banner de Orientações do Chrome */}
            <div className="bg-amber-950/30 border border-amber-500/20 rounded-lg p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-amber-500 font-semibold text-xs">
                  <span>⚠️ Pré-requisito de Execução:</span>
                  <span className="text-slate-300 font-normal">O Chrome deve estar aberto, logado no perfil desejado do Instagram, e Chrome no modo Debug na porta 9222.</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Abra o PowerShell do Windows no modo ADM, copie e cole o comando a direita no terminal e execute o comando  antes de iniciar a cadência ou a captação.
                </p>
              </div>
              <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-md px-3 py-1.5 w-full md:w-auto shadow-inner">
                <code className="text-[11px] font-mono text-indigo-300 truncate max-w-xs md:max-w-md">{chromeCommand}</code>
                <button onClick={handleCopyCommand} className="bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-200 px-3 py-1.5 rounded transition-all shrink-0 font-medium ml-2">
                  {copied ? '✅ Copiado!' : '📋 Copiar'}
                </button>
              </div>
            </div>

            {/* CARDS COMPACTOS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 shadow-sm flex flex-col justify-center">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Total de Leads</p>
                <p className="text-xl font-bold mt-1 text-indigo-400">{totalLeads}</p>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 shadow-sm flex flex-col justify-center">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Qualificados</p>
                <p className="text-xl font-bold mt-1 text-emerald-400">{qualifiedLeads}</p>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 shadow-sm flex flex-col justify-center">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Taxa de Contato</p>
                <p className="text-xl font-bold mt-1 text-violet-400">{contactRate}%</p>
              </div>
              {/* NOVO CARD: FECHADOS */}
              <div className="bg-linear-to-br from-slate-900 to-emerald-950/20 border border-emerald-500/20 rounded-lg p-4 shadow-sm flex flex-col justify-center">
                <p className="text-[10px] font-semibold text-emerald-500/70 uppercase tracking-wider">Fechados (Convertidos)</p>
                <p className="text-xl font-bold mt-1 text-emerald-500">{convertedLeads}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-slate-900 border border-slate-800 rounded-lg shadow-md flex flex-col h-112.5">
                <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                  <h2 className="text-sm font-semibold text-slate-200">Painel de Leads</h2>
                  
                  {/* BOTÕES DA MESA SUBSTITUÍDOS POR ÍCONES COM TOOLTIP (Hover) */}
                  <div className="flex gap-1.5">
                    <button onClick={() => setIsScrapeModalOpen(true)} className="relative group bg-indigo-900/40 hover:bg-indigo-800/60 border border-indigo-500/30 p-1.5 rounded transition-all flex items-center justify-center">
                      <span className="text-sm">🎯</span>
                      <span className="absolute top-full right-0 mt-2 w-max px-2 py-1 bg-slate-800 text-[10px] text-slate-200 rounded opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none shadow-lg">Captar Seguidores</span>
                    </button>
                    <button onClick={() => setIsModalOpen(true)} className="relative group bg-slate-800 hover:bg-slate-700 border border-slate-700 p-1.5 rounded transition-all flex items-center justify-center">
                      <span className="text-sm">➕</span>
                      <span className="absolute top-full right-0 mt-2 w-max px-2 py-1 bg-slate-800 text-[10px] text-slate-200 rounded opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none shadow-lg">Adicionar Manual</span>
                    </button>
                    <button onClick={handleClearLeads} className="relative group bg-red-950/30 hover:bg-red-900/40 border border-red-500/20 p-1.5 rounded transition-all flex items-center justify-center">
                      <span className="text-sm">🗑️</span>
                      <span className="absolute top-full right-0 mt-2 w-max px-2 py-1 bg-slate-800 text-[10px] text-slate-200 rounded opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none shadow-lg">Limpar Base</span>
                    </button>
                    <button onClick={fetchLeads} className="relative group bg-slate-800/40 hover:bg-slate-700 border border-slate-700/50 p-1.5 rounded transition-all flex items-center justify-center">
                      <span className="text-sm">🔄</span>
                      <span className="absolute top-full right-0 mt-2 w-max px-2 py-1 bg-slate-800 text-[10px] text-slate-200 rounded opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none shadow-lg">Atualizar Painel</span>
                    </button>
                  </div>
                </div>
                
                <div className="overflow-y-auto flex-1 custom-scrollbar">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] sticky top-0 backdrop-blur-sm z-10">
                      <tr>
                        <th className="px-4 py-3">Perfil</th>
                        <th className="px-4 py-3">Nicho / Score</th>
                        <th className="px-4 py-3 text-right">Status</th>
                        <th className="px-4 py-3 text-center w-12">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {leadsLoading ? (
                        <tr><td colSpan={4} className="px-4 py-4 text-center">Carregando...</td></tr>
                      ) : leads.map(lead => (
                      <tr key={lead.id} className="hover:bg-slate-800/40 cursor-pointer transition-colors" onClick={() => setSelectedLead(lead)}>
                        <td className="px-4 py-3 font-medium text-slate-200">@{lead.username.replace(/^@+/, '').trim()}</td>
                        <td className="px-4 py-3 text-slate-400">{lead.niche || 'N/A'} <span className="text-slate-500">({lead.score})</span></td>
                          <td className="px-4 py-3 text-right">
                            {getStatusBadge(lead.pipelineState)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button 
                              onClick={(e) => handleDeleteSingleLead(lead.id, lead.username, e)}
                              className="text-slate-500 hover:text-red-400 hover:bg-slate-800 p-1.5 rounded transition-all"
                              title="Excluir Lead"
                            >
                              🗑️
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 shadow-md flex flex-col h-112.5">
                <h2 className="text-xs font-semibold text-slate-300 mb-3 flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${loading ? 'bg-amber-400 animate-ping' : 'bg-emerald-500'}`}></span>
                  Console de Logs
                </h2>
                <div ref={logContainerRef} className="bg-slate-950 rounded-md p-3 font-mono text-[10px] text-slate-300 overflow-y-auto flex-1 border border-slate-800/80 space-y-2 custom-scrollbar">
                  {logs.length === 0 ? (
                    <p className="text-slate-600 italic">Aguardando disparo da cadência...</p>
                  ) : (
                    logs.map((log, index) => (
                      <div key={index} className={`${log.includes('🚀') ? 'text-indigo-400 font-bold' : log.includes('❌') || log.includes('⚠️') ? 'text-amber-400' : log.includes('✅') || log.includes('✨') ? 'text-emerald-400 font-semibold' : 'text-slate-300'}`}>
                        {log}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        {currentView === 'kanban' && (
          <div className="h-[calc(100vh-140px)] flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-slate-100">CRM de Vendas</h2>
              <p className="text-xs text-slate-400">Arraste os cards para atualizar o status.</p>
            </div>
            
            <div className="flex-1 flex gap-4 overflow-x-auto pb-2 custom-scrollbar">
              {columns.map((col) => (
                <div 
                  key={col.id} 
                  className="w-72 shrink-0 bg-slate-900 border border-slate-800 rounded-lg flex flex-col overflow-hidden"
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, col.id)}
                >
                  <div className={`p-3 border-b bg-slate-950/50 ${col.color}`}>
                    <h3 className="text-sm font-semibold text-slate-200">{col.title}</h3>
                    <span className="text-[10px] text-slate-500">
                      {leads.filter(l => l.pipelineState === col.id || (col.id === 'new' && l.pipelineState === 'discovered')).length} leads
                    </span>
                  </div>

                  <div className="flex-1 p-2 space-y-2 overflow-y-auto custom-scrollbar">
                    {leads
                      .filter(lead => 
                        lead.pipelineState === col.id || 
                        (col.id === 'new' && lead.pipelineState === 'discovered')
                      )
                      .map(lead => (
                        <div
                          key={lead.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, lead.id)}
                          onClick={() => setSelectedLead(lead)}
                          className="bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-indigo-500/50 p-3 rounded-md shadow-sm cursor-grab active:cursor-grabbing transition-colors"
                        >
                          <div className="flex justify-between items-start mb-1.5">
                            <span className="font-bold text-sm text-slate-200">@{lead.username}</span>
                            <span className="text-[9px] bg-slate-900 px-1.5 py-0.5 rounded text-slate-400 font-mono">
                              {lead.score}
                            </span>
                          </div>
                          {lead.niche && (
                            <p className="text-[10px] text-slate-400 truncate mb-2">{lead.niche}</p>
                          )}
                          <div>
                            {getStatusBadge(lead.pipelineState)}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Drawer Lateral */}
        {selectedLead && (
          <div className="fixed inset-0 z-110 flex justify-end">
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setSelectedLead(null)} />
            <div className="relative w-full max-w-sm bg-slate-900 border-l border-slate-700 shadow-2xl p-6 flex flex-col">
              <button onClick={() => setSelectedLead(null)} className="absolute top-4 right-4 text-slate-400 hover:text-white">✕</button>
              <h2 className="text-xl font-bold text-white mb-6">@{selectedLead.username.replace(/^@+/, '').trim()}</h2>
              <div className="space-y-5 flex-1">
                <div>
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Status Atual</p>
                  <div className="mt-1">{getStatusBadge(selectedLead.pipelineState)}</div>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Score da IA</p>
                  <p className="text-lg font-mono text-indigo-300 mt-1">{selectedLead.score}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Histórico de DM</p>
                  <div className="mt-2 h-40 bg-slate-950 border border-slate-800 rounded-md p-3 text-xs text-slate-400 overflow-y-auto custom-scrollbar">
                    <p>Sem histórico recente...</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modais */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-110">
            <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 w-full max-w-md shadow-2xl">
              <h2 className="text-base font-bold text-slate-100 mb-3">Adicionar Novos Leads</h2>
              <textarea
                value={newLeadsText}
                onChange={(e) => setNewLeadsText(e.target.value)}
                placeholder="Cole os usernames aqui..."
                className="w-full h-32 bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 mb-4 custom-scrollbar"
              />
              <div className="flex justify-end gap-2">
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-200 text-xs px-3">Cancelar</button>
                <button onClick={handleAddLeads} className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-4 py-1.5 rounded-lg text-xs">Adicionar</button>
              </div>
            </div>
          </div>
        )}

        {isConfigModalOpen && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-110">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 w-full max-w-2xl shadow-2xl">
              <h2 className="text-lg font-bold text-slate-100 mb-1">Configurações da Campanha</h2>
              <p className="text-[11px] text-slate-400 mb-5">
                Preencha os dados abaixo para guiar a Inteligência Artificial na qualificação e criação das mensagens.
              </p>
              
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-200">Nome do Negócio</label>
                    <p className="text-[9px] text-slate-500 mb-1.5">Como você ou sua empresa se chamam.</p>
                    <input type="text" placeholder="Ex: ASL Soluções Tech" value={config.businessName} onChange={(e) => setConfig({...config, businessName: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-md p-2 text-xs text-slate-300 focus:outline-none focus:border-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-200">Público-Alvo</label>
                    <p className="text-[9px] text-slate-500 mb-1.5">Quem é o seu cliente ideal?</p>
                    <input type="text" placeholder="Ex: Empreendedores, infoprodutores e agências" value={config.targetAudience} onChange={(e) => setConfig({...config, targetAudience: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-md p-2 text-xs text-slate-300 focus:outline-none focus:border-indigo-500" />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-200">Oferta do Produto</label>
                  <p className="text-[9px] text-slate-500 mb-1.5">O que você está vendendo ou oferecendo?</p>
                  <input type="text" placeholder="Ex: Um software de automação de captação de leads no Instagram" value={config.productOffer} onChange={(e) => setConfig({...config, productOffer: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-md p-2 text-xs text-slate-300 focus:outline-none focus:border-indigo-500" />
                </div>
                
                <div>
                  <label className="block text-[11px] font-semibold text-slate-200">Critério de Qualificação (Regra para a IA)</label>
                  <p className="text-[9px] text-slate-500 mb-1.5">O que a IA deve buscar na Bio para considerar o lead bom? (Se falhar, a IA descarta).</p>
                  <input type="text" placeholder="Ex: O perfil deve ser de uma empresa ou profissional. Descarte perfis de fã-clube, crianças ou contas privadas." value={config.aiCriteria} onChange={(e) => setConfig({...config, aiCriteria: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-md p-2 text-xs text-slate-300 focus:outline-none focus:border-indigo-500" />
                </div>
                
                <div>
                  <label className="block text-[11px] font-semibold text-slate-200">Mensagem Base para Direct</label>
                  <p className="text-[9px] text-slate-500 mb-1.5">O roteiro (script) que a IA usará como molde para criar uma mensagem única para cada lead.</p>
                  <textarea 
                    placeholder="Ex: Olá! Vi seu perfil sobre [nicho do lead] e achei incrível. Sou da [Nome do Negócio] e ajudamos perfis como o seu a escalar com [Oferta]..." 
                    value={config.aiMessage} 
                    onChange={(e) => setConfig({...config, aiMessage: e.target.value})} 
                    className="w-full h-28 bg-slate-950 border border-slate-700 rounded-md p-2.5 text-xs text-slate-300 focus:outline-none focus:border-indigo-500 custom-scrollbar leading-relaxed" 
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6 border-t border-slate-800 pt-4">
                <button onClick={() => setIsConfigModalOpen(false)} className="text-slate-400 hover:text-slate-200 text-xs px-2 transition-all">Cancelar</button>
                <button onClick={handleSaveConfig} className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-6 py-2 rounded-md text-xs shadow-lg shadow-indigo-900/20 transition-all">
                  Salvar Configurações
                </button>
              </div>
            </div>
          </div>
        )}

        {isScrapeModalOpen && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-110">
            <div className={`bg-slate-900 border border-slate-700 rounded-xl p-5 shadow-2xl transition-all duration-300 ${scrapeLogs.length > 0 ? 'w-full max-w-3xl' : 'w-full max-w-sm'}`}>
              <h2 className="text-base font-bold text-slate-100 mb-4 flex items-center gap-2">
                {isScraping && <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>}
                <span>Captar Seguidores</span>
              </h2>
              
              <div className="flex flex-col md:flex-row gap-5">
                <div className={`space-y-4 ${scrapeLogs.length > 0 ? 'w-full md:w-1/3' : 'w-full'}`}>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-400 mb-1">Perfil Alvo (Sem o @)</label>
                    <input
                      type="text"
                      value={targetProfile}
                      onChange={(e) => setTargetProfile(e.target.value)}
                      placeholder="ex: aslsolucoestech"
                      disabled={isScraping}
                      className="w-full bg-slate-950 border border-slate-700 rounded-md p-2 text-xs text-slate-300 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-400 mb-1">Máx. Leads (Lim: 10)</label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={scrapeMaxLeads}
                      onChange={(e) => {
                        let val = parseInt(e.target.value) || 1;
                        if (val > 10) val = 10;
                        if (val < 1) val = 1;
                        setScrapeMaxLeads(val);
                      }}
                      disabled={isScraping}
                      className="w-full bg-slate-950 border border-slate-700 rounded-md p-2 text-xs text-slate-300 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                    />
                  </div>
                  
                  <div className="flex flex-col gap-2 pt-2">
                    <button onClick={handleScrape} disabled={isScraping || !targetProfile.trim()} className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-medium px-4 py-2 rounded-md text-xs flex justify-center items-center gap-2 transition-all">
                      <span>{isScraping ? '⏳ Extraindo...' : '🎯 Iniciar'}</span>
                    </button>
                    <button onClick={() => { setIsScrapeModalOpen(false); setScrapeLogs([]); }} disabled={isScraping} className="w-full text-slate-400 hover:text-slate-200 text-xs py-1.5 disabled:opacity-50 transition-all">
                      <span>Cancelar</span>
                    </button>
                  </div>
                </div>

                {scrapeLogs.length > 0 && (
                  <div className="w-full md:w-2/3 flex flex-col border-t md:border-t-0 md:border-l border-slate-800 pt-5 md:pt-0 md:pl-5">
                    <h3 className="text-[10px] font-semibold text-slate-400 mb-2 uppercase tracking-wider">Console</h3>
                    <div ref={scrapeLogContainerRef} className="bg-slate-950 rounded-md p-3 font-mono text-[10px] text-slate-300 overflow-y-auto h-55 border border-slate-800 shadow-inner space-y-1 custom-scrollbar">
                      {scrapeLogs.map((log, index) => {
                        const safeLog = typeof log === 'string' ? log : String(log);
                        return (
                          <div key={index} className={`py-0.5 ${safeLog.includes('🎯') || safeLog.includes('🚀') ? 'text-indigo-400 font-bold' : safeLog.includes('❌') || safeLog.includes('⚠️') ? 'text-amber-400' : safeLog.includes('✅') || safeLog.includes('🎉') ? 'text-emerald-400 font-semibold' : 'text-slate-300'}`}>
                            {safeLog}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {confirmDialog?.isOpen && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-999">
            <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 w-full max-w-sm shadow-2xl">
              <h2 className="text-base font-bold text-slate-100 mb-2">{confirmDialog.title}</h2>
              <p className="text-xs text-slate-400 mb-5">{confirmDialog.message}</p>
              <div className="flex justify-end gap-2">
                <button onClick={() => setConfirmDialog(null)} className="text-slate-400 hover:text-slate-200 text-xs px-3 py-1.5 transition-all">Cancelar</button>
                <button onClick={confirmDialog.onAction} className="bg-red-600/90 hover:bg-red-500 text-white font-medium px-4 py-1.5 rounded-md text-xs shadow-lg transition-all">
                  Sim, apagar
                </button>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}