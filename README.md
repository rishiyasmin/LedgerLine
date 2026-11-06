# LedgerLine – Secure Money Movement Backend

A secure money-movement backend built using **Node.js, Express.js, and PostgreSQL**. LedgerLine provides account management, deposits, withdrawals, transfers, transaction history, role-based access control, and double-entry ledger accounting.

> LedgerLine is a backend-focused financial transaction management project. Deposits and withdrawals use simulated internal clearing accounts; they do not connect to real banking or payment networks.

## 1. Project Overview

LedgerLine is designed to demonstrate how a secure financial transaction system can manage money movements while maintaining data consistency, transaction integrity, and accountability.

### Key Features

- User registration and login.
- JWT-based authentication.
- Role-based access control.
- Customer account creation and management.
- Deposit and withdrawal operations.
- Account-to-account money transfers.
- Double-entry ledger accounting.
- Idempotency protection against duplicate transactions.
- Admin user management and account permissions.
- Transaction history.
- Audit logging.
- Database transactions and row-level locking.
- Automated API tests.

## 2. Technology Stack

| Component | Technology |
|---|---|
| Runtime | Node.js |
| Backend framework | Express.js |
| Database | PostgreSQL |
| Database driver | node-postgres (`pg`) |
| Authentication | JSON Web Token (JWT) |
| Password hashing | bcrypt |
| Input validation | Zod / application-level validation |
| Security middleware | Helmet, CORS |
| Testing | Jest, Supertest |
| API testing | Thunder Client |
| Development | Nodemon |
| Version control | Git and GitHub |

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
       +------------+------------+
       |            |            |
       v            v            v
     Users       Accounts    Transactions
                                |
                                v
                         Ledger Entries
                                |
                         +------+------+
                         |             |
                         v             v
                     Audit Logs   Idempotency
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

**Database**
- Store users, accounts, transactions, ledger entries, permissions, and audit records.
- Enforce database constraints and transaction integrity.

## 4. User Roles

LedgerLine supports three user roles.

| Role | Description |
|---|---|
| `admin` | Manage users and account permissions |
| `account_holder` | Create accounts and perform permitted money operations |
| `auditor` | View permitted accounts and transaction information |

Public registration creates an `account_holder` account. Administrative privileges are not assigned through public registration.

## 5. Database Schema

The PostgreSQL database contains the following main tables.

| Table | Purpose |
|---|---|
| `users` | Stores user details, email, password hash, role, and account status |
| `accounts` | Stores account details, account type, currency, balance, and status |
| `account_permissions` | Defines user-level permissions for individual accounts |
| `transactions` | Stores transaction information and status |
| `ledger_entries` | Records debit and credit entries for financial transactions |
| `idempotency_keys` | Prevents duplicate transaction processing |
| `audit_logs` | Records administrative and financial actions |
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

### Double-Entry Accounting

LedgerLine uses double-entry accounting to maintain transaction consistency.

Every posted transaction must contain balanced debit and credit entries.

For example, a ₹25 transfer:

| Account | Entry | Amount |
|---|---|---:|
| Sender account | Debit | ₹25 |
| Receiver account | Credit | ₹25 |
| **Total** | **Balanced** | **₹25 = ₹25** |

Balances are updated within the same database transaction as the ledger entries.

Amounts are stored in paise using PostgreSQL `BIGINT` to avoid floating-point currency calculations.

## 6. API Endpoints

Base URL:

```text
http://localhost:5000
```

### Health Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health` | Check server health |
| GET | `/api/health/db` | Check database connectivity |

### Authentication

| Method | Endpoint | Description | Access |
|---|---|---|---|
| POST | `/api/auth/register` | Register a new user | Public |
| POST | `/api/auth/login` | Authenticate a user | Public |

### Account Management

| Method | Endpoint | Description | Access |
|---|---|---|---|
| POST | `/api/accounts` | Create an account | Account holder |
| GET | `/api/accounts` | List permitted accounts | Authenticated |
| GET | `/api/accounts/:accountId` | View account details | Authenticated |
| GET | `/api/accounts/:accountId/balance` | View account balance | Authenticated |

### Money Operations

| Method | Endpoint | Description | Access |
|---|---|---|---|
| POST | `/api/accounts/:accountId/deposits` | Deposit money | Account holder |
| POST | `/api/accounts/:accountId/withdrawals` | Withdraw money | Account holder |
| POST | `/api/accounts/:accountId/transfers` | Transfer money | Account holder |

Deposit, withdrawal, and transfer requests require an `Idempotency-Key` header.

### Transaction History

| Method | Endpoint | Description | Access |
|---|---|---|---|
| GET | `/api/accounts/:accountId/transactions` | Retrieve account transaction history | Authenticated |

### Admin Management

| Method | Endpoint | Description | Access |
|---|---|---|---|
| GET | `/api/admin/users` | List users | Admin |
| PATCH | `/api/admin/users/:userId/status` | Update user status | Admin |
| GET | `/api/admin/accounts/:accountId/permissions` | View account permissions | Admin |
| PUT | `/api/admin/accounts/:accountId/permissions/:userId` | Update account permissions | Admin |

## 7. Installation and Setup

### Prerequisites

Install the following:

- Node.js
- npm
- PostgreSQL
- Git
- VS Code (recommended)

### Step 1: Clone the Repository

```bash
git clone https://github.com/rishiy asmin/LedgerLine.git
```

If your GitHub repository URL differs, use its actual clone URL.

```bash
cd LedgerLine/backend
```

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Configure PostgreSQL

Create the development database:

```sql
CREATE DATABASE ledgerline_db;
```

Apply the project's database schema from:

```text
backend/database/schema.sql
```

Use the SQL file provided in the repository.

### Step 4: Configure Environment Variables

Create a `.env` file inside the `backend` directory.

```env
PORT=5000
NODE_ENV=development

DATABASE_URL=postgresql://USERNAME:PASSWORD@localhost:5432/ledgerline_db

JWT_SECRET=YOUR_LONG_RANDOM_SECRET
JWT_EXPIRES_IN=1h
```

Use the database connection variable names expected by your `src/config/db.js`. If your configuration uses individual PostgreSQL variables instead of `DATABASE_URL`, configure those variables accordingly.

**Important:** Never commit `.env` files, database passwords, JWT secrets, or other credentials to GitHub.

### Step 5: Start the Backend

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

## 9. Security and Transaction Integrity

LedgerLine implements several security and consistency mechanisms.

### JWT Authentication
Protected routes require a valid JWT.

### Role-Based Access Control
Users can access functionality according to their assigned roles.

### Account-Level Permissions
Individual account permissions control operations such as viewing, depositing, withdrawing, and transferring.

### Password Hashing
Passwords are hashed using bcrypt before storage.

### Idempotency
Each money operation requires an idempotency key. Repeated requests with the same key and same request data return the stored result instead of processing the transaction again.

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

## 10. Testing

LedgerLine uses Jest and Supertest for automated testing.

Run the test suite:

```bash
npm test
```

The project includes tests for areas such as:

- Health endpoints.
- Authentication and authorization.
- Account permissions.
- Deposits and withdrawals.
- Idempotency.
- Concurrent withdrawals.
- Double-entry accounting.
- Ledger and audit record protections.

The test environment uses a separate PostgreSQL database named `ledgerline_test_db`.

Ensure the test database is configured before running tests. Never run destructive test setup against the development database.

## 11. Project Structure

```text
LedgerLine/
│
├── backend/
│   ├── database/
│   │   └── schema.sql
│   │
│   ├── src/
│   │   ├── config/
│   │   │   └── db.js
│   │   │
│   │   ├── controllers/
│   │   │   ├── accountController.js
│   │   │   ├── adminController.js
│   │   │   └── authController.js
│   │   │
│   │   ├── middleware/
│   │   │   ├── authMiddleware.js
│   │   │   └── roleMiddleware.js
│   │   │
│   │   ├── routes/
│   │   │   ├── accountRoutes.js
│   │   │   ├── adminRoutes.js
│   │   │   └── authRoutes.js
│   │   │
│   │   ├── services/
│   │   │   └── accountService.js
│   │   │
│   │   ├── app.js
│   │   └── server.js
│   │
│   ├── tests/
│   │   ├── health.test.js
│   │   ├── rbac.test.js
│   │   └── transactions.test.js
│   │
│   ├── .env
│   ├── .env.test
│   └── package.json
│
├── README.md
└── .gitignore
```

This structure describes the main project organization; additional test and utility files may also exist.

## 12. Future Enhancements

Possible future improvements include:

- Pagination and filtering for transaction history.
- Frontend dashboard.
- Transaction notifications.
- Transaction export and downloadable statements.
- Rate limiting and additional security monitoring.
- Integration with real payment gateways or banking APIs.
- Deployment to a cloud environment.

## 13. Disclaimer

LedgerLine is an educational and demonstration project. It uses simulated deposit and withdrawal clearing accounts and is not connected to real banking infrastructure. It should not be used to manage real customer funds without substantial additional security, compliance, operational, and financial-system engineering.

## 14. Author

**Project:** LedgerLine  
**GitHub:** [rishiyasmin](https://github.com/rishiyasmin)

---

*LedgerLine – Building secure, reliable, and consistent money movement systems.*