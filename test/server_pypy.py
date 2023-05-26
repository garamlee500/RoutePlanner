import flask
from flask import Flask
import json
from sphere_formula import generate_mercator_node_list
from graph_algorithms_demo import map_dijkstra, convex_hull, convex_hull_partition
#import graph_algorithms
from load_data import load_adjacency_list, load_node_lat_lons, load_node_list

app = Flask(__name__,
            static_url_path='/static')
adjacency_list = load_adjacency_list()
node_lat_lons = load_node_lat_lons()
node_list = load_node_list()
mercator_node_list = generate_mercator_node_list(node_list)
region_nodes = [node_lat_lons[region_node[0]] for region_node in convex_hull(mercator_node_list.copy())]


#graph_algorithms.initialise(len(node_list))
#graph_algorithms.map_dijkstra(0)
@app.get('/')
def get_main_page():
    return flask.send_file('static/index.html')


@app.get('/api/get/dijkstra/<node_index>')
def get_dijkstra(node_index):
    #print(graph_algorithms.map_dijkstra(int(node_index))[:100])
    #return graph_algorithms.map_dijkstra(int(node_index))
    #return json.dumps(map_dijkstra(int()))
    return json.dumps(map_dijkstra(int(node_index), adjacency_list))



@app.get('/api/get/nodes')
def get_nodes():
    return node_lat_lons


@app.get('/api/get/region')
def get_region():
    return region_nodes


@app.get('/api/get/convex/<node_index>/<partition_distance>')
def get_convex(node_index, partition_distance):
    #return json.dumps(convex_hull(mercator_node_list.copy()))
    dijkstra_result = map_dijkstra(int(node_index), adjacency_list)
    return json.dumps(convex_hull_partition(mercator_node_list, dijkstra_result[0], float(partition_distance)))
# @app.get('/api/get/closest_node/<lat>/<lon>')
# def get_closest_node(lat, lon):
#     return str(closest_node(float(lat), float(lon), node_list))
app.debug = False
