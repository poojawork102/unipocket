import React, { useState, useEffect } from "react";
import axios from "axios";
import { 
  Wallet, PlusCircle, ArrowUpRight, ArrowDownRight, 
  PiggyBank, Target, Lightbulb, Moon, Sun, SignOut, 
  UserPlus, SignIn, ChatCircleText, CalendarBlank, User, X, Plus
} from "@phosphor-icons/react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from "recharts";
import "./App.css";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "http://127.0.0.1:5000";

export default function App() {
  // Global State
  const [theme, setTheme] = useState("light");
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem("up_user")) || null);
  const [authMode, setAuthMode] = useState("login"); // login or signup
  const [activeTab, setActiveTab] = useState("dashboard"); // dashboard or profile

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

  // Merged Category Management inside Set Budget
  const [budgetCategoryMode, setBudgetCategoryMode] = useState("select"); // select or custom
  const [customCategoryName, setCustomCategoryName] = useState("");

  // Dynamic Data States
  const [expenses, setExpenses] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [savings, setSavings] = useState([]);
  const [categories, setCategories] = useState(["Food", "Travel", "Books", "Entertainment", "Other"]);
  const [aiTip, setAiTip] = useState("Welcome to UniPocket! Log your first expense to begin.");
  const [errorMsg, setErrorMsg] = useState("");
  const [alertMsg, setAlertMsg] = useState("");

  // Collapsible Floating Chatbot State
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

  // Confetti Particle burst
  const triggerConfetti = () => {
    const container = document.body;
    for (let i = 0; i < 60; i++) {
      const el = document.createElement("div");
      el.style.position = "fixed";
      el.style.width = "10px";
      el.style.height = "10px";
      el.style.backgroundColor = ["#ccff00", "#00ffff", "#ff66cc", "#ff9933", "#ff3366"][Math.floor(Math.random() * 5)];
      el.style.left = Math.random() * 100 + "vw";
      el.style.top = "-10px";
      el.style.zIndex = "9999";
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

  // Fetch Dashboard and User Categories
  const fetchDashboardData = async (studentId) => {
    try {
      const [expRes, budRes, savRes, catRes, aiRes] = await Promise.all([
        axios.get(`${BACKEND_URL}/api/expenses?student_id=${studentId}`),
        axios.get(`${BACKEND_URL}/api/budgets?student_id=${studentId}`),
        axios.get(`${BACKEND_URL}/api/savings?student_id=${studentId}`),
        axios.get(`${BACKEND_URL}/api/categories?student_id=${studentId}`),
        axios.get(`${BACKEND_URL}/api/ai/tip?student_id=${studentId}`)
      ]);
      
      const expData = expRes.data;
      const budData = budRes.data;
      
      setExpenses(expData);
      setBudgets(budData);
      setSavings(savRes.data);
      setCategories(catRes.data);
      setAiTip(aiRes.data.tip);

      // Enforce wizard setup if user has zero budgets configured
      if (budData.length === 0) {
        setIsSetupComplete(false);
      } else {
        setIsSetupComplete(true);
      }

      // Check category limit warnings for the selected month
      const currentMonthSpent = expData
        .filter(item => item.date.startsWith(selectedMonth))
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
        setAlertMsg(`⚠️ Budget limit breached for: ${breachedCats.join(", ")}!`);
      } else {
        setAlertMsg("");
      }

    } catch (err) {
      console.error("Error loading dashboard data:", err);
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
        localStorage.setItem("up_user", JSON.stringify(res.data.user));
        setUser(res.data.user);
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.error || "Authentication error. Verify database configuration.");
    }
  };

  const handleLogout = () => {
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

  // Add Custom Category Function
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

  // Log Expense Outflow
  const handleAddExpense = async (e) => {
    e.preventDefault();
    if (!expenseForm.title || !expenseForm.amount) return;
    try {
      await axios.post(`${BACKEND_URL}/api/expense`, {
        student_id: user.student_id,
        ...expenseForm,
        amount: parseFloat(expenseForm.amount)
      });
      setExpenseForm({ title: "", amount: "", category: categories[0] || "Food", date: new Date().toISOString().split('T')[0] });
      fetchDashboardData(user.student_id);
    } catch (err) {
      alert("Failed to log expense record.");
    }
  };

  // Set Budget Ceiling Limits
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
      fetchDashboardData(user.student_id);
    } catch (err) {
      alert("Failed to save budget limit.");
    }
  };

  // Savings target jar creations
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
      fetchDashboardData(user.student_id);
    } catch (err) {
      alert("Failed to construct new savings goal.");
    }
  };

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
      fetchDashboardData(user.student_id);
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
      localStorage.setItem("up_user", JSON.stringify(res.data.user));
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

  // Month-wise Filtering Calculations
  const filteredExpenses = expenses.filter(item => item.date.startsWith(selectedMonth));
  const monthlyTotalSpent = filteredExpenses.reduce((sum, item) => sum + parseFloat(item.amount), 0);
  
  const categoryDataMap = filteredExpenses.reduce((acc, curr) => {
    acc[curr.category] = (acc[curr.category] || 0) + parseFloat(curr.amount);
    return acc;
  }, {});

  const chartData = Object.keys(categoryDataMap).map(key => ({
    category: key,
    amount: categoryDataMap[key]
  }));

  const colors = ["#ccff00", "#00ffff", "#ff66cc", "#ff9933", "#9933ff"];

  // Monthly Calendar Calculations
  const getCalendarDays = () => {
    if (!selectedMonth) return [];
    const [yearStr, monthStr] = selectedMonth.split("-");
    const year = parseInt(yearStr);
    const month = parseInt(monthStr);

    const firstDay = new Date(year, month - 1, 1).getDay(); // Weekday starting index
    const totalDays = new Date(year, month, 0).getDate(); // Days count

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

  // Group daily spent amounts for current month
  const dailySpending = filteredExpenses.reduce((acc, curr) => {
    acc[curr.date] = (acc[curr.date] || 0) + parseFloat(curr.amount);
    return acc;
  }, {});

  const calendarDays = getCalendarDays();

  // Authentication Layout (Sign-in / Sign-up)
  if (!user) {
    return (
      <div className="app-container" style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
        <div className="nb-card" style={{ width: "100%", maxWidth: "420px", padding: "30px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
            <Wallet size={36} weight="fill" />
            <h1 style={{ margin: 0, fontSize: "28px" }}>UniPocket</h1>
          </div>
          <p style={{ fontWeight: "bold", marginBottom: "20px" }}>Smart Neo-Brutalist Ledger for College Students</p>
          
          {errorMsg && <div style={{ background: "#ff3366", color: "#fff", padding: "10px", border: "2px solid #000", fontWeight: "bold", marginBottom: "15px" }}>{errorMsg}</div>}

          <form onSubmit={handleAuthSubmit}>
            {authMode === "signup" && (
              <>
                <div style={{ marginBottom: "12px" }}>
                  <label style={{ display: "block", fontWeight: "bold", marginBottom: "4px" }}>Full Name</label>
                  <input type="text" className="nb-input" required value={authForm.name} onChange={e => setAuthForm({...authForm, name: e.target.value})} />
                </div>
                <div style={{ marginBottom: "12px" }}>
                  <label style={{ display: "block", fontWeight: "bold", marginBottom: "4px" }}>Student ID</label>
                  <input type="text" className="nb-input" placeholder="e.g. STU123" required value={authForm.student_id} onChange={e => setAuthForm({...authForm, student_id: e.target.value})} />
                </div>
                <div style={{ marginBottom: "12px" }}>
                  <label style={{ display: "block", fontWeight: "bold", marginBottom: "4px" }}>Contact Number</label>
                  <input type="text" className="nb-input" placeholder="e.g. +9199887766" value={authForm.contact_number} onChange={e => setAuthForm({...authForm, contact_number: e.target.value})} />
                </div>
              </>
            )}
            <div style={{ marginBottom: "12px" }}>
              <label style={{ display: "block", fontWeight: "bold", marginBottom: "4px" }}>College Email</label>
              <input type="email" className="nb-input" required value={authForm.email} onChange={e => setAuthForm({...authForm, email: e.target.value})} />
            </div>
            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", fontWeight: "bold", marginBottom: "4px" }}>Password</label>
              <input type="password" className="nb-input" required value={authForm.password} onChange={e => setAuthForm({...authForm, password: e.target.value})} />
            </div>

            <button type="submit" className="nb-btn" style={{ width: "100%", padding: "12px", fontSize: "16px" }}>
              {authMode === "login" ? <><SignIn size={18} weight="bold"/> Enter Dashboard</> : <><UserPlus size={18} weight="bold"/> Initialize Profile</>}
            </button>
          </form>

          <div style={{ textAlign: "center", marginTop: "20px" }}>
            {authMode === "login" ? (
              <span style={{ cursor: "pointer", textDecoration: "underline", fontSize: "14px" }} onClick={() => setAuthMode("signup")}>New user? Establish localized profile here</span>
            ) : (
              <span style={{ cursor: "pointer", textDecoration: "underline", fontSize: "14px" }} onClick={() => setAuthMode("login")}>Already registered? Login instead</span>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Task-Wise Setup Wizard Onboarding Overlay
  if (!isSetupComplete) {
    return (
      <div className="app-container" style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
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
              <p style={{ fontSize: "13px", lineHeight: "1.4", marginBottom: "15px" }}>
                Add your own custom spending categories or manage defaults. We have default categories set up for you.
              </p>
              
              <form onSubmit={async (e) => {
                e.preventDefault();
                if (newCategoryInput.trim()) {
                  await addCategorySilent(newCategoryInput.trim());
                  setNewCategoryInput("");
                }
              }} style={{ display: "flex", gap: "8px", marginBottom: "15px" }}>
                <input 
                  type="text" 
                  placeholder="New Category Name" 
                  className="nb-input" 
                  value={newCategoryInput} 
                  onChange={e => setNewCategoryInput(e.target.value)} 
                />
                <button type="submit" className="nb-btn" style={{ padding: "10px" }}><Plus size={18} /></button>
              </form>

              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "25px" }}>
                {categories.map((c, i) => (
                  <span key={i} className="sticker cyan" style={{ fontSize: "11px" }}>{c}</span>
                ))}
              </div>

              <button className="nb-btn" style={{ width: "100%" }} onClick={() => setSetupStep(2)}>Next: Configure Budgets</button>
            </div>
          )}

          {setupStep === 2 && (
            <div>
              <h3>Step 2: Assign Budget Limits</h3>
              <p style={{ fontSize: "13px", lineHeight: "1.4", marginBottom: "15px" }}>
                Set monthly limits for your categories so we can warn you of overspending leaks.
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

              <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "150px", overflowY: "auto", marginBottom: "25px" }}>
                {budgets.length === 0 && <p style={{ fontSize: "12px", opacity: 0.7 }}>No caps set yet.</p>}
                {budgets.map((b, idx) => (
                  <div key={idx} style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", borderBottom: "1px dashed var(--border)", paddingBottom: "4px" }}>
                    <span style={{ fontWeight: "bold" }}>{b.category}</span>
                    <span>₹{parseFloat(b.amount_limit).toFixed(0)}</span>
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", gap: "10px" }}>
                <button className="nb-btn" style={{ background: "var(--muted)", flex: 1 }} onClick={() => setSetupStep(1)}>Back</button>
                <button className="nb-btn" style={{ flex: 2 }} onClick={() => setSetupStep(3)}>Next: Finalize</button>
              </div>
            </div>
          )}

          {setupStep === 3 && (
            <div style={{ textAlign: "center" }}>
              <h3>Step 3: Setup Completed!</h3>
              <p style={{ fontSize: "14px", lineHeight: "1.5", marginBottom: "25px" }}>
                Perfect! You've configured your initial setup constraints. Let's redirect you to the main dashboard.
              </p>
              <button className="nb-btn" style={{ width: "100%" }} onClick={() => setIsSetupComplete(true)}>Lesgo! Launch Dashboard</button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Main Stack layout
  return (
    <div className="app-container">
      {/* HEADER SECTION */}
      <header className="nb-card" style={{ padding: "15px 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Wallet size={28} weight="fill" />
            <h2 style={{ margin: 0, fontSize: "20px" }}>UniPocket</h2>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <button className="nb-btn" style={{ background: "var(--muted)", padding: "6px", width: "36px", height: "36px", boxShadow: "2px 2px 0px var(--border)" }} onClick={() => setTheme(theme === "light" ? "dark" : "light")}>
              {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
            </button>
            <button className="nb-btn destruct" style={{ padding: "6px 12px", fontSize: "12px" }} onClick={handleLogout}>
              <SignOut size={16} /> Exit
            </button>
          </div>
        </div>

        {/* TABS SELECTOR */}
        <div className="tabs-navigation">
          <button className={`tab-button ${activeTab === "dashboard" ? "active" : ""}`} onClick={() => setActiveTab("dashboard")}><CalendarBlank size={16} /> Dashboard</button>
          <button className={`tab-button ${activeTab === "profile" ? "active" : ""}`} onClick={() => setActiveTab("profile")}><User size={16} /> Profile</button>
        </div>
      </header>

      {/* DYNAMIC ALERT BANNER */}
      {alertMsg && (
        <div className="alert-banner">
          <span>{alertMsg}</span>
          <button onClick={() => setAlertMsg("")}>✕</button>
        </div>
      )}

      {activeTab === "profile" ? (
        /* PROFILE MANAGER TAB */
        <div className="nb-card">
          <h3 style={{ borderBottom: "2px solid var(--border)", paddingBottom: "10px" }}>USER PROFILE SETTINGS 👤</h3>
          <form onSubmit={handleUpdateProfileSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div>
              <label style={{ display: "block", fontWeight: "bold", fontSize: "13px", marginBottom: "4px" }}>Full Name</label>
              <input type="text" className="nb-input" required value={profileForm.name} onChange={e => setProfileForm({...profileForm, name: e.target.value})} />
            </div>
            <div>
              <label style={{ display: "block", fontWeight: "bold", fontSize: "13px", marginBottom: "4px" }}>College Email</label>
              <input type="email" className="nb-input" required value={profileForm.email} onChange={e => setProfileForm({...profileForm, email: e.target.value})} />
            </div>
            <div>
              <label style={{ display: "block", fontWeight: "bold", fontSize: "13px", marginBottom: "4px" }}>Contact Number</label>
              <input type="text" className="nb-input" value={profileForm.contact_number} onChange={e => setProfileForm({...profileForm, contact_number: e.target.value})} />
            </div>
            <div>
              <label style={{ display: "block", fontWeight: "bold", fontSize: "13px", marginBottom: "4px" }}>New Password (Leave blank to keep current)</label>
              <input type="password" className="nb-input" value={profileForm.password} onChange={e => setProfileForm({...profileForm, password: e.target.value})} />
            </div>
            <button type="submit" className="nb-btn" style={{ marginTop: "10px" }}>Update Profile Details</button>
          </form>
        </div>
      ) : (
        /* MAIN DASHBOARD SCROLL FLOW (Vertical Stack Order Swapped: Budgets before transaction) */
        <>
          {/* MONTH FILTER BAR */}
          <div className="nb-card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
            <div>
              <span style={{ fontSize: "12px", fontWeight: "bold", display: "block", opacity: 0.8 }}>SELECT ACCOUNTING PERIOD 📅</span>
              <input 
                type="month" 
                className="nb-input" 
                style={{ width: "170px", padding: "6px", boxShadow: "1px 1px 0 var(--border)", fontSize: "14px" }}
                value={selectedMonth} 
                onChange={e => setSelectedMonth(e.target.value)} 
              />
            </div>
            <div style={{ textAlign: "right" }}>
              <span style={{ fontSize: "12px", fontWeight: "bold", display: "block", opacity: 0.8 }}>TOTAL MONTHLY SPENDING 💳</span>
              <h2 style={{ fontSize: "28px", margin: 0, color: "var(--destructive)" }}>₹{monthlyTotalSpent.toFixed(2)}</h2>
            </div>
          </div>

          {/* MONTHLY CALENDAR GRID VISUALIZER */}
          <div className="nb-card calendar-container">
            <h3 style={{ margin: 0 }}>MONTHLY EXPENSES GRID 📅</h3>
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
                      <span className="calendar-day-spent" title={`Total: ₹${spentToday}`}>
                        ₹{spentToday}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* BUDGET PLANNING PANELS (Swapped to be before Transaction Form) */}
          <div className="nb-card">
            <h3 style={{ margin: "0 0 12px 0" }}>SET CATEGORIZED BUDGET CAPS 🎯</h3>
            <form onSubmit={handleSetBudget} style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "15px" }}>
              {/* Category creation modes tab inside the budget block */}
              <div style={{ display: "flex", gap: "8px" }}>
                <button 
                  type="button"
                  className="nb-btn" 
                  style={{ 
                    flex: 1, 
                    padding: "6px", 
                    fontSize: "12px", 
                    background: budgetCategoryMode === "select" ? "var(--primary)" : "var(--card)", 
                    color: budgetCategoryMode === "select" ? "#000000" : "var(--fg)",
                    boxShadow: "1px 1px 0 var(--border)"
                  }}
                  onClick={() => setBudgetCategoryMode("select")}
                >
                  Select Existing Category
                </button>
                <button 
                  type="button"
                  className="nb-btn" 
                  style={{ 
                    flex: 1, 
                    padding: "6px", 
                    fontSize: "12px", 
                    background: budgetCategoryMode === "custom" ? "var(--primary)" : "var(--card)", 
                    color: budgetCategoryMode === "custom" ? "#000000" : "var(--fg)",
                    boxShadow: "1px 1px 0 var(--border)"
                  }}
                  onClick={() => setBudgetCategoryMode("custom")}
                >
                  + Add Custom Category
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

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {budgets.map((b, idx) => {
                const currentSpent = categoryDataMap[b.category] || 0;
                const ratio = Math.min((currentSpent / b.amount_limit) * 100, 100);
                return (
                  <div key={idx} style={{ fontSize: "13px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold", marginBottom: "4px" }}>
                      <span>{b.category}</span>
                      <span>₹{currentSpent} / ₹{parseFloat(b.amount_limit).toFixed(0)}</span>
                    </div>
                    <div className="bar-track">
                      <div className="bar-fill" style={{ width: `${ratio}%`, background: ratio >= 100 ? "var(--destructive)" : "var(--accent)" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* EXPENSE LOGGING FORM */}
          <div className="nb-card">
            <h3 style={{ margin: "0 0 12px 0", display: "flex", alignItems: "center", gap: "6px" }}>RECORD NEW TRANSACTION 💸</h3>
            <form onSubmit={handleAddExpense} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={{ display: "flex", gap: "10px" }}>
                <input type="text" placeholder="Expense Title (e.g. Bus ticket)" className="nb-input" style={{ flex: 2 }} required value={expenseForm.title} onChange={e => setExpenseForm({...expenseForm, title: e.target.value})} />
                <input type="number" placeholder="Amount (INR)" className="nb-input" style={{ flex: 1 }} required value={expenseForm.amount} onChange={e => setExpenseForm({...expenseForm, amount: e.target.value})} />
              </div>
              <div style={{ display: "flex", gap: "10px" }}>
                <select className="nb-select" style={{ flex: 1 }} value={expenseForm.category} onChange={e => setExpenseForm({...expenseForm, category: e.target.value})}>
                  {categories.map((c, idx) => <option key={idx} value={c}>{c}</option>)}
                </select>
                <input type="date" className="nb-input" style={{ flex: 1 }} required value={expenseForm.date} onChange={e => setExpenseForm({...expenseForm, date: e.target.value})} />
              </div>
              <button type="submit" className="nb-btn">Execute Transaction Log</button>
            </form>
          </div>

          {/* SAVINGS GOALS & JARS */}
          <div className="nb-card">
            <h3 style={{ margin: "0 0 12px 0", display: "flex", alignItems: "center", gap: "6px" }}>
              SAVINGS GOAL JARS 🍯
            </h3>
            <form onSubmit={handleAddSavingsGoal} style={{ display: "flex", gap: "10px", marginBottom: "15px" }}>
              <input 
                type="text" 
                placeholder="Goal (e.g. Laptop)" 
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
              <p style={{ fontSize: "13px", opacity: 0.8 }}>No active savings goals found.</p>
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
                      <div style={{ fontWeight: "bold", fontSize: "13px", marginTop: "4px" }}>{s.goal_name}</div>
                      <div style={{ fontSize: "11px", opacity: 0.7, marginBottom: "8px" }}>
                        ₹{current.toFixed(0)}/₹{target.toFixed(0)}
                      </div>
                      
                      {!isCompleted && (
                        <div style={{ display: "flex", gap: "4px", width: "100%" }}>
                          <input 
                            type="number" 
                            placeholder="₹" 
                            className="nb-input" 
                            style={{ padding: "4px 6px", fontSize: "11px", height: "26px", minWidth: "0" }}
                            value={depositAmounts[s.id] || ""}
                            onChange={e => setDepositAmounts({ ...depositAmounts, [s.id]: e.target.value })}
                          />
                          <button 
                            onClick={() => handleDepositSavings(s.id, depositAmounts[s.id], current, target)} 
                            className="nb-btn" 
                            style={{ padding: "4px 8px", fontSize: "10px", height: "26px" }}
                          >
                            Add
                          </button>
                        </div>
                      )}
                      {isCompleted && (
                        <span className="sticker pink" style={{ fontSize: "9px", padding: "3px", width: "100%", boxSizing: "border-box" }}>
                          🎉 GOAL MET!
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* SPENDING DISTRIBUTION MATRIX */}
          <div className="nb-card">
            <h3 style={{ margin: "0 0 12px 0" }}>SPENDING DISTRIBUTION MATRIX 📊</h3>
            {chartData.length === 0 ? (
              <p style={{ textAlign: "center", color: "#888", fontSize: "13px" }}>No transactions mapped for this period.</p>
            ) : (
              <div style={{ width: "100%", height: "200px" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <XAxis dataKey="category" stroke="var(--fg)" tick={{ fontSize: 11, fontWeight: "bold" }} />
                    <YAxis stroke="var(--fg)" tick={{ fontSize: 11, fontWeight: "bold" }} />
                    <Tooltip cursor={{ fill: 'rgba(0,0,0,0.03)' }} contentStyle={{ background: 'var(--card)', border: '2px solid var(--border)', fontFamily: 'monospace' }} />
                    <Bar dataKey="amount" fill="#ccff00" stroke="var(--border)" strokeWidth={2}>
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* HISTORICAL LEDGER FEED */}
          <div className="nb-card" style={{ flexGrow: 1 }}>
            <h3 style={{ margin: "0 0 12px 0" }}>HISTORICAL LEDGER FEED 📜</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "250px", overflowY: "auto" }}>
              {filteredExpenses.length === 0 && <p style={{ fontSize: "13px" }}>No transactions recorded for this period.</p>}
              {filteredExpenses.map((item, idx) => (
                <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px", borderBottom: "2px dashed var(--border)", fontSize: "13px" }}>
                  <div>
                    <div style={{ fontWeight: "bold" }}>{item.title}</div>
                    <div style={{ fontSize: "11px", opacity: 0.7 }}>{item.date} • <span style={{ textDecoration: "underline" }}>{item.category}</span></div>
                  </div>
                  <div style={{ fontWeight: "900", fontSize: "14px" }}>-₹{parseFloat(item.amount).toFixed(2)}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* FLOATING COLLAPSIBLE CHATBOT WIDGET */}
      <div className="chat-floating-btn" onClick={() => setChatOpen(!chatOpen)}>
        <ChatCircleText size={28} weight="bold" style={{ color: "#000000" }} />
      </div>

      {chatOpen && (
        <div className="chat-floating-drawer">
          <div className="chat-drawer-header">
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <Lightbulb size={20} weight="bold" />
              <span style={{ fontWeight: "bold", fontSize: "14px", fontFamily: "Space Grotesk" }}>Pocky - Your AI Coach</span>
            </div>
            <button 
              onClick={() => setChatOpen(false)} 
              style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", padding: 0 }}
            >
              <X size={18} weight="bold" style={{ color: "#000000" }} />
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
              placeholder="Ask Pocky anything..." 
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