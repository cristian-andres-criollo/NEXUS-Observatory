import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthProvider, useAuth } from '../../context/AuthContext';
import React from 'react';

// Un componente de prueba que usa el contexto
const TestComponent = () => {
  const { user, token, isAuthenticated, login, logout, updateUser } = useAuth();

  return (
    <div>
      <div data-testid="auth-status">{isAuthenticated ? 'Autenticado' : 'No autenticado'}</div>
      <div data-testid="token-val">{token || 'sin-token'}</div>
      <div data-testid="user-email">{user?.email || 'sin-email'}</div>
      <div data-testid="user-theme">{user?.theme_color || 'default'}</div>
      <button onClick={() => login('fake-token-123', { email: 'test@nexus.com', role: 'admin', theme_color: 'dark' })}>
        Login
      </button>
      <button onClick={() => logout()}>
        Logout
      </button>
      <button onClick={() => updateUser({ theme_color: 'light' })}>
        Update Theme
      </button>
    </div>
  );
};

describe('AuthContext', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
  });

  it('debe iniciar no autenticado si no hay localStorage', () => {
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    expect(screen.getByTestId('auth-status').textContent).toBe('No autenticado');
    expect(screen.getByTestId('token-val').textContent).toBe('sin-token');
  });

  it('debe permitir iniciar sesión y guardar en localStorage', () => {
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    act(() => {
      screen.getByText('Login').click();
    });

    expect(screen.getByTestId('auth-status').textContent).toBe('Autenticado');
    expect(screen.getByTestId('token-val').textContent).toBe('fake-token-123');
    expect(screen.getByTestId('user-email').textContent).toBe('test@nexus.com');
    expect(localStorage.getItem('nexus_token')).toBe('fake-token-123');
  });

  it('debe permitir actualizar el usuario', () => {
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    act(() => {
      screen.getByText('Login').click();
    });
    
    expect(screen.getByTestId('user-theme').textContent).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    act(() => {
      screen.getByText('Update Theme').click();
    });

    expect(screen.getByTestId('user-theme').textContent).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('debe permitir cerrar sesión y limpiar localStorage', () => {
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    act(() => {
      screen.getByText('Login').click();
    });

    expect(localStorage.getItem('nexus_token')).toBeTruthy();

    act(() => {
      screen.getByText('Logout').click();
    });

    expect(screen.getByTestId('auth-status').textContent).toBe('No autenticado');
    expect(localStorage.getItem('nexus_token')).toBeNull();
  });
});
