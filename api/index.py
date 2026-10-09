import os
import time
from collections import defaultdict
from flask import Flask, request, jsonify
from flask_cors import CORS
import psycopg2
import psycopg2.extras
from werkzeug.security import generate_password_hash, check_password_hash

# Simple in-memory rate limiter
_rate_store = defaultdict(list)
RATE_LIMIT = 30
RATE_WINDOW = 60

def is_rate_limited(key):
    now = time.time()
    _rate_store[key] = [t for t in _rate_store[key] if now - t < RATE_WINDOW]
    if len(_rate_store[key]) >= RATE_LIMIT:
        return True
    _rate_store[key].append(now)
    return False

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}}, supports_credentials=True,
     methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
     allow_headers=["Content-Type", "Authorization"])

@app.before_request
def handle_preflight():
    if request.method == "OPTIONS":
        return app.make_default_options_response()

@app.after_request
def add_security_headers(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
    response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'DENY'
    return response

def get_db_connection():
    db_url = os.getenv('POSTGRES_URL') or os.getenv('DATABASE_URL')
    if db_url:
        if db_url.startswith('postgres://'):
            db_url = db_url.replace('postgres://', 'postgresql://', 1)
        conn = psycopg2.connect(db_url, cursor_factory=psycopg2.extras.RealDictCursor)
    else:
        conn = psycopg2.connect(
            host=os.getenv('POSTGRES_HOST', 'localhost'),
            port=int(os.getenv('POSTGRES_PORT', '5432')),
            user=os.getenv('POSTGRES_USER', 'postgres'),
            password=os.getenv('POSTGRES_PASSWORD', ''),
            dbname=os.getenv('POSTGRES_DATABASE', 'unipocket'),
            cursor_factory=psycopg2.extras.RealDictCursor
        )
    conn.autocommit = False
    return conn

def init_db():
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    student_id VARCHAR(50) PRIMARY KEY,
                    name VARCHAR(100) NOT NULL,
                    email VARCHAR(100) NOT NULL UNIQUE,
                    password VARCHAR(255) NOT NULL,
                    contact_number VARCHAR(20) DEFAULT ''
                )
            """)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS categories (
                    id SERIAL PRIMARY KEY,
                    student_id VARCHAR(50) REFERENCES users(student_id) ON DELETE CASCADE,
                    name VARCHAR(50) NOT NULL,
                    UNIQUE(student_id, name)
                )
            """)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS expenses (
                    id SERIAL PRIMARY KEY,
                    student_id VARCHAR(50) NOT NULL REFERENCES users(student_id) ON DELETE CASCADE,
                    title VARCHAR(100) NOT NULL,
                    amount DECIMAL(10, 2) NOT NULL,
                    category VARCHAR(50) NOT NULL,
                    date DATE NOT NULL
                )
            """)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS budgets (
                    id SERIAL PRIMARY KEY,
                    student_id VARCHAR(50) NOT NULL REFERENCES users(student_id) ON DELETE CASCADE,
                    category VARCHAR(50) NOT NULL,
                    amount_limit DECIMAL(10, 2) NOT NULL,
                    UNIQUE(student_id, category)
                )
            """)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS savings_goals (
                    id SERIAL PRIMARY KEY,
                    student_id VARCHAR(50) NOT NULL REFERENCES users(student_id) ON DELETE CASCADE,
                    goal_name VARCHAR(100) NOT NULL,
                    target_amount DECIMAL(10, 2) NOT NULL,
                    current_saved DECIMAL(10, 2) DEFAULT 0.00
                )
            """)
            # Migration: add contact_number if missing
            cur.execute("""
                SELECT column_name FROM information_schema.columns
                WHERE table_name = 'users' AND column_name = 'contact_number'
            """)
            if not cur.fetchone():
                cur.execute("ALTER TABLE users ADD COLUMN contact_number VARCHAR(20) DEFAULT ''")
        conn.commit()
        print("Database initialized!")
    except Exception as e:
        print("DB init error:", e)
        if conn:
            conn.rollback()
    finally:
        if conn:
            conn.close()

try:
    init_db()
except Exception as e:
    print(f"init_db deferred: {e}")

# --- HEALTH ---

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({"status": "healthy", "message": "UniPocket Backend is live!"}), 200

# --- AUTH ---

@app.route('/api/register', methods=['POST'])
def register():
    client_ip = request.headers.get('X-Forwarded-For', request.remote_addr)
    if is_rate_limited(f"register:{client_ip}"):
        return jsonify({"error": "Too many requests. Please try again later."}), 429

    data = request.json or {}
    student_id = data.get('student_id') or data.get('studentId')
    email = data.get('email') or data.get('collegeEmail') or data.get('college_email')
    password = data.get('password')
    name = data.get('name') or data.get('fullName') or 'Student'
    contact_number = str(data.get('contact_number') or data.get('contactNumber') or '')

    if not student_id or not email or not password:
        return jsonify({"error": "Missing required fields"}), 400

    hashed_password = generate_password_hash(password)

    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute("SELECT student_id FROM users WHERE student_id = %s OR email = %s", (student_id, email))
            if cur.fetchone():
                return jsonify({"error": "User with this Student ID or Email already exists"}), 400
            cur.execute(
                "INSERT INTO users (student_id, name, email, password, contact_number) VALUES (%s, %s, %s, %s, %s)",
                (student_id, name, email, hashed_password, contact_number))
        conn.commit()
        return jsonify({"message": "User registered successfully!"}), 201
    except Exception as e:
        if conn: conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        if conn:
            conn.close()

@app.route('/api/login', methods=['POST'])
def login():
    client_ip = request.headers.get('X-Forwarded-For', request.remote_addr)
    if is_rate_limited(f"login:{client_ip}"):
        return jsonify({"error": "Too many login attempts. Please wait a moment."}), 429

    data = request.json or {}
    email = data.get('email') or data.get('collegeEmail') or data.get('college_email')
    password = data.get('password')

    if not email or not password:
        return jsonify({"error": "Missing email or password"}), 400

    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM users WHERE email = %s", (email,))
            user = cur.fetchone()

        if user:
            stored_hash = user.get('password', '')
            if isinstance(stored_hash, bytes):
                stored_hash = stored_hash.decode('utf-8')
            if check_password_hash(stored_hash, password):
                return jsonify({
                    "message": "Login successful",
                    "user": {
                        "student_id": user.get('student_id', ''),
                        "name": user.get('name', ''),
                        "email": user.get('email', ''),
                        "contact_number": user.get('contact_number', '')
                    }
                }), 200

        return jsonify({"error": "Invalid email or password"}), 401
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if conn:
            conn.close()

# --- EXPENSES ---

@app.route('/api/expenses', methods=['GET'])
def get_expenses():
    student_id = request.args.get('student_id')
    if not student_id:
        return jsonify({"error": "Student ID required"}), 401

    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM expenses WHERE student_id = %s ORDER BY date DESC, id DESC", (student_id,))
            expenses = cur.fetchall()
            for exp in expenses:
                if exp.get('date'):
                    exp['date'] = str(exp['date'])
        return jsonify(expenses), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if conn:
            conn.close()

@app.route('/api/expense', methods=['POST'])
def add_expense():
    data = request.json or {}
    student_id = data.get('student_id')
    title = data.get('title')
    amount = data.get('amount')
    category = data.get('category')
    date = data.get('date')

    if not all([student_id, title, amount, category, date]):
        return jsonify({"error": "Missing transaction parameters"}), 400

    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO expenses (student_id, title, amount, category, date) VALUES (%s, %s, %s, %s, %s) RETURNING id",
                (student_id, title, amount, category, date))
            expense_id = cur.fetchone()['id']
        conn.commit()
        return jsonify({"message": "Expense logged successfully!", "id": expense_id}), 201
    except Exception as e:
        if conn: conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        if conn:
            conn.close()

@app.route('/api/expense/<int:expense_id>', methods=['DELETE', 'OPTIONS'])
def delete_expense(expense_id):
    if request.method == 'OPTIONS':
        return jsonify({"status": "ok"}), 200

    student_id = request.args.get('student_id') or (request.json and request.json.get('student_id'))
    if not student_id:
        return jsonify({"error": "Student ID required for authorization"}), 401

    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute("DELETE FROM expenses WHERE id = %s AND student_id = %s", (expense_id, student_id))
            if cur.rowcount == 0:
                return jsonify({"error": "Expense not found or unauthorized"}), 404
        conn.commit()
        return jsonify({"message": "Expense deleted!", "id": expense_id}), 200
    except Exception as e:
        if conn: conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        if conn:
            conn.close()

# --- BUDGETS ---

@app.route('/api/budgets', methods=['GET', 'POST'])
def handle_budgets():
    student_id = request.args.get('student_id') if request.method == 'GET' else request.json.get('student_id')
    if not student_id:
        return jsonify({"error": "Student ID required"}), 400

    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            if request.method == 'GET':
                cur.execute("SELECT * FROM budgets WHERE student_id = %s", (student_id,))
                return jsonify(cur.fetchall()), 200
            else:
                data = request.json
                category = data.get('category')
                amount_limit = data.get('limit')
                cur.execute("""
                    INSERT INTO budgets (student_id, category, amount_limit) VALUES (%s, %s, %s)
                    ON CONFLICT (student_id, category) DO UPDATE SET amount_limit = EXCLUDED.amount_limit
                """, (student_id, category, amount_limit))
                conn.commit()
                return jsonify({"message": "Budget set successfully"}), 200
    except Exception as e:
        if conn: conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        if conn:
            conn.close()

# --- SAVINGS ---

@app.route('/api/savings', methods=['GET', 'POST'])
def handle_savings():
    student_id = request.args.get('student_id') if request.method == 'GET' else request.json.get('student_id')
    if not student_id:
        return jsonify({"error": "Student ID required"}), 400

    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            if request.method == 'GET':
                cur.execute("SELECT * FROM savings_goals WHERE student_id = %s", (student_id,))
                return jsonify(cur.fetchall()), 200
            else:
                data = request.json
                cur.execute(
                    "INSERT INTO savings_goals (student_id, goal_name, target_amount, current_saved) VALUES (%s, %s, %s, %s)",
                    (student_id, data.get('goal_name'), data.get('target_amount'), data.get('current_saved', 0)))
                conn.commit()
                return jsonify({"message": "Savings goal added!"}), 201
    except Exception as e:
        if conn: conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        if conn:
            conn.close()

@app.route('/api/savings/deposit', methods=['POST'])
def deposit_savings():
    data = request.json
    student_id = data.get('student_id')
    goal_id = data.get('id')
    amount = data.get('amount')

    if not all([student_id, goal_id, amount]):
        return jsonify({"error": "Missing parameters"}), 400

    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute("SELECT target_amount, current_saved FROM savings_goals WHERE id = %s AND student_id = %s", (goal_id, student_id))
            goal = cur.fetchone()
            if not goal:
                return jsonify({"error": "Savings goal not found"}), 404
            new_saved = min(float(goal['current_saved']) + float(amount), float(goal['target_amount']))
            cur.execute("UPDATE savings_goals SET current_saved = %s WHERE id = %s", (new_saved, goal_id))
        conn.commit()
        return jsonify({"message": "Deposit recorded!", "current_saved": new_saved}), 200
    except Exception as e:
        if conn: conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        if conn:
            conn.close()

# --- AI TIP ---

@app.route('/api/ai/tip', methods=['GET'])
def get_ai_tip():
    student_id = request.args.get('student_id')
    if not student_id:
        return jsonify({"tip": "Always track your daily spending to identify budget leaks!"})

    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute("SELECT SUM(amount) as total FROM expenses WHERE student_id = %s", (student_id,))
            result = cur.fetchone()
            total_spent = float(result['total']) if result['total'] else 0

        if total_spent > 5000:
            tip = "Your spending has crossed Rs.5,000. Consider cutting down on non-essential deliveries."
        elif total_spent == 0:
            tip = "Welcome to UniPocket! Log your first expense to start gathering AI-driven insights."
        else:
            tip = "Great job! You are spending within safe parameters for a typical student budget."
        return jsonify({"tip": tip}), 200
    except Exception:
        return jsonify({"tip": "Consistency is key! Try setting a savings goal this weekend."}), 200
    finally:
        if conn:
            conn.close()

# --- AI CHAT ---

@app.route('/api/ai/chat', methods=['POST'])
def ai_chat():
    data = request.json
    student_id = data.get('student_id')
    message = data.get('message', '').lower()

    if not student_id or not message:
        return jsonify({"reply": "I'm listening! Ask me anything about your money, budgets, or savings."}), 400

    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute("SELECT name FROM users WHERE student_id = %s", (student_id,))
            user = cur.fetchone()
            name = user['name'] if user else "Student"

            cur.execute("SELECT amount, category FROM expenses WHERE student_id = %s", (student_id,))
            expenses = cur.fetchall()
            total_spent = sum(float(item['amount']) for item in expenses)

            cur.execute("SELECT category, amount_limit FROM budgets WHERE student_id = %s", (student_id,))
            budgets = cur.fetchall()
            budget_map = {b['category'].lower(): float(b['amount_limit']) for b in budgets}

            cur.execute("SELECT goal_name, target_amount, current_saved FROM savings_goals WHERE student_id = %s", (student_id,))
            savings = cur.fetchall()

        cat_spending = {}
        for exp in expenses:
            cat = exp['category'].lower()
            cat_spending[cat] = cat_spending.get(cat, 0.0) + float(exp['amount'])

        import re, random
        reply = ""
        amounts = re.findall(r'(?:rs\.?|inr)?\s*(\d+(?:\.\d{1,2})?)', message)

        if amounts:
            requested_amount = float(amounts[0])
            if requested_amount > 5000:
                reply = f"Rs.{requested_amount:,.2f}? That's massive for a student budget! Sleep on it for 48 hours first."
            elif total_spent + requested_amount > 10000:
                reply = f"If you spend Rs.{requested_amount:,.2f}, your total hits Rs.{total_spent + requested_amount:,.2f}. Danger zone!"
            else:
                matched_cat = next((cat for cat in budget_map if cat in message), None)
                if matched_cat:
                    limit = budget_map[matched_cat]
                    rem = limit - cat_spending.get(matched_cat, 0.0)
                    if requested_amount > rem:
                        reply = f"Your remaining {matched_cat.capitalize()} budget is only Rs.{rem:.2f}. Spending Rs.{requested_amount:.2f} will exceed your cap!"
                    else:
                        reply = f"You have Rs.{rem:.2f} left in {matched_cat.capitalize()} budget. Rs.{requested_amount:.2f} is safe. Go ahead!"
                else:
                    reply = f"Spending Rs.{requested_amount:.2f} fits within your parameters. Total would become Rs.{total_spent + requested_amount:.2f}."

        elif any(k in message for k in ("budget", "limit", "cap")):
            if not budget_map:
                reply = "You haven't set any budget caps yet! Set a limit for categories like Food or Travel."
            else:
                lines = [f"- {c.capitalize()}: Rs.{cat_spending.get(c, 0):.0f}/Rs.{l:.0f} ({'OVER' if cat_spending.get(c, 0) > l else f'{cat_spending.get(c,0)/l*100:.0f}% used'})" for c, l in budget_map.items()]
                reply = "Budget status:\n" + "\n".join(lines)

        elif any(k in message for k in ("save", "saving", "goal", "jar")):
            if not savings:
                reply = "No savings goals yet. Create a savings jar to track milestones!"
            else:
                lines = [f"- '{s['goal_name']}': {float(s['current_saved'])/float(s['target_amount'])*100:.1f}% (Rs.{s['current_saved']}/Rs.{s['target_amount']})" for s in savings]
                reply = "Savings progress:\n" + "\n".join(lines)

        elif any(k in message for k in ("food", "eat", "zomato", "swiggy")):
            spent = cat_spending.get("food", 0.0)
            limit = budget_map.get("food")
            reply = f"Food spending: Rs.{spent:.2f}" + (f" of Rs.{limit:.2f} budget. {'Over budget!' if spent > limit else 'On track!'}" if limit else ". Set a budget cap to stay in control!")

        elif any(k in message for k in ("travel", "cab", "uber", "ola", "metro")):
            spent = cat_spending.get("travel", 0.0)
            limit = budget_map.get("travel")
            reply = f"Travel spending: Rs.{spent:.2f}" + (f" of Rs.{limit:.2f} limit. {'Time for public transit!' if spent > limit else 'Within bounds.'}" if limit else ". Walk more, it's free exercise!")

        else:
            reply = random.choice([
                f"Hey {name}! I can analyze your budget, check savings, or evaluate purchases. Try: 'Can I spend Rs.500 on Food?'",
                f"You've spent Rs.{total_spent:.2f} total this month. Set a savings goal to lock away extra cash!",
                f"Need advice, {name}? Set budget caps for high-expense categories to avoid leaking cash."
            ])

        return jsonify({"reply": reply}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if conn:
            conn.close()

# --- PROFILE ---

@app.route('/api/user/update', methods=['POST'])
def update_user():
    data = request.json
    student_id = data.get('student_id')
    name = data.get('name')
    email = data.get('email')
    contact_number = data.get('contact_number', '')
    password = data.get('password')

    if not student_id or not name or not email:
        return jsonify({"error": "Missing required fields"}), 400

    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            if password:
                hashed = generate_password_hash(password)
                cur.execute("UPDATE users SET name=%s, email=%s, contact_number=%s, password=%s WHERE student_id=%s",
                            (name, email, contact_number, hashed, student_id))
            else:
                cur.execute("UPDATE users SET name=%s, email=%s, contact_number=%s WHERE student_id=%s",
                            (name, email, contact_number, student_id))
        conn.commit()
        return jsonify({
            "message": "Profile updated!",
            "user": {"student_id": student_id, "name": name, "email": email, "contact_number": contact_number}
        }), 200
    except Exception as e:
        if conn: conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        if conn:
            conn.close()

# --- CATEGORIES ---

@app.route('/api/categories', methods=['GET', 'POST'])
def handle_categories():
    student_id = request.args.get('student_id') if request.method == 'GET' else request.json.get('student_id')
    if not student_id:
        return jsonify({"error": "Student ID required"}), 400

    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            if request.method == 'GET':
                cur.execute("SELECT name FROM categories WHERE student_id = %s", (student_id,))
                custom = [r['name'] for r in cur.fetchall()]
                defaults = ["Food", "Travel", "Books", "Entertainment", "Other"]
                return jsonify(list(dict.fromkeys(defaults + custom))), 200
            else:
                cat_name = request.json.get('category_name', '').strip()
                if not cat_name:
                    return jsonify({"error": "Category name required"}), 400
                defaults = ["food", "travel", "books", "entertainment", "other"]
                if cat_name.lower() in defaults:
                    return jsonify({"message": "Category already exists as a default!"}), 200
                cur.execute(
                    "INSERT INTO categories (student_id, name) VALUES (%s, %s) ON CONFLICT (student_id, name) DO NOTHING",
                    (student_id, cat_name))
                conn.commit()
                return jsonify({"message": "Category added!"}), 201
    except Exception as e:
        if conn: conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        if conn:
            conn.close()

# --- ERROR HANDLERS ---

@app.errorhandler(404)
def not_found(e):
    return jsonify({"error": "Endpoint not found", "status": 404}), 404

@app.errorhandler(405)
def method_not_allowed(e):
    return jsonify({"error": "Method not allowed", "status": 405}), 405

@app.errorhandler(500)
def internal_error(e):
    return jsonify({"error": "Internal server error", "status": 500}), 500
