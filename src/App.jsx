
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  Coins,
  Clock3,
  IndianRupee,
  LockKeyhole,
  LogOut,
  Plus,
  RefreshCw,
  ShieldCheck,
  Wallet,
  X,
  Pencil,
} from "lucide-react";
import { supabase } from "./lib/supabase";
import "./App.css";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const FUNCTION_URL = SUPABASE_URL
  ? `${SUPABASE_URL.replace(/\/+$/, "")}/functions/v1/smart-task`
  : "";

const today = () => {
  const now = new Date();
  return new Date(
    now.getTime() - now.getTimezoneOffset() * 60000
  )
    .toISOString()
    .slice(0, 10);
};

const money = (amount) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(amount) || 0);

const dateLabel = (value) => {
  if (!value) return "—";

  return new Date(`${String(value).slice(0, 10)}T00:00:00`).toLocaleDateString(
    "en-IN",
    {
      day: "numeric",
      month: "short",
      year: "numeric",
    }
  );
};

const emptyExpenseForm = () => ({
  description: "",
  amount: "",
  expense_date: today(),
  paid_by: "",
  category: "Travel",
});

const emptyFamilyForm = () => ({
  family_name: "",
  pilgrim_members: "2",
  contribution_paid: "0",
  settlement_status: "Pending",
  payment_mode: "",
  contribution_date: today(),
});

const REQUIRED_PER_COUPLE = 9000;

const familyStatus = (status) =>
  status === "Settled" ? "Paid" : status || "Pending";

export default function App() {
  // Reference to the Manage tour records section
  const managerTourRef = useRef(null);

  function goToManagerTour() {
    setTab("overview");
    setTimeout(() => {
      managerTourRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 100);
  }

  const [families, setFamilies] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [adminOpen, setAdminOpen] = useState(false);
  const [passcode, setPasscode] = useState("");
  const [adminMode, setAdminMode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [tab, setTab] = useState("overview");
  const [familySort, setFamilySort] = useState("name");
  const [expenseForm, setExpenseForm] = useState(emptyExpenseForm);
  const [familyForm, setFamilyForm] = useState(emptyFamilyForm);
  const [editingExpenseId, setEditingExpenseId] = useState(null);
  const [editingFamilyId, setEditingFamilyId] = useState(null);

  const loadData = useCallback(async (showSpinner = false) => {
    if (showSpinner) setLoading(true);
    setError("");

    try {
      const [familyResult, expenseResult] = await Promise.all([
        supabase
          .from("families")
          .select("*")
          .order("created_at", { ascending: true }),
        supabase
          .from("expenses")
          .select("*")
          .order("expense_date", { ascending: false }),
      ]);

      if (familyResult.error || expenseResult.error) {
        throw new Error(
          familyResult.error?.message ||
            expenseResult.error?.message ||
            "Could not load the tour data."
        );
      }

      setFamilies(familyResult.data || []);
      setExpenses(expenseResult.data || []);
    } catch (err) {
      setError(err.message || "Could not load the tour data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData(true);

    const interval = setInterval(() => {
      loadData(false);
    }, 15000);

    return () => clearInterval(interval);
  }, [loadData]);

  const totalExpenses = expenses.reduce(
    (sum, item) => sum + Number(item.amount || 0),
    0
  );

  const totalContributions = families.reduce(
    (sum, item) => sum + Number(item.contribution_paid || 0),
    0
  );

  const totalMembers = families.length * 2;
  const balance = totalContributions - totalExpenses;

  const pendingFamilies = families.filter(
    (item) => familyStatus(item.settlement_status) !== "Paid"
  ).length;

  const sortedFamilies = [...families].sort((a, b) =>
    familySort === "date"
      ? String(b.contribution_date || b.created_at || "")
          .slice(0, 10)
          .localeCompare(
            String(a.contribution_date || a.created_at || "").slice(0, 10)
          )
      : String(a.family_name || "").localeCompare(
          String(b.family_name || ""),
          "en",
          { sensitivity: "base" }
        )
  );

  const sortedExpenses = [...expenses].sort((a, b) =>
    String(b.expense_date || b.created_at || "")
      .slice(0, 10)
      .localeCompare(
        String(a.expense_date || a.created_at || "").slice(0, 10)
      )
  );

  const ledgerRows = [
    ...families
      .filter((family) => Number(family.contribution_paid) > 0)
      .map((family) => ({
        key: `family-${family.id}`,
        recordType: "families",
        recordId: family.id,
        date: (
          family.contribution_date ||
          family.created_at ||
          ""
        ).slice(0, 10),
        description: `Contribution — ${family.family_name}`,
        category: "Contribution",
        paidBy: family.family_name,
        income: Number(family.contribution_paid || 0),
        expense: 0,
      })),
    ...expenses.map((expense) => ({
      key: `expense-${expense.id}`,
      recordType: "expenses",
      recordId: expense.id,
      date: (
        expense.expense_date ||
        expense.created_at ||
        ""
      ).slice(0, 10),
      description: expense.description,
      category: expense.category || "Expense",
      paidBy: expense.paid_by || "—",
      income: 0,
      expense: Number(expense.amount || 0),
    })),
  ]
    .sort((a, b) => a.date.localeCompare(b.date))
    .reduce((rows, item) => {
      const previousBalance = rows.length
        ? rows[rows.length - 1].balance
        : 0;

      rows.push({
        ...item,
        balance: previousBalance + item.income - item.expense,
      });

      return rows;
    }, [])
    .reverse();

  async function adminRequest(table, action, data, id) {
    if (!FUNCTION_URL || !SUPABASE_ANON_KEY) {
      throw new Error(
        "Supabase configuration is missing. Check your environment variables."
      );
    }

    const response = await fetch(FUNCTION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        "x-admin-passcode": passcode,
      },
      body: JSON.stringify({ table, action, data, id }),
    });

    let result;

    try {
      result = await response.json();
    } catch {
      throw new Error("The server returned an invalid response.");
    }

    if (!response.ok || !result.success) {
      throw new Error(result.error || "The request failed.");
    }

    return result;
  }

  function startEditExpense(item) {
    if (!item) return;

    setEditingExpenseId(item.id);
    setExpenseForm({
      description: item.description || "",
      amount: String(item.amount ?? ""),
      expense_date: item.expense_date || today(),
      paid_by: item.paid_by || "",
      category: item.category || "Travel",
    });

    setMessage(
      "Editing expense. Make your changes and select Update expense."
    );

      goToManagerTour();
  }

  function startEditFamily(item) {
    if (!item) return;

    setEditingFamilyId(item.id);
    setFamilyForm({
      family_name: item.family_name || "",
      pilgrim_members: "2",
      contribution_paid: String(item.contribution_paid ?? "0"),
      settlement_status: familyStatus(item.settlement_status),
      payment_mode: item.payment_mode || "",
      contribution_date:
        item.contribution_date ||
        item.created_at?.slice(0, 10) ||
        today(),
    });

    setMessage(
      "Editing family contribution. Make your changes and select Update contribution."
    );

    goToManagerTour();
  }

  function cancelExpenseEdit() {
    setEditingExpenseId(null);
    setExpenseForm(emptyExpenseForm());
    setMessage("");
  }

  function cancelFamilyEdit() {
    setEditingFamilyId(null);
    setFamilyForm(emptyFamilyForm());
    setMessage("");
  }

  async function saveExpense(event) {
    event.preventDefault();
    setBusy(true);
    setMessage("");

    try {
      await adminRequest(
        "expenses",
        editingExpenseId ? "update" : "insert",
        {
          description: expenseForm.description.trim(),
          amount: Number(expenseForm.amount),
          expense_date: expenseForm.expense_date,
          paid_by: expenseForm.paid_by.trim() || null,
          category: expenseForm.category,
        },
        editingExpenseId
      );

      setEditingExpenseId(null);
      setExpenseForm(emptyExpenseForm());

      await loadData();
      setMessage("Expense saved successfully.");
    } catch (err) {
      setMessage(`Save failed: ${err.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function saveFamily(event) {
    event.preventDefault();
    setBusy(true);
    setMessage("");

    try {
      await adminRequest(
        "families",
        editingFamilyId ? "update" : "insert",
        {
          family_name: familyForm.family_name.trim(),
          pilgrim_members: 2,
          contribution_paid: Number(familyForm.contribution_paid),
          settlement_status:
            Number(familyForm.contribution_paid) >= REQUIRED_PER_COUPLE
              ? "Paid"
              : "Pending",
          payment_mode: familyForm.payment_mode.trim() || null,
          contribution_date: familyForm.contribution_date,
        },
        editingFamilyId
      );

      setEditingFamilyId(null);
      setFamilyForm(emptyFamilyForm());

      await loadData();
      setMessage("Family contribution saved successfully.");
    } catch (err) {
      setMessage(`Save failed: ${err.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function deleteRecord(table, id) {
    if (!window.confirm("Delete this record permanently?")) return;

    setBusy(true);
    setMessage("");

    try {
      await adminRequest(table, "delete", undefined, id);
      await loadData();
      setMessage("Record deleted.");
    } catch (err) {
      setMessage(`Delete failed: ${err.message}`);
    } finally {
      setBusy(false);
    }
  }

  function enterAdmin(event) {
    event.preventDefault();

    if (!passcode.trim()) {
      setMessage("Enter your admin passcode.");
      return;
    }

    setAdminMode(true);
    setAdminOpen(false);
    setMessage(
      "Admin mode enabled. Save operations verify your passcode."
    );
  }

  function leaveAdmin() {
    setAdminMode(false);
    setPasscode("");
    setMessage("");
    setTab("overview");
    cancelExpenseEdit();
    cancelFamilyEdit();
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <IndianRupee size={24} />
          </div>
          <div>
            <strong>Dev Darshan</strong>
            <span>Tour Expense Tracker</span>
          </div>
        </div>

        <div className="side-label">WORKSPACE</div>

        <button
          className={`nav-link ${tab === "overview" ? "active" : ""}`}
          onClick={() => setTab("overview")}
        >
          <Activity size={18} /> Overview
        </button>

        <button
          className={`nav-link ${tab === "expenses" ? "active" : ""}`}
          onClick={() => setTab("expenses")}
        >
          <Wallet size={18} /> Expenses
        </button>

        <button
          className={`nav-link ${tab === "families" ? "active" : ""}`}
          onClick={() => setTab("families")}
        >
          <Coins size={18} /> Family contributions
        </button>

        <div className="sidebar-bottom">
          <div className="shared-note">
            <ShieldCheck size={20} />
            <div>
              <strong>Shared tour ledger</strong>
              <span>Read-only for visitors</span>
            </div>
          </div>

          {adminMode ? (
            <button className="admin-button" onClick={leaveAdmin}>
              <LogOut size={17} /> Exit admin mode
            </button>
          ) : (
            <button
              className="admin-button"
              onClick={() => setAdminOpen(true)}
            >
              <LockKeyhole size={17} /> Admin access
            </button>
          )}
        </div>
      </aside>

      <section className="main-panel">
        <header className="topbar">
          <div>
            <div className="eyebrow">PILGRIMAGE • SHARED EXPENSES</div>
            <h1>Dev Darshan Expense Tracker</h1>
            <p>Every contribution and expense, all in one place.</p>
          </div>

          <button
            className="refresh-button"
            onClick={() => loadData(true)}
            disabled={loading}
          >
            <RefreshCw
              size={16}
              className={loading ? "spin" : ""}
            />
            <span>Refresh</span>
          </button>
        </header>

        {message && (
          <div className="notice" role="status">
            <span>{message}</span>
            <button
              onClick={() => setMessage("")}
              aria-label="Dismiss"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {error && (
          <div className="error-box">
            Unable to load shared data: {error}
          </div>
        )}

        <div className="status-row">
          <span className="live-dot" />
          Shared data refreshes every 15 seconds
          <span className="status-separator">•</span>
          {adminMode ? "Admin mode" : "View only"}
        </div>

        {tab === "overview" && (
          <section className="stats-grid">
            <article className="stat-card">
              <div className="stat-icon">
                <ArrowDownRight size={20} />
              </div>
              <span>Total contributions</span>
              <strong>{money(totalContributions)}</strong>
              <small>Money received from families</small>
            </article>

            <article className="stat-card">
              <div className="stat-icon">
                <ArrowUpRight size={20} />
              </div>
              <span>Total expenses</span>
              <strong>{money(totalExpenses)}</strong>
              <small>Money spent on the tour</small>
            </article>

            <article className="stat-card">
              <div className="stat-icon">
                <IndianRupee size={20} />
              </div>
              <span>Available balance</span>
              <strong>{money(balance)}</strong>
              <small>Contributions minus expenses</small>
            </article>

            <article className="stat-card">
              <div className="stat-icon">
                <Coins size={20} />
              </div>
              <span>Tour members</span>
              <strong>{totalMembers}</strong>
              <small>{families.length} family records</small>
            </article>
          </section>
        )}

        {tab === "overview" && (
          <section className="data-card">
            <div className="section-heading">
              <div>
                <div className="eyebrow">LIVE REGISTER</div>
                <h2>Complete tour ledger</h2>
                <p className="section-note">
                  Contributions and expenses with a running balance.
                </p>
              </div>
            </div>

            {loading ? (
              <p className="empty-state">Loading ledger…</p>
            ) : ledgerRows.length === 0 ? (
              <p className="empty-state">
                No transactions yet. Contributions and expenses will appear
                here.
              </p>
            ) : (
              <>
                <div className="desktop-only-table">
                  <table className="ledger-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Description</th>
                        <th>Type</th>
                        <th>Money in</th>
                        <th>Money out</th>
                        <th>Balance</th>
                        {adminMode && <th>Action</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {ledgerRows.map((item) => (
                        <tr key={item.key}>
                          <td>
                            <span className="date-cell">
                              <CalendarDays size={14} />
                              {dateLabel(item.date)}
                            </span>
                          </td>
                          <td>
                            <div className="expense-name">
                              <span className="expense-symbol">
                                {item.income ? (
                                  <ArrowDownRight size={17} />
                                ) : (
                                  <ArrowUpRight size={17} />
                                )}
                              </span>
                              <div>
                                <strong>{item.description}</strong>
                                <small>{item.category}</small>
                              </div>
                            </div>
                          </td>
                          <td>
                            <span
                              className={`settlement ${
                                item.income ? "settled" : "pending"
                              }`}
                            >
                              {item.income ? "Contribution" : "Expense"}
                            </span>
                          </td>
                          <td className="money-in">
                            {item.income ? money(item.income) : "—"}
                          </td>
                          <td className="money-out">
                            {item.expense ? money(item.expense) : "—"}
                          </td>
                          <td className="balance-cell">
                            {money(item.balance)}
                          </td>
                          {adminMode && (
                            <td className="row-actions">
                              <button
                                className="text-button"
                                disabled={busy}
                                onClick={() =>
                                  item.recordType === "expenses"
                                    ? startEditExpense(
                                        expenses.find(
                                          (record) =>
                                            record.id === item.recordId
                                        )
                                      )
                                    : startEditFamily(
                                        families.find(
                                          (record) =>
                                            record.id === item.recordId
                                        )
                                      )
                                }
                              >
                                <Pencil size={14} /> Edit
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mobile-ledger-list">
                  {ledgerRows.map((item) => (
                    <article className="mobile-ledger-card" key={item.key}>
                      <div className="mobile-ledger-heading">
                        <div className="mobile-ledger-description">
                          <strong>{item.description}</strong>
                          <span>
                            {item.category} · {dateLabel(item.date)}
                          </span>
                        </div>
                        <strong
                          className={
                            item.income
                              ? "ledger-income-amount"
                              : "ledger-expense-amount"
                          }
                        >
                          {item.income
                            ? `+${money(item.income)}`
                            : `−${money(item.expense)}`}
                        </strong>
                      </div>

                      <div className="mobile-ledger-details">
                        <span>Paid by / Family: {item.paidBy || "—"}</span>
                      </div>

                      <div className="mobile-ledger-balance">
                        <span>Running balance</span>
                        <strong>{money(item.balance)}</strong>
                      </div>

                      {adminMode && (
                        <div className="form-actions">
                          <button
                            className="text-button"
                            disabled={busy}
                            onClick={() =>
                              item.recordType === "expenses"
                                ? startEditExpense(
                                    expenses.find(
                                      (record) =>
                                        record.id === item.recordId
                                    )
                                  )
                                : startEditFamily(
                                    families.find(
                                      (record) =>
                                        record.id === item.recordId
                                    )
                                  )
                            }
                          >
                            <Pencil size={14} /> Edit
                          </button>
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              </>
            )}
          </section>
        )}

        {adminMode && (
          <section ref={managerTourRef} className="admin-panel">
            <div className="section-heading">
              <div>
                <div className="eyebrow">ADMIN TOOLS</div>
                <h2>Manage tour records</h2>
              </div>
              <span className="admin-tag">
                <ShieldCheck size={14} /> Admin enabled
              </span>
            </div>

            <div className="forms-grid">
              <form className="entry-form" onSubmit={saveExpense}>
                <div className="expense-form-heading">
  <h3>
    <Plus size={17} />
    {editingExpenseId ? "Editing Existing Expense" : "Add New Expense"}
  </h3>

  {editingExpenseId && (
    <button
      className="text-button"
      type="button"
      disabled={busy}
      onClick={cancelExpenseEdit}
    >
      + Add New Expense
    </button>
  )}
</div>

                <label>
                  Description
                  <input
                    required
                    value={expenseForm.description}
                    onChange={(event) =>
                      setExpenseForm({
                        ...expenseForm,
                        description: event.target.value,
                      })
                    }
                    placeholder="e.g. Bus booking"
                  />
                </label>

                <label>
                  Date
                  <input
                    required
                    type="date"
                    value={expenseForm.expense_date}
                    onChange={(event) =>
                      setExpenseForm({
                        ...expenseForm,
                        expense_date: event.target.value,
                      })
                    }
                  />
                </label>

                <label>
                  Amount (₹)
                  <input
                    required
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={expenseForm.amount}
                    onChange={(event) =>
                      setExpenseForm({
                        ...expenseForm,
                        amount: event.target.value,
                      })
                    }
                  />
                </label>

                <div className="field-row">
                  <label>
                    Paid by
                    <input
                      value={expenseForm.paid_by}
                      onChange={(event) =>
                        setExpenseForm({
                          ...expenseForm,
                          paid_by: event.target.value,
                        })
                      }
                      placeholder="Name (optional)"
                    />
                  </label>

                  <label>
                    Category
                    <select
                      value={expenseForm.category}
                      onChange={(event) =>
                        setExpenseForm({
                          ...expenseForm,
                          category: event.target.value,
                        })
                      }
                    >
                      <option>Travel</option>
                      <option>Hotel</option>
                      <option>Food</option>
                      <option>Temple</option>
                      <option>Shopping</option>
                      <option>Other</option>
                    </select>
                  </label>
                </div>

                <div className="form-actions">
                  <button
                    className="primary-button"
                    disabled={busy}
                    type="submit"
                  >
                    {busy
                      ? "Saving…"
                      : editingExpenseId
                        ? "Update expense"
                        : "Save expense"}
                  </button>

                  {editingExpenseId && (
                    <button
                      className="text-button"
                      type="button"
                      onClick={cancelExpenseEdit}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </form>

              <form className="entry-form" onSubmit={saveFamily}>
                <div className="expense-form-heading">
                  <h3>
                    <Plus size={17} />
                    {editingFamilyId
                      ? "Editing Existing Contribution"
                      : "Add New Contribution"}
                  </h3>
                  {editingFamilyId && (
                    <button
                      className="text-button"
                      type="button"
                      disabled={busy}
                      onClick={cancelFamilyEdit}
                    >
                      + Add New Contribution
                    </button>
                  )}
                </div>

                <label>
                  Family name
                  <input
                    required
                    value={familyForm.family_name}
                    onChange={(event) =>
                      setFamilyForm({
                        ...familyForm,
                        family_name: event.target.value,
                      })
                    }
                    placeholder="e.g. Patil family"
                  />
                </label>

                <label>
                  Contribution date
                  <input
                    required
                    type="date"
                    value={familyForm.contribution_date}
                    onChange={(event) =>
                      setFamilyForm({
                        ...familyForm,
                        contribution_date: event.target.value,
                      })
                    }
                  />
                </label>

                <label>
                  Paid (₹)
                  <input
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    value={familyForm.contribution_paid}
                    onChange={(event) =>
                      setFamilyForm({
                        ...familyForm,
                        contribution_paid: event.target.value,
                      })
                    }
                  />
                </label>

                <p className="contribution-rule">
                  Required per couple:{" "}
                  <strong>{money(REQUIRED_PER_COUPLE)}</strong>. Payment status
                  is calculated automatically from the amount paid.
                </p>

                <label>
                  Payment mode
                  <input
                    value={familyForm.payment_mode}
                    onChange={(event) =>
                      setFamilyForm({
                        ...familyForm,
                        payment_mode: event.target.value,
                      })
                    }
                    placeholder="Cash, UPI, etc. (optional)"
                  />
                </label>

                <div className="form-actions">
                  <button
                    className="primary-button"
                    disabled={busy}
                    type="submit"
                  >
                    {busy
                      ? "Saving…"
                      : editingFamilyId
                        ? "Update contribution"
                        : "Save family"}
                  </button>

                  {editingFamilyId && (
                    <button
                      className="text-button"
                      type="button"
                      onClick={cancelFamilyEdit}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            </div>
          </section>
        )}

        {(tab === "overview" || tab === "expenses") && (
          <section className="data-card">
            <div className="section-heading">
              <div>
                <div className="eyebrow">TRANSACTION HISTORY</div>
                <h2>Recent expenses</h2>
              </div>

              {tab === "overview" && (
                <button
                  className="text-button"
                  onClick={() => setTab("expenses")}
                >
                  View all
                </button>
              )}
            </div>

            {loading ? (
              <p className="empty-state">Loading expenses…</p>
            ) : expenses.length === 0 ? (
              <p className="empty-state">
                No expenses added yet.{" "}
                {adminMode
                  ? "Use the form above to add the first expense."
                  : "The tour admin can add the first expense."}
              </p>
            ) : (
              <>
                <div className="desktop-only-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Expense</th>
                        <th>Date</th>
                        <th>Paid by</th>
                        <th>Amount</th>
                        {adminMode && <th>Action</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {sortedExpenses.map((item) => (
                        <tr key={item.id}>
                          <td>
                            <div className="expense-name">
                              <span className="expense-symbol">
                                <Wallet size={17} />
                              </span>
                              <div>
                                <strong>{item.description}</strong>
                                <small>{item.category || "General"}</small>
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className="date-cell">
                              <CalendarDays size={14} />
                              {dateLabel(item.expense_date)}
                            </span>
                          </td>
                          <td>{item.paid_by || "—"}</td>
                          <td className="amount-cell">{money(item.amount)}</td>
                          {adminMode && (
                            <td className="row-actions">
                              <button
                                className="text-button"
                                disabled={busy}
                                onClick={() => startEditExpense(item)}
                              >
                                <Pencil size={14} /> Edit
                              </button>
                              <button
                                className="delete-button"
                                disabled={busy}
                                onClick={() =>
                                  deleteRecord("expenses", item.id)
                                }
                              >
                                Delete
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mobile-ledger-list">
                  {sortedExpenses.map((item) => (
                    <article
                      className="mobile-ledger-card"
                      key={`expense-${item.id}`}
                    >
                      <div className="mobile-ledger-heading">
                        <div className="mobile-ledger-description">
                          <strong>{item.description}</strong>
                          <span>
                            {item.category || "General"} ·{" "}
                            {dateLabel(item.expense_date)}
                          </span>
                        </div>

                        <strong className="ledger-expense-amount">
                          −{money(item.amount)}
                        </strong>
                      </div>

                      <div className="mobile-ledger-details">
                        <span>Paid by: {item.paid_by || "—"}</span>
                      </div>

                      {adminMode && (
                        <div className="form-actions">
                          <button
                            className="text-button"
                            disabled={busy}
                            onClick={() => startEditExpense(item)}
                          >
                            <Pencil size={14} /> Edit
                          </button>

                          <button
                            className="delete-button"
                            disabled={busy}
                            onClick={() =>
                              deleteRecord("expenses", item.id)
                            }
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              </>
            )}
          </section>
        )}

        {(tab === "overview" || tab === "families") && (
          <section className="data-card">
            <div className="section-heading">
              <div>
                <div className="eyebrow">CONTRIBUTION OVERVIEW</div>
                <h2>Family contributions</h2>
                <p className="section-note">
                  Sort by family name or contribution date.
                </p>
              </div>

              <label className="sort-control">
                Sort by
                <select
                  value={familySort}
                  onChange={(event) => setFamilySort(event.target.value)}
                >
                  <option value="name">Family name (A–Z)</option>
                  <option value="date">Latest contribution date</option>
                </select>
              </label>

              <span className="count-pill">{families.length} families</span>
            </div>

            <div className="contribution-summary">
              <div>
                <span>Required per couple</span>
                <strong>{money(REQUIRED_PER_COUPLE)}</strong>
              </div>
              <div>
                <span>Families paid</span>
                <strong>
                  {
                    families.filter(
                      (item) =>
                        familyStatus(item.settlement_status) === "Paid"
                    ).length
                  }
                </strong>
              </div>
              <div>
                <span>Amount received</span>
                <strong>{money(totalContributions)}</strong>
              </div>
              <div>
                <span>Payment pending</span>
                <strong>{pendingFamilies} families</strong>
              </div>
            </div>

            {loading ? (
              <p className="empty-state">Loading family records…</p>
            ) : families.length === 0 ? (
              <p className="empty-state">
                No family records yet.{" "}
                {adminMode
                  ? "Add the first family above."
                  : "Family details will appear here when added by the admin."}
              </p>
            ) : (
              <>
                <div className="desktop-only-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Family</th>
                        <th>Contribution date</th>
                        <th>Members</th>
                        <th>Required (₹)</th>
                        <th>Paid (₹)</th>
                        <th>Remaining (₹)</th>
                        <th>Payment mode</th>
                        <th>Status</th>
                        {adminMode && <th>Action</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {sortedFamilies.map((item) => {
                        const paid = Number(item.contribution_paid || 0);
                        const isPaid = paid >= REQUIRED_PER_COUPLE;

                        return (
                          <tr key={item.id}>
                            <td>
                              <strong>{item.family_name}</strong>
                            </td>
                            <td>
                              {dateLabel(
                                item.contribution_date || item.created_at
                              )}
                            </td>
                            <td>2</td>
                            <td>{money(REQUIRED_PER_COUPLE)}</td>
                            <td className="amount-cell">{money(paid)}</td>
                            <td className="amount-cell">
                              {money(Math.max(0, REQUIRED_PER_COUPLE - paid))}
                            </td>
                            <td>{item.payment_mode || "—"}</td>
                            <td>
                              <span
                                className={`settlement ${
                                  isPaid ? "settled" : "pending"
                                }`}
                              >
                                {isPaid ? "Paid" : "Pending"}
                              </span>
                            </td>

                            {adminMode && (
                              <td className="row-actions">
                                <button
                                  className="text-button"
                                  disabled={busy}
                                  onClick={() => startEditFamily(item)}
                                >
                                  <Pencil size={14} /> Edit
                                </button>
                                <button
                                  className="delete-button"
                                  disabled={busy}
                                  onClick={() =>
                                    deleteRecord("families", item.id)
                                  }
                                >
                                  Delete
                                </button>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="mobile-ledger-list">
                  {sortedFamilies.map((item) => {
                    const paid = Number(item.contribution_paid || 0);
                    const remaining = Math.max(
                      0,
                      REQUIRED_PER_COUPLE - paid
                    );
                    const isPaid = paid >= REQUIRED_PER_COUPLE;

                    return (
                      <article
                        className="mobile-ledger-card"
                        key={`family-${item.id}`}
                      >
                        <div className="mobile-ledger-heading">
                          <div className="mobile-ledger-description">
                            <strong>{item.family_name}</strong>
                            <span>
                              Contribution ·{" "}
                              {dateLabel(
                                item.contribution_date || item.created_at
                              )}
                            </span>
                          </div>

                          <strong className="ledger-income-amount">
                            {money(paid)}
                          </strong>
                        </div>

                        <div className="mobile-ledger-details">
                          <span>Members: 2</span>
                          <span>Payment mode: {item.payment_mode || "—"}</span>
                          <span>
                            Status: {isPaid ? "Paid" : "Pending"}
                          </span>
                        </div>

                        <div className="mobile-ledger-balance">
                          <span>Remaining</span>
                          <strong>{money(remaining)}</strong>
                        </div>

                        {adminMode && (
                          <div className="form-actions">
                            <button
                              className="text-button"
                              disabled={busy}
                              onClick={() => startEditFamily(item)}
                            >
                              <Pencil size={14} /> Edit
                            </button>

                            <button
                              className="delete-button"
                              disabled={busy}
                              onClick={() =>
                                deleteRecord("families", item.id)
                              }
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              </>
            )}
          </section>
        )}

        <footer className="footer">
          <span>Dev Darshan • Shared tour expenses</span>
          <span>
            <Clock3 size={14} /> Data refreshes automatically
          </span>
        </footer>
      </section>

      {adminOpen && (
        <div
          className="modal-backdrop"
          onClick={() => setAdminOpen(false)}
        >
          <form
            className="admin-modal"
            onSubmit={enterAdmin}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="modal-close"
              type="button"
              onClick={() => setAdminOpen(false)}
              aria-label="Close"
            >
              <X size={19} />
            </button>

            <div className="modal-icon">
              <LockKeyhole size={25} />
            </div>

            <h2>Admin access</h2>
            <p>Enter the private admin passcode to manage tour records.</p>

            <label>
              Admin passcode
              <input
                autoFocus
                required
                type="password"
                value={passcode}
                onChange={(event) => setPasscode(event.target.value)}
                placeholder="Enter passcode"
              />
            </label>

            <button className="primary-button" type="submit">
              Continue securely
            </button>

            <small>
              <CheckCircle2 size={14} /> The passcode is not saved in the
              website files.
            </small>
          </form>
        </div>
      )}
    </main>
  );
}
