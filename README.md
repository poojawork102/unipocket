#UNIPOCKET

# 👛 UniPocket

> **Personal Finance & Expense Tracker for University Students**

UniPocket is a tailored personal finance management web application designed specifically to help university students track daily expenses, manage budgets, and build healthy financial habits. Built with a robust **Python (Flask)** backend and a **MySQL** database, UniPocket provides structured data handling and an intuitive dashboard experience.

---

## ✨ Key Features

- 📊 **Expense & Income Tracking:** Easily log, classify, and track daily spending and budget limits.
- 🏷️ **Categorized Budgets:** Visual breakdowns across student-specific categories (e.g., Food, Academics, Travel, Entertainment).
- 🗄️ **Relational Database Management:** Built with normalized MySQL schemas, triggers, and procedures to ensure data integrity and real-time balance updates.
- ⚡ **Lightweight REST API:** Powered by Flask for smooth, asynchronous interactions between backend logic and UI.

---

## 🛠️ Tech Stack

- **Backend:** Python 3, Flask
- **Database:** MySQL
- **Frontend:** HTML5, CSS3, JavaScript (Jinja2 Templates)
- **Database Connector:** `mysql-connector-python` / `Flask-SQLAlchemy`

---

## 📁 Repository Structure

```text
unipocket/
│
├── app/
│   ├── static/          # CSS, JS, and image assets
│   ├── templates/       # Jinja2 HTML templates
│   ├── __init__.py      # Flask app initialization
│   ├── routes.py        # Application routes & API endpoints
│   └── models.py        # Database models & queries
│
├── database/
│   ├── schema.sql       # Database tables and constraints
│   └── seed.sql         # Dummy data for initial testing
│
├── .env.example         # Example environment configuration
├── config.py            # App configuration settings
├── app.py               # Application entry point
├── requirements.txt     # Python dependencies
└── README.md            # Project documentation
🚀 Getting Started
Follow these instructions to set up and run UniPocket locally on your machine.

📋 Prerequisites
Ensure you have the following installed:

Python 3.9+

MySQL Server & Workbench / Command Line Client

git

📥 1. Clone the Repository
Bash
git clone [https://github.com/poojawork102/unipocket.git](https://github.com/poojawork102/unipocket.git)
cd unipocket
🐍 2. Set Up Virtual Environment
Create and activate a virtual environment:

On macOS/Linux
python3 -m venv venv
source venv/bin/activate

On Windows (PowerShell)
python -m venv venv
.\venv\Scripts\activate


---

### 📦 3. Install Dependencies

```bash
pip install -r requirements.txt
🛢️ 4. Configure the MySQL Database
Log in to MySQL:

Bash
mysql -u root -p
Create the database and run the schema file:

SQL
CREATE DATABASE unipocket_db;
USE unipocket_db;
SOURCE database/schema.sql;
Configure environment variables by creating a .env file in the project root:

Code snippet
FLASK_APP=app.py
FLASK_ENV=development
SECRET_KEY=your_secret_key_here

DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=unipocket_db
▶️ 5. Run the Application
Bash
flask run
Open your browser and navigate to:

Plaintext
http://127.0.0.1:5000
📌 Future Enhancements
[ ] Interactive chart visualizer for monthly spending patterns.

[ ] Export transaction logs to CSV/PDF reports.

[ ] Group expense splitting for shared housing and outings.

📄 License
Distributed under the MIT License. See LICENSE for more information.


---

<ElicitationsGroup message="Would you like help with any of the following to complete the setup?">

  <Elicitation label="Draft a MySQL schema.sql template for UniPocket" query="Provide a clean MySQL schema.sql script for UniPocket with users, transactions, and categories tables." />

  <Elicitation label="Generate a requirements.txt file" query="Show me a standard requirements.txt file for a Flask and MySQL web application." />

  <Elicitation label="Create a Flask database connection module" query="Write a Python script using Flask and MySQL connector to connect the backend to the database." />
</ElicitationsGroup>