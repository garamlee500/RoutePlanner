import json
from typing import Callable, List, Tuple, Set, Dict
from pathlib import Path
import re
import requests
from distance_formulas import haversine_node_distance, walking_time
import elevation
import graph_algorithms


def bfs_connected_nodes(start_node: int,
                        adjacency_list: List[List[Tuple[int, float]]]) -> List[bool]:
    connected_nodes = [False for _ in adjacency_list]
    connected_nodes[start_node] = True
    bfs_queue = [start_node]
    while len(bfs_queue) > 0:
        current_node = bfs_queue.pop(0)
        for connected_node_pair in adjacency_list[current_node]:
            if not connected_nodes[connected_node_pair[0]]:
                # Add unvisited node to bfs queue
                connected_nodes[connected_node_pair[0]] = True
                bfs_queue.append(connected_node_pair[0])
    return connected_nodes


def name_match_score(name, search):
    name = name.lower()
    search = search.lower()
    if search == name:
        return 100

    # Pad with spaces for convenience
    name = ' ' + name + ' '
    if ' ' + search + ' ' in name:
        return 10
    return 1


def search_relation(search_term, overpass_interpreter_url):
    # Performs a case-insensitive for all (up to 100) relations that are boundaries containing search_term
    # Double re.escape is required to allow string to reach regex parser properly
    # qt turns off id sort for quicker results (but turns on geographical sort instead) - result is sorted
    # once received so not really important
    query = f"[out:json];" \
            f"relation[name~'{re.escape(re.escape(search_term))}',i][type='boundary'];" \
            f"out tags qt 100;"
    try:
        response = requests.get(overpass_interpreter_url, params={'data': query})
    except:
        raise ConnectionError("Unable to succesfully connect to Overpass Api")
    if response.status_code != 200:
        raise ConnectionError("Unable to successfully connect to Overpass Api")

    relations = json.loads(response.text)["elements"]
    # Sort by descending tag count (descending importance), breaking ties with name match score
    # Uses fact .sort() is stable (but have to reverse order of sorts)
    relations.sort(key=lambda x: name_match_score(x['tags']['name'], search_term), reverse=True)
    relations.sort(key=lambda x: len(x['tags']), reverse=True)
    return relations


def _process_ways(data: Dict,
                  present_nodes: Set[int],
                  node_indexes: Dict[int, int],
                  nodes: List[Tuple[int, float, float]],
                  adjacency_list: List[List[Tuple[int, float]]],
                  dead_nodes: Set[int],
                  node_distance_formula: Callable[[float, float, float, float], float] = haversine_node_distance
                  ):
    # Goes through each way in the data dict and adds it to the adjacency list, subject to checks
    for item in data:
        if item["type"] == "way":
            for i in range(len(item["nodes"]) - 1):
                if item["nodes"][i] in present_nodes and item["nodes"][i + 1] in present_nodes:
                    if item["nodes"][i] not in dead_nodes:
                        node_index1 = node_indexes[item["nodes"][i]]
                        node_index2 = node_indexes[item["nodes"][i + 1]]
                        distance = node_distance_formula(nodes[node_index1][1],
                                                         nodes[node_index1][2],
                                                         nodes[node_index2][1],
                                                         nodes[node_index2][2])
                        adjacency_list[node_index1].append((node_index2, distance))
                        adjacency_list[node_index2].append((node_index1, distance))


def _download_edges(edge_query: str,
                    node_query: str,
                    overpass_interpreter_url: str,
                    aster_gdem_api_endpoint: str,
                    node_distance_formula: Callable[[float, float, float, float], float] = haversine_node_distance,
                    node_filename="map_data/nodes.csv",
                    adjacency_list_filename="map_data/edges.csv",
                    elevation_list_filename="map_data/elevation.csv",
                    grid_filename="map_data/grid2d.csv",
                    verbose=True):

    try:
        response = requests.get(overpass_interpreter_url, params={'data': edge_query})
    except:
        raise ConnectionError("Unable to succesfully connect to Overpass Api")
    if response.status_code != 200:
        raise ConnectionError("Unable to succesfully connect to Overpass Api")

    data = json.loads(response.text)["elements"]

    # Make request to get all nodes that are actually in region
    try:
        response = requests.get(overpass_interpreter_url, params={'data': node_query})
    except:
        raise ConnectionError("Unable to succesfully connect to Overpass Api")
    if response.status_code != 200:
        raise ConnectionError("Unable to succesfully connect to Overpass Api")

    present_nodes = {node['id'] for node in json.loads(response.text)["elements"]}

    if verbose:
        print("Downloaded data")

    node_indexes = {}
    node_lat_lng_indexes = {}
    nodes = []

    for item in data:
        if item["type"] == "node" and item['id'] in present_nodes and item['id'] not in node_indexes:
            if (item["lat"], item["lon"]) in node_lat_lng_indexes:
                # Duplicated node lat lng
                original_node_index = node_lat_lng_indexes[(item["lat"], item["lon"])]

                # Point both node ids to the same node index
                node_indexes[item["id"]] = original_node_index
                if verbose:
                    print("Duplicate nodes found - please consider fixing on OpenStreetMap")
                    print(f"Node 1: https://www.openstreetmap.org/node/{nodes[original_node_index][0]}")
                    print(f"Node 2: https://www.openstreetmap.org/node/{item['id']}")
            else:
                node_indexes[item["id"]] = len(nodes)
                node_lat_lng_indexes[(item["lat"], item["lon"])] = len(nodes)
                nodes.append((item["id"], item["lat"], item["lon"]))

    adjacency_list: List[List[Tuple[int, float]]] = [[] for _ in range(len(nodes))]
    _process_ways(data, present_nodes, node_indexes, nodes, adjacency_list, set(), node_distance_formula)

    if verbose:
        print("Loaded preliminary graph")

    safe_node = 0

    connected_to_dead_node = [False for _ in range(len(nodes))]
    connected_nodes = []
    while safe_node < len(adjacency_list):
        connected_nodes = bfs_connected_nodes(safe_node, adjacency_list)

        # Safe nodes are those connected to at least half the map
        if connected_nodes.count(False) * 2 < len(adjacency_list):
            break
        safe_node += 1
        # Merge boolean values from connected_to_dead_node and connected_nodes (to dead node)
        connected_to_dead_node = [a or b for a,b in zip(connected_to_dead_node, connected_nodes)]
        while safe_node < len(adjacency_list):
            # Any node connected to a dead node is also dead,
            # so keep going until node unconnected to dead node is found
            if not connected_to_dead_node[safe_node]:
                break
            safe_node += 1

    if safe_node == len(adjacency_list):
        raise ValueError(
            "Region given has no set of connected nodes that take up at least half the entire region"
        )

    if verbose:
        print("Found safe node")

    # Prune region
    dead_nodes = set()
    for i, is_node_connected in enumerate(connected_nodes):
        if not is_node_connected:
            dead_nodes.add(nodes[i][0])

    if verbose:
        print("Found all dead nodes")

    # Regenerate everything but with knowledge of dead + duplicate nodes
    node_indexes = {}
    node_lat_lng_indexes = {}
    nodes = []

    for item in data:
        if item["type"] == "node":
            if item["id"] not in dead_nodes and item['id'] in present_nodes and item['id'] not in node_indexes:
                if (item["lat"], item["lon"]) in node_lat_lng_indexes:
                    # Duplicated node lat lng
                    original_node_index = node_lat_lng_indexes[(item["lat"], item["lon"])]
                    # Point both node ids to the same node index
                    node_indexes[item["id"]] = original_node_index

                else:
                    node_indexes[item["id"]] = len(nodes)
                    node_lat_lng_indexes[(item["lat"], item["lon"])] = len(nodes)
                    nodes.append((item["id"], item["lat"], item["lon"]))

    adjacency_list: List[List[Tuple[int, float]]] = [[] for _i in range(len(nodes))]
    _process_ways(data, present_nodes, node_indexes, nodes, adjacency_list, dead_nodes, node_distance_formula)

    if verbose:
        print("Regenerated graph")

    elevations = elevation.get_elevation_for_nodes(nodes,
                                                              aster_gdem_api_endpoint=aster_gdem_api_endpoint)
    if verbose:
        print("Found elevations of nodes")

    # Make map_data folder if it doesn't exist
    Path("map_data").mkdir(exist_ok=True)

    with open(node_filename, 'w') as file:
        # Write node count at top of file
        file.write(str(len(nodes)) + '\n')
        for node in nodes:
            file.write(str(node[0]) + ',' + str(node[1]) + ',' + str(node[2]) + '\n')

    with open(adjacency_list_filename, 'w') as file:
        for node, row in enumerate(adjacency_list):
            # Write node_index, edge_distance, walking time for each edge
            file.write(','.join([str(edge[0])
                                 + ',' + str(edge[1]) + ',' +
                                 str(walking_time(edge[1], elevations[edge[0]] - elevations[node]))
                                 for edge in row]))
            file.write('\n')

    with open(elevation_list_filename, 'w') as file:
        file.write(",".join([str(x) for x in elevations]))

    if verbose:
        print("Saved graph to files")
        print("Generating 2d grid of closest nodes precomputation (this can take a while!)")

    graph_algorithms.compute_2D_nearest_neighbours(nodes, grid_filename=grid_filename, grid_distance=10)
    if verbose:
        print("Done!")


def download_edges_in_relation(area_relation_id: int,
                               overpass_interpreter_url: str,
                               aster_gdem_api_endpoint: str,
                               node_distance_formula: Callable[
                                   [float, float, float, float], float] = haversine_node_distance,
                               node_filename="map_data/nodes.csv",
                               adjacency_list_filename="map_data/edges.csv",
                               elevation_list_filename="map_data/elevation.csv",
                               grid_filename="map_data/grid2d.csv",
                               verbose=True):
    # out skel returns all but tags
    # out ids only returns ids
    edge_query = "[out:json];" + \
                 f"rel({area_relation_id});" + \
                 "map_to_area->.searchArea;" + \
                 "way['highway']['highway'!~'motorway'](area.searchArea);" + \
                 "(._;>;);out skel;"

    node_query = "[out:json];" + \
                 f"rel({area_relation_id});" + \
                 "map_to_area->.searchArea;" + \
                 "node(area.searchArea);" + \
                 "out ids;"

    _download_edges(edge_query, node_query, overpass_interpreter_url, aster_gdem_api_endpoint,
                    node_distance_formula, node_filename, adjacency_list_filename, elevation_list_filename,
                    grid_filename, verbose)


def download_edges_around_point(node_lat: float,
                                node_lon: float,
                                node_radius: int,
                                overpass_interpreter_url,
                                aster_gdem_api_endpoint,
                                node_distance_formula: Callable[
                                    [float, float, float, float], float] = haversine_node_distance,
                                node_filename="map_data/nodes.csv",
                                adjacency_list_filename="map_data/edges.csv",
                                elevation_list_filename="map_data/elevation.csv",
                                grid_filename="map_data/grid2d.csv",
                                verbose=True):
    edge_query = "[out:json];" + \
                 f"way(around:{node_radius},{node_lat},{node_lon})['highway']['highway'!~'motorway'];" + \
                 "(._;>;);out skel;"
    node_query = "[out:json];" + \
                 f"node(around:{node_radius},{node_lat},{node_lon});" + \
                 "out ids;"

    _download_edges(edge_query, node_query, overpass_interpreter_url, aster_gdem_api_endpoint,
                    node_distance_formula, node_filename, adjacency_list_filename, elevation_list_filename,
                    grid_filename, verbose)
