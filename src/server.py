import flask
import flask_login
from graph_algorithms import MapGraphInstance
import database
import json

app = flask.Flask(__name__,
                  static_folder='server/static',
                  template_folder='server/templates')

app.secret_key = "TEST-SECRET-KEY-CHANGE-FOR-ACTUAL-SERVER-USAGE"
serverMapGraphInstance = None
login_manager = flask_login.LoginManager()
login_manager.init_app(app)


class User(flask_login.UserMixin):
    pass


# https://github.com/maxcountryman/flask-login
@login_manager.user_loader
def user_loader(username):
    if not database.user_exists(username):
        return

    user = User()
    user.id = username
    return user


# https://github.com/maxcountryman/flask-login
@login_manager.request_loader
def request_loader(request):
    username = request.form.get('username')
    if not database.user_exists(username):
        return

    user = User()
    user.id = username
    return user


@app.get('/account')
def account():
    if flask_login.current_user.is_authenticated:
        return flask.render_template('account.html',
                                     saved_routes=database.get_all_routes(flask_login.current_user.id),
                                     username=flask_login.current_user.id,
                                     random_routes=database.get_random_routes(),
                                     popular_routes=database.get_popular_routes())

    return flask.redirect('/login')


@app.route('/register', methods=['GET', 'POST'])
def register():
    if flask.request.method == 'GET':
        if flask_login.current_user.is_authenticated:
            return flask.redirect('/')

        return flask.send_file('server/static/register.html')

    username = flask.request.form['username']
    if not database.user_exists(username):
        database.create_user(username, flask.request.form['password'])
        return 'User created! - <a href="/login">Login</a>'

    # Good practice to prevent weird xss/added html stuff
    return flask.render_template_string(
        'User with username {{ username }} already exists! - <a href="/login">Go back</a>',
        username=username)


# https://github.com/maxcountryman/flask-login
@app.route('/login', methods=['GET', 'POST'])
def login():
    if flask.request.method == 'GET':
        if flask_login.current_user.is_authenticated:
            return flask.redirect('/')

        return flask.send_file('server/static/login.html')

    username = flask.request.form['username']
    if database.check_password(username, flask.request.form["password"]):
        user = User()
        user.id = username
        flask_login.login_user(user)
        return flask.redirect('/')

    return 'Bad login - <a href="/login">Go back</a>'


# https://github.com/maxcountryman/flask-login
@login_manager.unauthorized_handler
def unauthorized_handler():
    return 'Unauthorized - try <a href="/login">logging in</a> or <a href="/account">managing your account</a>', 401


@app.get("/logout")
def logout():
    flask_login.logout_user()
    return flask.redirect('/')


@app.get('/')
def get_main_page():
    return flask.render_template('index.html',
                                 authenticated_user=flask_login.current_user.is_authenticated)



@app.get('/view/<route_id>')
def view_route(route_id):
    route = database.get_route(route_id)
    if route is None:
        return "Route not found", 404
    if route[4] == 1:
        if flask_login.current_user.is_authenticated:
            return flask.render_template('viewer.html',
                                         route=route,
                                         route_id=route_id,
                                         authenticated_user=flask_login.current_user.is_authenticated,
                                         current_user_rating=
                                         database.get_single_route_rating(route_id, flask_login.current_user.id),
                                         current_rating=database.get_route_rating(route_id)
                                         )
        else:
            return flask.render_template('viewer.html',
                                         route=route,
                                         route_id=route_id,
                                         authenticated_user=flask_login.current_user.is_authenticated,
                                         current_user_rating=-1,
                                         current_rating=database.get_route_rating(route_id)
                                         )

    if flask_login.current_user.is_authenticated:
        if flask_login.current_user.id == route[2]:
            return flask.render_template('viewer.html',
                                         route=route,
                                         route_id=route_id,
                                         authenticated_user=flask_login.current_user.is_authenticated,
                                         current_user_rating=-1,
                                         current_rating=database.get_route_rating(route_id)
                                         )

    return unauthorized_handler()


@app.post('/api/post/public_route')
@flask_login.login_required
def make_route_public():
    database.set_route_public(flask_login.current_user.id,
                              flask.request.json["route_id"],
                              flask.request.json["is_public"])
    return json.dumps({'success': True}), 200, {'ContentType': 'application/json'}



@app.post('/api/post/delete/')
@flask_login.login_required
def delete_route():
    if database.delete_route(flask.request.json["route_id"], flask_login.current_user.id):
        return json.dumps({'success': True}), 200, {'ContentType': 'application/json'}
    else:
        return unauthorized_handler()


@app.post('/api/post/rate_route')
@flask_login.login_required
def rate_route():
    username = flask_login.current_user.id
    route_id = flask.request.json["route_id"]
    rating = flask.request.json["rating"]
    database.rate_route(username, route_id, rating)
    return json.dumps({'success': True}), 200, {'ContentType': 'application/json'}


@app.post('/api/post/route')
@flask_login.login_required
def save_route():
    # Remember - don't trust user's for their username - remember authentication!
    username = flask_login.current_user.id
    route = flask.request.json["route"]
    route_name = flask.request.json["route_name"]
    route_id = database.store_route(route, username, route_name)
    # https://stackoverflow.com/a/26080784/13573736
    return json.dumps({'success': True, 'route_id': route_id}), 200, {'ContentType': 'application/json'}


@app.get('/api/get/nodes')
def get_nodes():
    return serverMapGraphInstance.get_node_lat_lons()


@app.get('/api/get/elevations')
def get_elevations():
    return serverMapGraphInstance.get_node_elevations()


@app.get('/api/get/region')
def get_region():
    return serverMapGraphInstance.get_region_nodes()


@app.get('/api/get/isoline/<node_index>/<isovalue>')
def get_isoline(node_index, isovalue):
    return serverMapGraphInstance.isoline(int(node_index), float(isovalue))


@app.get('/api/get/cycle/<node_index>/<length>')
def get_cycle(node_index, length):
    return serverMapGraphInstance.generate_cycle(int(node_index), float(length))


@app.get('/api/get/a_star_distance/<start_node_index>/<end_node_index>')
def get_a_star_distance(start_node_index, end_node_index):
    return serverMapGraphInstance.a_star(int(start_node_index), int(end_node_index), False)


@app.get('/api/get/a_star_time/<start_node_index>/<end_node_index>')
def a_star_time(start_node_index, end_node_index):
    return serverMapGraphInstance.a_star(int(start_node_index), int(end_node_index), True)


def reload_map_graph():
    global serverMapGraphInstance
    serverMapGraphInstance = MapGraphInstance()


app.debug = False
