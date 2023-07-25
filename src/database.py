import sqlite3
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime

# Flask requests are dealt sequentially so no danger here
con = sqlite3.connect("server/data.db", check_same_thread=False)
cur = con.cursor()

cur.execute("CREATE TABLE IF NOT EXISTS accounts"
            "(username TEXT PRIMARY KEY,"
            "password_hash TEXT)")
cur.execute("CREATE TABLE IF NOT EXISTS routes"
            "(id INTEGER PRIMARY KEY AUTOINCREMENT,"
            "timestamp TEXT,"
            "route TEXT,"
            "username TEXT,"
            "route_name TEXT,"
            "FOREIGN KEY(username) REFERENCES accounts(username))")

def user_exists(username):
    # Prevents unwanted sql injection vulnerabilities
    res = cur.execute("SELECT username FROM accounts WHERE username=?", (username,))
    return res.fetchone() is not None


def create_user(username, raw_password):
    if user_exists(username):
        return False
    cur.execute("INSERT INTO accounts "
                "VALUES (?, ?)", (username, generate_password_hash(raw_password)))
    con.commit()
    return True


def check_password(username, raw_password):
    res = cur.execute("SELECT password_hash "
                      "FROM accounts "
                      "WHERE username=?",
                      (username,))
    first_row = res.fetchone()
    if first_row is None:
        return False
    return check_password_hash(first_row[0], raw_password)


def store_route(route, username, route_name, timestamp=None):
    # Due to eager evaluation of default parameters timestamp shouldn't be set
    # to datetime.now() as default
    if timestamp is None:
        timestamp = datetime.now()

    cur.execute("INSERT INTO routes (timestamp, route, username, route_name)"
                "VALUES(?,?,?,?)", (timestamp, route, username, route_name))
    con.commit()


def get_all_routes(username):
    res = cur.execute("SELECT timestamp, route, route_name "
                      "FROM routes "
                      "WHERE username=? "
                      "ORDER BY datetime(timestamp) DESC",
                      (username,))
    return res.fetchall()
