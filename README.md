# LedgerLine -- Secure Money Movement System

A full-stack money-movement application demonstrating secure account
operations, role-based access control, double-entry ledger accounting,
transaction integrity, and auditability.

**Live application:** https://frontend-xi-plum-29.vercel.app\
**Backend API:** https://ledgerline-backend-y3h0.onrender.com\
**GitHub repository:** https://github.com/rishiyasmin/LedgerLine

> **Disclaimer:** LedgerLine is an educational and demonstration
> project. Deposits and withdrawals use simulated internal clearing
> accounts. The application is not connected to real banking or payment
> networks and must not be used to manage real customer funds.

------------------------------------------------------------------------

## 1. Project Overview

LedgerLine demonstrates how a financial transaction system can manage
account operations while maintaining data consistency, transaction
integrity, security, and accountability.

### Key Features

-   User registration and login.
-   JWT-based authentication.
-   Role-based access control with Admin, Account Holder, and Auditor
    roles.
-   Account creation and account management through the backend API.
-   Deposits, withdrawals, and account-to-account transfers.
-   Double-entry ledger accounting.
-   Idempotency protection against duplicate money operations.
-   Prevention of negative account balances.
-   Database transactions and row-level locking for financial
    operations.
-   Account-level permissions.
-   Transaction history, including recorded rejected and failed
    attempts.
-   Audit logging.
-   Automated API and transaction-integrity tests.
-   React-based web interface connected to the deployed backend.

## 2. Technology Stack

  Component             Technology
  --------------------- --------------------------------------
  Frontend              React, Vite
  Frontend routing      React Router
  API communication     Axios
  UI icons              lucide-react
  Backend runtime       Node.js
  Backend framework     Express.js
  Database              PostgreSQL
  Database driver       node-postgres (`pg`)
  Authentication        JSON Web Token (JWT)
  Password hashing      bcrypt
  Input validation      Zod and application-level validation
  Security middleware   Helmet, CORS
  Backend testing       Jest, Supertest
  API testing           Thunder Client
  Development           Nodemon
  Version control       Git and GitHub
  Frontend hosting      Vercel
  Backend hosting       Render
  Database hosting      Neon

## 3. Live Deployment

  ------------------------------------------------------------------------------------------------
  Component                           URL
  ----------------------------------- ------------------------------------------------------------
  Web application                     https://frontend-xi-plum-29.vercel.app

  Backend API                         https://ledgerline-backend-y3h0.onrender.com

  Backend health check                https://ledgerline-backend-y3h0.onrender.com/api/health

  Database health check               https://ledgerline-backend-y3h0.onrender.com/api/health/db

  GitHub repository                   https://github.com/rishiyasmin/LedgerLine
  ------------------------------------------------------------------------------------------------

The frontend is deployed on Vercel, the Express backend is deployed on
Render, and PostgreSQL is hosted on Neon. The backend uses environment
variables for database credentials, JWT configuration, and the permitted
frontend origin.

**Deployment note:** The backend currently uses Render's free service
tier. After a period of inactivity, the service may take some time to
start responding to the first request.

## 4. System Architecture

LedgerLine uses a React frontend and a layered Express backend.

``` text
                   USER
                    |
                    v
          REACT + VITE FRONTEND
           (Browser application)
                    |
               Axios / HTTP
                    |
                    v
             EXPRESS SERVER
                    |
                    v
                API ROUTES
                    |
                    v
                MIDDLEWARE
          JWT Authentication / Roles
                    |
                    v
               CONTROLLERS
          Request handling / responses
                    |
                    v
                 SERVICES
       Business rules / transaction logic
                    |
                    v
              POSTGRESQL
                    |
       +------------+-------------+
       |            |             |
       v            v             v
     Users       Accounts     Transactions
                                  |
                                  v
                             Ledger Entries
                                  |
                       +----------+----------+
                       |                     |
                       v                     v
                   Audit Logs          Idempotency Keys
```

### Architecture Responsibilities

-   **Frontend:** Provides the browser interface for authentication,
    account overview, and available account actions.
-   **Routes:** Define API endpoints and connect requests to controllers
    with the required middleware.
-   **Middleware:** Verifies JWTs and applies role-based access
    restrictions.
-   **Controllers:** Handle requests, validation, service calls, and
    HTTP responses.
-   **Services:** Implement business rules, account permissions, money
    operations, and database transaction handling.
-   **Database:** Stores users, accounts, permissions, transactions,
    ledger entries, idempotency records, audit logs, and transaction
    attempts.

## 5. User Roles and Permissions

LedgerLine supports three roles.

  -----------------------------------------------------------------------
  Role                                Capabilities
  ----------------------------------- -----------------------------------
  `admin`                             Administrative user management and
                                      account-permission management

  `account_holder`                    Create accounts and perform money
                                      operations permitted for their
                                      accounts

  `auditor`                           View permitted accounts, balances,
                                      and transaction information; cannot
                                      perform money operations
  -----------------------------------------------------------------------

Public registration always creates an `account_holder`. Administrative
and auditor roles are not selectable through public registration.

### Account-Level Permissions

The system supports:

-   `can_view`
-   `can_deposit`
-   `can_withdraw`
-   `can_transfer`
-   `can_adjust`

The backend checks role and account-level permissions when protected
operations are requested. The frontend may present different actions
according to the user's role, but backend authorization is the security
boundary.

## 6. Database Schema

The PostgreSQL schema contains eight main tables.

  -----------------------------------------------------------------------
  Table                               Purpose
  ----------------------------------- -----------------------------------
  `users`                             User details, password hashes,
                                      roles, and account status

  `accounts`                          Account details, currency, balance,
                                      and status

  `account_permissions`               User permissions for individual
                                      accounts

  `transactions`                      Transaction information and status

  `ledger_entries`                    Debit and credit entries

  `idempotency_keys`                  Prevents duplicate transaction
                                      processing

  `audit_logs`                        Records important administrative
                                      and financial actions

  `transaction_attempts`              Records successful, rejected, and
                                      failed transaction attempts
  -----------------------------------------------------------------------

The schema, constraints, triggers, and database permissions are defined
in `backend/database/schema.sql`.

### 6.1 Double-Entry Accounting

Every posted transaction must contain balanced debit and credit entries.

Example: an internal transfer of ₹25.

  Account            Entry                   Amount
  ------------------ -------------- ---------------
  Sender account     Debit                      ₹25
  Receiver account   Credit                     ₹25
  **Total**          **Balanced**     **₹25 = ₹25**

Balances are updated in the same database transaction as the
corresponding ledger entries. Amounts are stored in paise using
PostgreSQL `BIGINT` to avoid floating-point currency calculations.

### 6.2 Deposits, Withdrawals, and Transfers

-   **Deposit:** Credits the customer account and debits a simulated
    deposit clearing account.
-   **Withdrawal:** Debits the customer account and credits a simulated
    withdrawal clearing account.
-   **Transfer:** Debits the source account and credits the destination
    account.

Transfers are atomic: both sides succeed together or are rolled back
together. Deposits and withdrawals are simulated and do not connect to
external payment systems.

### 6.3 Transaction Integrity

The backend uses PostgreSQL transactions, account-row locking,
idempotency keys, database constraints, balanced ledger entries, and
database protections on ledger records. These controls help prevent
duplicate processing, negative balances, and inconsistent financial
records.

## 7. API Endpoints

**Production API base URL:**

``` text
https://ledgerline-backend-y3h0.onrender.com
```

For local development, use `http://localhost:5000`.

Protected endpoints require:

``` text
Authorization: Bearer YOUR_JWT_TOKEN
```

### 7.1 Health

  Method   Endpoint           Description                   Access
  -------- ------------------ ----------------------------- --------
  GET      `/api/health`      Check server health           Public
  GET      `/api/health/db`   Check database connectivity   Public

### 7.2 Authentication

  ----------------------------------------------------------------------------
  Method            Endpoint               Description       Access
  ----------------- ---------------------- ----------------- -----------------
  POST              `/api/auth/register`   Register a new    Public
                                           account-holder    
                                           user              

  POST              `/api/auth/login`      Authenticate and  Public
                                           receive a JWT     
  ----------------------------------------------------------------------------

### 7.3 Accounts

  -----------------------------------------------------------------------------------------------
  Method            Endpoint                                  Description       Access
  ----------------- ----------------------------------------- ----------------- -----------------
  POST              `/api/accounts`                           Create a customer Account Holder
                                                              account           

  GET               `/api/accounts`                           List permitted    Authenticated
                                                              accounts          roles, subject to
                                                                                permissions

  GET               `/api/accounts/:accountId`                View account      Authenticated
                                                              details           roles, subject to
                                                                                view permission

  GET               `/api/accounts/:accountId/balance`        View account      Authenticated
                                                              balance           roles, subject to
                                                                                view permission

  GET               `/api/accounts/:accountId/transactions`   View transaction  Authenticated
                                                              history           roles, subject to
                                                                                view permission
  -----------------------------------------------------------------------------------------------

### 7.4 Money Operations

All money operations require authentication, the account-holder role,
the relevant account-level permission, and an `Idempotency-Key` header.

  ----------------------------------------------------------------------------------------------
  Method            Endpoint                                 Required          Money effect
                                                             permission        
  ----------------- ---------------------------------------- ----------------- -----------------
  POST              `/api/accounts/:accountId/deposits`      `can_deposit`     Credits customer
                                                                               account; debits
                                                                               simulated deposit
                                                                               clearing

  POST              `/api/accounts/:accountId/withdrawals`   `can_withdraw`    Debits customer
                                                                               account; credits
                                                                               simulated
                                                                               withdrawal
                                                                               clearing

  POST              `/api/accounts/:accountId/transfers`     `can_transfer`    Debits source
                                                                               account; credits
                                                                               destination
                                                                               account
  ----------------------------------------------------------------------------------------------

Example deposit body:

``` json
{
  "amount_rupees": "100.00"
}
```

Example withdrawal body:

``` json
{
  "amount_rupees": "20.00"
}
```

Example transfer body:

``` json
{
  "target_account_id": "DESTINATION_ACCOUNT_UUID",
  "amount_rupees": "25.00"
}
```

Example headers:

``` text
Authorization: Bearer YOUR_JWT_TOKEN
Idempotency-Key: unique-request-key-001
Content-Type: application/json
```

Amounts are supplied as rupee strings and stored internally as paise.

### 7.5 Admin Management

All endpoints below require an authenticated admin.

  ------------------------------------------------------------------------------------------------------
  Method                  Endpoint                                               Description
  ----------------------- ------------------------------------------------------ -----------------------
  GET                     `/api/admin/users`                                     List users

  PATCH                   `/api/admin/users/:userId/status`                      Update user status

  GET                     `/api/admin/accounts/:accountId/permissions`           View account
                                                                                 permissions

  PUT                     `/api/admin/accounts/:accountId/permissions/:userId`   Update account
                                                                                 permissions
  ------------------------------------------------------------------------------------------------------

### 7.6 Important HTTP Status Codes

  Status   Meaning
  -------- ---------------------------------------------------------
  200      Request successful
  201      Resource created
  400      Invalid request data
  401      Missing or invalid authentication
  403      Insufficient role or account permission
  404      Resource not found or access denied
  409      Conflict, insufficient balance, or idempotency conflict
  500      Unexpected server error

## 8. Installation and Local Setup

### Prerequisites

-   Node.js and npm
-   PostgreSQL
-   Git
-   VS Code (recommended)

### Step 1: Clone the repository

``` bash
git clone https://github.com/rishiyasmin/LedgerLine.git
cd LedgerLine
```

### Step 2: Install backend dependencies

``` bash
cd backend
npm install
```

### Step 3: Create PostgreSQL databases and application role

Using a PostgreSQL administrator account, create an application role and
separate development and test databases. Adjust names if you already
have equivalent databases.

``` sql
CREATE ROLE ledgerline_app LOGIN PASSWORD 'SET_A_STRONG_DATABASE_PASSWORD';

CREATE DATABASE ledgerline_db;
CREATE DATABASE ledgerline_test_db;

GRANT CONNECT ON DATABASE ledgerline_db TO ledgerline_app;
GRANT CONNECT ON DATABASE ledgerline_test_db TO ledgerline_app;
```

Apply the schema to both databases as the database owner or
administrator:

``` bash
psql -U postgres -d ledgerline_db -f database/schema.sql
psql -U postgres -d ledgerline_test_db -f database/schema.sql
```

The schema defines the application tables, indexes, integrity
constraints, triggers, and application-role permissions.

### Step 4: Configure environment variables

Create `backend/.env` using this structure:

``` env
PORT=5000
NODE_ENV=development

DB_HOST=localhost
DB_PORT=5432
DB_NAME=ledgerline_db
DB_USER=ledgerline_app
DB_PASSWORD=YOUR_DATABASE_PASSWORD
DB_SSL=false

JWT_SECRET=YOUR_LONG_RANDOM_SECRET

SEED_ADMIN_PASSWORD=YOUR_DEMO_ADMIN_PASSWORD
SEED_CUSTOMER_PASSWORD=YOUR_DEMO_CUSTOMER_PASSWORD
SEED_AUDITOR_PASSWORD=YOUR_DEMO_AUDITOR_PASSWORD
```

Use strong, different passwords. For a hosted PostgreSQL database, set
the appropriate host, credentials, and SSL setting supplied by the
database provider.

The repository includes `backend/.env.example` as a template. Never
commit `.env`, `.env.test`, database passwords, JWT secrets, tokens, or
other credentials.

### Step 5: Seed demo users and accounts

From the `backend` directory:

``` bash
node database/seed.js
```

The seed script creates demo users for the administrator, customer, and
auditor roles, along with simulated clearing accounts and a demo
customer account. Passwords are supplied through environment variables
rather than hardcoded in the seed script.

Demo email addresses:

-   `demo-admin@ledgerline.local`
-   `customer@ledgerline.local`
-   `auditor@ledgerline.local`

The corresponding passwords are the values configured in
`SEED_ADMIN_PASSWORD`, `SEED_CUSTOMER_PASSWORD`, and
`SEED_AUDITOR_PASSWORD`. Do not assume a public password; use the values
configured for your own environment.

### Step 6: Start the backend

Development mode:

``` bash
npm run dev
```

Production-style start:

``` bash
npm start
```

The backend listens on the configured port (5000 by default).

### Step 7: Install and start the frontend

Open a second terminal:

``` bash
cd frontend
npm install
```

Create `frontend/.env` and set the API base URL:

``` env
VITE_API_BASE_URL=http://localhost:5000/api
```

Start the Vite development server:

``` bash
npm run dev
```

Open the local URL printed by Vite, normally `http://localhost:5173`.

For a production frontend build:

``` bash
npm run build
```

### Step 8: Configure the test environment

Configure `backend/.env.test` to use the separate `ledgerline_test_db`
database and a test JWT secret. The test environment must never use the
development or production database.

### Step 9: Run backend tests

From the `backend` directory:

``` bash
npm test
```

## 9. Security and Transaction Integrity

LedgerLine implements the following controls:

-   **JWT authentication:** Protected routes require a valid token.
-   **Role-based access control:** Backend routes restrict operations
    according to the authenticated user's role.
-   **Account-level permissions:** Individual account permissions
    control viewing and money operations.
-   **Password hashing:** Passwords are hashed using bcrypt before
    storage.
-   **Input validation:** Request data is validated before business
    operations.
-   **Idempotency:** Money operations require an idempotency key.
    Repeating a request with the same key and request data does not
    process the transaction again; conflicting reuse is rejected.
-   **Database transactions:** Related financial changes are committed
    or rolled back together.
-   **Row-level locking:** Account rows are locked during financial
    operations to help prevent concurrent balance inconsistencies.
-   **Double-entry ledger:** Posted financial transactions must have
    balanced debit and credit entries.
-   **Audit logging:** Important actions are recorded for
    accountability.
-   **Append-only protections:** Database protections restrict updates
    and deletes to ledger and audit records.

These controls are project-level security measures, not a claim of
certification or a substitute for an independent security audit.

## 10. Testing

LedgerLine uses Jest and Supertest for backend automated tests.

Run:

``` bash
cd backend
npm test
```

The test suite covers areas including:

-   Health endpoints.
-   Authentication and authorization.
-   Account permissions.
-   Successful deposits and withdrawals.
-   Successful transfers.
-   Double-entry ledger verification.
-   Duplicate-request idempotency.
-   Idempotency key reuse with different request data.
-   Insufficient-balance protection.
-   Concurrent withdrawal and transfer protection.
-   Unauthorized transfer protection.
-   Customer money conservation.
-   Account balance reconciliation.
-   Ledger update and delete protection.

**Previously verified result:** 23 tests passed across 3 test suites.
Run `npm test` against your current checkout to verify the current
repository state. The test environment must use a separate PostgreSQL
test database.

## 11. Project Structure

The repository is organized into backend and frontend applications. The
main backend structure is:

``` text
LedgerLine/
├── backend/
│   ├── database/
│   │   ├── schema.sql
│   │   └── seed.js
│   ├── src/
│   │   ├── config/
│   │   │   └── db.js
│   │   ├── controllers/
│   │   │   ├── accountController.js
│   │   │   ├── adminController.js
│   │   │   └── authController.js
│   │   ├── middleware/
│   │   │   ├── authMiddleware.js
│   │   │   └── roleMiddleware.js
│   │   ├── routes/
│   │   │   ├── accountRoutes.js
│   │   │   ├── adminRoutes.js
│   │   │   └── authRoutes.js
│   │   ├── services/
│   │   │   └── accountService.js
│   │   ├── app.js
│   │   └── server.js
│   ├── tests/
│   │   ├── health.test.js
│   │   ├── rbac.test.js
│   │   ├── transactions.test.js
│   │   └── load-env.js
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── services/
│   │   ├── App.jsx
│   │   └── Dashboard.jsx
│   ├── package.json
│   └── vite.config.js
├── README.md
├── THREATS.md
├── PROMPTS.md
└── .gitignore
```

This is a high-level view of the main files; additional components,
styles, configuration, and utility files may exist in the repository.
The `.env` and `.env.test` files are intentionally excluded from version
control.

## 12. Threat Analysis and AI Usage

### `THREATS.md`

Documents identified security threats, implemented mitigations, accepted
risks, and security improvements that remain outstanding.

### `PROMPTS.md`

Documents representative AI-assisted development interactions,
implementation decisions, identified mistakes, corrections, and related
test evidence.

These documents are included to make the development process and
security decisions transparent.

## 13. Future Enhancements

Potential future improvements include:

-   Pagination and filtering for transaction history.
-   Transaction notifications.
-   Transaction export and downloadable statements.
-   Rate limiting and additional security monitoring.
-   Refresh-token management and token revocation.
-   Independent security review and penetration testing.
-   Production monitoring, backups, and disaster recovery.
-   Integration with real payment gateways or banking APIs, subject to
    the required security and compliance work.

These are potential enhancements and should not be considered
implemented features.

## 14. Demo Guidance

Use the deployed web application:

https://frontend-xi-plum-29.vercel.app

Use the demo email addresses listed in the setup section and the
corresponding passwords configured in the deployment environment. Do not
publish passwords, JWT tokens, database credentials, or other secrets in
this repository or in a public demo.

Suggested demonstration flow:

1.  Sign in as an account holder and show the account overview.
2.  Demonstrate a deposit and withdrawal using simulated clearing
    accounts.
3.  Demonstrate a transfer between accounts and show the updated
    balances.
4.  Open transaction history.
5.  Sign in as an auditor and demonstrate view-only access.
6.  Attempt a restricted money operation as an auditor and show that the
    backend rejects it.
7.  Explain the admin role, account permissions, double-entry ledger,
    idempotency, and audit trail.

A demo video link can be added here after it has been recorded and
uploaded.

## 15. Disclaimer

LedgerLine is an educational and demonstration project. Deposits and
withdrawals use simulated clearing accounts. The application is not
connected to real banking infrastructure or payment networks.

It should not be used to manage real customer funds without substantial
additional security, compliance, operational, and financial-system
engineering.

## 16. Author and Repository

**Project:** LedgerLine\
**GitHub repository:** https://github.com/rishiyasmin/LedgerLine\
**Live application:** https://frontend-xi-plum-29.vercel.app

------------------------------------------------------------------------

*LedgerLine -- Building secure, reliable, and consistent money movement
systems.*
