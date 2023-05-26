from graph_algorithms_demo import map_dijkstra
from load_data import load_node_list, load_adjacency_list


def reset_dead_nodes(dead_node_filename="map_data/dead.csv"):
    with open(dead_node_filename, 'w') as file:
        pass


def find_dead_nodes(safe_node: int, edge_filename="map_data/edges.csv", node_filename="map_data/nodes.csv", dead_node_filename="map_data/dead.csv"):
    dijkstra_prev_nodes = map_dijkstra(safe_node, load_adjacency_list(edge_filename))[1]
    dead_nodes = []
    node_list = load_node_list(node_filename)
    for i in range(safe_node):
        if dijkstra_prev_nodes[i] == -1:
            dead_nodes.append(str(node_list[i][0]))
    for i in range(safe_node+1, len(node_list)):
        if dijkstra_prev_nodes[i] == -1:
            dead_nodes.append(str(node_list[i][0]))

    with open(dead_node_filename, 'w') as file:
        file.write(','.join(dead_nodes))

#find_dead_nodes(67791)

raise DeprecationWarning()