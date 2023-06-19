import json
from typing import Callable, List, Tuple, Set, Dict
import requests
from sphere_formula import haversine_node_distance
import exceptions
from load_data import load_node_list, load_adjacency_list
import elevation.downloader

def bfs_connected_nodes(start_node: int,
                        adjacency_list: List[List[Tuple[int, float]]]) -> List[bool]:
    connected_nodes = [False for _ in adjacency_list]
    connected_nodes[start_node] = False
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
    """
    Simple function to give score to how well name matches search
    Numbers are arbitrary, but should be descending
    """
    if search == name:
        return 100

    # Pad with spaces for convenience
    name = ' ' + name + ' '
    if ' ' + search + ' ' in name:
        return 10

    return 1


def search_relation(search_term,
                    overpass_interpreter_url="https://overpass-api.de/api/interpreter"):
    """
    Performs a case-insensitive for all relations that are boundaries
    containing search_term
    """
    query = f"[out:json];" \
            f"relation[name~'{search_term}',i][type='boundary'];" \
            f"out;"

    response = requests.get(overpass_interpreter_url, params={'data': query})
    if response.status_code != 200:
        # print(response.text)
        raise ConnectionError("Unable to successfully connect to Overpass Api")

    relations = json.loads(response.text)["elements"]
    # Sort by descending order by descending tag count, then by name match to give more important results first
    # Uses fact .sort() is stable (but have to reverse order of sorts)
    # relations.sort(key=lambda x: int(x['tags']['admin_level']) if 'admin_level' in x['tags'] else 11)
    relations.sort(key=lambda x: name_match_score(x['tags']['name'], search_term), reverse=True)
    relations.sort(key=lambda x: len(x['tags']), reverse=True)

    return relations

def _add_edges_from_prev_graph(original_node_count: int,
                               adjacency_list: List[List[Tuple[int, float]]],
                               old_adjacency_list: List[List[Tuple[int, float]]]):
    """
    Adds edegs that were in the old adjacency list to the new graph, if nodes were completely removed
    """
    removed_node_indexes = []
    for i in range(original_node_count):
        # Try and preserve edges of removed nodes, but not removed edges of present nodes
        if len(adjacency_list[i]) == 0:
            removed_node_indexes.append(i)

    for removed_node in removed_node_indexes:
        for edge in old_adjacency_list[removed_node]:
            # Check if any edge in the current adjacency list has a matching index
            if not any(test_edge[0] == edge[0] for test_edge in adjacency_list[removed_node]):
                adjacency_list[removed_node].append(edge)

            # Do the same for the other node of the edge
            if not any(test_edge[0] == removed_node for test_edge in adjacency_list[edge[0]]):
                # Reconstruct edge to go other way
                adjacency_list[edge[0]].append((removed_node, edge[1]))


def _process_ways(data: Dict,
                  present_nodes: Set[int],
                  node_indexes: Dict[int, int],
                  nodes: List[Tuple[int, float, float]],
                  adjacency_list: List[List[Tuple[int, float]]],
                  dead_nodes: Set[int],
                  node_distance_formula: Callable[[float, float, float, float], float] = haversine_node_distance
):
    """
    Goes through each way in the data dict and adds it to the adjacency list, subject to checks
    """
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
                    node_distance_formula: Callable[[float, float, float, float], float] = haversine_node_distance,
                    node_filename="map_data/nodes.csv",
                    adjacency_list_filename="map_data/edges.csv",
                    elevation_list_filename="map_data/elevation.csv",
                    overpass_interpreter_url="https://overpass-api.de/api/interpreter",
                    aster_gdem_api_endpoint = "https://gdemdl.aster.jspacesystems.or.jp/download/",
                    incremental=False,
                    verbose=True):
    # Make request to overpass for data - note query has been prebuilt
    response = requests.get(overpass_interpreter_url, params={'data': edge_query})

    data = json.loads(response.text)["elements"]

    # Make request to get all nodes that are actually in region
    response = requests.get(overpass_interpreter_url, params={'data': node_query})
    if response.status_code != 200:
        raise ConnectionError("Unable to succesfully connect to Overpass Api")

    present_nodes = set()
    present_node_data = json.loads(response.text)["elements"]
    for node in present_node_data:
        present_nodes.add(node['id'])

    if verbose:
        print("Downloaded data")

    # All current nodes with ids, lat, lon
    node_indexes = {}
    node_lat_lng_indexes = {}
    duplicate_nodes = set()
    original_node_count = 0
    old_adjacency_list = []

    if incremental:
        nodes = load_node_list(node_filename, include_id=True)
        original_node_count = len(nodes)
        old_adjacency_list = load_adjacency_list(adjacency_list_filename)
        for i, node in enumerate(nodes):
            node_indexes[node[0]] = i
            node_lat_lng_indexes[(node[1], node[2])] = i
    else:
        nodes = []

    for item in data:
        if item["type"] == "node" and item['id'] in present_nodes and item['id'] not in node_indexes:
            if (item["lat"], item["lon"]) in node_lat_lng_indexes:
                # Duplicated node lat lng
                original_node_index = node_lat_lng_indexes[(item["lat"], item["lon"])]

                # Point both node ids to the same node index
                node_indexes[item["id"]] = original_node_index
                duplicate_nodes.add(item["id"])
                if verbose:
                    print("Duplicate nodes found - please consider fixing on OpenStreetMap")
                    print(f"Node 1: https://www.openstreetmap.org/node/{nodes[original_node_index][0]}")
                    print(f"Node 2: https://www.openstreetmap.org/node/{item['id']}")
            else:
                node_indexes[item["id"]] = len(nodes)
                node_lat_lng_indexes[(item["lat"], item["lon"])] = len(nodes)
                nodes.append((item["id"], item["lat"], item["lon"]))

    adjacency_list: List[List[Tuple[int, float]]] = [[] for _i in range(len(nodes))]

    # Iterate separately to ensure all nodes have been detected before processing ways
    _process_ways(data, present_nodes, node_indexes, nodes, adjacency_list, set(), node_distance_formula)

    if incremental:
        _add_edges_from_prev_graph(original_node_count, adjacency_list, old_adjacency_list)


    if verbose:
        print("Loaded preliminary graph")

    safe_node = 0

    connected_nodes = []
    while safe_node < len(adjacency_list):
        connected_nodes = bfs_connected_nodes(safe_node, adjacency_list)

        # Safe nodes are those connected to at least half the map
        if connected_nodes.count(False) * 2 < len(adjacency_list):
            break
        safe_node += 1
        while safe_node < len(adjacency_list):
            # Any node connected to a dead node is also dead, so keep going until node unconnected to dead node is found
            if not connected_nodes[safe_node]:
                break
            safe_node += 1

    if safe_node == len(adjacency_list):
        raise exceptions.InvalidRegionError(
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
    original_node_count = 0
    old_adjacency_list = []
    if incremental:
        nodes = load_node_list(node_filename, include_id=True)
        original_node_count = len(nodes)
        old_adjacency_list = load_adjacency_list(adjacency_list_filename)
        for i, node in enumerate(nodes):
            node_indexes[node[0]] = i
            node_lat_lng_indexes[(node[1], node[2])] = i
    else:
        nodes = []

    for item in data:
        if item["type"] == "node":
            if item["id"] not in dead_nodes and item['id'] in present_nodes and item['id'] not in node_indexes:
                if item["id"] in duplicate_nodes:
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

    if incremental:
        _add_edges_from_prev_graph(original_node_count, adjacency_list, old_adjacency_list)

    if verbose:
        print("Regenerated graph")

    elevations = elevation.downloader.get_elevation_for_nodes(nodes,
                                                              aster_gdem_api_endpoint=aster_gdem_api_endpoint)
    print("Found elevations of nodes")

    with open(node_filename, 'w') as file:
        # Write node count at top of file
        file.write(str(len(nodes)) + '\n')
        for node in nodes:
            file.write(str(node[0]) + ',' + str(node[1]) + ',' + str(node[2]) + '\n')

    with open(adjacency_list_filename, 'w') as file:
        for row in adjacency_list:
            file.write(','.join([str(edge[0]) + ',' + str(edge[1]) for edge in row]))
            file.write('\n')

    with open(elevation_list_filename, 'w') as file:
        file.write(",".join([str(x) for x in elevations]))

    if verbose:
        print("Saved graph to files")


def download_edges_in_relation(area_relation_id,
                               node_distance_formula: Callable[
                                   [float, float, float, float], float] = haversine_node_distance,
                               node_filename="map_data/nodes.csv",
                               adjacency_list_filename="map_data/edges.csv",
                               elevation_list_filename="map_data/elevation.csv",
                               overpass_interpreter_url="https://overpass-api.de/api/interpreter",
                               aster_gdem_api_endpoint = "https://gdemdl.aster.jspacesystems.or.jp/download/",
                               incremental=False,
                               verbose=True):
    """
    Runs download_edges but with prebuilt query
    """
    # 3600000000 is the magic number
    edge_query = "[out:json];" + \
                 f"area({3600000000 + area_relation_id})->.searchArea;" + \
                 "way['highway']['highway'!~'motorway'](area.searchArea);" + \
                 "(._;>;);out;"

    node_query = "[out:json];" + \
                 f"area({3600000000 + area_relation_id})->.searchArea;" + \
                 "node(area.searchArea);" + \
                 "(._;>;);out;"

    _download_edges(edge_query, node_query, node_distance_formula, node_filename, adjacency_list_filename, elevation_list_filename,
                    overpass_interpreter_url, aster_gdem_api_endpoint, incremental, verbose)


def download_edges_around_point(node_lat: float,
                                node_lon: float,
                                node_radius: int,
                                node_distance_formula: Callable[
                                    [float, float, float, float], float] = haversine_node_distance,
                                node_filename="map_data/nodes.csv",
                                adjacency_list_filename="map_data/edges.csv",
                                elevation_list_filename="map_data/elevation.csv",
                                overpass_interpreter_url="https://overpass-api.de/api/interpreter",
                                aster_gdem_api_endpoint = "https://gdemdl.aster.jspacesystems.or.jp/download/",
                                incremental=False,
                                verbose=True):
    """
    Runs download_edges but with prebuilt query
    """
    edge_query = "[out:json];" + \
                 f"way(around:{node_radius},{node_lat},{node_lon})['highway']['highway'!~'motorway'];" + \
                 "(._;>;);out;"
    node_query = "[out:json];" + \
                 f"node(around:{node_radius},{node_lat},{node_lon});" + \
                 "(._;>;);out;"

    _download_edges(edge_query, node_query, node_distance_formula, node_filename, adjacency_list_filename, elevation_list_filename,
                    overpass_interpreter_url, aster_gdem_api_endpoint, incremental, verbose)
