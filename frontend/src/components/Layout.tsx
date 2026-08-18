import React, { useState } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { LayoutDashboard, Wallet, Settings, LogOut, Menu, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function Layout() {
  const { logout, user } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const closeMenu = () => setIsMobileMenuOpen(false);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 font-sans text-slate-800 flex-col md:flex-row">
      
      {/* Mobile Top Bar */}
      <header className="md:hidden flex items-center justify-between p-4 bg-white border-b border-slate-200 shrink-0 z-40 relative">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-md">
            <span className="text-white font-bold text-lg">N</span>
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-bold tracking-tight text-slate-900 leading-none">Nexus</span>
            <span className="text-[9px] font-bold tracking-widest text-blue-600 uppercase mt-0.5">Observatory</span>
          </div>
        </div>
        <button 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
        >
          {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </header>

      {/* Overlay Backdrop for Mobile */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 z-40 md:hidden backdrop-blur-sm transition-opacity"
          onClick={closeMenu}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed md:static inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 flex flex-col justify-between h-full transform transition-transform duration-300 ease-in-out md:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}`}>
        <div className="p-6 overflow-y-auto">
          <div className="hidden md:flex mb-8 items-center gap-3">
             <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-md">
                <span className="text-white font-bold text-xl">N</span>
             </div>
             <div className="flex flex-col">
               <span className="text-xl font-bold tracking-tight text-slate-900 leading-none">Nexus</span>
               <span className="text-[10px] font-bold tracking-widest text-blue-600 uppercase mt-0.5">Observatory</span>
             </div>
          </div>

          <nav className="flex flex-col gap-2">
            <NavLink
              to="/"
              onClick={closeMenu}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors ${
                  isActive ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`
              }
            >
              <LayoutDashboard className="w-5 h-5" /> Dashboard
            </NavLink>
            <NavLink
              to="/finops"
              onClick={closeMenu}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors ${
                  isActive ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`
              }
            >
              <Wallet className="w-5 h-5" /> Finanzas
            </NavLink>
            <NavLink
              to="/settings"
              onClick={closeMenu}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors ${
                  isActive ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`
              }
            >
              <Settings className="w-5 h-5" /> Ajustes
            </NavLink>
          </nav>
        </div>

        <div className="p-6 border-t border-slate-100">
          <div className="flex items-center gap-3 mb-4">
             {user?.profile_picture ? (
               <img src={user.profile_picture} alt="Profile" className="w-10 h-10 rounded-full object-cover shrink-0 shadow-sm border border-slate-200" />
             ) : (
               <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 shrink-0">
                 {user?.full_name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
               </div>
             )}
             <div className="overflow-hidden">
               <p className="text-sm font-bold truncate text-slate-800">{user?.full_name || 'Usuario'}</p>
               <p className="text-xs text-slate-500 truncate">{user?.email}</p>
             </div>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-3 w-full px-4 py-2 text-rose-600 hover:bg-rose-50 rounded-xl font-medium transition-colors"
          >
            <LogOut className="w-5 h-5" /> Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden relative z-0">
        <Outlet />
      </main>
    </div>
  );
}
