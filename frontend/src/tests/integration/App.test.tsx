import { render, screen } from '@testing-library/react';
import { MemoryRouter, Outlet } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import App from '../../App';
import * as AuthContext from '../../context/AuthContext';

// Mockeamos los componentes de las rutas para verificar si se renderizan
vi.mock('../../pages/LoginModule', () => ({ LoginModule: () => <div data-testid="login-page">Login Page</div> }));
vi.mock('../../pages/Dashboard', () => ({ Dashboard: () => <div data-testid="dashboard-page">Dashboard</div> }));
vi.mock('../../components/Layout', () => ({ Layout: () => <div data-testid="layout"><Outlet /></div> }));

describe('App Integration', () => {
  it('debe mostrar la página de login si no está autenticado', () => {
    // Simulamos que el usuario NO está autenticado
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
      isAuthenticated: false,
      login: vi.fn(),
      updateUser: vi.fn(),
      logout: vi.fn(),
      token: null,
      user: null
    });

    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    );

    expect(screen.getByTestId('login-page')).toBeInTheDocument();
  });

  it('debe redirigir al Dashboard si está autenticado', () => {
    // Simulamos que el usuario SÍ está autenticado
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
      isAuthenticated: true,
      login: vi.fn(),
      updateUser: vi.fn(),
      logout: vi.fn(),
      token: 'fake-token',
      user: { email: 'admin@nexus.com', role: 'admin' }
    });

    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    );

    expect(screen.getByTestId('dashboard-page')).toBeInTheDocument();
  });
});
