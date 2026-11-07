
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
    loadAccounts()
  }, [])

  // Format paise into Indian currency
  const formatMoney = (paise) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
    }).format(Number(paise || 0) / 100)

  // Calculate total balance
  const totalBalance = accounts.reduce(
    (sum, account) => sum + Number(account.balance_paise || 0),
    0
  )

  // Handle deposit
  const handleDeposit = async (e) => {
    e.preventDefault()

    setTransactionMessage('')
    setTransactionSuccess(false)

    const amount = Number(depositAmount)

    if (!selectedAccount) {
      setTransactionMessage('Please select an account.')
      return
    }

    if (
      !Number.isFinite(amount) ||
      amount <= 0 ||
      !/^\d+(\.\d{1,2})?$/.test(depositAmount) ||
      !Number.isSafeInteger(Math.round(amount * 100))
    ) {
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
        err.response?.data?.message || 'Deposit failed. Please try again.'
      )
    } finally {
      setTransactionLoading(false)
    }
  }

  // Open deposit form
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

  // Close deposit form
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

    const amount = Number(withdrawAmount)

    if (!withdrawAccount) {
      setWithdrawMessage('Please select an account.')
      return
    }

    if (
      !Number.isFinite(amount) ||
      amount <= 0 ||
      !/^\d+(\.\d{1,2})?$/.test(withdrawAmount) ||
      !Number.isSafeInteger(Math.round(amount * 100))
    ) {
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

  // Open withdrawal form
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

  // Close withdrawal form
  const closeWithdrawForm = () => {
    if (withdrawLoading) return

    setShowWithdraw(false)
    setWithdrawMessage('')
    setWithdrawAmount('')
  }

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

        {/* Header */}
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

        {/* Account loading/error */}
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
              disabled={loading || accounts.length === 0}
            >
              <ArrowDownToLine />
              Deposit
            </button>

            <button
              onClick={openWithdrawForm}
              disabled={loading || accounts.length === 0}
            >
              <ArrowUpFromLine />
              Withdraw
            </button>

            <button disabled>
              <Send />
              Transfer
            </button>

            <button disabled>
              <History />
              History
            </button>
          </div>

          <p className="coming-soon">
            Deposit and withdrawal are available.
            Transfer and history will be enabled in upcoming steps.
          </p>
        </div>

        {/* Deposit form */}
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
                    onChange={(e) =>
                      setSelectedAccount(e.target.value)
                    }
                    required
                    disabled={transactionLoading}
                  >
                    <option value="">Choose an account</option>

                    {accounts
                      .filter((account) => account.status === 'active')
                      .map((account) => (
                        <option
                          key={account.id}
                          value={account.id}
                        >
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
                    onChange={(e) =>
                      setDepositAmount(e.target.value)
                    }
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

                  {!transactionLoading && (
                    <ArrowRight size={18} />
                  )}
                </button>
              </form>
            </section>
          </div>
        )}

        {/* Withdrawal form */}
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
                    onChange={(e) =>
                      setWithdrawAccount(e.target.value)
                    }
                    required
                    disabled={withdrawLoading}
                  >
                    <option value="">Choose an account</option>

                    {accounts
                      .filter((account) => account.status === 'active')
                      .map((account) => (
                        <option
                          key={account.id}
                          value={account.id}
                        >
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
                    onChange={(e) =>
                      setWithdrawAmount(e.target.value)
                    }
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

                  {!withdrawLoading && (
                    <ArrowRight size={18} />
                  )}
                </button>
              </form>
            </section>
          </div>
        )}

      </section>
    </main>
  )
}

export default Dashboard
