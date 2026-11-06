import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FinOpsModule } from '../../pages/FinOpsModule';
import { AuthProvider } from '../../context/AuthContext';
import React from 'react';

// Mock recharts to avoid rendering issues in jsdom
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  LineChart: () => <div data-testid="line-chart" />,
  BarChart: () => <div data-testid="bar-chart" />,
  Line: () => null,
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
}));

// Mock hooks
vi.mock('../../hooks/useMetrics', () => ({
  useMetrics: () => ({ metrics: { total_cost_usd: 100 }, loading: false }),
  useCostHistory: () => ({ data: [], loading: false })
}));

// Mock api
const mockGet = vi.fn();
vi.mock('../../lib/api', () => ({
  adminAPI: {
    getDashboard: (...args: any[]) => mockGet(...args)
  }
}));

describe('FinOpsModule', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Simulate being logged in
    localStorage.setItem('nexus_token', 'fake-token');
    localStorage.setItem('nexus_user', JSON.stringify({ email: 'admin@nexus.com', role: 'admin' }));
  });

  it('renders loading state initially', () => {
    // We don't resolve the promise immediately
    mockGet.mockImplementation(() => new Promise(() => {}));

    const { container } = render(
      <AuthProvider>
        <FinOpsModule />
      </AuthProvider>
    );

    expect(container.querySelector('.animate-spin')).toBeTruthy();
  });

  it('fetches and displays dashboard data successfully', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        budget_cop: 500000,
        total_tokens_purchased: 1000000,
        trm_usd_cop: 4200,
        trm_rates: { COP: 4200 },
        groq_cost_per_million: 0.69,
        anthropic_cost_per_million: 15.0,
        openai_cost_per_million: 10.0,
        google_cost_per_million: 7.0,
        total_users: 2,
        token_limit_per_user: 500000,
        payment_methods: [],
        users: [
          { email: 'user1@test.com', tokens_used: 1000, token_limit: 500000, usage_percentage: 0.2 },
          { email: 'user2@test.com', tokens_used: 2000, token_limit: 500000, usage_percentage: 0.4 }
        ],
        projects: [
          { id: 1, name: 'Agent X', description: 'Test Agent', budget_cop: 100000, is_active: true }
        ],
        llm_provider: 'groq'
      }
    });

    render(
      <AuthProvider>
        <FinOpsModule />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalled();
    });

    // Verify UI shows the project in Vista 1
    await waitFor(() => {
      expect(screen.getByText('Agent X')).toBeTruthy();
    });
  });

  it('handles API errors gracefully', async () => {
    mockGet.mockRejectedValueOnce(new Error('API Error'));

    render(
      <AuthProvider>
        <FinOpsModule />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalled();
    });

    // The component shows an error state
    expect(screen.getByText(/Hubo un problema/i)).toBeTruthy();
  });
});
