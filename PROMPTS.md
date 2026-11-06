# LedgerLine – AI Development Prompts

This document contains the key AI prompts for planning, designing, implementing, testing, and improving the LedgerLine money-movement backend.

These are representative development prompts organized by project phase.

## 1. Project Planning and Architecture

**Prompt 1: Project Architecture**

```text
I want to develop a secure money-movement backend called LedgerLine.

Use Node.js, Express.js, and PostgreSQL.

Design a scalable backend architecture with separate routes,
controllers, services, middleware, and database layers.

Include authentication, authorization, account management,
deposits, withdrawals, transfers, and transaction history.

Explain the responsibilities of each component.
```

**Prompt 2: Technology Selection**

```text
Suggest an appropriate technology stack for a secure
financial transaction backend.

Explain the purpose of Node.js, Express.js, PostgreSQL,
JWT, bcrypt, Helmet, CORS, and Jest.
```

## 2. Database Design

**Prompt 3: Database Schema**

```text
Design a PostgreSQL database schema for LedgerLine.

Include the following tables:

1. users
2. accounts
3. account_permissions
4. transactions
5. ledger_entries
6. idempotency_keys
7. audit_logs
8. transaction_attempts

Include primary keys, foreign keys, constraints,
indexes, and appropriate data types.

Use UUIDs for identifiers and BIGINT for monetary
amounts stored in paise.
```

**Prompt 4: Double-Entry Accounting**

```text
Explain how to implement double-entry accounting
in a money-movement backend.

Every posted transaction must contain balanced
debit and credit ledger entries.

Demonstrate how deposits, withdrawals, and transfers
should affect account balances and ledger records.
```

## 3. Authentication and Authorization

**Prompt 5: User Authentication**

```text
Implement user registration and login using
Node.js, Express.js, PostgreSQL, bcrypt, and JWT.

Hash passwords before storing them.

Validate user credentials during login and issue
JWT tokens for authenticated users.

Handle invalid credentials and inactive accounts securely.
```

**Prompt 6: Role-Based Access Control**

```text
Implement role-based access control for LedgerLine.

Support three roles:

1. admin
2. account_holder
3. auditor

Create authentication middleware and role authorization
middleware.

Ensure users can access only the operations permitted
by their roles and account-level permissions.
```

## 4. Account Management

**Prompt 7: Account Creation**

```text
Implement customer account creation using
Express.js and PostgreSQL.

Generate unique account numbers.

Create account permission records for the account owner.

Validate account details and handle database errors.
```

**Prompt 8: Account Permissions**

```text
Implement account-level permissions.

Support:

- can_view
- can_deposit
- can_withdraw
- can_transfer
- can_adjust

Allow administrators to view and update permissions.

Ensure auditors have view-only permissions.
```

## 5. Financial Transaction Operations

**Prompt 9: Deposit Implementation**

```text
Implement a secure deposit operation for LedgerLine.

Use PostgreSQL database transactions.

Create balanced debit and credit ledger entries
between the simulated deposit clearing account
and the customer account.

Update account balances atomically.

Include idempotency and audit logging.
```

**Prompt 10: Withdrawal Implementation**

```text
Implement a secure withdrawal operation.

Verify account permissions and account status.

Check available balance before processing.

Prevent negative customer balances.

Use row-level locking, database transactions,
double-entry accounting, and idempotency protection.
```

**Prompt 11: Money Transfer**

```text
Implement account-to-account money transfers.

Validate source and destination accounts.

Check source account transfer permission.

Prevent transfers to the same account.

Verify account status, currency, and available balance.

Use PostgreSQL transactions and deterministic row locking.

Create one debit ledger entry and one credit ledger entry.

Update both account balances atomically.

Include idempotency keys, transaction attempts,
and audit logging.
```

## 6. Transaction Integrity and Security

**Prompt 12: Idempotency**

```text
Implement idempotency protection for financial operations.

Prevent duplicate deposits, withdrawals, and transfers
when clients retry requests.

Store the user ID, idempotency key, request hash,
transaction ID, and response.

Reject reuse of the same key with different request data.
```

**Prompt 13: Concurrent Transactions**

```text
Analyze concurrency issues in a PostgreSQL
money-movement backend.

Use row-level locking and database transactions
to prevent race conditions and overdrafts.

Explain how concurrent withdrawals and transfers
should be handled.
```

**Prompt 14: Audit Logging**

```text
Implement audit logging for LedgerLine.

Record important financial and administrative actions.

Store actor ID, action, resource type, resource ID,
outcome, reason, and metadata.

Protect audit records against unauthorized modification
and deletion.
```

## 7. API Development

**Prompt 15: REST API Design**

```text
Design REST API endpoints for LedgerLine.

Include:

- User registration and login
- Account creation
- Account listing
- Account balance
- Deposits
- Withdrawals
- Transfers
- Transaction history
- Admin user management
- Account permission management

Use appropriate HTTP methods and status codes.

Include authentication and authorization requirements.
```

**Prompt 16: Input Validation and Error Handling**

```text
Review the LedgerLine API for input validation
and error handling.

Validate UUIDs, monetary amounts, request bodies,
and idempotency keys.

Return meaningful HTTP status codes and
consistent JSON error responses.
```

## 8. Testing and Verification

**Prompt 17: Automated Testing**

```text
Create automated tests for LedgerLine using
Jest and Supertest.

Test:

- Health endpoints
- Authentication
- Authorization
- Account permissions
- Deposits
- Withdrawals
- Transfers
- Idempotency
- Insufficient balance
- Concurrent transactions
- Double-entry accounting
- Append-only ledger protections

Use an isolated PostgreSQL test database.
```

**Prompt 18: API Testing**

```text
Provide Thunder Client test cases for LedgerLine.

Include sample request bodies, headers,
authentication tokens, expected responses,
and common error scenarios.

Test successful and unsuccessful financial operations.
```

## 9. Documentation and Deployment

**Prompt 19: README Documentation**

```text
Create professional GitHub README documentation
for LedgerLine.

Include project overview, architecture,
technology stack, database schema, API endpoints,
installation, environment configuration,
sample API requests, testing, and security features.
```

**Prompt 20: Code Review**

```text
Review the LedgerLine backend code.

Identify potential security vulnerabilities,
database consistency issues, concurrency problems,
validation gaps, and code quality improvements.

Do not remove existing security constraints
or weaken transaction integrity.
```

## 10. Future Enhancements

Potential prompts for future development:

- Design a frontend dashboard for account holders.
- Implement transaction pagination and filtering.
- Generate downloadable account statements.
- Add transaction notifications.
- Implement API rate limiting.
- Design cloud deployment architecture.
- Integrate a payment gateway in a properly secured test environment.

---

## Project Development Summary

LedgerLine demonstrates the use of AI-assisted software development across multiple stages:

1. Requirement analysis and architecture design.
2. PostgreSQL database design.
3. Authentication and authorization.
4. Financial transaction implementation.
5. Double-entry accounting.
6. Transaction integrity and security.
7. API development and testing.
8. Documentation and future planning.

**Project:** LedgerLine  
**Backend:** Node.js, Express.js, PostgreSQL  
**Purpose:** Secure money-movement backend

*These prompts are representative development prompts, not a verbatim record of every interaction used during implementation.*