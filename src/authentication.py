import sqlite3
from werkzeug.security import generate_password_hash, check_password_hash

# Flask requests are dealt sequentially so no danger here
con = sqlite3.connect("server/data.db", check_same_thread=False)
cur = con.cursor()

cur.execute("CREATE TABLE IF NOT EXISTS accounts(username TEXT PRIMARY KEY, password_hash TEXT)")


def user_exists(username):
    # Prevents unwanted sql injection vulnerabilities
    res = cur.execute("SELECT username FROM accounts WHERE username=?", (username,))
    return res.fetchone() is not None


def create_user(username, raw_password):
    if user_exists(username):
        return False
    cur.execute("INSERT INTO accounts VALUES (?, ?)", (username, generate_password_hash(raw_password)))
    con.commit()
    return True


def check_password(username, raw_password):
    res = cur.execute("SELECT password_hash FROM accounts WHERE username=?", (username,))
    first_row = res.fetchone()
    if first_row is None:
        return False
    return check_password_hash(first_row[0], raw_password)
