BEGIN;

-- =========================================
-- 1. USERS
-- =========================================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name VARCHAR(120) NOT NULL,
    email VARCHAR(255) NOT NULL,
    password_hash TEXT NOT NULL,
    role VARCHAR(20) NOT NULL
        CHECK (role IN ('admin', 'account_holder', 'auditor')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT users_email_not_empty CHECK (length(trim(email)) > 0)
);

CREATE UNIQUE INDEX users_email_unique
ON users (LOWER(email));


-- =========================================
-- 2. ACCOUNTS
-- =========================================

CREATE TABLE accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_number VARCHAR(30) NOT NULL UNIQUE,
    account_name VARCHAR(120) NOT NULL,

    account_type VARCHAR(20) NOT NULL
        CHECK (account_type IN ('customer', 'system')),

    currency CHAR(3) NOT NULL DEFAULT 'INR',
    balance_paise BIGINT NOT NULL DEFAULT 0,

    status VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'frozen', 'closed')),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT non_negative_customer_balance
        CHECK (account_type = 'system' OR balance_paise >= 0),

    CONSTRAINT valid_account_balance
        CHECK (balance_paise >= -9000000000000000)
);


-- =========================================
-- 3. ACCOUNT PERMISSIONS
-- =========================================

CREATE TABLE account_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL REFERENCES users(id),
    account_id UUID NOT NULL REFERENCES accounts(id),

    can_view BOOLEAN NOT NULL DEFAULT FALSE,
    can_deposit BOOLEAN NOT NULL DEFAULT FALSE,
    can_withdraw BOOLEAN NOT NULL DEFAULT FALSE,
    can_transfer BOOLEAN NOT NULL DEFAULT FALSE,
    can_adjust BOOLEAN NOT NULL DEFAULT FALSE,

    granted_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (user_id, account_id)
);


-- =========================================
-- 4. TRANSACTIONS
-- =========================================

CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    transaction_type VARCHAR(20) NOT NULL
        CHECK (
            transaction_type IN (
                'deposit',
                'withdrawal',
                'transfer',
                'adjustment',
                'reversal'
            )
        ),

    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'posted', 'reversed')),

    initiated_by UUID NOT NULL REFERENCES users(id),

    description TEXT,
    reference_id UUID,

    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);


-- =========================================
-- 5. LEDGER ENTRIES
-- =========================================

CREATE TABLE ledger_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    transaction_id UUID NOT NULL REFERENCES transactions(id),
    account_id UUID NOT NULL REFERENCES accounts(id),

    entry_side VARCHAR(10) NOT NULL
        CHECK (entry_side IN ('debit', 'credit')),

    amount_paise BIGINT NOT NULL
        CHECK (
            amount_paise > 0
            AND amount_paise <= 9000000000000000
        ),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (transaction_id, account_id, entry_side)
);


-- =========================================
-- 6. IDEMPOTENCY KEYS
-- =========================================

CREATE TABLE idempotency_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL REFERENCES users(id),

    idempotency_key VARCHAR(255) NOT NULL,
    request_hash CHAR(64) NOT NULL,

    transaction_id UUID REFERENCES transactions(id),

    status VARCHAR(20) NOT NULL DEFAULT 'processing'
        CHECK (status IN ('processing', 'completed', 'failed')),

    response_body JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,

    UNIQUE (user_id, idempotency_key)
);


-- =========================================
-- 7. AUDIT LOGS
-- =========================================

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    actor_id UUID REFERENCES users(id),

    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id UUID,

    outcome VARCHAR(20) NOT NULL
        CHECK (outcome IN ('success', 'denied', 'failure')),

    reason TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- =========================================
-- 8. TRANSACTION ATTEMPTS
-- =========================================

CREATE TABLE transaction_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    actor_id UUID REFERENCES users(id),

    operation VARCHAR(20) NOT NULL,
    source_account_id UUID REFERENCES accounts(id),
    target_account_id UUID REFERENCES accounts(id),

    amount_paise BIGINT,

    idempotency_key VARCHAR(255),

    outcome VARCHAR(20) NOT NULL
        CHECK (outcome IN ('success', 'rejected', 'failed')),

    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CHECK (amount_paise IS NULL OR amount_paise > 0)
);


-- =========================================
-- 9. INDEXES
-- =========================================

CREATE INDEX idx_permissions_user
ON account_permissions(user_id);

CREATE INDEX idx_permissions_account
ON account_permissions(account_id);

CREATE INDEX idx_transactions_actor
ON transactions(initiated_by);

CREATE INDEX idx_transactions_created
ON transactions(created_at DESC);

CREATE INDEX idx_ledger_account
ON ledger_entries(account_id, created_at DESC);

CREATE INDEX idx_ledger_transaction
ON ledger_entries(transaction_id);

CREATE INDEX idx_audit_actor
ON audit_logs(actor_id, created_at DESC);

CREATE INDEX idx_attempt_actor
ON transaction_attempts(actor_id, created_at DESC);


-- =========================================
-- 10. APPEND-ONLY PROTECTION
-- =========================================

CREATE OR REPLACE FUNCTION prevent_record_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION
        'This record is append-only. Updates and deletes are prohibited.';
END;
$$ LANGUAGE plpgsql;


CREATE TRIGGER ledger_entries_immutable
BEFORE UPDATE OR DELETE ON ledger_entries
FOR EACH ROW
EXECUTE FUNCTION prevent_record_mutation();


CREATE TRIGGER audit_logs_immutable
BEFORE UPDATE OR DELETE ON audit_logs
FOR EACH ROW
EXECUTE FUNCTION prevent_record_mutation();


CREATE TRIGGER transaction_attempts_immutable
BEFORE UPDATE OR DELETE ON transaction_attempts
FOR EACH ROW
EXECUTE FUNCTION prevent_record_mutation();


-- =========================================
-- 11. DOUBLE-ENTRY BALANCE ENFORCEMENT
-- =========================================

CREATE OR REPLACE FUNCTION assert_transaction_balanced()
RETURNS TRIGGER AS $$
DECLARE
    v_transaction_id UUID;
    v_status VARCHAR(20);
    v_count BIGINT;
    v_debits NUMERIC;
    v_credits NUMERIC;
BEGIN
    IF TG_TABLE_NAME = 'transactions' THEN
        v_transaction_id := NEW.id;
    ELSIF TG_OP = 'DELETE' THEN
        v_transaction_id := OLD.transaction_id;
    ELSE
        v_transaction_id := NEW.transaction_id;
    END IF;

    SELECT status
    INTO v_status
    FROM transactions
    WHERE id = v_transaction_id;

    IF NOT FOUND OR v_status <> 'posted' THEN
        RETURN NULL;
    END IF;

    SELECT
        COUNT(*),
        COALESCE(SUM(amount_paise)
            FILTER (WHERE entry_side = 'debit'), 0),
        COALESCE(SUM(amount_paise)
            FILTER (WHERE entry_side = 'credit'), 0)
    INTO v_count, v_debits, v_credits
    FROM ledger_entries
    WHERE transaction_id = v_transaction_id;

    IF v_count < 2 OR v_debits <> v_credits THEN
        RAISE EXCEPTION
            'Transaction % is unbalanced: debits %, credits %',
            v_transaction_id, v_debits, v_credits;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;


CREATE CONSTRAINT TRIGGER ledger_entries_balanced
AFTER INSERT ON ledger_entries
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION assert_transaction_balanced();


CREATE CONSTRAINT TRIGGER transactions_balanced
AFTER INSERT OR UPDATE ON transactions
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION assert_transaction_balanced();

-- Application schema permissions

REVOKE CREATE ON SCHEMA public FROM PUBLIC;

GRANT USAGE ON SCHEMA public TO ledgerline_app;

GRANT SELECT, INSERT ON
    users,
    accounts,
    account_permissions,
    transactions,
    ledger_entries,
    idempotency_keys,
    audit_logs,
    transaction_attempts
TO ledgerline_app;

GRANT UPDATE (is_active)
ON users TO ledgerline_app;

GRANT UPDATE (
    status,
    balance_paise
)
ON accounts TO ledgerline_app;

GRANT UPDATE (
    can_view,
    can_deposit,
    can_withdraw,
    can_transfer,
    can_adjust
)
ON account_permissions TO ledgerline_app;

GRANT UPDATE (
    status,
    completed_at,
    metadata
)
ON transactions TO ledgerline_app;

GRANT UPDATE (
    transaction_id,
    status,
    response_body,
    completed_at
)
ON idempotency_keys TO ledgerline_app;
COMMIT;