import sqlite3
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime

# Flask requests are dealt sequentially so no danger here
# Change to allow different databases?
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
            "public INTEGER,"
            "FOREIGN KEY(username) REFERENCES accounts(username))")
cur.execute("CREATE TABLE IF NOT EXISTS route_ratings"
            "(rating_user TEXT,"
            "route_id INTEGER,"
            "rating INTEGER,"
            "PRIMARY KEY (rating_user, route_id),"
            "FOREIGN KEY(rating_user) REFERENCES accounts(username),"
            "FOREIGN KEY(route_id) REFERENCES routes(id))")


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
    cur.execute("INSERT INTO routes (timestamp, route, username, route_name, public)"
                "VALUES(?,?,?,?,0);",
                (timestamp, route, username, route_name))
    con.commit()
    res = cur.execute("SELECT last_insert_rowid() FROM routes")
    new_route_id  = res.fetchone()[0]

    # New routes are rated by their owners by 5 by default
    rate_route(username, new_route_id, 5)


def set_route_public(username, route_id, is_public=True):
    # Checks logged-in user matches one that created record
    cur.execute("UPDATE routes SET public = ? WHERE id=? AND username=?",
                (is_public, route_id, username))
    con.commit()


def rate_route(username, route_id, rating):
    # https://www.sqlite.org/lang_insert.html
    # Note how insert replaces preexisting item in sqlite if it already exists
    cur.execute("INSERT INTO route_ratings VALUES"
                "(?,?,?)",
                (username, route_id, rating))
    con.commit()


def get_route_rating(route_id):
    res = cur.execute("SELECT AVG(rating), COUNT(rating) "
                      "FROM route_ratings "
                      "WHERE route_id=?",
                      (route_id,))
    return res.fetchone()


def get_all_routes(username):
    res = cur.execute("SELECT * "
                      "FROM routes "
                      "WHERE username=? "
                      "ORDER BY datetime(timestamp) DESC",
                      (username,))
    return res.fetchall()


def get_random_routes(limit=10):
    # https://stackoverflow.com/a/24591696/13573736
    # Notes orders randomly too not just picks
    res = cur.execute("SELECT id, route, route_name, username, AVG(route_ratings.rating), COUNT(route_ratings.rating) "
                      "FROM routes, route_ratings "
                      "WHERE routes.id=route_ratings.route_id "
                      "AND public = 1 "
                      "GROUP BY routes.id "       
                      "ORDER BY RANDOM() "
                      "LIMIT ?",
                      (limit,))
    return res.fetchall()


def get_popular_routes(limit=10):
    # Gets most popular public routes, sorting by mean-1.96std/sqrt(count) of rating
    # Sorts by lower 95% confidence interval, then breaks ties randomly
    # (prevents loads of routes with same rating being sorted same way every single time)
    # Sqlite doesn't have stdev...
    # https://math.stackexchange.com/questions/3591814/5-star-average-rating-which-also-considers-number-of-users-rated
    # Note *1.0 is to convert integer to real - prevents integer division!
    res = cur.execute("SELECT routes.id, routes.route, routes.route_name, routes.username, AVG(route_ratings.rating), COUNT(route_ratings.rating) "
                      "FROM routes, route_ratings "
                      "WHERE public = 1 "
                      "AND routes.id = route_ratings.route_id "
                      "GROUP BY routes.id "
                      "ORDER BY "
                      "     IFNULL(AVG(route_ratings.rating) "
                      "         - SQRT("
                      "                 SUM(route_ratings.rating*route_ratings.rating)*1.0/COUNT(route_ratings.rating)"
                      "                 -POW(AVG(route_ratings.rating), 2))"
                      "             *1.96/SQRT(COUNT(route_ratings.rating))"
                      "     ,-100) DESC, RANDOM() "
                      "LIMIT ? ",
                      (limit,))
    return res.fetchall()
