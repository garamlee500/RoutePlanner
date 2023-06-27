from typing import List, Tuple

def load_adjacency_list(filename="map_data/edges.csv") -> List[List[Tuple[int, float, float]]]:
    adjacency_list: List[List[Tuple[int, float, float]]] = []
    with open(filename) as file:
        for line in file:
            adjacency_list.append([])
            if line != "":
                # Remove \n at end of line
                line = line[:-1]
                line = line.split(',')
                for i in range(len(line)//3):
                    adjacency_list[-1].append((int(line[3*i]), float(line[3*i+1]), float(line[3*i+2])))

    return adjacency_list


def load_node_list(filename="map_data/nodes.csv",
                   include_id=False) -> List[Tuple]:
    nodes: List[Tuple] = []
    with open(filename) as file:
        # Skip node count
        file.readline()
        for line in file:
            if line != "":
                line = line[:-1]
                line = line.split(',')
                if include_id:
                    nodes.append((int(line[0]), float(line[1]), float(line[2])))
                else:
                    nodes.append((float(line[1]), float(line[2])))

    return nodes

