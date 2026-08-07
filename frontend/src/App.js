import React, { useState, useEffect } from "react";
import axios from "axios";
import { 
  Wallet, PlusCircle, ArrowUpRight, 
  PiggyBank, Target, Lightbulb, Moon, Sun, SignOut, 
  UserPlus, SignIn, ChatCircleText, CalendarBlank, User, X, Plus,
  Receipt, ChartBar, Compass, Sparkle, ArrowsClockwise
} from "@phosphor-icons/react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from "recharts";
import "./App.css";

const BACKEND_URL = "https://unipocket.onrender.com";

export default function App() {
  // Global State & State Persistence (unipocket_user)
  const [theme, setTheme] = useState("dark");
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem("unipocket_user") || localStorage.getItem("up_user");
    return saved ? JSON.parse(saved) : null;
  });
  const [authMode, setAuthMode] = useState("login"); // login or signup
  const [activeTab, setActiveTab] = useState("dashboard"); // dashboard, transactions, budgets, analytics, profile

  // Onboarding Wizard Stepper State
  const [isSetupComplete, setIsSetupComplete] = useState(true);
  const [setupStep, setSetupStep] = useState(1); // 1: Categories, 2: Budgets, 3: Completed
  const [newCategoryInput, setNewCategoryInput] = useState("");

  // Month Selection State (Format: YYYY-MM)
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  // Forms States
  const [authForm, setAuthForm] = useState({ student_id: "", name: "", email: "", password: "", contact_number: "" });
  const [profileForm, setProfileForm] = useState({ name: "", email: "", contact_number: "", password: "" });
  const [expenseForm, setExpenseForm] = useState({ title: "", amount: "", category: "Food", date: new Date().toISOString().split('T')[0] });
  const [budgetForm, setBudgetForm] = useState({ category: "Food", limit: "" });
  const [savingsForm, setSavingsForm] = useState({ goal_name: "", target_amount: "" });
  const [depositAmounts, setDepositAmounts] = useState({});

  // Category Management inside Set Budget
  const [budgetCategoryMode, setBudgetCategoryMode] = useState("select"); // select or custom
  const [customCategoryName, setCustomCategoryName] = useState("");

  // Dynamic Data States
  const [expenses, setExpenses] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [savings, setSavings] = useState([]);
  const [categories, setCategories] = useState(["Food", "Travel", "Books", "Entertainment", "Other"]);
  const [aiTip, setAiTip] = useState("Welcome to UniPocket! Log your first expense to begin gathering intelligent insights.");
  const [aiTipLoading, setAiTipLoading] = useState(false);
  const [isBreachedState, setIsBreachedState] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [alertMsg, setAlertMsg] = useState("");

  // Floating AI Coach Drawer State
  const [chatOpen, setChatOpen] = useState(false);
  const [chatLog, setChatLog] = useState([
    { sender: "ai", text: "Hey! I'm Pocky, your AI Money Coach. Ask me anything, or log some transactions to start analyzing!" }
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  // Toggle Dark/Light Mode Themes
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  // Synchronize profile form when user logs in
  useEffect(() => {
    if (user) {
      setProfileForm({
        name: user.name || "",
        email: user.email || "",
        contact_number: user.contact_number || "",
        password: ""
      });
    }
  }, [user]);

  // Confetti Particle burst on savings goal completed
  const triggerConfetti = () => {
    const container = document.body;
    for (let i = 0; i < 60; i++) {
      const el = document.createElement("div");
      el.style.position = "fixed";
      el.style.width = "10px";
      el.style.height = "10px";
      el.style.backgroundColor = ["#ccff00", "#06b6d4", "#8b5cf6", "#f97316", "#ec4899"][Math.floor(Math.random() * 5)];
      el.style.left = Math.random() * 100 + "vw";
      el.style.top = "-10px";
      el.style.zIndex = "9999";
      el.style.borderRadius = "2px";
      el.style.transform = `rotate(${Math.random() * 360}deg)`;
      el.style.transition = "transform 2s linear, top 2s linear, opacity 2s ease-out";
      container.appendChild(el);

      void el.offsetWidth;

      el.style.top = "105vh";
      el.style.transform = `rotate(${Math.random() * 720}deg) translate(${Math.random() * 100 - 50}px)`;
      el.style.opacity = "0";

      setTimeout(() => el.remove(), 2000);
    }
  };

  // Dedicated Expenses Fetcher Function
  const fetchExpenses = async (studentId) => {
    if (!studentId) return [];
    try {
      const res = await fetch(`${BACKEND_URL}/api/expenses?student_id=${studentId}`);
      if (res.ok) {
        const data = await res.json();
        setExpenses(data);
        return data;
      }
    } catch (err) {
      console.error("Failed to fetch expenses:", err);
    }
    return [];
  };

  // Fetch Dashboard and User Data
  const fetchDashboardData = async (studentId) => {
    try {
      const [expData, budRes, savRes, catRes, aiRes] = await Promise.all([
        fetchExpenses(studentId),
        axios.get(`${BACKEND_URL}/api/budgets?student_id=${studentId}`),
        axios.get(`${BACKEND_URL}/api/savings?student_id=${studentId}`),
        axios.get(`${BACKEND_URL}/api/categories?student_id=${studentId}`),
        axios.get(`${BACKEND_URL}/api/ai/tip?student_id=${studentId}`)
      ]);
      
      const budData = budRes.data;
      
      setBudgets(budData);
      setSavings(savRes.data);
      setCategories(catRes.data);

      // Enforce wizard setup if user has zero budgets configured
      if (budData.length === 0) {
        setIsSetupComplete(false);
      } else {
        setIsSetupComplete(true);
      }

      // Check category limit warnings for the selected month
      const currentExpenses = expData || [];
      const currentMonthSpent = currentExpenses
        .filter(item => item.date && item.date.startsWith(selectedMonth))
        .reduce((acc, curr) => {
          acc[curr.category] = (acc[curr.category] || 0) + parseFloat(curr.amount);
          return acc;
        }, {});

      const breachedCats = [];
      budData.forEach(b => {
        const spent = currentMonthSpent[b.category] || 0;
        if (spent > parseFloat(b.amount_limit)) {
          breachedCats.push(b.category);
        }
      });

      if (breachedCats.length > 0) {
        setIsBreachedState(true);
        setAlertMsg(`⚠️ Budget limit breached for: ${breachedCats.join(", ")}!`);
        setAiTip(`🚨 ACTION REQUIRED: You have breached your budget cap for ${breachedCats.join(", ")}! Pause non-essential spending for the rest of the month.`);
      } else {
        setIsBreachedState(false);
        setAlertMsg("");
        setAiTip(aiRes.data.tip);
      }

    } catch (err) {
      console.error("Error loading dashboard data:", err);
    }
  };

  const fetchAiTip = async () => {
    if (!user?.student_id) return;
    setAiTipLoading(true);
    try {
      if (isBreachedState) {
        // If breached, maintain actionable alert
        setAiTip(prev => prev);
      } else {
        const res = await axios.get(`${BACKEND_URL}/api/ai/tip?student_id=${user.student_id}`);
        setAiTip(res.data.tip);
      }
    } catch (err) {
      console.error("Failed to fetch AI tip:", err);
    } finally {
      setAiTipLoading(false);
    }
  };

  useEffect(() => {
    if (user?.student_id) {
      fetchDashboardData(user.student_id);
    }
  }, [user, selectedMonth]);

  // Auth Operations
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    const endpoint = authMode === "login" ? "/api/login" : "/api/register";
    try {
      const res = await axios.post(`${BACKEND_URL}${endpoint}`, authForm);
      if (res.data.user) {
        localStorage.setItem("unipocket_user", JSON.stringify(res.data.user));
        setUser(res.data.user);
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.error || "Authentication error. Verify database configuration.");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("unipocket_user");
    localStorage.removeItem("up_user");
    setUser(null);
    setExpenses([]);
    setBudgets([]);
    setSavings([]);
    setAlertMsg("");
    setIsSetupComplete(true);
    setSetupStep(1);
    setActiveTab("dashboard");
    setChatLog([
      { sender: "ai", text: "Hey! I'm Pocky, your AI Money Coach. Ask me anything, or log some transactions to start analyzing!" }
    ]);
  };

  // Category Helper
  const addCategorySilent = async (catName) => {
    try {
      await axios.post(`${BACKEND_URL}/api/categories`, {
        student_id: user.student_id,
        category_name: catName
      });
      const catRes = await axios.get(`${BACKEND_URL}/api/categories?student_id=${user.student_id}`);
      setCategories(catRes.data);
      return catName;
    } catch (err) {
      console.error("Failed to add custom category:", err);
      throw err;
    }
  };

  // Transaction Payload Alignment Fix: { student_id, title, amount, category, date }
  const handleAddExpense = async (e) => {
    e.preventDefault();
    if (!expenseForm.title || !expenseForm.amount) return;
    try {
      await axios.post(`${BACKEND_URL}/api/expense`, {
        student_id: user.student_id,
        title: expenseForm.title,
        amount: parseFloat(expenseForm.amount),
        category: expenseForm.category,
        date: expenseForm.date
      });
      setExpenseForm({ title: "", amount: "", category: categories[0] || "Food", date: new Date().toISOString().split('T')[0] });
      // Trigger instant state refresh across Dashboard, Calendar, Ledger Feed, and Analytics
      await fetchExpenses(user.student_id);
      await fetchDashboardData(user.student_id);
    } catch (err) {
      alert("Failed to log expense record. Please verify all input parameters.");
    }
  };

  // Budget Payload Alignment Fix: { student_id, category, limit }
  const handleSetBudget = async (e) => {
    e.preventDefault();
    if (!budgetForm.limit) return;
    
    let targetCategory = budgetForm.category;

    if (budgetCategoryMode === "custom") {
      const trimmedCustom = customCategoryName.trim();
      if (!trimmedCustom) {
        alert("Please type a valid custom category name.");
        return;
      }
      try {
        await addCategorySilent(trimmedCustom);
        targetCategory = trimmedCustom;
        setCustomCategoryName("");
        setBudgetCategoryMode("select");
      } catch (err) {
        alert("Failed to create custom category.");
        return;
      }
    }

    try {
      await axios.post(`${BACKEND_URL}/api/budgets`, {
        student_id: user.student_id,
        category: targetCategory,
        limit: parseFloat(budgetForm.limit)
      });
      setBudgetForm({ category: categories[0] || "Food", limit: "" });
      await fetchDashboardData(user.student_id);
    } catch (err) {
      alert("Failed to save budget limit.");
    }
  };

  // Savings Goal Creation
  const handleAddSavingsGoal = async (e) => {
    e.preventDefault();
    if (!savingsForm.goal_name || !savingsForm.target_amount) return;
    try {
      await axios.post(`${BACKEND_URL}/api/savings`, {
        student_id: user.student_id,
        goal_name: savingsForm.goal_name,
        target_amount: parseFloat(savingsForm.target_amount),
        current_saved: 0
      });
      setSavingsForm({ goal_name: "", target_amount: "" });
      await fetchDashboardData(user.student_id);
    } catch (err) {
      alert("Failed to construct new savings goal.");
    }
  };

  // Savings Deposit Payload Alignment Fix: { student_id, id, amount }
  const handleDepositSavings = async (goalId, amountStr, current, target) => {
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) return;
    try {
      const res = await axios.post(`${BACKEND_URL}/api/savings/deposit`, {
        student_id: user.student_id,
        id: goalId,
        amount: amount
      });
      setDepositAmounts(prev => ({ ...prev, [goalId]: "" }));
      await fetchDashboardData(user.student_id);
      if (res.data.current_saved >= target) {
        triggerConfetti();
      }
    } catch (err) {
      alert("Failed to deposit funds into jar.");
    }
  };

  // Profile Edit Submission
  const handleUpdateProfileSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post(`${BACKEND_URL}/api/user/update`, {
        student_id: user.student_id,
        name: profileForm.name,
        email: profileForm.email,
        contact_number: profileForm.contact_number,
        password: profileForm.password || undefined
      });
      alert("Profile updated successfully!");
      localStorage.setItem("unipocket_user", JSON.stringify(res.data.user));
      setUser(res.data.user);
      setProfileForm(prev => ({ ...prev, password: "" }));
    } catch (err) {
      alert(err.response?.data?.error || "Failed to update profile.");
    }
  };

  // Pocky AI Money Coach Chat Interface
  const handleSendChat = async (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userMsg = chatInput;
    setChatLog(prev => [...prev, { sender: "user", text: userMsg }]);
    setChatInput("");
    setChatLoading(true);

    try {
      const res = await axios.post(`${BACKEND_URL}/api/ai/chat`, {
        student_id: user.student_id,
        message: userMsg
      });
      setChatLog(prev => [...prev, { sender: "ai", text: res.data.reply }]);
    } catch (err) {
      setChatLog(prev => [...prev, { sender: "ai", text: "I ran into a server error. Please retry." }]);
    } finally {
      setChatLoading(false);
    }
  };

  // Month-wise Filtering & Financial KPI Calculations
  const filteredExpenses = expenses.filter(item => item.date && item.date.startsWith(selectedMonth));
  const monthlyTotalSpent = filteredExpenses.reduce((sum, item) => sum + parseFloat(item.amount), 0);
  
  const totalBudgetCap = budgets.reduce((sum, item) => sum + parseFloat(item.amount_limit), 0);
  const remainingBudget = Math.max(0, totalBudgetCap - monthlyTotalSpent);

  const totalSaved = savings.reduce((sum, item) => sum + parseFloat(item.current_saved), 0);
  const totalSavingsTarget = savings.reduce((sum, item) => sum + parseFloat(item.target_amount), 0);
  const overallSavingsProgress = totalSavingsTarget > 0 ? Math.min(100, (totalSaved / totalSavingsTarget) * 100) : 0;

  const categoryDataMap = filteredExpenses.reduce((acc, curr) => {
    acc[curr.category] = (acc[curr.category] || 0) + parseFloat(curr.amount);
    return acc;
  }, {});

  const chartData = Object.keys(categoryDataMap).map(key => ({
    category: key,
    amount: categoryDataMap[key]
  }));

  const colors = ["#ccff00", "#06b6d4", "#8b5cf6", "#f97316", "#ec4899", "#10b981"];

  // Monthly Calendar Calculations
  const getCalendarDays = () => {
    if (!selectedMonth) return [];
    const [yearStr, monthStr] = selectedMonth.split("-");
    const year = parseInt(yearStr);
    const month = parseInt(monthStr);

    const firstDay = new Date(year, month - 1, 1).getDay();
    const totalDays = new Date(year, month, 0).getDate();

    const days = [];
    for (let i = 0; i < firstDay; i++) {
      days.push({ day: null, dateString: null });
    }
    for (let d = 1; d <= totalDays; d++) {
      const dateString = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({ day: d, dateString });
    }
    return days;
  };

  const dailySpending = filteredExpenses.reduce((acc, curr) => {
    acc[curr.date] = (acc[curr.date] || 0) + parseFloat(curr.amount);
    return acc;
  }, {});

  const calendarDays = getCalendarDays();

  // Authentication Screen
  if (!user) {
    return (
      <div className="app-container" style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh" }}>
        <div className="nb-card" style={{ width: "100%", maxWidth: "440px", padding: "32px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
            <div style={{ background: "var(--primary)", padding: "10px", borderRadius: "10px", display: "flex", border: "2px solid #000" }}>
              <Wallet size={32} weight="fill" style={{ color: "#000000" }} />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: "28px" }}>UniPocket</h1>
              <span style={{ fontSize: "12px", fontWeight: "700", opacity: 0.8 }}>STUDENT FINANCIAL SUITE</span>
            </div>
          </div>
          <p style={{ fontSize: "14px", lineHeight: "1.5", color: "var(--fg)", marginBottom: "24px" }}>
            Responsive multi-tab platform for intelligent budget tracking, visual savings goals, and real-time AI guidance.
          </p>
          
          {errorMsg && <div style={{ background: "var(--destructive)", color: "#fff", padding: "12px", borderRadius: "8px", fontWeight: "bold", fontSize: "13px", marginBottom: "18px" }}>{errorMsg}</div>}

          <form onSubmit={handleAuthSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {authMode === "signup" && (
              <>
                <div>
                  <label style={{ display: "block", fontWeight: "bold", fontSize: "12px", marginBottom: "4px" }}>Full Name</label>
                  <input type="text" className="nb-input" required value={authForm.name} onChange={e => setAuthForm({...authForm, name: e.target.value})} />
                </div>
                <div>
                  <label style={{ display: "block", fontWeight: "bold", fontSize: "12px", marginBottom: "4px" }}>Student ID</label>
                  <input type="text" className="nb-input" placeholder="e.g. STU123" required value={authForm.student_id} onChange={e => setAuthForm({...authForm, student_id: e.target.value})} />
                </div>
                <div>
                  <label style={{ display: "block", fontWeight: "bold", fontSize: "12px", marginBottom: "4px" }}>Contact Number</label>
                  <input type="text" className="nb-input" placeholder="e.g. +9199887766" value={authForm.contact_number} onChange={e => setAuthForm({...authForm, contact_number: e.target.value})} />
                </div>
              </>
            )}
            <div>
              <label style={{ display: "block", fontWeight: "bold", fontSize: "12px", marginBottom: "4px" }}>College Email</label>
              <input type="email" className="nb-input" required value={authForm.email} onChange={e => setAuthForm({...authForm, email: e.target.value})} />
            </div>
            <div>
              <label style={{ display: "block", fontWeight: "bold", fontSize: "12px", marginBottom: "4px" }}>Password</label>
              <input type="password" className="nb-input" required value={authForm.password} onChange={e => setAuthForm({...authForm, password: e.target.value})} />
            </div>

            <button type="submit" className="nb-btn" style={{ padding: "12px", fontSize: "15px", marginTop: "10px" }}>
              {authMode === "login" ? <><SignIn size={18} weight="bold"/> Enter Platform</> : <><UserPlus size={18} weight="bold"/> Create Profile</>}
            </button>
          </form>

          <div style={{ textAlign: "center", marginTop: "24px", paddingTop: "16px", borderTop: "2px dashed var(--border)" }}>
            {authMode === "login" ? (
              <span style={{ cursor: "pointer", fontWeight: "700", fontSize: "13px", color: "var(--accent)" }} onClick={() => setAuthMode("signup")}>New student? Register your account here →</span>
            ) : (
              <span style={{ cursor: "pointer", fontWeight: "700", fontSize: "13px", color: "var(--accent)" }} onClick={() => setAuthMode("login")}>Already registered? Login to account →</span>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Initial Onboarding Setup Wizard Overlay
  if (!isSetupComplete) {
    return (
      <div className="app-container" style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh" }}>
        <div className="setup-box">
          <div className="setup-stepper-header">
            <h2 style={{ margin: 0, fontSize: "20px" }}>Initial Setup Wizard</h2>
            <div style={{ display: "flex", gap: "8px" }}>
              <div className={`setup-step-bubble ${setupStep >= 1 ? (setupStep > 1 ? "done" : "active") : ""}`}>1</div>
              <div className={`setup-step-bubble ${setupStep >= 2 ? (setupStep > 2 ? "done" : "active") : ""}`}>2</div>
              <div className={`setup-step-bubble ${setupStep >= 3 ? "done" : "active"}`}>3</div>
            </div>
          </div>

          {setupStep === 1 && (
            <div>
              <h3>Step 1: Custom Categories</h3>
              <p style={{ fontSize: "13px", lineHeight: "1.5", marginBottom: "16px" }}>
                Add your own custom spending categories or use defaults.
              </p>
              
              <form onSubmit={async (e) => {
                e.preventDefault();
                if (newCategoryInput.trim()) {
                  await addCategorySilent(newCategoryInput.trim());
                  setNewCategoryInput("");
                }
              }} style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
                <input 
                  type="text" 
                  placeholder="New Category Name" 
                  className="nb-input" 
                  value={newCategoryInput} 
                  onChange={e => setNewCategoryInput(e.target.value)} 
                />
                <button type="submit" className="nb-btn" style={{ padding: "10px 14px" }}><Plus size={18} /></button>
              </form>

              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "24px" }}>
                {categories.map((c, i) => (
                  <span key={i} className="sticker cyan" style={{ fontSize: "12px" }}>{c}</span>
                ))}
              </div>

              <button className="nb-btn" style={{ width: "100%" }} onClick={() => setSetupStep(2)}>Next: Configure Budgets →</button>
            </div>
          )}

          {setupStep === 2 && (
            <div>
              <h3>Step 2: Assign Budget Limits</h3>
              <p style={{ fontSize: "13px", lineHeight: "1.5", marginBottom: "16px" }}>
                Set monthly limit caps for spending categories to prevent budget leaks.
              </p>

              <form onSubmit={handleSetBudget} style={{ display: "flex", gap: "8px", marginBottom: "20px" }}>
                <select className="nb-select" style={{ flex: 1 }} value={budgetForm.category} onChange={e => setBudgetForm({...budgetForm, category: e.target.value})}>
                  {categories.map((c, idx) => <option key={idx} value={c}>{c}</option>)}
                </select>
                <input 
                  type="number" 
                  placeholder="Cap (₹)" 
                  className="nb-input" 
                  style={{ flex: 1 }} 
                  required 
                  value={budgetForm.limit} 
                  onChange={e => setBudgetForm({...budgetForm, limit: e.target.value})} 
                />
                <button type="submit" className="nb-btn">Apply</button>
              </form>

              <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "150px", overflowY: "auto", marginBottom: "24px" }}>
                {budgets.length === 0 && <p style={{ fontSize: "12px", opacity: 0.7 }}>No caps set yet.</p>}
                {budgets.map((b, idx) => (
                  <div key={idx} style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", borderBottom: "1px dashed var(--border)", paddingBottom: "4px" }}>
                    <span style={{ fontWeight: "bold" }}>{b.category}</span>
                    <span>₹{parseFloat(b.amount_limit).toFixed(0)}</span>
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", gap: "10px" }}>
                <button className="nb-btn" style={{ background: "var(--muted)", color: "var(--fg)", flex: 1 }} onClick={() => setSetupStep(1)}>Back</button>
                <button className="nb-btn" style={{ flex: 2 }} onClick={() => setSetupStep(3)}>Next: Finalize →</button>
              </div>
            </div>
          )}

          {setupStep === 3 && (
            <div style={{ textAlign: "center" }}>
              <h3>Step 3: Setup Completed!</h3>
              <p style={{ fontSize: "14px", lineHeight: "1.5", marginBottom: "24px" }}>
                Awesome! Your UniPocket workspace is now configured. Welcome aboard!
              </p>
              <button className="nb-btn" style={{ width: "100%" }} onClick={() => setIsSetupComplete(true)}>🚀 Launch Platform</button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* HEADER SECTION & TOP TAB NAVIGATION */}
      <header className="nb-card header-card">
        <div className="header-top">
          <div className="brand-title">
            <div style={{ background: "var(--primary)", padding: "8px", borderRadius: "10px", display: "flex", border: "2px solid var(--border)" }}>
              <Wallet size={26} weight="fill" style={{ color: "#000000" }} />
            </div>
            <div>
              <h1 style={{ fontSize: "24px", margin: 0 }}>UniPocket</h1>
              <span style={{ fontSize: "11px", fontWeight: "700", opacity: 0.8, letterSpacing: "0.05em" }}>WELCOME, {user.name.toUpperCase()}</span>
            </div>
          </div>

          <div className="header-actions">
            <button 
              className="nb-btn" 
              style={{ background: "var(--muted)", color: "var(--fg)", padding: "8px 12px", fontSize: "13px" }}
              onClick={() => setTheme(theme === "light" ? "dark" : "light")}
            >
              {theme === "light" ? <><Moon size={16} /> Dark</> : <><Sun size={16} /> Light</>}
            </button>
            
            <button 
              className="nb-btn"
              style={{ background: activeTab === "profile" ? "var(--accent)" : "var(--muted)", color: activeTab === "profile" ? "#000" : "var(--fg)", padding: "8px 14px", fontSize: "13px" }}
              onClick={() => setActiveTab("profile")}
            >
              <User size={16} weight="bold" /> Profile
            </button>

            <button className="nb-btn destruct" style={{ padding: "8px 14px", fontSize: "13px" }} onClick={handleLogout}>
              <SignOut size={16} weight="bold" /> Exit
            </button>
          </div>
        </div>

        {/* TOP TAB NAVIGATION BAR */}
        <nav className="tabs-navigation">
          <button className={`tab-button ${activeTab === "dashboard" ? "active" : ""}`} onClick={() => setActiveTab("dashboard")}>
            <CalendarBlank size={18} weight="bold" /> Dashboard
          </button>
          <button className={`tab-button ${activeTab === "transactions" ? "active" : ""}`} onClick={() => setActiveTab("transactions")}>
            <Receipt size={18} weight="bold" /> Transactions & Ledger
          </button>
          <button className={`tab-button ${activeTab === "budgets" ? "active" : ""}`} onClick={() => setActiveTab("budgets")}>
            <PiggyBank size={18} weight="bold" /> Budgets & Savings
          </button>
          <button className={`tab-button ${activeTab === "analytics" ? "active" : ""}`} onClick={() => setActiveTab("analytics")}>
            <ChartBar size={18} weight="bold" /> Analytics & Matrix
          </button>
        </nav>
      </header>

      {/* DYNAMIC ALERT BANNER */}
      {alertMsg && (
        <div className="alert-banner">
          <span>{alertMsg}</span>
          <button onClick={() => setAlertMsg("")}>✕</button>
        </div>
      )}

      {/* TAB 1: DASHBOARD (OVERVIEW) */}
      {activeTab === "dashboard" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {/* AI INSIGHT BANNER */}
          <div className={`ai-banner ${isBreachedState ? "breached" : ""}`}>
            <div className="ai-banner-content">
              <div style={{ background: isBreachedState ? "var(--destructive)" : "var(--primary)", padding: "8px", borderRadius: "8px", border: "2px solid #000" }}>
                <Sparkle size={24} weight="fill" style={{ color: isBreachedState ? "#ffffff" : "#000000" }} />
              </div>
              <div>
                <span style={{ fontSize: "11px", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.05em", color: isBreachedState ? "var(--destructive)" : "var(--accent)" }}>
                  {isBreachedState ? "⚠️ CRITICAL BUDGET BREACH WARNING" : "LIVE AI MONEY INSIGHT"}
                </span>
                <div className="ai-banner-text">{aiTip}</div>
              </div>
            </div>
            <button className="nb-btn" style={{ padding: "6px 12px", fontSize: "12px", background: "var(--card)", color: "var(--fg)" }} onClick={fetchAiTip} disabled={aiTipLoading}>
              <ArrowsClockwise size={14} className={aiTipLoading ? "spin" : ""} /> Refresh
            </button>
          </div>

          {/* TOP KPI ROW */}
          <div className="kpi-grid">
            <div className="kpi-card">
              <div className="kpi-card-header">
                <span className="kpi-title">Monthly Outflow</span>
                <div className="kpi-icon" style={{ background: "rgba(239, 68, 68, 0.15)", color: "var(--destructive)" }}>
                  <ArrowUpRight size={22} weight="bold" />
                </div>
              </div>
              <div>
                <h2 className="kpi-value" style={{ color: "var(--destructive)" }}>₹{monthlyTotalSpent.toFixed(2)}</h2>
                <span style={{ fontSize: "12px", opacity: 0.7 }}>Period: {selectedMonth}</span>
              </div>
            </div>

            <div className="kpi-card">
              <div className="kpi-card-header">
                <span className="kpi-title">Remaining Budget</span>
                <div className="kpi-icon" style={{ background: "rgba(6, 182, 212, 0.15)", color: "var(--accent)" }}>
                  <Compass size={22} weight="bold" />
                </div>
              </div>
              <div>
                <h2 className="kpi-value" style={{ color: "var(--accent)" }}>₹{remainingBudget.toFixed(2)}</h2>
                <span style={{ fontSize: "12px", opacity: 0.7 }}>Out of ₹{totalBudgetCap.toFixed(0)} configured limits</span>
              </div>
            </div>

            <div className="kpi-card">
              <div className="kpi-card-header">
                <span className="kpi-title">Savings Goal Progress</span>
                <div className="kpi-icon" style={{ background: "rgba(204, 255, 0, 0.15)", color: "var(--primary)" }}>
                  <Target size={22} weight="bold" />
                </div>
              </div>
              <div>
                <h2 className="kpi-value" style={{ color: "var(--primary)" }}>₹{totalSaved.toFixed(0)} <span style={{ fontSize: "14px", color: "var(--fg)", opacity: 0.6 }}>/ ₹{totalSavingsTarget.toFixed(0)}</span></h2>
                <div className="bar-track" style={{ marginTop: "8px" }}>
                  <div className="bar-fill" style={{ width: `${overallSavingsProgress}%`, background: "var(--primary)" }} />
                </div>
              </div>
            </div>
          </div>

          {/* MONTHLY CALENDAR GRID */}
          <div className="nb-card calendar-container">
            <div className="calendar-header">
              <div>
                <h3 style={{ margin: 0 }}>MONTHLY EXPENSES CALENDAR 📅</h3>
                <span style={{ fontSize: "12px", opacity: 0.7 }}>Visual breakdown of daily cash outflows</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "12px", fontWeight: "bold" }}>Month:</span>
                <input 
                  type="month" 
                  className="nb-input" 
                  style={{ width: "170px", padding: "6px 10px", fontSize: "13px" }}
                  value={selectedMonth} 
                  onChange={e => setSelectedMonth(e.target.value)} 
                />
              </div>
            </div>

            <div className="calendar-grid-wrapper">
              <div className="calendar-grid">
                <div className="calendar-weekday-bar">
                  <span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span>
                </div>
                {calendarDays.map((box, idx) => {
                  const isDayEmpty = box.day === null;
                  const spentToday = !isDayEmpty && dailySpending[box.dateString] ? dailySpending[box.dateString] : 0;
                  
                  return (
                    <div key={idx} className={`calendar-day-cell ${isDayEmpty ? "empty" : ""}`}>
                      <span className="calendar-day-num">{box.day}</span>
                      {spentToday > 0 && (
                        <span className="calendar-day-spent" title={`Date: ${box.dateString} - Total spent: ₹${spentToday}`}>
                          ₹{spentToday}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: TRANSACTIONS & LEDGER */}
      {activeTab === "transactions" && (
        <div className="grid-2col">
          {/* LEFT COLUMN: RECORD NEW TRANSACTION FORM */}
          <div className="nb-card">
            <h3 style={{ margin: "0 0 16px 0", display: "flex", alignItems: "center", gap: "8px" }}>
              <PlusCircle size={22} weight="bold" style={{ color: "var(--primary)" }} /> RECORD NEW TRANSACTION
            </h3>
            
            <form onSubmit={handleAddExpense} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={{ display: "block", fontWeight: "bold", fontSize: "12px", marginBottom: "4px" }}>Transaction Title</label>
                <input 
                  type="text" 
                  placeholder="e.g. Textbook purchase, Campus lunch" 
                  className="nb-input" 
                  required 
                  value={expenseForm.title} 
                  onChange={e => setExpenseForm({...expenseForm, title: e.target.value})} 
                />
              </div>

              <div style={{ display: "flex", gap: "12px" }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: "block", fontWeight: "bold", fontSize: "12px", marginBottom: "4px" }}>Amount (INR ₹)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    placeholder="0.00" 
                    className="nb-input" 
                    required 
                    value={expenseForm.amount} 
                    onChange={e => setExpenseForm({...expenseForm, amount: e.target.value})} 
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: "block", fontWeight: "bold", fontSize: "12px", marginBottom: "4px" }}>Category</label>
                  <select className="nb-select" value={expenseForm.category} onChange={e => setExpenseForm({...expenseForm, category: e.target.value})}>
                    {categories.map((c, idx) => <option key={idx} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontWeight: "bold", fontSize: "12px", marginBottom: "4px" }}>Transaction Date</label>
                <input 
                  type="date" 
                  className="nb-input" 
                  required 
                  value={expenseForm.date} 
                  onChange={e => setExpenseForm({...expenseForm, date: e.target.value})} 
                />
              </div>

              <button type="submit" className="nb-btn" style={{ marginTop: "6px" }}>
                <Receipt size={18} weight="bold" /> Log Expense Record
              </button>
            </form>
          </div>

          {/* RIGHT COLUMN: HISTORICAL LEDGER FEED */}
          <div className="nb-card" style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ margin: 0 }}>HISTORICAL LEDGER FEED 📜</h3>
              <span className="sticker cyan">{filteredExpenses.length} Records</span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px", maxHeight: "500px", overflowY: "auto", paddingRight: "4px" }}>
              {filteredExpenses.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 20px", border: "2px dashed var(--border)", borderRadius: "8px" }}>
                  <Receipt size={40} style={{ opacity: 0.4, marginBottom: "8px" }} />
                  <p style={{ fontSize: "14px", fontWeight: "600", opacity: 0.8, margin: 0 }}>No transactions recorded for this period yet.</p>
                  <p style={{ fontSize: "12px", opacity: 0.6, marginTop: "4px" }}>Use the form on the left to record your first outflow!</p>
                </div>
              ) : (
                filteredExpenses.map((item, idx) => (
                  <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", background: "var(--muted)", border: "2px solid var(--border)", borderRadius: "8px", boxShadow: "2px 2px 0px var(--shadow)" }}>
                    <div>
                      <div style={{ fontWeight: "700", fontSize: "14px" }}>{item.title}</div>
                      <div style={{ fontSize: "11px", opacity: 0.7, marginTop: "2px" }}>
                        {item.date} • <span className="sticker pink" style={{ fontSize: "10px", padding: "2px 6px" }}>{item.category}</span>
                      </div>
                    </div>
                    <div style={{ fontWeight: "900", fontSize: "16px", color: "var(--destructive)", fontFamily: "Space Grotesk" }}>
                      -₹{parseFloat(item.amount).toFixed(2)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: BUDGETS & SAVINGS JARS */}
      {activeTab === "budgets" && (
        <div className="grid-2col">
          {/* LEFT COLUMN: SET CATEGORIZED BUDGET CAPS */}
          <div className="nb-card">
            <h3 style={{ margin: "0 0 16px 0" }}>SET CATEGORIZED BUDGET CAPS 🎯</h3>
            
            <form onSubmit={handleSetBudget} style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "20px" }}>
              <div style={{ display: "flex", gap: "8px" }}>
                <button 
                  type="button"
                  className="nb-btn" 
                  style={{ 
                    flex: 1, 
                    padding: "8px", 
                    fontSize: "12px", 
                    background: budgetCategoryMode === "select" ? "var(--primary)" : "var(--muted)", 
                    color: budgetCategoryMode === "select" ? "#000000" : "var(--fg)"
                  }}
                  onClick={() => setBudgetCategoryMode("select")}
                >
                  Select Category
                </button>
                <button 
                  type="button"
                  className="nb-btn" 
                  style={{ 
                    flex: 1, 
                    padding: "8px", 
                    fontSize: "12px", 
                    background: budgetCategoryMode === "custom" ? "var(--primary)" : "var(--muted)", 
                    color: budgetCategoryMode === "custom" ? "#000000" : "var(--fg)"
                  }}
                  onClick={() => setBudgetCategoryMode("custom")}
                >
                  + Custom Category
                </button>
              </div>

              <div style={{ display: "flex", gap: "10px" }}>
                {budgetCategoryMode === "select" ? (
                  <select className="nb-select" style={{ flex: 1.5 }} value={budgetForm.category} onChange={e => setBudgetForm({...budgetForm, category: e.target.value})}>
                    {categories.map((c, idx) => <option key={idx} value={c}>{c}</option>)}
                  </select>
                ) : (
                  <input 
                    type="text" 
                    placeholder="New Category Name" 
                    className="nb-input" 
                    style={{ flex: 1.5 }} 
                    required 
                    value={customCategoryName} 
                    onChange={e => setCustomCategoryName(e.target.value)} 
                  />
                )}
                <input type="number" placeholder="Cap (₹)" className="nb-input" style={{ flex: 1 }} value={budgetForm.limit} onChange={e => setBudgetForm({...budgetForm, limit: e.target.value})} />
              </div>
              <button type="submit" className="nb-btn">Apply Budget Cap</button>
            </form>

            <h4 style={{ fontSize: "14px", borderBottom: "2px dashed var(--border)", paddingBottom: "8px", marginBottom: "12px" }}>ACTIVE CATEGORY BUDGET METERS</h4>

            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {budgets.length === 0 && <p style={{ fontSize: "13px", opacity: 0.7 }}>No active budget limits configured yet.</p>}
              {budgets.map((b, idx) => {
                const currentSpent = categoryDataMap[b.category] || 0;
                const ratio = Math.min((currentSpent / b.amount_limit) * 100, 100);
                const isBreached = currentSpent > b.amount_limit;
                
                return (
                  <div key={idx} style={{ fontSize: "13px", padding: "10px", background: "var(--muted)", border: "2px solid var(--border)", borderRadius: "8px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold", marginBottom: "4px" }}>
                      <span>{b.category}</span>
                      <span style={{ color: isBreached ? "var(--destructive)" : "var(--fg)" }}>
                        ₹{currentSpent.toFixed(0)} / ₹{parseFloat(b.amount_limit).toFixed(0)}
                      </span>
                    </div>
                    <div className="bar-track">
                      <div className="bar-fill" style={{ width: `${ratio}%`, background: isBreached ? "var(--destructive)" : "var(--primary)" }} />
                    </div>
                    {isBreached && <div style={{ color: "var(--destructive)", fontSize: "11px", fontWeight: "bold", marginTop: "4px" }}>⚠️ Cap exceeded by ₹{(currentSpent - b.amount_limit).toFixed(0)}!</div>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* RIGHT COLUMN: SAVINGS GOAL JARS CONTAINER */}
          <div className="nb-card">
            <h3 style={{ margin: "0 0 16px 0", display: "flex", alignItems: "center", gap: "8px" }}>
              <PiggyBank size={24} weight="bold" style={{ color: "var(--accent)" }} /> SAVINGS GOAL JARS 🍯
            </h3>

            <form onSubmit={handleAddSavingsGoal} style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
              <input 
                type="text" 
                placeholder="Goal (e.g. Laptop, Trip)" 
                className="nb-input" 
                style={{ flex: 2 }} 
                required 
                value={savingsForm.goal_name} 
                onChange={e => setSavingsForm({...savingsForm, goal_name: e.target.value})} 
              />
              <input 
                type="number" 
                placeholder="Target (₹)" 
                className="nb-input" 
                style={{ flex: 1.5 }} 
                required 
                value={savingsForm.target_amount} 
                onChange={e => setSavingsForm({...savingsForm, target_amount: e.target.value})} 
              />
              <button type="submit" className="nb-btn">Create</button>
            </form>

            {savings.length === 0 ? (
              <div style={{ textAlign: "center", padding: "30px", border: "2px dashed var(--border)", borderRadius: "8px" }}>
                <p style={{ fontSize: "13px", opacity: 0.7, margin: 0 }}>No active savings goals found. Create your first jar above!</p>
              </div>
            ) : (
              <div className="jar-grid">
                {savings.map((s, idx) => {
                  const target = parseFloat(s.target_amount);
                  const current = parseFloat(s.current_saved);
                  const ratio = Math.min((current / target) * 100, 100);
                  const isCompleted = ratio >= 100;
                  
                  return (
                    <div key={idx} className="jar-card">
                      <div className="jar-lid"></div>
                      <div className="jar-container">
                        <div className="jar-percentage">{ratio.toFixed(0)}%</div>
                        <div 
                          className={`jar-liquid ${isCompleted ? "completed" : ""}`} 
                          style={{ height: `${ratio}%` }} 
                        />
                      </div>
                      <div style={{ fontWeight: "700", fontSize: "13px", marginTop: "4px" }}>{s.goal_name}</div>
                      <div style={{ fontSize: "11px", opacity: 0.8, marginBottom: "8px" }}>
                        ₹{current.toFixed(0)} / ₹{target.toFixed(0)}
                      </div>
                      
                      {!isCompleted && (
                        <div style={{ display: "flex", gap: "4px", width: "100%" }}>
                          <input 
                            type="number" 
                            placeholder="₹" 
                            className="nb-input" 
                            style={{ padding: "4px 6px", fontSize: "11px", height: "28px", minWidth: "0" }}
                            value={depositAmounts[s.id] || ""}
                            onChange={e => setDepositAmounts({ ...depositAmounts, [s.id]: e.target.value })}
                          />
                          <button 
                            onClick={() => handleDepositSavings(s.id, depositAmounts[s.id], current, target)} 
                            className="nb-btn" 
                            style={{ padding: "4px 8px", fontSize: "10px", height: "28px" }}
                          >
                            Deposit
                          </button>
                        </div>
                      )}
                      {isCompleted && (
                        <span className="sticker pink" style={{ fontSize: "10px", padding: "4px", width: "100%", textAlign: "center" }}>
                          🎉 GOAL MET!
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: ANALYTICS & DISTRIBUTION MATRIX */}
      {activeTab === "analytics" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          <div className="nb-card">
            <h3 style={{ margin: "0 0 16px 0", display: "flex", alignItems: "center", gap: "8px" }}>
              <ChartBar size={24} weight="bold" style={{ color: "var(--primary)" }} /> SPENDING DISTRIBUTION MATRIX 📊
            </h3>
            
            {chartData.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px", border: "2px dashed var(--border)", borderRadius: "8px" }}>
                <p style={{ color: "var(--fg)", opacity: 0.7, fontSize: "14px" }}>No transactions mapped for this period to render matrix.</p>
              </div>
            ) : (
              <div style={{ width: "100%", height: "260px" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <XAxis dataKey="category" stroke="var(--fg)" tick={{ fontSize: 12, fontWeight: "bold" }} />
                    <YAxis stroke="var(--fg)" tick={{ fontSize: 12, fontWeight: "bold" }} />
                    <Tooltip 
                      cursor={{ fill: 'rgba(255,255,255,0.05)' }} 
                      contentStyle={{ background: 'var(--card)', border: '2px solid var(--border)', borderRadius: '8px', fontFamily: 'Space Grotesk' }} 
                    />
                    <Bar dataKey="amount" fill="#ccff00" stroke="var(--border)" strokeWidth={2} radius={[6, 6, 0, 0]}>
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* CATEGORY BREAKDOWN GRID */}
          <div className="nb-card">
            <h3 style={{ margin: "0 0 16px 0" }}>CATEGORY OUTFLOW BREAKDOWN</h3>
            
            {chartData.length === 0 ? (
              <p style={{ fontSize: "13px", opacity: 0.7 }}>No breakdown data available.</p>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
                {chartData.map((c, idx) => {
                  const pct = monthlyTotalSpent > 0 ? (c.amount / monthlyTotalSpent) * 100 : 0;
                  return (
                    <div key={idx} style={{ padding: "16px", background: "var(--muted)", border: "2px solid var(--border)", borderRadius: "10px", boxShadow: "2px 2px 0px var(--shadow)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                        <span style={{ fontWeight: "700", fontSize: "14px" }}>{c.category}</span>
                        <span className="sticker" style={{ background: colors[idx % colors.length], color: "#000" }}>{pct.toFixed(1)}%</span>
                      </div>
                      <div style={{ fontSize: "20px", fontWeight: "800", fontFamily: "Space Grotesk", color: "var(--fg)" }}>
                        ₹{c.amount.toFixed(2)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* PROFILE SETTINGS TAB */}
      {activeTab === "profile" && (
        <div className="nb-card" style={{ maxWidth: "600px", margin: "0 auto", width: "100%" }}>
          <h3 style={{ borderBottom: "2px solid var(--border)", paddingBottom: "12px", marginBottom: "18px" }}>USER PROFILE SETTINGS 👤</h3>
          <form onSubmit={handleUpdateProfileSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div>
              <label style={{ display: "block", fontWeight: "bold", fontSize: "12px", marginBottom: "4px" }}>Full Name</label>
              <input type="text" className="nb-input" required value={profileForm.name} onChange={e => setProfileForm({...profileForm, name: e.target.value})} />
            </div>
            <div>
              <label style={{ display: "block", fontWeight: "bold", fontSize: "12px", marginBottom: "4px" }}>College Email</label>
              <input type="email" className="nb-input" required value={profileForm.email} onChange={e => setProfileForm({...profileForm, email: e.target.value})} />
            </div>
            <div>
              <label style={{ display: "block", fontWeight: "bold", fontSize: "12px", marginBottom: "4px" }}>Contact Number</label>
              <input type="text" className="nb-input" value={profileForm.contact_number} onChange={e => setProfileForm({...profileForm, contact_number: e.target.value})} />
            </div>
            <div>
              <label style={{ display: "block", fontWeight: "bold", fontSize: "12px", marginBottom: "4px" }}>New Password (Leave blank to keep current)</label>
              <input type="password" className="nb-input" value={profileForm.password} onChange={e => setProfileForm({...profileForm, password: e.target.value})} />
            </div>
            <button type="submit" className="nb-btn" style={{ marginTop: "10px" }}>Update Profile Details</button>
          </form>
        </div>
      )}

      {/* FLOATING COLLAPSIBLE CHATBOT WIDGET */}
      <div className="chat-floating-btn" onClick={() => setChatOpen(!chatOpen)}>
        <ChatCircleText size={30} weight="fill" style={{ color: "#000000" }} />
      </div>

      {chatOpen && (
        <div className="chat-floating-drawer">
          <div className="chat-drawer-header">
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Lightbulb size={22} weight="fill" />
              <span style={{ fontWeight: "800", fontSize: "14px", fontFamily: "Space Grotesk" }}>Pocky - AI Coach</span>
            </div>
            <button 
              onClick={() => setChatOpen(false)} 
              style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", padding: 0 }}
            >
              <X size={20} weight="bold" style={{ color: "#000000" }} />
            </button>
          </div>
          <div className="chat-messages">
            {chatLog.map((chat, idx) => (
              <div key={idx} className={`chat-bubble ${chat.sender}`}>
                {chat.text}
              </div>
            ))}
            {chatLoading && <div className="chat-bubble ai" style={{ opacity: 0.6 }}>Pocky is thinking...</div>}
          </div>
          <form onSubmit={handleSendChat} className="chat-input-bar">
            <input 
              type="text" 
              placeholder="Ask Pocky anything about your budget..." 
              value={chatInput} 
              onChange={e => setChatInput(e.target.value)} 
              disabled={chatLoading} 
            />
            <button type="submit" disabled={chatLoading}>Ask</button>
          </form>
        </div>
      )}
    </div>
  );
}