# LedgerLine – AI Development Prompts and Usage Log

## 1. Purpose

This document records how AI assistance was used during LedgerLine development.

AI was used for architecture guidance, database design, implementation suggestions, debugging, security reviews, and automated testing.

The entries below distinguish between AI suggestions, implementation decisions, identified limitations, and corrections.

**Important:** Commit links must be added after the corresponding changes are committed to the public Git repository. No commit URLs are fabricated in this document.

---

## 2. Development History and AI Usage

### Entry 1 – Transaction Statement Improvements

**Date:** 2026-11-07

**Area:** Transaction history and account statements

**Prompt / Request:**

Review the existing account transaction-history implementation. Improve it to include successful transactions, rejected and failed attempts, running balances, and the identity of the user who initiated each transaction.

**AI Output:**

Suggested extending the transaction-history service to retrieve ledger entries, transaction attempts, and initiator information, then combine the events and calculate running balances.

**What was incomplete in the initial implementation:**

The existing statement returned ledger entries only. It did not include rejected or failed attempts, running balances, or initiator details.

**What was implemented instead:**

- Added retrieval of ledger entries.
- Added retrieval of rejected and failed transaction attempts.
- Joined user information to identify the initiator.
- Combined transaction events chronologically.
- Calculated running balances using signed debit and credit amounts.

**Verification:**

Transaction history endpoint returned HTTP 200. The response included a rejected withdrawal attempt and a successful transfer with initiator details and running balance.

**Commit link:** [View implementation commit](https://github.com/rishiyasmin/LedgerLine/commit/f78b450ac0cb822c84474d4072706e2eb13c7ec)

---

### Entry 2 – Transfer Idempotency

**Date:** 2026-11-07

**Area:** Money integrity and duplicate processing

**Prompt / Request:**

Create an automated test proving that replaying the same transfer request with the same idempotency key does not transfer money twice.

**AI Output:**

Suggested creating two accounts, funding the source account, submitting the same transfer twice, and checking that the original transaction response is returned.

**What was missing in the existing tests:**

The existing test suite covered duplicate deposits but did not independently prove duplicate transfer protection.

**What was implemented instead:**

- Added a reusable transfer helper.
- Added a duplicate transfer integration test.
- Reused the same idempotency key and request data.
- Verified that the second response was marked as replayed.
- Verified that both account balances remained unchanged after the replay.

**Verification:**

The duplicate transfer test passed. The source retained ₹70 and the destination retained ₹30 after the original ₹30 transfer and its replay.

**Commit link:** [View implementation commit](https://github.com/rishiyasmin/LedgerLine/commit/f78b450ac0cb822c84474d4072706e2eb13c7ec)

---

### Entry 3 – Concurrent Transfer Protection

**Date:** 2026-11-07

**Area:** Money integrity and concurrency

**Prompt / Request:**

Design an automated concurrency test to verify that two simultaneous transfers cannot spend more money than the source account contains.

**AI Output:**

Suggested using parallel requests with different idempotency keys and checking the final account balances.

**What was missing in the existing tests:**

Concurrent withdrawal protection was already tested, but concurrent transfers were not independently verified.

**What was implemented instead:**

- Created one source account and two destination accounts.
- Funded the source with ₹50.
- Submitted two simultaneous ₹40 transfers.
- Used separate idempotency keys.
- Verified that only one transfer succeeded.
- Verified that the other request was rejected.
- Checked the final source and destination balances.

**Verification:**

The test passed with one HTTP 200 response and one HTTP 409 response. The source retained ₹10, and the combined destination balance was ₹40.

**Commit link:** [View implementation commit](https://github.com/rishiyasmin/LedgerLine/commit/f78b450ac0cb822c84474d4072706e2eb13c7ec)

---

### Entry 4 – Unauthorized Transfer Testing

**Date:** 2026-11-07

**Area:** Account-level authorization

**Prompt / Request:**

Write an integration test proving that one customer cannot transfer money from another customer's account by manipulating the source account ID.

**AI Output:**

Suggested registering a second customer, obtaining a separate JWT, and attempting a transfer from an account belonging to the first customer.

**What was missing in the existing tests:**

The existing transaction tests covered balance protection and concurrency but did not directly verify this cross-user transfer scenario.

**What was implemented instead:**

- Registered a separate customer.
- Authenticated the second customer independently.
- Attempted a transfer using the first customer's account ID.
- Verified that the request was denied.
- Checked that the original customer's balance remained unchanged.

**Verification:**

The unauthorized transfer test passed with HTTP 403. The original account balance remained ₹100.

**Commit link:** [View implementation commit](https://github.com/rishiyasmin/LedgerLine/commit/f78b450ac0cb822c84474d4072706e2eb13c7ec)

---

### Entry 5 – System-Wide Money Conservation

**Date:** 2026-11-07

**Area:** Double-entry accounting and money conservation

**Prompt / Request:**

Add an automated test proving that an internal transfer does not create or destroy money across all customer accounts.

**AI Output:**

Suggested comparing the total customer account balances before and after an internal transfer.

**What was missing in the existing tests:**

The earlier reconciliation test compared an individual account balance with its ledger entries. It did not directly verify the total customer balance across the test database before and after an internal transfer.

**What was implemented instead:**

- Calculated the total balance of customer accounts before the transfer.
- Executed an internal transfer.
- Calculated the total customer balance again.
- Compared both totals using BigInt to avoid monetary precision problems.

**Verification:**

The system-wide conservation test passed. The total customer balance remained unchanged after the internal transfer.

**Commit link:** [View implementation commit](https://github.com/rishiyasmin/LedgerLine/commit/f78b450ac0cb822c84474d4072706e2eb13c7ec)
---

## 3. Earlier Representative Development Prompts

The following prompts summarize the broader categories of AI-assisted development used during the project. They are representative prompts, not a verbatim chronological transcript.

### Architecture and Database Design

1. Design a layered Node.js, Express.js, and PostgreSQL backend architecture.
2. Design a PostgreSQL schema with users, accounts, permissions, transactions, ledger entries, idempotency keys, audit logs, and transaction attempts.
3. Explain double-entry accounting for deposits, withdrawals, and transfers.

### Authentication and Authorization

4. Implement registration and login using bcrypt and JWT.
5. Implement role-based authorization for admin, account_holder, and auditor.
6. Implement account-level permission checks.

### Financial Operations

7. Implement secure deposits using simulated clearing accounts.
8. Implement withdrawals with balance validation and row-level locking.
9. Implement internal transfers with deterministic account locking.
10. Implement idempotency for financial operations.

### Security and Testing

11. Review concurrency risks in financial transactions.
12. Implement audit logging and append-only ledger protections.
13. Create Jest and Supertest integration tests.
14. Verify that unauthorized users cannot move another customer's money.

### Documentation

15. Prepare API documentation, setup instructions, database schema documentation, and security threat analysis.

---

## 4. Lessons Learned from AI-Assisted Development

The development process demonstrated that AI-generated code must be reviewed and tested before being accepted.

Important lessons:

1. A transaction-history implementation that displays only successful ledger entries is incomplete when rejected attempts must also be visible.
2. Testing duplicate deposits does not automatically prove that duplicate transfers are safe.
3. Testing concurrent withdrawals does not automatically prove that concurrent transfers are safe.
4. Testing individual account balances does not replace system-wide money conservation checks.
5. Authorization must be tested using separate users and independent authentication tokens.
6. Database locking, constraints, and transaction boundaries must be verified rather than assumed.
7. Documentation must distinguish implemented features from proposed improvements.

AI suggestions were treated as development assistance, not as proof of correctness.

---

## 5. Current Automated Testing Evidence

Latest recorded test execution:

- Test suites passed: 3
- Tests passed: 23
- Tests failed: 0

The test suite covers:

- Deposits and withdrawals.
- Double-entry accounting.
- Ledger update and delete protection.
- Idempotency.
- Insufficient balance.
- Concurrent withdrawals.
- Concurrent transfers.
- Unauthorized transfers.
- Account balance reconciliation.
- Internal transfer conservation.

These results describe the recorded test run and do not constitute a complete security audit.

---

## 6. Pending Evidence and Improvements

The following items must be completed before final submission:

- [ ] Replace all TODO commit-link placeholders with real public Git commit URLs.
- [ ] Verify the dates against Git history and actual development records.
- [ ] Ensure each entry corresponds to a real interaction and implementation.
- [ ] Add further examples of debugging mistakes and their corrections when documented.
- [ ] Preserve the actual project commit history.

---

**Project:** LedgerLine  
**Backend:** Node.js, Express.js, PostgreSQL  
**Testing:** Jest, Supertest  
**Focus:** Secure money movement, transaction integrity, concurrency, and authorization