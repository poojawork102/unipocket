import os
from flask import Flask, request, jsonify
from flask_cors import CORS
import pymysql
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__)
# Enable CORS so your React frontend (port 3000) can talk to your Flask backend (port 5000)
CORS(app, resources={r"/api/*": {"origins": "http://localhost:3000"}})

# MySQL Connection Configuration
db_config = {
    'host': 'localhost',
    'user': 'root',         # Replace with your MySQL username
    'password': 'pooja', # Replace with your MySQL password
    'database': 'up',
    'cursorclass': pymysql.cursors.DictCursor
}

def get_db_connection():
    return pymysql.connect(**db_config)

def init_db():
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            # Check and add contact_number column to users table
            cursor.execute("SHOW COLUMNS FROM users LIKE 'contact_number'")
            has_contact = cursor.fetchone()
            if not has_contact:
                cursor.execute("ALTER TABLE users ADD COLUMN contact_number VARCHAR(15) DEFAULT ''")
                
            # Create categories table if not exists
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS categories (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    student_id VARCHAR(50),
                    name VARCHAR(50) NOT NULL,
                    UNIQUE KEY (student_id, name),
                    FOREIGN KEY (student_id) REFERENCES users(student_id) ON DELETE CASCADE
                )
            """)
        conn.commit()
        print("Database migrations applied successfully!")
    except Exception as e:
        print("Database schema migration error:", e)
    finally:
        conn.close()

init_db()

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({"status": "healthy", "message": "UniPocket Backend is live!"}), 200

# --- AUTHENTICATION ENDPOINTS ---

@app.route('/api/register', methods=['POST'])
def register():
    data = request.json
    student_id = data.get('student_id')
    email = data.get('email')
    password = data.get('password')
    name = data.get('name', 'Student')
    contact_number = data.get('contact_number', '')

    if not student_id or not email or not password:
        return jsonify({"error": "Missing required fields"}), 400

    hashed_password = generate_password_hash(password)

    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            # Check if user already exists
            cursor.execute("SELECT student_id FROM users WHERE student_id = %s OR email = %s", (student_id, email))
            if cursor.fetchone():
                return jsonify({"error": "User with this Student ID or Email already exists"}), 400

            # Insert new user
            sql = "INSERT INTO users (student_id, name, email, password, contact_number) VALUES (%s, %s, %s, %s, %s)"
            cursor.execute(sql, (student_id, name, email, hashed_password, contact_number))
        conn.commit()
        return jsonify({
            "message": "User registered successfully!", 
            "user": {
                "student_id": student_id, 
                "name": name,
                "email": email,
                "contact_number": contact_number
            }
        }), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    email = data.get('email')
    password = data.get('password')

    if not email or not password:
        return jsonify({"error": "Missing email or password"}), 400

    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            cursor.execute("SELECT * FROM users WHERE email = %s", (email,))
            user = cursor.fetchone()

        if user and check_password_hash(user['password'], password):
            return jsonify({
                "message": "Login successful",
                "user": {
                    "student_id": user['student_id'],
                    "name": user['name'],
                    "email": user['email'],
                    "contact_number": user.get('contact_number', '')
                }
            }), 200
        else:
            return jsonify({"error": "Invalid email or password"}), 401
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()

# --- TRANSACTIONS & EXPENSES ---

@app.route('/api/expenses', methods=['GET'])
def get_expenses():
    student_id = request.args.get('student_id')
    if not student_id:
        return jsonify({"error": "Unauthorized. Student ID required."}), 401

    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            cursor.execute("SELECT * FROM expenses WHERE student_id = %s ORDER BY date DESC", (student_id,))
            expenses = cursor.fetchall()
        return jsonify(expenses), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()

@app.route('/api/expense', methods=['POST'])
def add_expense():
    data = request.json
    student_id = data.get('student_id')
    title = data.get('title')
    amount = data.get('amount')
    category = data.get('category')
    date = data.get('date') # Format: YYYY-MM-DD

    if not all([student_id, title, amount, category, date]):
        return jsonify({"error": "Missing transaction parameters"}), 400

    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            sql = "INSERT INTO expenses (student_id, title, amount, category, date) VALUES (%s, %s, %s, %s, %s)"
            cursor.execute(sql, (student_id, title, amount, category, date))
        conn.commit()
        return jsonify({"message": "Expense logged successfully!"}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()

# --- BUDGETS & SAVINGS ENDPOINTS ---

@app.route('/api/budgets', methods=['GET', 'POST'])
def handle_budgets():
    student_id = request.args.get('student_id') if request.method == 'GET' else request.json.get('student_id')
    if not student_id:
        return jsonify({"error": "Student ID required"}), 400

    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            if request.method == 'GET':
                cursor.execute("SELECT * FROM budgets WHERE student_id = %s", (student_id,))
                return jsonify(cursor.fetchall()), 200
            
            elif request.method == 'POST':
                data = request.json
                category = data.get('category')
                amount_limit = data.get('limit')
                
                cursor.execute("""
                    INSERT INTO budgets (student_id, category, amount_limit) 
                    VALUES (%s, %s, %s) 
                    ON DUPLICATE KEY UPDATE amount_limit = %s
                """, (student_id, category, amount_limit, amount_limit))
                conn.commit()
                return jsonify({"message": "Budget set successfully"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()

@app.route('/api/savings', methods=['GET', 'POST'])
def handle_savings():
    student_id = request.args.get('student_id') if request.method == 'GET' else request.json.get('student_id')
    if not student_id:
        return jsonify({"error": "Student ID required"}), 400

    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            if request.method == 'GET':
                cursor.execute("SELECT * FROM savings_goals WHERE student_id = %s", (student_id,))
                return jsonify(cursor.fetchall()), 200
            
            elif request.method == 'POST':
                data = request.json
                goal_name = data.get('goal_name')
                target_amount = data.get('target_amount')
                current_saved = data.get('current_saved', 0)
                
                cursor.execute("""
                    INSERT INTO savings_goals (student_id, goal_name, target_amount, current_saved) 
                    VALUES (%s, %s, %s, %s)
                """, (student_id, goal_name, target_amount, current_saved))
                conn.commit()
                return jsonify({"message": "Savings goal added!"}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()

# --- AI MONEY COACH ENDPOINT ---
@app.route('/api/ai/tip', methods=['GET'])
def get_ai_tip():
    # Simple rule-based analytical insights acting as your core AI money coach logic
    student_id = request.args.get('student_id')
    if not student_id:
        return jsonify({"tip": "Always track your daily spending to identify budget leaks!"})

    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            cursor.execute("SELECT SUM(amount) as total FROM expenses WHERE student_id = %s", (student_id,))
            result = cursor.fetchone()
            total_spent = result['total'] if result['total'] else 0

        if total_spent > 5000:
            tip = "⚠️ Heads up! Your spending has crossed ₹5,000 this month. Consider cutting down on non-essential food deliveries."
        elif total_spent == 0:
            tip = "🌱 Welcome to UniPocket! Log your first expense today to start gathering AI-driven savings insights."
        else:
            tip = "⚡ Great job keeping an eye on your cash! You are currently spending within safe parameters for a typical student budget."
        
        return jsonify({"tip": tip}), 200
    except Exception:
        return jsonify({"tip": "Consistency is key! Try setting a concrete savings goal this weekend."}), 200
    finally:
        conn.close()

# --- SAVINGS DEPOSIT ENDPOINT ---
@app.route('/api/savings/deposit', methods=['POST'])
def deposit_savings():
    data = request.json
    student_id = data.get('student_id')
    goal_id = data.get('id')
    amount = data.get('amount')

    if not all([student_id, goal_id, amount]):
        return jsonify({"error": "Missing parameters"}), 400

    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            cursor.execute("SELECT target_amount, current_saved FROM savings_goals WHERE id = %s AND student_id = %s", (goal_id, student_id))
            goal = cursor.fetchone()
            if not goal:
                return jsonify({"error": "Savings goal not found"}), 404

            new_saved = float(goal['current_saved']) + float(amount)
            new_saved = min(new_saved, float(goal['target_amount']))

            cursor.execute("UPDATE savings_goals SET current_saved = %s WHERE id = %s", (new_saved, goal_id))
        conn.commit()
        return jsonify({"message": "Deposit recorded successfully!", "current_saved": new_saved}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()

# --- AI MONEY COACH CHAT ENDPOINT ---
@app.route('/api/ai/chat', methods=['POST'])
def ai_chat():
    data = request.json
    student_id = data.get('student_id')
    message = data.get('message', '').lower()

    if not student_id or not message:
        return jsonify({"reply": "I'm listening! Ask me anything about your money, budgets, or savings."}), 400

    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            cursor.execute("SELECT name FROM users WHERE student_id = %s", (student_id,))
            user = cursor.fetchone()
            name = user['name'] if user else "Student"

            cursor.execute("SELECT amount, category FROM expenses WHERE student_id = %s", (student_id,))
            expenses = cursor.fetchall()
            total_spent = sum(float(item['amount']) for item in expenses)

            cursor.execute("SELECT category, amount_limit FROM budgets WHERE student_id = %s", (student_id,))
            budgets = cursor.fetchall()
            budget_map = {b['category'].lower(): float(b['amount_limit']) for b in budgets}

            cursor.execute("SELECT goal_name, target_amount, current_saved FROM savings_goals WHERE student_id = %s", (student_id,))
            savings = cursor.fetchall()

        cat_spending = {}
        for exp in expenses:
            cat = exp['category'].lower()
            cat_spending[cat] = cat_spending.get(cat, 0.0) + float(exp['amount'])

        reply = ""
        import re
        import random
        amounts = re.findall(r'(?:rs\.?|₹|inr)?\s*(\d+(?:\.\d{1,2})?)', message)
        
        if amounts:
            requested_amount = float(amounts[0])
            if requested_amount > 5000:
                reply = f"💸 ₹{requested_amount:,.2f}? That's a massive expense for a student budget! I'd highly recommend sleeping on it for 48 hours first."
            elif total_spent + requested_amount > 10000:
                reply = f"🚨 If you spend ₹{requested_amount:,.2f}, your total monthly spending will hit ₹{total_spent + requested_amount:,.2f}. That's entering the danger zone! Maybe hold off."
            else:
                matched_cat = None
                for cat in budget_map:
                    if cat in message:
                        matched_cat = cat
                        break
                
                if matched_cat:
                    limit = budget_map[matched_cat]
                    spent = cat_spending.get(matched_cat, 0.0)
                    rem = limit - spent
                    if requested_amount > rem:
                        reply = f"⚠️ Your remaining {matched_cat.capitalize()} budget is only ₹{rem:.2f} (Limit: ₹{limit:.2f}). Spending ₹{requested_amount:.2f} will blow right past your cap!"
                    else:
                        reply = f"✅ You have ₹{rem:.2f} left in your {matched_cat.capitalize()} budget. Spending ₹{requested_amount:.2f} is safe. Go ahead, but track it!"
                else:
                    reply = f"💰 Spending ₹{requested_amount:.2f} fits within your current parameters. Your total monthly outflow would become ₹{total_spent + requested_amount:.2f}."

        elif "budget" in message or "limit" in message or "cap" in message:
            if not budget_map:
                reply = "📋 You haven't set any budget caps yet! Set a limit for categories like Food or Travel below so I can monitor them for you."
            else:
                lines = []
                for cat, limit in budget_map.items():
                    spent = cat_spending.get(cat, 0.0)
                    pct = (spent / limit) * 100
                    status = "🚨 OVER BUDGET" if spent > limit else f"{pct:.0f}% used"
                    lines.append(f"• {cat.capitalize()}: ₹{spent:.0f}/₹{limit:.0f} ({status})")
                reply = f"📊 Here is your active budget status:\n" + "\n".join(lines)

        elif "save" in message or "saving" in message or "goal" in message or "jar" in message:
            if not savings:
                reply = "🌱 You haven't set any savings goals yet. Create a savings goal jar to track major milestones (like a new laptop or semester fees)!"
            else:
                lines = []
                for s in savings:
                    pct = (float(s['current_saved']) / float(s['target_amount'])) * 100
                    lines.append(f"• '{s['goal_name']}' is {pct:.1f}% saved (₹{s['current_saved']:.0f}/₹{s['target_amount']:.0f})")
                reply = f"🎯 Savings Jars progress:\n" + "\n".join(lines) + "\n💡 Tip: Redirect spare change here instead of ordering takeout!"

        elif "food" in message or "eat" in message or "restaurant" in message or "zomato" in message or "swiggy" in message:
            spent = cat_spending.get("food", 0.0)
            limit = budget_map.get("food")
            if limit:
                reply = f"🍔 You've spent ₹{spent:.2f} of your ₹{limit:.2f} Food budget. " + ("You are over budget! 🛑 Pack a lunch." if spent > limit else "You're doing great, keep it up!")
            else:
                reply = f"🍔 You've spent ₹{spent:.2f} on Food this month. Set a budget cap to keep your food cravings under control!"

        elif "travel" in message or "cab" in message or "uber" in message or "ola" in message or "metro" in message:
            spent = cat_spending.get("travel", 0.0)
            limit = budget_map.get("travel")
            if limit:
                reply = f"🚗 Travel expenses: ₹{spent:.2f} out of ₹{limit:.2f} limit. " + ("Time to walk or use public transit! 🚨" if spent > limit else "Within budget bounds.")
            else:
                reply = f"🚗 You've spent ₹{spent:.2f} on travel. Walk more, it's free exercise!"

        else:
            replies = [
                f"Hey {name}! I'm Pocky, your AI Money Coach. I can analyze your budget, check your savings goals, or evaluate potential purchases. Try asking: 'Can I spend ₹500 on Food?'",
                f"Keep up the momentum, {name}! Currently, you've spent ₹{total_spent:.2f} in total this month. Set a savings goal to keep your extra cash locked away safely.",
                f"Need savings advice, {name}? Set budget caps for your high-expense categories to avoid leaking cash on small items."
            ]
            reply = random.choice(replies)

        return jsonify({"reply": reply}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()

# --- PROFILE UPDATE ENDPOINT ---
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

    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            if password:
                hashed_password = generate_password_hash(password)
                sql = "UPDATE users SET name = %s, email = %s, contact_number = %s, password = %s WHERE student_id = %s"
                cursor.execute(sql, (name, email, contact_number, hashed_password, student_id))
            else:
                sql = "UPDATE users SET name = %s, email = %s, contact_number = %s WHERE student_id = %s"
                cursor.execute(sql, (name, email, contact_number, student_id))
        conn.commit()
        return jsonify({
            "message": "Profile updated successfully!", 
            "user": {
                "student_id": student_id, 
                "name": name, 
                "email": email, 
                "contact_number": contact_number
            }
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()

# --- CATEGORY MANAGEMENT ENDPOINT ---
@app.route('/api/categories', methods=['GET', 'POST'])
def handle_categories():
    student_id = request.args.get('student_id') if request.method == 'GET' else request.json.get('student_id')
    if not student_id:
        return jsonify({"error": "Student ID required"}), 400

    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            if request.method == 'GET':
                cursor.execute("SELECT name FROM categories WHERE student_id = %s", (student_id,))
                rows = cursor.fetchall()
                custom_cats = [r['name'] for r in rows]
                defaults = ["Food", "Travel", "Books", "Entertainment", "Other"]
                all_cats = list(dict.fromkeys(defaults + custom_cats))
                return jsonify(all_cats), 200
                
            elif request.method == 'POST':
                data = request.json
                category_name = data.get('category_name', '').strip()
                if not category_name:
                    return jsonify({"error": "Category name required"}), 400

                defaults = ["Food", "Travel", "Books", "Entertainment", "Other"]
                if category_name.lower() in [d.lower() for d in defaults]:
                    return jsonify({"message": "Category already exists as a default!"}), 200

                cursor.execute("""
                    INSERT INTO categories (student_id, name) 
                    VALUES (%s, %s)
                    ON DUPLICATE KEY UPDATE name = name
                """, (student_id, category_name))
                conn.commit()
                return jsonify({"message": "Category added successfully!"}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()

if __name__ == '__main__':
    app.run(debug=True, port=5000)