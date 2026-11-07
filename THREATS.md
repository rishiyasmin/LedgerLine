# LedgerLine – Security Threats and Mitigation

## 1. Overview

LedgerLine is a money-movement backend built using Node.js, Express.js, and PostgreSQL.

It handles user authentication, account permissions, deposits, withdrawals, internal transfers, transaction records, and audit information.

Since financial applications require strong integrity and access controls, this document identifies potential threats, their impact, the protections implemented in LedgerLine, and improvements that remain necessary.

## 2. Identified Security Threats

### 2.1 Unauthorized Access

**Threat:**  
An attacker may attempt to access protected APIs without valid authentication credentials.

**Possible Impact:**
- Unauthorized account access.
- Exposure of financial information.
- Unauthorized transaction attempts.

**Implemented Mitigations:**
- JWT-based authentication.
- Authentication middleware on protected routes.
- JWT expiration.
- Role-based authorization.

**Remaining Risk:**  
A stolen, unexpired JWT may still be used by an attacker. Token revocation and refresh-token management are not currently implemented.

### 2.2 Broken Access Control

**Threat:**  
A user may manipulate account IDs or API requests to access another user's account.

**Possible Impact:**
- Unauthorized account viewing.
- Unauthorized withdrawals or transfers.
- Exposure of transaction history.

**Implemented Mitigations:**
- Account-level permissions.
- Role-based authorization.
- Permission checks before financial operations.
- Account ownership and access validation.
- Protected administrative permission-management endpoints.

**Testing Evidence:**  
An automated test verifies that one customer cannot transfer money from another customer's account.

### 2.3 Duplicate Transaction Attacks

**Threat:**  
A client may submit the same financial request multiple times because of network retries, repeated clicks, or malicious activity.

**Possible Impact:**
- Duplicate deposits.
- Duplicate withdrawals.
- Duplicate transfers.
- Incorrect account balances.

**Implemented Mitigations:**
- Client-provided idempotency keys.
- SHA-256 request hashing.
- Database uniqueness constraints on user and idempotency key.
- Duplicate request detection.
- Stored responses for completed requests.
- Database transactions for atomic processing.

**Testing Evidence:**
- Duplicate deposit requests return the original result.
- Reusing a key with different request data is rejected.
- Duplicate transfer requests do not move money twice.

### 2.4 Race Conditions and Concurrent Transactions

**Threat:**  
Multiple requests may execute simultaneously against the same account balance.

**Possible Impact:**
- Double spending.
- Incorrect account balances.
- Unauthorized overdrafts.
- Inconsistent ledger records.

**Implemented Mitigations:**
- PostgreSQL database transactions.
- Row-level locking using `SELECT ... FOR UPDATE`.
- Consistent account-locking order during transfers.
- Balance validation while holding account locks.
- Atomic ledger and balance updates.

**Testing Evidence:**
- Concurrent withdrawal test verifies that two withdrawals cannot spend the same available balance.
- Concurrent transfer test verifies that two transfers cannot overdraw the source account.

### 2.5 SQL Injection

**Threat:**  
An attacker may submit malicious SQL input through API parameters or request bodies.

**Possible Impact:**
- Unauthorized database access.
- Data modification.
- Data exposure.
- Database destruction.

**Implemented Mitigations:**
- Parameterized PostgreSQL queries.
- Input validation.
- Restricted application database privileges.
- Avoiding direct insertion of untrusted input into SQL statements.

**Remaining Risk:**  
Database privileges and SQL query construction must continue to be reviewed as new endpoints are introduced.

### 2.6 Password Theft

**Threat:**  
User passwords may be exposed through insecure storage or credential attacks.

**Possible Impact:**
- Account takeover.
- Unauthorized transactions.
- Exposure of user information.

**Implemented Mitigations:**
- bcrypt password hashing.
- Password hashes stored instead of plaintext passwords.
- Password verification during login.
- Passwords are not returned in authentication responses.

**Remaining Risk:**  
Password-reset workflows, stronger account protection, and production credential policies require further review.

### 2.7 JWT Theft and Token Abuse

**Threat:**  
An attacker may steal a valid JWT and use it to access protected endpoints.

**Possible Impact:**
- Account impersonation.
- Unauthorized API requests.
- Financial operations performed under another user's identity.

**Implemented Mitigations:**
- JWT signing using an environment-configured secret.
- Token expiration.
- Authentication middleware verifies incoming tokens.
- Secrets are kept outside source code.

**Remaining Risk:**
- Refresh-token management is not implemented.
- Token revocation is not implemented.
- Secure production client-side token storage requires further review.
- HTTPS must be configured for deployment.

### 2.8 Insufficient Balance and Overdraft Attacks

**Threat:**  
An attacker may attempt withdrawals or transfers exceeding the available account balance.

**Possible Impact:**
- Negative customer account balances.
- Financial inconsistencies.
- Unauthorized money movement.

**Implemented Mitigations:**
- Balance validation before withdrawals and transfers.
- Row-level account locking.
- Database balance constraints.
- Atomic balance updates.
- Customer account overdraft prevention.

**Testing Evidence:**
- Insufficient-balance withdrawal is rejected.
- Concurrent withdrawals cannot overdraw the account.
- Concurrent transfers cannot overdraw the source account.

### 2.9 Ledger Tampering

**Threat:**  
An attacker or unauthorized database user may attempt to modify or delete financial ledger records.

**Possible Impact:**
- Financial record manipulation.
- Incorrect transaction history.
- Loss of accountability.

**Implemented Mitigations:**
- Append-only protections on ledger entries.
- Database triggers that reject ledger modifications and deletions.
- Restricted database privileges.
- Double-entry accounting.
- Database constraints validating posted transaction entries.

**Testing Evidence:**
- Automated tests verify that existing ledger entries cannot be updated or deleted.
- Double-entry tests verify equal debit and credit amounts for a posted deposit.

**Remaining Risk:**  
Privileged database administrators may still have capabilities beyond the application's permissions. Production systems require stronger operational controls and independent backups.

### 2.10 Denial of Service (DoS)

**Threat:**  
An attacker may send excessive requests to overload the backend or database.

**Possible Impact:**
- API unavailability.
- Database resource exhaustion.
- Interrupted financial operations.

**Current Controls:**
- PostgreSQL connection pooling.
- Database connection timeout configuration.
- Request validation.
- Helmet security headers.

**Not Yet Implemented or Verified:**
- API rate limiting.
- Distributed denial-of-service protection.
- Centralized security monitoring.
- Production alerting.

### 2.11 Privilege Escalation

**Threat:**  
A normal user may attempt to obtain administrator privileges or modify protected permissions.

**Possible Impact:**
- Unauthorized user management.
- Account permission manipulation.
- Administrative access.

**Implemented Mitigations:**
- Public registration assigns the `account_holder` role.
- Administrative endpoints require administrator authorization.
- Account permissions are managed through protected endpoints.
- Administrative actions are recorded in audit logs.
- Administrative protections include restrictions against deactivating the last active administrator.

### 2.12 Sensitive Information Exposure

**Threat:**  
Sensitive information may accidentally be exposed through API responses, application logs, screenshots, or repository files.

**Possible Impact:**
- Credential theft.
- Database compromise.
- Unauthorized account access.

**Implemented Mitigations:**
- Password hashes are not returned in API responses.
- Environment variables are used for secrets.
- `.env` files are excluded from Git.
- Database credentials are not hardcoded in application source.

**Remaining Risk:**  
Production logs, screenshots, deployment configuration, and repository history must be reviewed for accidental exposure.

## 3. Security Controls Implemented

| Security Control | Purpose |
|---|---|
| JWT Authentication | Protects authenticated APIs |
| Role-Based Access Control | Restricts operations by user role |
| Account-Level Permissions | Controls individual account operations |
| bcrypt | Password hashing |
| Parameterized SQL Queries | Reduces SQL injection risk |
| Idempotency Keys | Prevents duplicate processing |
| SHA-256 Request Hashing | Detects mismatched request reuse |
| PostgreSQL Transactions | Maintains transaction atomicity |
| Row-Level Locking | Protects concurrent financial operations |
| Double-Entry Accounting | Records balanced debit and credit entries |
| Database Constraints | Enforces financial data integrity |
| Append-Only Protections | Prevents ledger record modification and deletion |
| Audit Logging | Supports accountability |
| Helmet | Adds HTTP security headers |
| Connection Pooling | Manages database connections |

## 4. Security Testing and Evidence

The automated integration tests currently cover the following scenarios:

| Test Scenario | Expected Result |
|---|---|
| Successful deposit | Money is credited correctly |
| Successful withdrawal | Money is debited correctly |
| Double-entry deposit | Total debit equals total credit |
| Ledger UPDATE attempt | Database operation rejected |
| Ledger DELETE attempt | Database operation rejected |
| Duplicate deposit | Original result returned |
| Idempotency key reused with different data | HTTP 409 |
| Insufficient-balance withdrawal | HTTP 409 |
| Concurrent withdrawals | Only affordable withdrawals succeed |
| Account balance reconciliation | Account balance matches ledger |
| Successful internal transfer | Source and destination balances update |
| Duplicate transfer | Money moves only once |
| Concurrent transfers | Source account is not overdrawn |
| Unauthorized transfer | HTTP 403 |
| Internal transfer conservation | Total customer balance remains unchanged |

**Current test evidence:** 23 automated tests passed across 3 test suites in the latest recorded run.

This is evidence for the tested scenarios, not a guarantee that all possible security vulnerabilities have been eliminated.

Additional tests for failed database operations, broader permission combinations, administrator access, and deployment security remain necessary.

## 5. Additional Recommended Security Improvements

The following improvements are not claimed as completed features:

1. Implement API rate limiting.
2. Add refresh-token management and token revocation.
3. Enforce HTTPS in production.
4. Introduce centralized security monitoring and alerting.
5. Add dependency vulnerability scanning.
6. Implement stricter request-size limits.
7. Perform penetration testing.
8. Use managed secrets storage in production.
9. Add automated security testing to the CI/CD pipeline.
10. Integrate a trusted payment provider if real-money transactions are required.

## 6. Security Limitations and Accepted Risks

LedgerLine is an educational money-movement backend.

Its deposit and withdrawal operations use simulated internal clearing accounts. It is not integrated with real banking systems, payment networks, or external settlement providers.

The system currently focuses on internal transaction integrity, authentication, authorization, idempotency, and concurrency protection.

The following limitations are acknowledged:

- No real banking or payment-provider integration.
- No refresh-token or token-revocation workflow.
- No confirmed production rate-limiting implementation.
- No completed independent penetration test.
- No guarantee against compromise of privileged database infrastructure.
- Production monitoring, backups, disaster recovery, and deployment hardening require additional work.

These risks are accepted for the educational project scope but must be addressed before real customer funds are handled.

## 7. Conclusion

LedgerLine incorporates security controls to protect authentication, authorization, account access, financial transactions, and database integrity.

JWT authentication, role-based permissions, account-level authorization, idempotency, PostgreSQL transactions, row-level locking, double-entry accounting, append-only ledger protections, and audit logging provide a foundation for reliable money movement.

Automated tests provide evidence that important transaction-integrity and access-control scenarios behave as expected.

Further security reviews, production hardening, monitoring, and independent testing are required before deployment in a real financial environment.

**Project:** LedgerLine  
**Technology:** Node.js, Express.js, PostgreSQL  
**Focus:** Financial transaction security and integrity