import flask
import flask_login
from graph_algorithms import MapGraphInstance
import authentication

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
    if not authentication.user_exists(username):
        return

    user = User()
    user.id = username
    return user

# https://github.com/maxcountryman/flask-login
@login_manager.request_loader
def request_loader(request):
    username = request.form.get('username')
    if not authentication.user_exists(username):
        return

    user = User()
    user.id = username
    return user


@app.route('/account')
def account():
    if flask_login.current_user.is_authenticated:
        return flask.render_template('account.html')

    return flask.redirect('/login')


# https://github.com/maxcountryman/flask-login
@app.route('/login', methods=['GET', 'POST'])
def login():
    if flask.request.method == 'GET':
        if flask_login.current_user.is_authenticated:
            return flask.redirect('/')

        return '''
               <form action='login' method='POST'>
                <input type='text' name='username' id='username' placeholder='username'/>
                <input type='password' name='password' id='password' placeholder='password'/>
                <input type='submit' name='submit'></input>
               </form>
               '''

    username = flask.request.form['username']
    if authentication.check_password(username, flask.request.form["password"]):
        user = User()
        user.id = username
        flask_login.login_user(user)
        return flask.redirect('/')

    return 'Bad login'

# https://github.com/maxcountryman/flask-login
@login_manager.unauthorized_handler
def unauthorized_handler():
    return 'Unauthorized', 401


@app.route("/logout")
def logout():
    flask_login.logout_user()
    return flask.redirect('/')


@app.get('/')
def get_main_page():
    return flask.render_template('index.html',
                                 authenticated_user=flask_login.current_user.is_authenticated)


@app.get('/api/get/dijkstra/<node_index>')
def get_dijkstra(node_index):
    return serverMapGraphInstance.map_dijkstra(int(node_index))


@app.get('/api/get/nodes')
def get_nodes():
    return serverMapGraphInstance.get_node_lat_lons()

@app.get('/api/get/elevations')
def get_elevations():
    return serverMapGraphInstance.get_node_elevations()


@app.get('/api/get/region')
def get_region():
    return serverMapGraphInstance.get_region_nodes()


@app.get('/api/get/convex/<node_index>/<partition_distance>')
def get_convex(node_index, partition_distance):
    return serverMapGraphInstance.convex_hull_partition(int(node_index), float(partition_distance))


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
