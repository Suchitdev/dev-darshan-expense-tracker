import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Coins,
  IndianRupee,
  LockKeyhole,
  LogOut,
  Pencil,
  Plus,
  RefreshCw,
  ShieldCheck,
  Wallet,
  X,
} from "lucide-react";
import { supabase } from "./lib/supabase";
import "./App.css";

const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/smart-task`;
const REQUIRED_PER_COUPLE = 9000;

const today = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
};

const money = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);

const dateLabel = (value) => {
  if (!value) return "—";

  const date = String(value).slice(0, 10);
  const [year, month, day] = date.split("-").map(Number);

  if (!year || !month || !day) return "—";

  return new Date(year, month - 1, day).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
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
  contribution_paid: "0",
  payment_mode: "",
  contribution_date: today(),
});

const familyStatus = (family) =>
  Number(family?.contribution_paid || 0) >= REQUIRED_PER_COUPLE
    ? "Paid"
    : "Pending";

export default function App() {
  const [families, setFamilies] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [tab, setTab] = useState("overview");
  const [familySort, setFamilySort] = useState("name");

  const [adminOpen, setAdminOpen] = useState(false);
  const [passcode, setPasscode] = useState("");
  const [adminMode, setAdminMode] = useState(false);

  const [expenseForm, setExpenseForm] = useState(emptyExpenseForm);
  const [familyForm, setFamilyForm] = useState(emptyFamilyForm);

  const [editingExpenseId, setEditingExpenseId] = useState(null);
  const [editingFamilyId, setEditingFamilyId] = useState(null);

  const loadData = useCallback(async (showSpinner = false) => {
    if (showSpinner) setLoading(true);

    setError("");

    try {
      const [familyResult, expenseResult] = await Promise.all([
        supabase.from("families").select("*"),
        supabase.from("expenses").select("*"),
      ]);

      if (familyResult.error) throw familyResult.error;
      if (expenseResult.error) throw expenseResult.error;

      setFamilies(familyResult.data || []);
      setExpenses(expenseResult.data || []);
    } catch (err) {
      setError(err.message || "Could not load tour data.");
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

  // When Edit is clicked, automatically bring the relevant form into view.
  useEffect(() => {
    if (editingExpenseId || editingFamilyId) {
      requestAnimationFrame(() => {
        document.getElementById("admin-entry-forms")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
    }
  }, [editingExpenseId, editingFamilyId]);

  const totalContributions = useMemo(
    () =>
      families.reduce(
        (sum, family) => sum + Number(family.contribution_paid || 0),
        0
      ),
    [families]
  );

  const totalExpenses = useMemo(
    () =>
      expenses.reduce(
        (sum, expense) => sum + Number(expense.amount || 0),
        0
      ),
    [expenses]
  );

  const balance = totalContributions - totalExpenses;
  const totalMembers = families.length * 2;

  const pendingFamilies = families.filter(
    (family) => familyStatus(family) === "Pending"
  ).length;

  const paidFamilies = families.filter(
    (family) => familyStatus(family) === "Paid"
  ).length;

  // Alphabetical by default; optionally sort by most recent contribution date.
  const sortedFamilies = useMemo(
    () =>
      [...families].sort((a, b) => {
        if (familySort === "date") {
          const dateA = String(
            a.contribution_date || a.created_at || ""
          ).slice(0, 10);

          const dateB = String(
            b.contribution_date || b.created_at || ""
          ).slice(0, 10);

          return dateB.localeCompare(dateA) ||
            String(a.family_name || "").localeCompare(
              String(b.family_name || ""),
              "en",
              { sensitivity: "base" }
            );
        }

        return String(a.family_name || "").localeCompare(
          String(b.family_name || ""),
          "en",
          { sensitivity: "base" }
        );
      }),
    [families, familySort]
  );

  // Expenses: newest date first. Same-day records sort by creation time.
  const sortedExpenses = useMemo(
    () =>
      [...expenses].sort((a, b) => {
        const dateA = String(
          a.expense_date || a.created_at || ""
        ).slice(0, 10);

        const dateB = String(
          b.expense_date || b.created_at || ""
        ).slice(0, 10);

        return (
          dateB.localeCompare(dateA) ||
          String(b.created_at || "").localeCompare(String(a.created_at || ""))
        );
      }),
    [expenses]
  );

  /*
   * Build the ledger in chronological order first.
   * The balance for each row is calculated from all earlier transactions.
   * Keep this table oldest-first so the running balance reads naturally.
   */
  const ledgerRows = useMemo(() => {
    const entries = [
      ...families
        .filter((family) => Number(family.contribution_paid || 0) > 0)
        .map((family) => ({
          key: `family-${family.id}`,
          recordType: "families",
          recordId: family.id,
          date: String(
            family.contribution_date || family.created_at || ""
          ).slice(0, 10),
          createdAt: family.created_at || "",
          description: `Contribution — ${family.family_name}`,
          category: "Contribution",
          paidBy: family.family_name || "—",
          income: Number(family.contribution_paid || 0),
          expense: 0,
        })),

      ...expenses.map((expense) => ({
        key: `expense-${expense.id}`,
        recordType: "expenses",
        recordId: expense.id,
        date: String(
          expense.expense_date || expense.created_at || ""
        ).slice(0, 10),
        createdAt: expense.created_at || "",
        description: expense.description || "Expense",
        category: expense.category || "Other",
        paidBy: expense.paid_by || "—",
        income: 0,
        expense: Number(expense.amount || 0),
      })),
    ];

    entries.sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        a.createdAt.localeCompare(b.createdAt) ||
        a.key.localeCompare(b.key)
    );

    let runningBalance = 0;

    return entries.map((entry) => {
      runningBalance += entry.income - entry.expense;

      return {
        ...entry,
        balance: runningBalance,
      };
    });
  }, [families, expenses]);

  async function adminRequest(table, action, data, id) {
    if (!passcode.trim()) {
      throw new Error("Admin passcode is missing. Please enter it again.");
    }

    const response = await fetch(FUNCTION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        "x-admin-passcode": passcode,
      },
      body: JSON.stringify({
        table,
        action,
        ...(data !== undefined ? { data } : {}),
        ...(id !== undefined && id !== null ? { id } : {}),
      }),
    });

    let result;

    try {
      result = await response.json();
    } catch {
      throw new Error(
        `Server returned an invalid response (HTTP ${response.status}).`
      );
    }

    if (!response.ok || result.success === false) {
      throw new Error(
        result.error || `Request failed (HTTP ${response.status}).`
      );
    }

    return result;
  }

  function startEditExpense(item) {
    if (!item) {
      setMessage("Could not find this expense. Refresh and try again.");
      return;
    }

    setEditingFamilyId(null);
    setFamilyForm(emptyFamilyForm());

    setEditingExpenseId(item.id);
    setExpenseForm({
      description: item.description || "",
      amount: String(item.amount ?? ""),
      expense_date: String(
        item.expense_date || item.created_at || today()
      ).slice(0, 10),
      paid_by: item.paid_by || "",
      category: item.category || "Travel",
    });

    setTab("overview");
    setMessage("Edit the expense in the form below, then click Update expense.");
  }

  function startEditFamily(item) {
    if (!item) {
      setMessage("Could not find this family. Refresh and try again.");
      return;
    }

    setEditingExpenseId(null);
    setExpenseForm(emptyExpenseForm());

    setEditingFamilyId(item.id);
    setFamilyForm({
      family_name: item.family_name || "",
      contribution_paid: String(item.contribution_paid ?? "0"),
      payment_mode: item.payment_mode || "",
      contribution_date: String(
        item.contribution_date || item.created_at || today()
      ).slice(0, 10),
    });

    setTab("overview");
    setMessage(
      "Edit the contribution in the form below, then click Update contribution."
    );
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

    if (!expenseForm.description.trim()) {
      setMessage("Please enter an expense description.");
      return;
    }

    if (!expenseForm.expense_date) {
      setMessage("Please select the expense date.");
      return;
    }

    const amount = Number(expenseForm.amount);

    if (!Number.isFinite(amount) || amount <= 0) {
      setMessage("Enter an expense amount greater than zero.");
      return;
    }

    setBusy(true);
    setMessage("");

    try {
      await adminRequest(
        "expenses",
        editingExpenseId ? "update" : "insert",
        {
          description: expenseForm.description.trim(),
          amount,
          expense_date: expenseForm.expense_date,
          paid_by: expenseForm.paid_by.trim() || null,
          category: expenseForm.category,
        },
        editingExpenseId
      );

      setEditingExpenseId(null);
      setExpenseForm(emptyExpenseForm());

      await loadData();

      setMessage(
        editingExpenseId
          ? "Expense updated successfully."
          : "Expense added successfully."
      );
    } catch (err) {
      setMessage(`Could not save expense: ${err.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function saveFamily(event) {
    event.preventDefault();

    if (!familyForm.family_name.trim()) {
      setMessage("Please enter the family name.");
      return;
    }

    if (!familyForm.contribution_date) {
      setMessage("Please select the contribution date.");
      return;
    }

    const amountPaid = Number(familyForm.contribution_paid);

    if (!Number.isFinite(amountPaid) || amountPaid < 0) {
      setMessage("Enter a valid contribution amount.");
      return;
    }

    setBusy(true);
    setMessage("");

    try {
      await adminRequest(
        "families",
        editingFamilyId ? "update" : "insert",
        {
          family_name: familyForm.family_name.trim(),
          pilgrim_members: 2,
          contribution_paid: amountPaid,
          settlement_status:
            amountPaid >= REQUIRED_PER_COUPLE ? "Paid" : "Pending",
          payment_mode: familyForm.payment_mode.trim() || null,
          contribution_date: familyForm.contribution_date,
        },
        editingFamilyId
      );

      setEditingFamilyId(null);
      setFamilyForm(emptyFamilyForm());

      await loadData();

      setMessage(
        editingFamilyId
          ? "Family contribution updated successfully."
          : "Family contribution added successfully."
      );
    } catch (err) {
      setMessage(`Could not save family contribution: ${err.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function deleteRecord(table, id) {
    if (!id) {
      setMessage("Could not identify the record to delete.");
      return;
    }

    const confirmed = window.confirm(
      "Are you sure you want to delete this record permanently?"
    );

    if (!confirmed) return;

    setBusy(true);
    setMessage("");

    try {
      await adminRequest(table, "delete", undefined, id);

      if (table === "expenses" && editingExpenseId === id) {
        cancelExpenseEdit();
      }

      if (table === "families" && editingFamilyId === id) {
        cancelFamilyEdit();
      }

      await loadData();
      setMessage("Record deleted successfully.");
    } catch (err) {
      setMessage(`Could not delete record: ${err.message}`);
    } finally {
      setBusy(false);
    }
  }

  function enterAdmin(event) {
    event.preventDefault();

    if (!passcode.trim()) {
      setMessage("Please enter your admin passcode.");
      return;
    }

    setAdminMode(true);
    setAdminOpen(false);
    setMessage(
      "Admin mode enabled. The server verifies your passcode when you save or delete a record."
    );
  }

  function leaveAdmin() {
    setAdminMode(false);
    setPasscode("");
    setAdminOpen(false);
    cancelExpenseEdit();
    cancelFamilyEdit();
    setMessage("Admin mode exited.");
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
          type="button"
          className={`nav-link ${tab === "overview" ? "active" : ""}`}
          onClick={() => setTab("overview")}
        >
          <Activity size={18} /> Overview
        </button>

        <button
          type="button"
          className={`nav-link ${tab === "expenses" ? "active" : ""}`}
          onClick={() => setTab("expenses")}
        >
          <Wallet size={18} /> Expenses
        </button>

        <button
          type="button"
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
            <button
              type="button"
              className="admin-button"
              onClick={leaveAdmin}
            >
              <LogOut size={17} /> Exit admin mode
            </button>
          ) : (
            <button
              type="button"
              className="admin-button"
              onClick={() => setAdminOpen(true)}
            >
              <LockKeyhole size={17} /> Admin access
            </button>
          )}
        </div>
      </aside>

      <section className="main-content">
        <header className="page-header">
          <div>
            <div className="eyebrow">DEV DARSHAN TOUR</div>
            <h1>Tour Expense Tracker</h1>
            <p>Contributions, expenses and tour balance in one place.</p>
          </div>

          <button
            type="button"
            className="refresh-button"
            disabled={loading}
            onClick={() => loadData(true)}
          >
            <RefreshCw size={16} /> Refresh
          </button>
        </header>

        {error && (
          <div className="error-banner" role="alert">
            {error}
          </div>
        )}

        {message && (
          <div className="message-banner" role="status">
            {message}
          </div>
        )}

        {loading && <p className="empty-state">Loading tour data…</p>}

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
              <Wallet size={20} />
            </div>
            <span>Available balance</span>
            <strong>{money(balance)}</strong>
            <small>
              {balance < 0
                ? "Expenses exceed contributions"
                : "Contributions minus expenses"}
            </small>
          </article>

          <article className="stat-card">
            <div className="stat-icon">
              <Coins size={20} />
            </div>
            <span>Tour members</span>
            <strong>{totalMembers}</strong>
            <small>{pendingFamilies} families have payment pending</small>
          </article>
        </section>

        {tab === "overview" && (
          <section className="data-card ledger-card">
            <div className="section-heading">
              <div>
                <div className="eyebrow">TOUR ACCOUNT BOOK</div>
                <h2>Dev Darshan Expense Register</h2>
                <p className="section-note">
                  Transactions are shown oldest to newest so the running balance
                  is easy to follow.
                </p>
              </div>
              <span className="count-pill">{ledgerRows.length} entries</span>
            </div>

            <div className="desktop-only-table table-wrap">
              <table className="ledger-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Details</th>
                    <th>Category</th>
                    <th>Paid by / Family</th>
                    <th>Money in</th>
                    <th>Money out</th>
                    <th>Running balance</th>
                    {adminMode && <th>Action</th>}
                  </tr>
                </thead>

                <tbody>
                  {ledgerRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={adminMode ? 8 : 7}
                        className="empty-state"
                      >
                        No tour entries yet.
                      </td>
                    </tr>
                  ) : (
                    ledgerRows.map((item) => (
                      <tr key={item.key}>
                        <td>{dateLabel(item.date)}</td>
                        <td>
                          <strong>{item.description}</strong>
                        </td>
                        <td>{item.category}</td>
                        <td>{item.paidBy}</td>
                        <td className="money-in">
                          {item.income > 0 ? money(item.income) : "—"}
                        </td>
                        <td className="money-out">
                          {item.expense > 0 ? money(item.expense) : "—"}
                        </td>
                        <td className="balance-cell">
                          <strong>{money(item.balance)}</strong>
                        </td>

                        {adminMode && (
                          <td className="row-actions">
                            <button
                              type="button"
                              className="text-button"
                              disabled={busy}
                              onClick={() => {
                                if (item.recordType === "expenses") {
                                  const record = expenses.find(
                                    (expense) => expense.id === item.recordId
                                  );
                                  startEditExpense(record);
                                } else {
                                  const record = families.find(
                                    (family) => family.id === item.recordId
                                  );
                                  startEditFamily(record);
                                }
                              }}
                            >
                              <Pencil size={14} /> Edit
                            </button>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>

                
{ledgerRows.length > 0 && (
  <tfoot>
    <tr>
      <td colSpan={4}>
        <strong>Current total</strong>
      </td>
      <td className="money-in">
        <strong>{money(totalContributions)}</strong>
      </td>
      <td className="money-out">
        <strong>{money(totalExpenses)}</strong>
      </td>
      <td className="balance-cell">
        <strong>{money(balance)}</strong>
      </td>
      {adminMode && <td />}
    </tr>
  </tfoot>
)}

              </table>
            </div>
          </section>
        )}

        {adminMode && (
          <section className="admin-panel" id="admin-entry-forms">
            <div className="section-heading">
              <div>
                <div className="eyebrow">ADMIN TOOLS</div>
                <h2>Manage tour records</h2>
              </div>

              <span className="admin-tag">
                <ShieldCheck size={14} /> Admin enabled
              </span>
            </div> 

            <div className="mobile-expense-list">
  {sortedExpenses.map((item) => (
    <article className="mobile-expense-card" key={item.id}>
      <div className="mobile-expense-top">
        <span className="expense-symbol">
          <Wallet size={18} />
        </span>

        <div className="mobile-expense-info">
          <strong>{item.description}</strong>
          <span>{item.category || "Other"}</span>
        </div>

        <strong className="mobile-expense-amount">
          {money(item.amount)}
        </strong>
      </div>

      <div className="mobile-expense-meta">
        <span>
          <CalendarDays size={13} />
          {dateLabel(item.expense_date || item.created_at)}
        </span>
        <span>Paid by: {item.paid_by || "—"}</span>
      </div>

      {adminMode && (
        <div className="mobile-card-actions">
          <button
            type="button"
            className="text-button"
            disabled={busy}
            onClick={() => startEditExpense(item)}
          >
            <Pencil size={14} /> Edit
          </button>

          <button
            type="button"
            className="delete-button"
            disabled={busy}
            onClick={() => deleteRecord("expenses", item.id)}
          >
            Delete
          </button>
        </div>
      )}
    </article>
  ))}
</div>

            <div className="forms-grid">
              <form className="entry-form" onSubmit={saveExpense}>
                <h3>
                  <Plus size={17} />
                  {editingExpenseId ? "Edit expense" : "Add expense"}
                </h3>

                <label>
                  Description
                  <input
                    required
                    value={expenseForm.description}
                    onChange={(event) =>
                      setExpenseForm((previous) => ({
                        ...previous,
                        description: event.target.value,
                      }))
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
                      setExpenseForm((previous) => ({
                        ...previous,
                        expense_date: event.target.value,
                      }))
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
                      setExpenseForm((previous) => ({
                        ...previous,
                        amount: event.target.value,
                      }))
                    }
                    placeholder="Enter amount"
                  />
                </label>

                <div className="field-row">
                  <label>
                    Paid by
                    <input
                      value={expenseForm.paid_by}
                      onChange={(event) =>
                        setExpenseForm((previous) => ({
                          ...previous,
                          paid_by: event.target.value,
                        }))
                      }
                      placeholder="Name (optional)"
                    />
                  </label>

                  <label>
                    Category
                    <select
                      value={expenseForm.category}
                      onChange={(event) =>
                        setExpenseForm((previous) => ({
                          ...previous,
                          category: event.target.value,
                        }))
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
                      disabled={busy}
                      onClick={cancelExpenseEdit}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </form>

              <form className="entry-form" onSubmit={saveFamily}>
                <h3>
                  <Plus size={17} />
                  {editingFamilyId
                    ? "Edit family contribution"
                    : "Add family contribution"}
                </h3>

                <label>
                  Family name
                  <input
                    required
                    value={familyForm.family_name}
                    onChange={(event) =>
                      setFamilyForm((previous) => ({
                        ...previous,
                        family_name: event.target.value,
                      }))
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
                      setFamilyForm((previous) => ({
                        ...previous,
                        contribution_date: event.target.value,
                      }))
                    }
                  />
                </label>

                <label>
                  Amount paid (₹)
                  <input
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    value={familyForm.contribution_paid}
                    onChange={(event) =>
                      setFamilyForm((previous) => ({
                        ...previous,
                        contribution_paid: event.target.value,
                      }))
                    }
                  />
                </label>

                <p className="contribution-rule">
                  Required per couple:{" "}
                  <strong>{money(REQUIRED_PER_COUPLE)}</strong>.
                  <br />
                  Remaining:{" "}
                  <strong>
                    {money(
                      Math.max(
                        0,
                        REQUIRED_PER_COUPLE -
                          Number(familyForm.contribution_paid || 0)
                      )
                    )}
                  </strong>
                  <br />
                  Status:{" "}
                  <strong>
                    {Number(familyForm.contribution_paid || 0) >=
                    REQUIRED_PER_COUPLE
                      ? "Paid"
                      : "Pending"}
                  </strong>
                </p>

                <label>
                  Payment mode
                  <input
                    value={familyForm.payment_mode}
                    onChange={(event) =>
                      setFamilyForm((previous) => ({
                        ...previous,
                        payment_mode: event.target.value,
                      }))
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
                      disabled={busy}
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
                  type="button"
                  className="text-button"
                  onClick={() => setTab("expenses")}
                >
                  View all
                </button>
              )}
            </div>

            {loading ? (
              <p className="empty-state">Loading expenses…</p>
            ) : sortedExpenses.length === 0 ? (
              <p className="empty-state">No expenses added yet.</p>
            ) : (
              <div className="table-wrap">
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
                              <small>{item.category || "Other"}</small>
                            </div>
                          </div>
                        </td>

                        <td>
                          <span className="date-cell">
                            <CalendarDays size={14} />
                            {dateLabel(item.expense_date || item.created_at)}
                          </span>
                        </td>

                        <td>{item.paid_by || "—"}</td>
                        <td className="amount-cell">{money(item.amount)}</td>

                        {adminMode && (
                          <td className="row-actions">
                            <button
                              type="button"
                              className="text-button"
                              disabled={busy}
                              onClick={() => startEditExpense(item)}
                            >
                              <Pencil size={14} /> Edit
                            </button>

                            <button
                              type="button"
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
                <strong>{paidFamilies}</strong>
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
              <p className="empty-state">No family records added yet.</p>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Family</th>
                      <th>Contribution date</th>
                      <th>Members</th>
                      <th>Required</th>
                      <th>Paid</th>
                      <th>Remaining</th>
                      <th>Payment mode</th>
                      <th>Status</th>
                      {adminMode && <th>Action</th>}
                    </tr>
                  </thead>

                  <tbody>
                    {sortedFamilies.map((item) => {
                      const paid = Number(item.contribution_paid || 0);
                      const remaining = Math.max(
                        0,
                        REQUIRED_PER_COUPLE - paid
                      );
                      const status = familyStatus(item);

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
                          <td className="amount-cell">{money(remaining)}</td>
                          <td>{item.payment_mode || "—"}</td>
                          <td>
                            <span
                              className={`settlement ${
                                status === "Paid" ? "settled" : "pending"
                              }`}
                            >
                              {status}
                            </span>
                          </td>

                          {adminMode && (
                            <td className="row-actions">
                              <button
                                type="button"
                                className="text-button"
                                disabled={busy}
                                onClick={() => startEditFamily(item)}
                              >
                                <Pencil size={14} /> Edit
                              </button>

                              <button
                                type="button"
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
              <CheckCircle2 size={14} />
              Your passcode is not stored in the website files.
            </small>
          </form>
        </div>
      )}
    </main>
  );
}