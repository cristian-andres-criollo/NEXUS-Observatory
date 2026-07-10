-- =========================================================================
-- NEXUS OBSERVATORY - ESQUEMA DE BASE DE DATOS FINOPS (PostgreSQL)
-- =========================================================================

CREATE DATABASE langfuse_db;
CREATE DATABASE litellm_db;

-- 1. Empresas / Clientes
CREATE TABLE IF NOT EXISTS companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Proyectos / Módulos (ej. Agente Financiero, Chatbot RRHH)
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    module_key VARCHAR(100) UNIQUE NOT NULL, -- Identificador único para enrutamiento (ej. 'agent_finanzas')
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Usuarios de los sistemas (Power Users)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Presupuestos Mensuales y Control FinOps
CREATE TABLE IF NOT EXISTS budgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    year_month VARCHAR(7) NOT NULL, -- Formato 'YYYY-MM'
    monthly_limit_cop DECIMAL(15, 2) NOT NULL, -- Límite de gasto mensual en Pesos Colombianos
    current_spend_cop DECIMAL(15, 2) DEFAULT 0.00, -- Consumo actual acumulado
    trm_rate DECIMAL(10, 2) NOT NULL DEFAULT 4100.00, -- TRM del momento para auditoría
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(company_id, year_month)
);

-- 5. Transacciones Individuales (Log inmutable de consumo)
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id),
    user_id UUID REFERENCES users(id), -- Opcional, puede ser un request anónimo
    budget_id UUID NOT NULL REFERENCES budgets(id),
    trace_id VARCHAR(255), -- Referencia cruzada al TraceID en Langfuse
    model_name VARCHAR(100) NOT NULL,
    prompt_tokens INT NOT NULL DEFAULT 0,
    completion_tokens INT NOT NULL DEFAULT 0,
    total_tokens INT NOT NULL DEFAULT 0,
    cost_usd DECIMAL(12, 6) NOT NULL,
    cost_cop DECIMAL(12, 2) NOT NULL,
    trm_applied DECIMAL(10, 2) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================================
-- ÍNDICES PARA OPTIMIZACIÓN
-- =========================================================================
CREATE INDEX idx_budgets_company_month ON budgets(company_id, year_month);
CREATE INDEX idx_transactions_project ON transactions(project_id);
CREATE INDEX idx_transactions_user ON transactions(user_id);
CREATE INDEX idx_transactions_trace ON transactions(trace_id);

-- =========================================================================
-- DATOS SEMILLA DE PRUEBA (MOCK DATA)
-- =========================================================================
INSERT INTO companies (id, name) VALUES ('11111111-1111-1111-1111-111111111111', 'Acme Corp Colombia') ON CONFLICT DO NOTHING;
INSERT INTO users (id, company_id, email) VALUES ('0d08d697-27ff-4468-a372-6c8e0484a49a', '11111111-1111-1111-1111-111111111111', 'tovarcristian431@gmail.com') ON CONFLICT DO NOTHING;
INSERT INTO projects (id, company_id, name, module_key) VALUES ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'Asistente de Recursos Humanos', 'chat_rrhh') ON CONFLICT DO NOTHING;
INSERT INTO budgets (id, company_id, year_month, monthly_limit_cop, current_spend_cop, trm_rate) VALUES ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', to_char(CURRENT_DATE, 'YYYY-MM'), 500000.00, 0.00, 4150.00) ON CONFLICT DO NOTHING;
