import { useEffect, useState } from 'react'
import {
  Wallet,
  ArrowRight,
  ArrowDownToLine,
  ArrowUpFromLine,
  Send,
  History,
  LogOut,
  RefreshCw,
  Plus,
  ShieldCheck,
  X,
} from 'lucide-react'
import api from './services/api'
function Dashboard({ user, onLogout }) {
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  // Deposit states
  const [showDeposit, setShowDeposit] = useState(false)
  const [selectedAccount, setSelectedAccount] = useState('')
  const [depositAmount, setDepositAmount] = useState('')
  const [transactionLoading, setTransactionLoading] = useState(false)
  const [transactionMessage, setTransactionMessage] = useState('')
  const [transactionSuccess, setTransactionSuccess] = useState(false)
  // Withdrawal states
  const [showWithdraw, setShowWithdraw] = useState(false)
  const [withdrawAccount, setWithdrawAccount] = useState('')
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [withdrawLoading, setWithdrawLoading] = useState(false)
  const [withdrawMessage, setWithdrawMessage] = useState('')
  const [withdrawSuccess, setWithdrawSuccess] = useState(false)
  // Transfer states
  const [showTransfer, setShowTransfer] = useState(false)
  const [sourceAccount, setSourceAccount] = useState('')
  const [targetAccount, setTargetAccount] = useState('')
  const [transferAmount, setTransferAmount] = useState('')
  const [transferLoading, setTransferLoading] = useState(false)
  const [transferMessage, setTransferMessage] = useState('')
  const [transferSuccess, setTransferSuccess] = useState(false)
  // Transaction history states
  const [showHistory, setShowHistory] = useState(false)
  const [historyAccount, setHistoryAccount] = useState('')
  const [historyItems, setHistoryItems] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState('')
  // Load accounts
  const loadAccounts = async () => {
    try {
      setError('')
      const response = await api.get('/accounts')
      setAccounts(response.data.accounts || [])
    } catch (err) {
      setError(
        err.response?.data?.message || 'Unable to load accounts.'
      )
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadAccounts()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [])
  // Format paise into Indian currency
  const formatMoney = (paise) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
    }).format(Number(paise || 0) / 100)
  // Validate amount in rupees
  const isValidAmount = (value) => {
    const amount = Number(value)
    return (
      Number.isFinite(amount) &&
      amount > 0 &&
      /^\d+(\.\d{1,2})?$/.test(value) &&
      Number.isSafeInteger(Math.round(amount * 100))
    )
  }
  // Handle deposit
  const handleDeposit = async (e) => {
    e.preventDefault()
    setTransactionMessage('')
    setTransactionSuccess(false)
    if (!selectedAccount) {
      setTransactionMessage('Please select an account.')
      return
    }
    if (!isValidAmount(depositAmount)) {
      setTransactionMessage(
        'Enter a valid amount with up to 2 decimal places.'
      )
      return
    }
    try {
      setTransactionLoading(true)
      const response = await api.post(
        `/accounts/${selectedAccount}/deposits`,
        { amount_rupees: depositAmount },
        {
          headers: {
            'Idempotency-Key': crypto.randomUUID(),
          },
        }
      )
      setTransactionSuccess(true)
      setTransactionMessage(
        response.data.message || 'Deposit successful!'
      )
      setDepositAmount('')
      await loadAccounts()
    } catch (err) {
      setTransactionMessage(
        err.response?.data?.message ||
          'Deposit failed. Please try again.'
      )
    } finally {
      setTransactionLoading(false)
    }
  }
  const openDepositForm = () => {
    const activeAccount = accounts.find(
      (account) => account.status === 'active'
    )
    setTransactionMessage('')
    setTransactionSuccess(false)
    setDepositAmount('')
    setSelectedAccount(activeAccount?.id || '')
    setShowDeposit(true)
  }
  const closeDepositForm = () => {
    if (transactionLoading) return
    setShowDeposit(false)
    setTransactionMessage('')
    setDepositAmount('')
  }
  // Handle withdrawal
  const handleWithdraw = async (e) => {
    e.preventDefault()
    setWithdrawMessage('')
    setWithdrawSuccess(false)
    if (!withdrawAccount) {
      setWithdrawMessage('Please select an account.')
      return
    }
    if (!isValidAmount(withdrawAmount)) {
      setWithdrawMessage(
        'Enter a valid amount with up to 2 decimal places.'
      )
      return
    }
    try {
      setWithdrawLoading(true)
      const response = await api.post(
        `/accounts/${withdrawAccount}/withdrawals`,
        { amount_rupees: withdrawAmount },
        {
          headers: {
            'Idempotency-Key': crypto.randomUUID(),
          },
        }
      )
      setWithdrawSuccess(true)
      setWithdrawMessage(
        response.data.message || 'Withdrawal successful!'
      )
      setWithdrawAmount('')
      await loadAccounts()
    } catch (err) {
      setWithdrawMessage(
        err.response?.data?.message ||
          'Withdrawal failed. Please try again.'
      )
    } finally {
      setWithdrawLoading(false)
    }
  }
  const openWithdrawForm = () => {
    const activeAccount = accounts.find(
      (account) => account.status === 'active'
    )
    setWithdrawMessage('')
    setWithdrawSuccess(false)
    setWithdrawAmount('')
    setWithdrawAccount(activeAccount?.id || '')
    setShowWithdraw(true)
  }
  const closeWithdrawForm = () => {
    if (withdrawLoading) return
    setShowWithdraw(false)
    setWithdrawMessage('')
    setWithdrawAmount('')
  }
  // Handle transfer
  const handleTransfer = async (e) => {
    e.preventDefault()
    setTransferMessage('')
    setTransferSuccess(false)
    if (!sourceAccount || !targetAccount) {
      setTransferMessage('Please select both accounts.')
      return
    }
    if (sourceAccount === targetAccount) {
      setTransferMessage(
        'Source and destination accounts must be different.'
      )
      return
    }
    if (!isValidAmount(transferAmount)) {
      setTransferMessage(
        'Enter a valid amount with up to 2 decimal places.'
      )
      return
    }
    try {
      setTransferLoading(true)
      const response = await api.post(
        `/accounts/${sourceAccount}/transfers`,
        {
          target_account_id: targetAccount,
          amount_rupees: transferAmount,
        },
        {
          headers: {
            'Idempotency-Key': crypto.randomUUID(),
          },
        }
      )
      setTransferSuccess(true)
      setTransferMessage(
        response.data.message || 'Transfer completed successfully!'
      )
      setTransferAmount('')
      await loadAccounts()
    } catch (err) {
      setTransferMessage(
        err.response?.data?.message ||
          'Transfer failed. Please try again.'
      )
    } finally {
      setTransferLoading(false)
    }
  }
  const openTransferForm = () => {
    const availableAccounts = accounts.filter(
      (account) => account.status === 'active'
    )
    setTransferMessage('')
    setTransferSuccess(false)
    setTransferAmount('')
    setSourceAccount(availableAccounts[0]?.id || '')
    setTargetAccount(availableAccounts[1]?.id || '')
    setShowTransfer(true)
  }
  const closeTransferForm = () => {
    if (transferLoading) return
    setShowTransfer(false)
    setTransferMessage('')
    setTransferAmount('')
  }
  // Load transaction history for the selected account.
  const loadHistory = async (accountId) => {
    if (!accountId) {
      setHistoryItems([])
      return
    }
    try {
      setHistoryLoading(true)
      setHistoryError('')
      const response = await api.get(`/accounts/${accountId}/transactions`)
      const data = response.data
      const items =
        data.transactions ||
        data.entries ||
        data.history ||
        data.transaction_history ||
        []
      setHistoryItems(Array.isArray(items) ? items : [])
    } catch (err) {
      setHistoryItems([])
      setHistoryError(
        err.response?.data?.message || 'Unable to load transaction history.'
      )
    } finally {
      setHistoryLoading(false)
    }
  }
  const openHistory = async () => {
    const firstAccount = accounts[0]
    const accountId = firstAccount?.id || ''
    setHistoryAccount(accountId)
    setHistoryItems([])
    setHistoryError('')
    setShowHistory(true)
    if (accountId) await loadHistory(accountId)
  }
  const handleHistoryAccountChange = async (e) => {
    const accountId = e.target.value
    setHistoryAccount(accountId)
    await loadHistory(accountId)
  }
  const closeHistory = () => {
    setShowHistory(false)
    setHistoryError('')
  }
  const formatTransactionDate = (value) => {
    if (!value) return '—'
    const date = new Date(value)
    return Number.isNaN(date.getTime())
      ? String(value)
      : date.toLocaleString('en-IN', {
          dateStyle: 'medium',
          timeStyle: 'short',
        })
  }
  const getTransactionAmount = (item) => {
    if (item.amount_paise !== undefined) {
      return formatMoney(item.amount_paise)
    }
    if (item.amount_rupees !== undefined) {
      return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
      }).format(Number(item.amount_rupees))
    }
    if (item.amount !== undefined) {
      const amount = Number(item.amount)
      return Number.isFinite(amount)
        ? new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
          }).format(amount)
        : '—'
    }
    return '—'
  }
  const activeAccounts = accounts.filter(
    (account) => account.status === 'active'
  )
  const totalBalance = accounts.reduce(
    (sum, account) => sum + Number(account.balance_paise || 0),
    0
  )
  return (
    <main className="dashboard-page">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="dashboard-brand">
          <Wallet size={25} />
          Ledger<span>Line</span>
        </div>
        <nav className="side-nav">
          <div className="nav-item active">
            <Wallet size={18} />
            Overview
          </div>
          <div className="nav-item">
            <History size={18} />
            Transactions
          </div>
          <div className="nav-item">
            <Send size={18} />
            Transfers
          </div>
        </nav>
        <div className="sidebar-bottom">
          <div className="security-label">
            <ShieldCheck size={18} />
            Secure banking
          </div>
          <button
            className="logout-button"
            onClick={onLogout}
          >
            <LogOut size={18} />
            Sign out
          </button>
        </div>
      </aside>
      {/* Main dashboard */}
      <section className="dashboard-main">
        <header className="dashboard-header">
          <div>
            <span className="welcome-label">
              YOUR FINANCIAL OVERVIEW
            </span>
            <h1>
              Hello, {user?.full_name || 'Customer'} 👋
            </h1>
            <p>
              Here's what's happening with your accounts.
            </p>
          </div>
          <button
            className="refresh-button"
            onClick={loadAccounts}
            disabled={loading}
          >
            <RefreshCw size={17} />
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </header>
        {/* Total balance */}
        <section className="balance-card">
          <div>
            <span>Total available balance</span>
            <h2>{formatMoney(totalBalance)}</h2>
            <small>
              Across {accounts.length} accessible account(s)
            </small>
          </div>
          <div className="balance-icon">
            <Wallet size={30} />
          </div>
        </section>
        {/* Accounts heading */}
        <div className="section-heading">
          <div>
            <h2>Your accounts</h2>
            <p>Manage your LedgerLine accounts</p>
          </div>
          <button
            className="create-account-button"
            disabled
          >
            <Plus size={17} />
            Create account
          </button>
        </div>
        {error && (
          <div className="dashboard-error" role="alert">
            {error}
          </div>
        )}
        {/* Account list */}
        {loading ? (
          <p className="loading-text">
            Loading your accounts...
          </p>
        ) : accounts.length === 0 ? (
          <div className="empty-state">
            <Wallet size={35} />
            <h3>No accounts found</h3>
            <p>Your accessible accounts will appear here.</p>
          </div>
        ) : (
          <div className="account-grid">
            {accounts.map((account) => (
              <article
                className="account-card"
                key={account.id}
              >
                <div className="account-card-top">
                  <div className="account-icon">
                    <Wallet size={21} />
                  </div>
                  <span className={`account-status ${account.status}`}>
                    {account.status}
                  </span>
                </div>
                <h3>{account.account_name}</h3>
                <p>{account.account_number}</p>
                <div className="account-balance">
                  {formatMoney(account.balance_paise)}
                </div>
                <small>
                  {account.currency} · {account.account_type}
                </small>
              </article>
            ))}
          </div>
        )}
        {/* Quick actions */}
        <div className="quick-actions">
          <h2>Quick actions</h2>
          <div className="action-grid">
            <button
              onClick={openDepositForm}
              disabled={loading || activeAccounts.length === 0}
            >
              <ArrowDownToLine />
              Deposit
            </button>
            <button
              onClick={openWithdrawForm}
              disabled={loading || activeAccounts.length === 0}
            >
              <ArrowUpFromLine />
              Withdraw
            </button>
            <button
              onClick={openTransferForm}
              disabled={loading || activeAccounts.length < 2}
            >
              <Send />
              Transfer
            </button>
            <button
              onClick={openHistory}
              disabled={loading || accounts.length === 0}
            >
              <History />
              History
            </button>
          </div>
          <p className="coming-soon">
            Deposit, withdrawal, transfer and transaction history are available.
          </p>
        </div>
        {/* Deposit modal */}
        {showDeposit && (
          <div className="transaction-overlay">
            <section
              className="transaction-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="deposit-title"
            >
              <div className="modal-heading">
                <div>
                  <span className="welcome-label">
                    MONEY MOVEMENT
                  </span>
                  <h2 id="deposit-title">Deposit money</h2>
                  <p>Add funds to your LedgerLine account.</p>
                </div>
                <button
                  type="button"
                  className="modal-close"
                  onClick={closeDepositForm}
                  disabled={transactionLoading}
                  aria-label="Close deposit form"
                >
                  <X size={21} />
                </button>
              </div>
              <form onSubmit={handleDeposit}>
                <label className="input-group">
                  <span>Select account</span>
                  <select
                    value={selectedAccount}
                    onChange={(e) => setSelectedAccount(e.target.value)}
                    required
                    disabled={transactionLoading}
                  >
                    <option value="">Choose an account</option>
                    {activeAccounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.account_name} - {account.account_number}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="input-group">
                  <span>Amount (INR)</span>
                  <input
                    type="number"
                    placeholder="Enter amount"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    min="0.01"
                    step="0.01"
                    required
                    disabled={transactionLoading}
                  />
                </label>
                {transactionMessage && (
                  <div
                    className={
                      transactionSuccess
                        ? 'transaction-success'
                        : 'transaction-error'
                    }
                    role="status"
                  >
                    {transactionMessage}
                  </div>
                )}
                <button
                  type="submit"
                  className="submit-button"
                  disabled={transactionLoading}
                >
                  {transactionLoading
                    ? 'Processing deposit...'
                    : 'Confirm deposit'}
                  {!transactionLoading && <ArrowRight size={18} />}
                </button>
              </form>
            </section>
          </div>
        )}
        {/* Withdrawal modal */}
        {showWithdraw && (
          <div className="transaction-overlay">
            <section
              className="transaction-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="withdraw-title"
            >
              <div className="modal-heading">
                <div>
                  <span className="welcome-label">
                    MONEY MOVEMENT
                  </span>
                  <h2 id="withdraw-title">Withdraw money</h2>
                  <p>Withdraw funds from your LedgerLine account.</p>
                </div>
                <button
                  type="button"
                  className="modal-close"
                  onClick={closeWithdrawForm}
                  disabled={withdrawLoading}
                  aria-label="Close withdrawal form"
                >
                  <X size={21} />
                </button>
              </div>
              <form onSubmit={handleWithdraw}>
                <label className="input-group">
                  <span>Select account</span>
                  <select
                    value={withdrawAccount}
                    onChange={(e) => setWithdrawAccount(e.target.value)}
                    required
                    disabled={withdrawLoading}
                  >
                    <option value="">Choose an account</option>
                    {activeAccounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.account_name} - {account.account_number}
                        {' '}({formatMoney(account.balance_paise)})
                      </option>
                    ))}
                  </select>
                </label>
                <label className="input-group">
                  <span>Amount (INR)</span>
                  <input
                    type="number"
                    placeholder="Enter withdrawal amount"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    min="0.01"
                    step="0.01"
                    required
                    disabled={withdrawLoading}
                  />
                </label>
                {withdrawMessage && (
                  <div
                    className={
                      withdrawSuccess
                        ? 'transaction-success'
                        : 'transaction-error'
                    }
                    role="status"
                  >
                    {withdrawMessage}
                  </div>
                )}
                <button
                  type="submit"
                  className="submit-button"
                  disabled={withdrawLoading}
                >
                  {withdrawLoading
                    ? 'Processing withdrawal...'
                    : 'Confirm withdrawal'}
                  {!withdrawLoading && <ArrowRight size={18} />}
                </button>
              </form>
            </section>
          </div>
        )}
        {/* Transfer modal */}
        {showTransfer && (
          <div className="transaction-overlay">
            <section
              className="transaction-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="transfer-title"
            >
              <div className="modal-heading">
                <div>
                  <span className="welcome-label">
                    MONEY MOVEMENT
                  </span>
                  <h2 id="transfer-title">Transfer money</h2>
                  <p>Move funds between your LedgerLine accounts.</p>
                </div>
                <button
                  type="button"
                  className="modal-close"
                  onClick={closeTransferForm}
                  disabled={transferLoading}
                  aria-label="Close transfer form"
                >
                  <X size={21} />
                </button>
              </div>
              <form onSubmit={handleTransfer}>
                <label className="input-group">
                  <span>From account</span>
                  <select
                    value={sourceAccount}
                    onChange={(e) => setSourceAccount(e.target.value)}
                    required
                    disabled={transferLoading}
                  >
                    <option value="">Select source account</option>
                    {activeAccounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.account_name} - {account.account_number}
                        {' '}({formatMoney(account.balance_paise)})
                      </option>
                    ))}
                  </select>
                </label>
                <label className="input-group">
                  <span>To account</span>
                  <select
                    value={targetAccount}
                    onChange={(e) => setTargetAccount(e.target.value)}
                    required
                    disabled={transferLoading}
                  >
                    <option value="">Select destination account</option>
                    {activeAccounts
                      .filter((account) => account.id !== sourceAccount)
                      .map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.account_name} - {account.account_number}
                        </option>
                      ))}
                  </select>
                </label>
                <label className="input-group">
                  <span>Amount (INR)</span>
                  <input
                    type="number"
                    placeholder="Enter transfer amount"
                    value={transferAmount}
                    onChange={(e) => setTransferAmount(e.target.value)}
                    min="0.01"
                    step="0.01"
                    required
                    disabled={transferLoading}
                  />
                </label>
                {transferMessage && (
                  <div
                    className={
                      transferSuccess
                        ? 'transaction-success'
                        : 'transaction-error'
                    }
                    role="status"
                  >
                    {transferMessage}
                  </div>
                )}
                <button
                  type="submit"
                  className="submit-button"
                  disabled={transferLoading}
                >
                  {transferLoading
                    ? 'Processing transfer...'
                    : 'Confirm transfer'}
                  {!transferLoading && <ArrowRight size={18} />}
                </button>
              </form>
            </section>
          </div>
        )}
        {/* Transaction history modal */}
        {showHistory && (
          <div className="transaction-overlay">
            <section
              className="transaction-modal history-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="history-title"
            >
              <div className="modal-heading">
                <div>
                  <span className="welcome-label">ACCOUNT ACTIVITY</span>
                  <h2 id="history-title">Transaction history</h2>
                  <p>Review transactions for your LedgerLine account.</p>
                </div>
                <button
                  type="button"
                  className="modal-close"
                  onClick={closeHistory}
                  aria-label="Close transaction history"
                >
                  <X size={21} />
                </button>
              </div>
              <label className="input-group">
                <span>Select account</span>
                <select
                  value={historyAccount}
                  onChange={handleHistoryAccountChange}
                  disabled={historyLoading}
                >
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.account_name} - {account.account_number}
                    </option>
                  ))}
                </select>
              </label>
              {historyLoading && (
                <p className="loading-text">Loading transactions...</p>
              )}
              {historyError && (
                <div className="transaction-error" role="alert">
                  {historyError}
                </div>
              )}
              {!historyLoading && !historyError && historyItems.length === 0 && (
                <div className="empty-state history-empty">
                  <History size={30} />
                  <h3>No transactions found</h3>
                  <p>Transactions for this account will appear here.</p>
                </div>
              )}
              {!historyLoading && historyItems.length > 0 && (
                <div className="history-list">
                  {historyItems.map((item, index) => {
                    const type =
                      item.transaction_type ||
                      item.type ||
                      item.transactionType ||
                      'Transaction'
                    const status = item.status || item.transaction_status || '—'
                    const date =
                      item.created_at ||
                      item.createdAt ||
                      item.transaction_date ||
                      item.timestamp
                    const identifier =
                      item.id || item.transaction_id || item.transactionId || index
                    const amount = getTransactionAmount(item)
                    const description =
                      item.description || item.reference || item.memo || ''
                    return (
                      <article className="history-row" key={identifier}>
                        <div className="history-row-icon">
                          <History size={18} />
                        </div>
                        <div className="history-row-details">
                          <strong>{String(type).replaceAll('_', ' ')}</strong>
                          <span>{formatTransactionDate(date)}</span>
                          {description && <small>{description}</small>}
                          <span className="history-status">
                            {String(status).replaceAll('_', ' ')}
                          </span>
                        </div>
                        <strong className="history-amount">{amount}</strong>
                      </article>
                    )
                  })}
                </div>
              )}
            </section>
          </div>
        )}
      </section>
    </main>
  )
}
export default Dashboard
