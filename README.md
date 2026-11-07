# LedgerLine â€“ Secure Money Movement Backend

A secure money-movement backend built using **Node.js, Express.js, and PostgreSQL**. LedgerLine provides account management, deposits, withdrawals, transfers, transaction history, role-based access control, and double-entry ledger accounting.

> **Disclaimer:** LedgerLine is an educational backend project. Deposits and withdrawals use simulated internal clearing accounts. The application does not connect to real banking or payment networks.

---

## 1. Project Overview

LedgerLine demonstrates how a financial transaction system can manage money movements while maintaining data consistency, transaction integrity, security, and accountability.

### Key Features

- User registration and login.
- JWT-based authentication.
- Role-based access control.
- Three user roles: Admin, Account Holder, and Auditor.
- Customer account creation and management.
- Deposits and withdrawals.
- Account-to-account transfers.
- Double-entry ledger accounting.
- Idempotency protection against duplicate transactions.
- Prevention of negative account balances.
- Concurrent transaction protection.
- Account-level permissions.
- Transaction history with running balances.
- Recording of rejected and failed transaction attempts.
- Audit logging.
- Database transactions and row-level locking.
- Automated API and integrity tests.

---

## 2. Technology Stack

| Component | Technology |
|---|---|
| Runtime | Node.js |
| Backend framework | Express.js |
| Database | PostgreSQL |
| Database driver | node-postgres (`pg`) |
| Authentication | JSON Web Token (JWT) |
| Password hashing | bcrypt |
| Input validation | Zod and application-level validation |
| Security middleware | Helmet, CORS |
| Testing | Jest, Supertest |
| API testing | Thunder Client |
| Development | Nodemon |
| Version control | Git and GitHub |

---

## 3. System Architecture

LedgerLine follows a layered backend architecture.

```text
                  CLIENT
           (Thunder Client / Frontend)
                     |
                     v
                EXPRESS SERVER
                     |
                     v
                  API ROUTES
                     |
                     v
                  MIDDLEWARE
          Authentication and Authorization
                     |
                     v
                 CONTROLLERS
          Request validation and responses
                     |
                     v
                   SERVICES
          Business logic and transaction rules
                     |
                     v
               POSTGRESQL DATABASE
                     |
       +-------------+-------------+
       |             |             |
       v             v             v
     Users        Accounts     Transactions
                                   |
                                   v
                              Ledger Entries
                                   |
                         +---------+---------+
                         |                   |
                         v                   v
                     Audit Logs       Idempotency Keys
```

### Architecture Responsibilities

**Routes**
- Define API endpoints.
- Apply authentication and role-based middleware.
- Connect endpoints to controllers.

**Middleware**
- Verify JWT tokens.
- Identify authenticated users.
- Restrict access according to user roles.

**Controllers**
- Validate incoming requests.
- Call service functions.
- Return appropriate HTTP responses.

**Services**
- Implement business logic.
- Execute database transactions.
- Maintain ledger consistency.
- Handle idempotency and audit records.
- Apply account-level permission checks.

**Database**
- Store users, accounts, transactions, ledger entries, permissions, and audit records.
- Enforce database constraints and transaction integrity.

---

## 4. User Roles and Permissions

LedgerLine supports three user roles.

| Role | Description |
|---|---|
| `admin` | Manage users and account permissions |
| `account_holder` | Create accounts and perform permitted money operations |
| `auditor` | View permitted accounts and transaction information |

Public registration creates an `account_holder` account. Administrative and auditor privileges cannot be assigned through public registration.

### Account-Level Permissions

The system supports the following permissions:

- `can_view`
- `can_deposit`
- `can_withdraw`
- `can_transfer`
- `can_adjust`

An account holder can perform only the operations permitted for their account.

An auditor is restricted to view-only access.

---

## 5. Database Schema

The PostgreSQL database contains eight main tables.

| Table | Purpose |
|---|---|
| `users` | Stores user details, password hashes, roles, and account status |
| `accounts` | Stores account details, currency, balance, and status |
| `account_permissions` | Defines user permissions for individual accounts |
| `transactions` | Stores transaction information and status |
| `ledger_entries` | Records debit and credit entries |
| `idempotency_keys` | Prevents duplicate transaction processing |
| `audit_logs` | Records important administrative and financial actions |
| `transaction_attempts` | Records successful, rejected, and failed transaction attempts |

### Important Database Fields

**Users**
- `id`
- `full_name`
- `email`
- `password_hash`
- `role`
- `is_active`
- `created_at`

**Accounts**
- `id`
- `account_number`
- `account_name`
- `account_type`
- `currency`
- `balance_paise`
- `status`

**Account Permissions**
- `user_id`
- `account_id`
- `can_view`
- `can_deposit`
- `can_withdraw`
- `can_transfer`
- `can_adjust`

**Transactions**
- `id`
- `transaction_type`
- `status`
- `initiated_by`
- `description`
- `reference_id`
- `metadata`
- `created_at`
- `completed_at`

**Ledger Entries**
- `id`
- `transaction_id`
- `account_id`
- `entry_side`
- `amount_paise`
- `created_at`

**Idempotency Keys**
- `user_id`
- `idempotency_key`
- `request_hash`
- `transaction_id`
- `status`
- `response_body`

Additional database fields are defined in `backend/database/schema.sql`.

### 5.1 Double-Entry Accounting

LedgerLine uses double-entry accounting to maintain transaction consistency.

Every posted transaction must contain balanced debit and credit entries.

Example: A â‚¹25 internal transfer.

| Account | Entry | Amount |
|---|---|---:|
| Sender account | Debit | â‚¹25 |
| Receiver account | Credit | â‚¹25 |
| **Total** | **Balanced** | **â‚¹25 = â‚¹25** |

Balances are updated within the same database transaction as the corresponding ledger entries.

Amounts are stored in paise using PostgreSQL `BIGINT` to avoid floating-point currency calculations.

### 5.2 Money Conservation

For an internal transfer:

- The source account is debited.
- The destination account is credited.
- Both operations are performed atomically.
- The total customer-account balance remains unchanged.

Deposits and withdrawals use simulated clearing accounts.

These operations change the total customer-account balance because they represent simulated money entering or leaving the customer-account system.

### 5.3 Transaction Integrity

The backend uses:

- PostgreSQL database transactions.
- Account-row locking during money operations.
- Idempotency keys.
- Database constraints.
- Balanced debit and credit ledger entries.
- Protection against ledger-entry updates and deletes.
- Transaction attempt records.

These mechanisms help prevent duplicate processing, negative balances, and inconsistent financial records.

---

## 6. API Endpoints

Base URL:

```text
http://localhost:5000
```

Protected endpoints require a valid JWT:

```text
Authorization: Bearer YOUR_JWT_TOKEN
```

### 6.1 Health Endpoints

| Method | Endpoint | Description | Access |
|---|---|---|---|
| GET | `/api/health` | Check server health | Public |
| GET | `/api/health/db` | Check database connectivity | Public |

### 6.2 Authentication

| Method | Endpoint | Description | Access |
|---|---|---|---|
| POST | `/api/auth/register` | Register a new user | Public |
| POST | `/api/auth/login` | Authenticate a user and receive JWT | Public |

### 6.3 Account Management

| Method | Endpoint | Description | Access |
|---|---|---|---|
| POST | `/api/accounts` | Create a customer account | Account holder |
| GET | `/api/accounts` | List permitted accounts | Admin, account holder, or auditor, subject to account permissions |
| GET | `/api/accounts/:accountId` | View account details | Admin, account holder, or auditor, subject to account view permission |
| GET | `/api/accounts/:accountId/balance` | View account balance | Admin, account holder, or auditor, subject to account view permission |

### 6.4 Money Operations

All money operations require authentication, the account-holder role, the appropriate account-level permission, and an `Idempotency-Key` header.

| Method | Endpoint | Required permission | Money effect |
|---|---|---|---|
| POST | `/api/accounts/:accountId/deposits` | `can_deposit` | Credits customer account and debits simulated deposit clearing account |
| POST | `/api/accounts/:accountId/withdrawals` | `can_withdraw` | Debits customer account and credits simulated withdrawal clearing account |
| POST | `/api/accounts/:accountId/transfers` | `can_transfer` | Debits source account and credits destination account |

**Deposit request body**

```json
{
  "amount_rupees": "100.00"
}
```

**Withdrawal request body**

```json
{
  "amount_rupees": "20.00"
}
```

**Transfer request body**

```json
{
  "target_account_id": "DESTINATION_ACCOUNT_UUID",
  "amount_rupees": "25.00"
}
```
Idempotency-Key: unique-request-key-001
Content-Type: application/json
Amounts are provided as rupee strings and stored internally as paise.

### 6.5 Transaction History

| Method | Endpoint | Description | Access |
|---|---|---|---|
| GET | `/api/accounts/:accountId/transactions` | Retrieve account transaction history | Admin, account holder, or auditor, subject to account view permission |

The transaction history includes:

- Posted debit and credit ledger entries.
- Rejected and failed transaction attempts.
- Transaction status and timestamps.
- Initiating user for each recorded event.
- Transaction amount.
- Running account balance.

Rejected and failed attempts are recorded separately from posted ledger transactions and do not change the account balance.

### 6.6 Admin Management

All endpoints below require an authenticated admin.

| Method | Endpoint | Description | Access |
|---|---|---|---|
| GET | `/api/admin/users` | List users | Admin |
| PATCH | `/api/admin/users/:userId/status` | Update user status | Admin |
| GET | `/api/admin/accounts/:accountId/permissions` | View account permissions | Admin |
| PUT | `/api/admin/accounts/:accountId/permissions/:userId` | Update account permissions | Admin |

### 6.7 Important HTTP Status Codes

| Status | Meaning |
|---|---|
| 200 | Request successful |
| 201 | Resource created, where applicable |
| 400 | Invalid request data |
| 401 | Missing or invalid authentication |
| 403 | Insufficient role or account permission |
| 404 | Resource not found or access denied |
| 409 | Conflict, insufficient balance, or idempotency conflict |
| 500 | Unexpected server error |

---

## 7. Installation and Setup

### Prerequisites

Install the following:

- Node.js and npm
- PostgreSQL
- Git
- VS Code (recommended)

### Step 1: Clone the Repository

```bash
git clone https://github.com/rishiyasmin/LedgerLine.git
cd LedgerLine/backend
```

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Configure PostgreSQL

Create the application database role and databases using a PostgreSQL administrator account.

```sql
CREATE ROLE ledgerline_app LOGIN PASSWORD 'SET_A_STRONG_DATABASE_PASSWORD';

CREATE DATABASE ledgerline_db;
CREATE DATABASE ledgerline_test_db;

GRANT CONNECT ON DATABASE ledgerline_db TO ledgerline_app;
GRANT CONNECT ON DATABASE ledgerline_test_db TO ledgerline_app;
```

If the role or databases already exist, do not create them again.

Apply the database schema as the database owner or administrator to both databases:

```bash
psql -U postgres -d ledgerline_db -f database/schema.sql

psql -U postgres -d ledgerline_test_db -f database/schema.sql
```

The schema creates the application tables, indexes, integrity constraints, triggers, and application-role permissions.

### Step 4: Configure Environment Variables

Create `backend/.env` using the following structure:

```env
PORT=5000
NODE_ENV=development

DB_HOST=localhost
DB_PORT=5432
DB_NAME=ledgerline_db
DB_USER=ledgerline_app
DB_PASSWORD=YOUR_DATABASE_PASSWORD

JWT_SECRET=YOUR_LONG_RANDOM_SECRET

SEED_ADMIN_PASSWORD=YOUR_DEMO_ADMIN_PASSWORD
SEED_CUSTOMER_PASSWORD=YOUR_DEMO_CUSTOMER_PASSWORD
SEED_AUDITOR_PASSWORD=YOUR_DEMO_AUDITOR_PASSWORD
```

Use strong, different passwords for the demo accounts.

The repository includes `.env.example` as a configuration template. Copy it and supply your own values.

Never commit `.env`, `.env.test`, database passwords, JWT secrets, or other credentials.

### Step 5: Create Demo Accounts

From the `backend` directory, execute:

```bash
node database/seed.js
```

The seed script creates:

- Demo administrator: `admin@ledgerline.local`
- Demo customer: `customer@ledgerline.local`
- Demo auditor: `auditor@ledgerline.local`
- Simulated deposit and withdrawal clearing accounts.
- A demo customer account with an initial balance of â‚¹0.00.

The demo passwords are supplied through environment variables and are not hardcoded in the seed script.

### Step 6: Start the Backend

Development mode:

```bash
npm run dev
```

Production-style start:

```bash
npm start
```

The backend runs at:

```text
http://localhost:5000
```

### Step 7: Configure the Test Environment

Configure `backend/.env.test` to use the separate `ledgerline_test_db` database and a test JWT secret.

The test environment must never use the development database.

### Step 8: Run Automated Tests

From the backend directory:

```bash
npm test
```

---

## 8. Sample API Requests

The following examples demonstrate how to interact with LedgerLine using Thunder Client or another API client.

### 8.1 Register a User

**POST**

```text
/api/auth/register
```

Request body:

```json
{
  "full_name": "Test Customer",
  "email": "customer@example.com",
  "password": "Customer@12345"
}
```

Public registration creates an account-holder user.

### 8.2 Login

**POST**

```text
/api/auth/login
```

Request body:

```json
{
  "email": "customer@example.com",
  "password": "Customer@12345"
}
```

Copy the JWT token from the response.

For protected endpoints, add:

```text
Authorization: Bearer YOUR_JWT_TOKEN
```

### 8.3 Create an Account

**POST**

```text
/api/accounts
```

Request body:

```json
{
  "account_name": "My Savings Account"
}
```

### 8.4 Deposit Money

**POST**

```text
/api/accounts/SOURCE_ACCOUNT_ID/deposits
```

Headers:

```text
Authorization: Bearer YOUR_JWT_TOKEN
Idempotency-Key: deposit-demo-001
```

Request body:

```json
{
  "amount_rupees": "100.00"
}
```

### 8.5 Withdraw Money

**POST**

```text
/api/accounts/SOURCE_ACCOUNT_ID/withdrawals
```

Headers:

```text
Authorization: Bearer YOUR_JWT_TOKEN
Idempotency-Key: withdrawal-demo-001
```

Request body:

```json
{
  "amount_rupees": "20.00"
}
```

### 8.6 Transfer Money

**POST**

```text
/api/accounts/SOURCE_ACCOUNT_ID/transfers
```

Headers:

```text
Authorization: Bearer YOUR_JWT_TOKEN
Idempotency-Key: transfer-demo-001
```

Request body:

```json
{
  "target_account_id": "DESTINATION_ACCOUNT_ID",
  "amount_rupees": "25.00"
}
```

### 8.7 Get Account Balance

**GET**

```text
/api/accounts/SOURCE_ACCOUNT_ID/balance
```

Header:

```text
Authorization: Bearer YOUR_JWT_TOKEN
```

### 8.8 Get Transaction History

**GET**

```text
/api/accounts/SOURCE_ACCOUNT_ID/transactions
```

Header:

```text
Authorization: Bearer YOUR_JWT_TOKEN
```

### 8.9 Get All Permitted Accounts

**GET**

```text
/api/accounts
```

Header:

```text
Authorization: Bearer YOUR_JWT_TOKEN
```

---

## 9. Security and Transaction Integrity

LedgerLine implements several security and consistency mechanisms.

### JWT Authentication

Protected routes require a valid JWT.

### Role-Based Access Control

Users can access functionality according to their assigned roles.

### Account-Level Permissions

Individual account permissions control viewing, depositing, withdrawing, transferring, and adjusting.

### Password Hashing

Passwords are hashed using bcrypt before storage.

### Idempotency

Each money operation requires an idempotency key.

Repeated requests using the same key and same request data return the stored result instead of processing the transaction again.

Reusing a key with different request data is rejected.

### Database Transactions

Financial operations use PostgreSQL transactions to ensure related database changes are committed or rolled back together.

### Row-Level Locking

Account rows are locked during financial operations to help prevent concurrent balance inconsistencies.

### Double-Entry Ledger

Every posted financial transaction must have balanced debit and credit entries.

### Audit Logging

Important actions are recorded for accountability and investigation.

### Append-Only Records

Ledger entries and audit records have database protections against updates and deletes.

---

## 10. Testing

LedgerLine uses Jest and Supertest for automated testing.

Run the test suite:

```bash
npm test
```

### Test Coverage

The project includes tests covering areas such as:

- Health endpoints.
- Authentication and authorization.
- Account permissions.
- Successful deposits and withdrawals.
- Successful transfers.
- Double-entry ledger verification.
- Duplicate deposit idempotency.
- Duplicate transfer idempotency.
- Idempotency key reuse with different request data.
- Insufficient balance protection.
- Concurrent withdrawal protection.
- Concurrent transfer protection.
- Unauthorized transfer protection.
- System-wide customer money conservation.
- Account balance reconciliation.
- Ledger update and delete protection.

The test environment uses a separate PostgreSQL database named `ledgerline_test_db`.

**Previously verified test result:** 23 tests passed across 3 test suites. Run `npm test` again to verify the current repository state.

Never run destructive test setup against the development database.

---

## 11. Project Structure

```text
LedgerLine/
â”‚
â”œâ”€â”€ backend/
â”‚   â”œâ”€â”€ database/
â”‚   â”‚   â”œâ”€â”€ schema.sql
â”‚   â”‚   â””â”€â”€ seed.js
â”‚   â”‚
â”‚   â”œâ”€â”€ src/
â”‚   â”‚   â”œâ”€â”€ config/
â”‚   â”‚   â”‚   â””â”€â”€ db.js
â”‚   â”‚   â”‚
â”‚   â”‚   â”œâ”€â”€ controllers/
â”‚   â”‚   â”‚   â”œâ”€â”€ accountController.js
â”‚   â”‚   â”‚   â”œâ”€â”€ adminController.js
â”‚   â”‚   â”‚   â””â”€â”€ authController.js
â”‚   â”‚   â”‚
â”‚   â”‚   â”œâ”€â”€ middleware/
â”‚   â”‚   â”‚   â”œâ”€â”€ authMiddleware.js
â”‚   â”‚   â”‚   â””â”€â”€ roleMiddleware.js
â”‚   â”‚   â”‚
â”‚   â”‚   â”œâ”€â”€ routes/
â”‚   â”‚   â”‚   â”œâ”€â”€ accountRoutes.js
â”‚   â”‚   â”‚   â”œâ”€â”€ adminRoutes.js
â”‚   â”‚   â”‚   â””â”€â”€ authRoutes.js
â”‚   â”‚   â”‚
â”‚   â”‚   â”œâ”€â”€ services/
â”‚   â”‚   â”‚   â””â”€â”€ accountService.js
â”‚   â”‚   â”‚
â”‚   â”‚   â”œâ”€â”€ app.js
â”‚   â”‚   â””â”€â”€ server.js
â”‚   â”‚
â”‚   â”œâ”€â”€ tests/
â”‚   â”‚   â”œâ”€â”€ health.test.js
â”‚   â”‚   â”œâ”€â”€ rbac.test.js
â”‚   â”‚   â”œâ”€â”€ transactions.test.js
â”‚   â”‚   â””â”€â”€ load-env.js
â”‚   â”‚
â”‚   â”œâ”€â”€ .env.example
â”‚   â””â”€â”€ package.json
â”‚
â”œâ”€â”€ README.md
â”œâ”€â”€ THREATS.md
â”œâ”€â”€ PROMPTS.md
â””â”€â”€ .gitignore
```

The `.env` and `.env.test` files are intentionally excluded from the repository.

Additional utility and test files may exist in the actual implementation.

---

## 12. Threat Analysis and AI Usage

### THREATS.md

The `THREATS.md` file documents identified security threats, implemented mitigations, accepted risks, and security improvements that remain outstanding.

### PROMPTS.md

The `PROMPTS.md` file documents representative AI-assisted development interactions, identified mistakes, corrections, implementation decisions, and related test evidence.

These documents are included to make the development process and security decisions transparent.

---

## 13. Future Enhancements

Possible future improvements include:

- Pagination and filtering for transaction history.
- Frontend dashboard.
- Transaction notifications.
- Transaction export and downloadable statements.
- Rate limiting and additional security monitoring.
- Refresh-token management and token revocation.
- Integration with real payment gateways or banking APIs.
- Cloud deployment.
- Production monitoring, backups, and disaster recovery.

These are future improvements and should not be considered implemented features.

---

## 14. Deployment and Demo

**Deployment status:** Add the actual public backend URL after deployment.

**Demo video:** Add the five-minute demonstration video link after recording and uploading it.

The project can currently be tested locally using the setup instructions in this README.

---

## 15. Disclaimer

LedgerLine is an educational and demonstration project.

It uses simulated deposit and withdrawal clearing accounts and is not connected to real banking infrastructure.

It should not be used to manage real customer funds without substantial additional security, compliance, operational, and financial-system engineering.

---

## 16. Author

**Project:** LedgerLine

**GitHub Repository:**
https://github.com/rishiyasmin/LedgerLine
---
*LedgerLine â€“ Building secure, reliable, and consistent money movement systems.*
