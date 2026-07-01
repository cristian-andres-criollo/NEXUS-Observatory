import React from 'react';
import { Loader2 } from 'lucide-react';

interface NexusLoaderProps {
  message?: string;
  fullscreen?: boolean;
}

export const NexusLoader: React.FC<NexusLoaderProps> = ({ message = "CARGANDO...", fullscreen = true }) => {
  const content = (
    <div className="flex flex-col items-center justify-center gap-6 p-8 relative">
      {/* Glow effect behind spinner */}
      <div className="absolute inset-0 bg-nexus-cyan/10 blur-[50px] rounded-full animate-pulse-slow" />
      
      {/* Custom spinner with glowing rings */}
      <div className="relative w-20 h-20 flex items-center justify-center">
        {/* Outer ring */}
        <div className="absolute inset-0 border-2 border-nexus-cyan/20 border-t-nexus-cyan rounded-full animate-[spin_3s_linear_infinite]" />
        {/* Middle ring */}
        <div className="absolute inset-2 border-2 border-nexus-blue/20 border-l-nexus-blue rounded-full animate-[spin_2s_linear_infinite_reverse]" />
        {/* Inner ring */}
        <div className="absolute inset-4 border-2 border-purple-500/20 border-b-purple-500 rounded-full animate-[spin_1.5s_linear_infinite]" />
        
        {/* Center icon */}
        <Loader2 className="text-nexus-cyan animate-spin z-10" size={24} />
      </div>

      {/* Loading text with shimmer effect */}
      <div className="relative overflow-hidden group">
        <p className="font-mono text-sm font-semibold tracking-[0.3em] text-transparent bg-clip-text bg-gradient-to-r from-nexus-dim via-white to-nexus-dim animate-[shimmer_2s_infinite]">
          {message.toUpperCase()}
        </p>
      </div>

      {/* Progress bar line */}
      <div className="w-48 h-1 bg-black/40 rounded-full overflow-hidden border border-white/5">
        <div className="h-full bg-gradient-to-r from-nexus-blue via-nexus-cyan to-nexus-blue w-[200%] animate-[shimmer_1.5s_infinite]" />
      </div>
    </div>
  );

  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#020408]/90 backdrop-blur-md animate-fade-in-up">
        {content}
      </div>
    );
  }

  return (
    <div className="w-full h-full min-h-[300px] flex items-center justify-center animate-fade-in-up">
      {content}
    </div>
  );
};
