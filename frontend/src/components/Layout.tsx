import React from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { LayoutDashboard, Wallet, Settings, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function Layout() {
  const { logout, user } = useAuth();

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 font-sans text-slate-800">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col justify-between shrink-0 h-full">
        <div className="p-6">
          <div className="mb-8 flex items-center gap-3">
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
      <main className="flex-1 overflow-y-auto overflow-x-hidden">
        <Outlet />
      </main>
    </div>
  );
}
