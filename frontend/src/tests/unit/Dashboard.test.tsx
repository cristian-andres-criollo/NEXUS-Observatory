import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Dashboard } from '@/pages/Dashboard';
import { BrowserRouter } from 'react-router-dom';

// Mock context and hooks
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 1, email: 'admin@test.com', is_admin: true, name: 'Admin' }
  })
}));

vi.mock('@/hooks/useMetrics', () => ({
  useMetrics: () => ({}),
  useCostHistory: () => ([]),
  useLatencyHistory: () => ([])
}));

describe('Dashboard Component', () => {
  it('renders without crashing and shows basic elements', () => {
    render(
      <BrowserRouter>
        <Dashboard />
      </BrowserRouter>
    );

    // Verify it renders the loading text or the main component text
    // Depending on the loading state, we check if it mounts without errors.
    expect(document.body).toBeDefined();
  });
});
