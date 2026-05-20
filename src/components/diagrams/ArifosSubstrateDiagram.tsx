import React from 'react';
import { Database, Cpu, Share2, Shield, Activity, Lock, Layers, Zap, Thermometer, Brain } from 'lucide-react';

const ArifosSubstrateDiagram = () => {
  const stages = [
    { id: '000', name: 'INIT', tech: 'YAML/JSON', role: 'Identity', icon: Lock, color: 'text-blue-400' },
    { id: '111', name: 'SENSE', tech: 'JSON/SQL', role: 'Reality', icon: Activity, color: 'text-green-400' },
    { id: '333', name: 'MIND', tech: 'Python', role: 'Reasoning', icon: Cpu, color: 'text-purple-400' },
    { id: '444', name: 'ROUT', tech: 'YAML/JSON', role: 'Routing', icon: Layers, color: 'text-yellow-400' },
    { id: '555', name: 'MEM', tech: 'Python/Qdrant', role: 'Memory', icon: Brain, color: 'text-cyan-400' },
    { id: '666', name: 'HEART', tech: 'Python/Protobuf', role: 'Safety', icon: Shield, color: 'text-red-400' },
    { id: '777', name: 'OPS', tech: 'Python/JSON', role: 'Thermo', icon: Thermometer, color: 'text-orange-400' },
    { id: '888', name: 'JUDGE', tech: 'SQL/TypeScript', role: 'Verdict', icon: Share2, color: 'text-blue-500' },
    { id: '999', name: 'SEAL', tech: 'SQL/JSON', role: 'Vault', icon: Database, color: 'text-indigo-400' },
  ];

  return (
    <div className="p-8 bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl">
      <div className="mb-6 flex justify-between items-center">
        <h2 className="text-2xl font-mono font-bold text-slate-100 flex items-center gap-3">
          <Activity className="text-blue-400" /> arifOS v2.1 Substrate Pipeline
        </h2>
        <span className="px-3 py-1 bg-blue-500/10 text-blue-400 rounded-full text-xs font-mono border border-blue-500/20">
          9-STAGE_METABOLISM
        </span>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {stages.map((stage) => (
          <div key={stage.id} className="p-4 bg-slate-800/50 rounded-xl border border-slate-700 hover:border-slate-500 transition-all group">
            <div className="flex justify-between items-start mb-3">
              <span className="text-[10px] font-mono text-slate-500">STAGE_{stage.id}</span>
              <stage.icon size={16} className={`${stage.color} opacity-80 group-hover:scale-110 transition-transform`} />
            </div>
            <h3 className="font-mono font-bold text-slate-100 text-sm mb-1">{stage.name}</h3>
            <p className="text-xs text-slate-400 mb-2">{stage.role}</p>
            <div className="pt-2 border-t border-slate-700/50">
              <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Substrate:</span>
              <p className="text-xs font-mono text-blue-300 mt-1">{stage.tech}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 p-4 bg-blue-500/5 rounded-lg border border-blue-500/10 flex items-center gap-4">
        <div className="p-2 bg-blue-500/10 rounded-md">
          <Share2 size={18} className="text-blue-400" />
        </div>
        <div>
          <h4 className="text-xs font-mono font-bold text-slate-200">99-TOOL_GÖDEL_LOCK</h4>
          <p className="text-[10px] text-slate-400 mt-1">Topology capped at 99 tools across 8 cognitive tiers. Substrate-level Ωₒᵣₜₕₒ enforcement active.</p>
        </div>
      </div>
    </div>
  );
};

export default ArifosSubstrateDiagram;
