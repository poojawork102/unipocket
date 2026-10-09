import os

os.environ['POSTGRES_URL'] = 'postgresql://neondb_owner:npg_nzPc5FUYdJ6x@ep-green-rice-b86af885-pooler.c-14.us-east-1.aws.neon.tech/neondb?sslmode=require'

# Load SMTP credentials from api/.env if present
env_path = os.path.join(os.path.dirname(__file__), 'api', '.env')
if os.path.exists(env_path):
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, val = line.split('=', 1)
                os.environ.setdefault(key.strip(), val.strip())

import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'api'))
from index import app

if __name__ == '__main__':
    print("Starting UniPocket backend on http://localhost:5000")
    print("SMTP configured:", "Yes" if os.getenv('SMTP_EMAIL') and os.getenv('SMTP_PASSWORD') else "No (forgot password won't send emails)")
    app.run(debug=True, port=5000)
