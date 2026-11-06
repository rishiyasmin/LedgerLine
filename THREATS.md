# LedgerLine – Security Threats and Mitigation

## 1. Overview

LedgerLine is a secure money-movement backend built using Node.js, Express.js, and PostgreSQL.

Since the application handles financial transactions, account information, authentication, and authorization, it may face several security threats.

This document identifies potential threats to LedgerLine, their possible impact, and the security mechanisms implemented or recommended to mitigate them.

## 2. Identified Security Threats

### 2.1 Unauthorized Access

**Threat:**  
An attacker may attempt to access protected APIs without valid authentication credentials.

**Possible Impact:**
- Unauthorized account access.
- Exposure of financial information.
- Unauthorized transaction attempts.

**Mitigation:**
- JWT-based authentication.
- Authentication middleware on protected routes.
- Token expiration.
- Role-based access control.

### 2.2 Broken Access Control

**Threat:**  
A user may attempt to access or modify another user's account by manipulating account IDs or API requests.

**Possible Impact:**
- Unauthorized account viewing.
- Unauthorized withdrawals or transfers.
- Exposure of transaction history.

**Mitigation:**
- Account-level permissions.
- Role-based authorization.
- Validation of account ownership and permissions.
- Permission checks before financial operations.

### 2.3 Duplicate Transaction Attacks

**Threat:**  
An attacker or client may repeatedly submit the same financial request due to malicious activity or network retries.

**Possible Impact:**
- Duplicate deposits.
- Duplicate withdrawals.
- Duplicate transfers.
- Incorrect account balances.

**Mitigation:**
- Idempotency keys.
- Request hashing.
- Duplicate request detection.
- Stored responses for completed requests.

### 2.4 Race Conditions

**Threat:**  
Multiple financial requests may execute simultaneously against the same account balance.

**Possible Impact:**
- Incorrect balances.
- Double spending.
- Unauthorized overdrafts.

**Mitigation:**
- PostgreSQL database transactions.
- Row-level locking using `SELECT FOR UPDATE`.
- Consistent account locking order during transfers.
- Atomic balance updates.

### 2.5 SQL Injection

**Threat:**  
An attacker may submit malicious SQL input through API parameters or request bodies.

**Possible Impact:**
- Unauthorized database access.
- Data modification.
- Data exposure.
- Database destruction.

**Mitigation:**
- Parameterized SQL queries.
- Input validation.
- Restricted database privileges.
- Avoiding dynamically constructed SQL from untrusted input.

### 2.6 Password Theft

**Threat:**  
User passwords may be exposed through insecure storage or credential attacks.

**Possible Impact:**
- Account takeover.
- Unauthorized transactions.
- Exposure of user information.

**Mitigation:**
- bcrypt password hashing.
- Never storing plaintext passwords.
- Secure credential handling.
- HTTPS for deployed environments.

### 2.7 JWT Theft and Token Abuse

**Threat:**  
An attacker may steal or obtain a valid JWT and use it to access protected endpoints.

**Possible Impact:**
- Account impersonation.
- Unauthorized API requests.
- Financial operations performed under another user's identity.

**Mitigation:**
- Strong JWT signing secrets.
- Token expiration.
- Secure token storage on clients.
- HTTPS.
- Never exposing JWTs in logs or public repositories.

### 2.8 Insufficient Balance and Overdraft Attacks

**Threat:**  
An attacker may attempt withdrawals or transfers exceeding the available account balance.

**Possible Impact:**
- Negative account balances.
- Financial inconsistencies.
- Unauthorized money movement.

**Mitigation:**
- Balance validation before withdrawals and transfers.
- Row-level locking.
- Database constraints.
- Atomic balance updates.

### 2.9 Ledger Tampering

**Threat:**  
An attacker or unauthorized database user may attempt to modify or delete financial ledger records.

**Possible Impact:**
- Financial record manipulation.
- Incorrect transaction history.
- Loss of accountability.

**Mitigation:**
- Append-only protections on ledger entries.
- Database triggers.
- Restricted database permissions.
- Double-entry accounting validation.

### 2.10 Denial of Service (DoS)

**Threat:**  
An attacker may send excessive requests to overload the backend or database.

**Possible Impact:**
- API unavailability.
- Database resource exhaustion.
- Interrupted financial operations.

**Mitigation:**
- Rate limiting (recommended enhancement).
- Request validation.
- Database connection pooling.
- Request timeouts.
- Monitoring and logging.

### 2.11 Privilege Escalation

**Threat:**  
A normal user may attempt to obtain administrator privileges or modify protected permissions.

**Possible Impact:**
- Unauthorized user management.
- Account permission manipulation.
- Administrative access.

**Mitigation:**
- Public registration assigns only the `account_holder` role.
- Admin routes require administrator authorization.
- Account permissions are managed through protected endpoints.
- Administrative actions are audited.

### 2.12 Sensitive Information Exposure

**Threat:**  
Sensitive information may accidentally be exposed through API responses, logs, screenshots, or repository files.

**Possible Impact:**
- Credential theft.
- Database compromise.
- Unauthorized access to user accounts.

**Mitigation:**
- Never returning password hashes in API responses.
- Keeping `.env` files out of Git.
- Avoiding sensitive information in application logs.
- Using environment variables for secrets.
- Restricting access to database credentials.

## 3. Security Controls Implemented

The following security mechanisms are part of the LedgerLine implementation.

| Security Control | Purpose |
|---|---|
| JWT Authentication | Protects authenticated APIs |
| Role-Based Access Control | Restricts operations by user role |
| Account-Level Permissions | Controls individual account operations |
| bcrypt | Secure password hashing |
| Parameterized Queries | Reduces SQL injection risk |
| Idempotency Keys | Prevents duplicate processing |
| Database Transactions | Maintains transaction atomicity |
| Row-Level Locking | Reduces concurrency issues |
| Double-Entry Accounting | Maintains balanced ledger records |
| Append-Only Ledger Protections | Prevents unauthorized record modification |
| Audit Logging | Supports accountability |
| Helmet | Adds HTTP security headers |

## 4. Security Testing Scenarios

The following scenarios should be tested before deployment.

| Test Scenario | Expected Result |
|---|---|
| Login with incorrect password | 401 Unauthorized |
| Access protected API without token | 401 Unauthorized |
| Use expired or invalid JWT | 401 Unauthorized |
| Access another user's account without permission | Access denied |
| Withdraw more than available balance | 409 Conflict |
| Submit the same idempotency key and request again | Return stored result |
| Reuse an idempotency key with different data | 409 Conflict |
| Transfer money to the same account | 400 Bad Request |
| Attempt a transfer without permission | 403 Forbidden |
| Attempt to modify append-only ledger entries | Database operation rejected |
| Attempt admin API access as a customer | 403 Forbidden |

## 5. Additional Recommended Security Improvements

The following improvements can strengthen LedgerLine before production deployment:

1. Implement API rate limiting.
2. Add refresh-token management and token revocation.
3. Use HTTPS in all deployed environments.
4. Introduce centralized security monitoring.
5. Add dependency vulnerability scanning.
6. Implement stricter request-size limits.
7. Add automated security testing.
8. Use managed secrets storage in production.
9. Perform penetration testing.
10. Integrate a trusted payment provider if real-money transactions are required.

## 6. Security Limitations

LedgerLine is an educational money-movement backend.

Its deposit and withdrawal operations use simulated internal clearing accounts. It is not integrated with real banking systems or payment networks.

The presence of security controls does not guarantee complete protection against all attacks. Additional security reviews, compliance checks, operational controls, and penetration testing are necessary before handling real customer funds.

## 7. Conclusion

LedgerLine incorporates multiple security mechanisms to protect authentication, authorization, financial transactions, and database integrity.

The combination of JWT authentication, role-based permissions, idempotency, PostgreSQL transactions, row-level locking, double-entry accounting, and audit logging provides a foundation for building a reliable money-movement backend.

**Project:** LedgerLine  
**Technology:** Node.js, Express.js, PostgreSQL  
**Focus:** Financial transaction security and integrity