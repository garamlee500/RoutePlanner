import cProfile
from graph_algorithms_demo import map_dijkstra
from load_data import load_adjacency_list, load_node_list
from sphere_formula import generate_mercator_node_list
adjacency_list = load_adjacency_list()


mercator_node_list = generate_mercator_node_list(load_node_list())
dijkstra_result = map_dijkstra(0, adjacency_list)[0]
cProfile.run('convex_hull_partition(mercator_node_list, dijkstra_result)')
cProfile.run('convex_hull(mercator_node_list)')