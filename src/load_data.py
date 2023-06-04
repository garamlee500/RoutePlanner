from typing import List, Tuple


def load_region_nodes(filename="map_data/region.csv") -> List[Tuple[float, float]]:
    region_nodes = []
    with open(filename) as file:
        for line in file:
            if line != "":
                line = line[:-1].split(',')
                region_nodes.append((float(line[0]), float(line[1])))

    return region_nodes


def load_adjacency_list(filename="map_data/edges.csv") -> List[List[Tuple[int, float]]]:
    adjacency_list: List[List[Tuple[int, float]]] = []
    with open(filename) as file:
        for line in file:
            adjacency_list.append([])
            if line != "":
                # Remove \n at end of line
                line = line[:-1]
                line = line.split(',')
                for i in range(len(line)//2):
                    adjacency_list[-1].append((int(line[2*i]), float(line[2*i+1])))

    return adjacency_list


def load_node_list(filename="map_data/nodes.csv") -> List[Tuple[float, float]]:
    nodes: List[Tuple[float, float]] = []
    with open(filename) as file:
        # Skip node count
        file.readline()
        for line in file:
            if line != "":
                line = line[:-1]
                line = line.split(',')
                # Fix
                nodes.append((float(line[1]), float(line[2])))

    return nodes
