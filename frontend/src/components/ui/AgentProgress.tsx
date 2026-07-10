import React from 'react';
import { CheckCircle2, Circle, AlertTriangle } from 'lucide-react';

interface Task {
  id: number;
  description: string;
  status: string;
  result?: string;
}

interface AgentProgressProps {
  tasks: Task[];
  isVisible: boolean;
}

export function AgentProgress({ tasks, isVisible }: AgentProgressProps) {
  if (!isVisible) return null;

  return (
    <div className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl p-4 w-full max-w-sm animate-fade-in shadow-[0_8px_30px_rgba(0,0,0,0.5)]">
      <div className="flex items-center gap-2 mb-4 border-b border-white/10 pb-3">
        <div className="w-2 h-2 rounded-full bg-nexus-cyan animate-pulse shadow-[0_0_8px_rgba(0,212,255,0.8)]" />
        <h3 className="font-display text-xs font-bold tracking-widest text-white uppercase">
          Arnés: Progreso del Agente
        </h3>
      </div>
      
      <div className="space-y-3">
        {tasks.map((task) => {
          let Icon = Circle;
          let colorClass = "text-nexus-dim";
          
          if (task.status === "[x]") {
            Icon = CheckCircle2;
            colorClass = "text-nexus-success drop-shadow-[0_0_5px_rgba(0,230,118,0.5)]";
          } else if (task.status === "[!]") {
            Icon = AlertTriangle;
            colorClass = "text-nexus-danger drop-shadow-[0_0_5px_rgba(255,45,85,0.5)]";
          }

          return (
            <div key={task.id} className="flex gap-3">
              <div className="mt-0.5">
                <Icon size={16} className={colorClass} />
              </div>
              <div>
                <div className={`font-body text-sm ${task.status === '[x]' ? 'text-white/80' : 'text-white/60'}`}>
                  {task.description}
                </div>
                {task.result && (
                  <div className="mt-1 text-xs text-nexus-dim bg-white/5 p-2 rounded-md border border-white/5 font-mono truncate max-w-[250px]">
                    {task.result}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {tasks.length === 0 && (
          <div className="text-nexus-dim text-xs italic">Esperando inicialización del planificador...</div>
        )}
      </div>
    </div>
  );
}
