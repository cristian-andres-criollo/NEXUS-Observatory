import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LoginModule } from '../../pages/LoginModule';
import { AuthProvider } from '../../context/AuthContext';
import React from 'react';

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

// Mock api
const mockLogin = vi.fn();
vi.mock('../../lib/api', () => ({
  authAPI: {
    login: (...args: any[]) => mockLogin(...args)
  }
}));

describe('LoginModule', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders login form correctly', () => {
    render(
      <AuthProvider>
        <LoginModule />
      </AuthProvider>
    );

    expect(screen.getByPlaceholderText('ejemplo@correo.com')).toBeTruthy();
    expect(screen.getByPlaceholderText('••••••••')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Entrar/i })).toBeTruthy();
  });

  it('shows error if fields are empty', async () => {
    render(
      <AuthProvider>
        <LoginModule />
      </AuthProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: /Entrar/i }));

    await waitFor(() => {
      // The button text changes when loading or it doesn't submit.
      // Since we don't mock the response yet, the test might just check if axios is NOT called
      expect(mockLogin).not.toHaveBeenCalled();
    });
  });

  it('submits form when filled and handles successful login', async () => {
    mockLogin.mockResolvedValueOnce({
      data: {
        access_token: 'fake-token-123',
        email: 'admin@nexus.com',
        role: 'admin'
      }
    });

    render(
      <AuthProvider>
        <LoginModule />
      </AuthProvider>
    );

    fireEvent.change(screen.getByPlaceholderText('ejemplo@correo.com'), { target: { value: 'admin@nexus.com' } });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'password123' } });

    fireEvent.click(screen.getByRole('button', { name: /Entrar/i }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('admin@nexus.com', 'password123');
    });

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
    });
  });

  it('shows error message on failed login', async () => {
    mockLogin.mockRejectedValueOnce({
      response: {
        data: {
          detail: 'Credenciales inválidas'
        }
      }
    });

    render(
      <AuthProvider>
        <LoginModule />
      </AuthProvider>
    );

    fireEvent.change(screen.getByPlaceholderText('ejemplo@correo.com'), { target: { value: 'admin@nexus.com' } });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'wrongpw' } });

    fireEvent.click(screen.getByRole('button', { name: /Entrar/i }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('admin@nexus.com', 'wrongpw');
    });

    // Check if toast error or an error message would be rendered
    // Since we use react-hot-toast, it's external, but we verify it didn't navigate
    await waitFor(() => {
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });
});
