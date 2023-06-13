import flask
from graph_algorithms import MapGraphInstance

app = flask.Flask(__name__,
                  static_folder='server/static')

# This way of setting up c++ extension allows for proper server reloading!
serverMapGraphInstance = None


@app.get('/')
def get_main_page():
    return flask.send_file('server/static/index.html')


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


def reload_map_graph():
    global serverMapGraphInstance
    serverMapGraphInstance = MapGraphInstance()


app.debug = False
