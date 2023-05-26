from typing import Callable, List, Tuple
from sphere_formula import haversine_node_distance
from math import floor


def left_turn(x1, y1, x2, y2):
    """
    Works out whether vector x2, y2 is more 'anticlockwise' than vector x1, y1 (used for graham scan)
    """

    # Does (x1, y1, 0) x (x2, y2, 0) and checks magnitude
    # Equivalent to checking determinant and seeing whether such a transformation would flip orientation or not
    # No flip orientation -> anti clockwise turn from x1, y1 -> x2, y2
    # return x1 * y2 - y1 * x2 >= 0
    return x1 * y2 >= y1 * x2


def convex_hull_partition(node_list_mercator: List[Tuple[int, float, float]],
                          dijkstra_distances: List[float],
                          partition_distance=2000) -> List[List[int]]:
    largest_set_num: int = 0
    partitioned_nodes = [[]]

    for i, node_distance in enumerate(dijkstra_distances):
        node_set_index: int = floor(node_distance / partition_distance)
        if node_set_index > largest_set_num:
            for j in range(node_set_index - largest_set_num):
                partitioned_nodes.append([])

            largest_set_num = node_set_index
        partitioned_nodes[node_set_index].append(node_list_mercator[i])
    """
    convex_hull_increments = []
    for node_partition in partitioned_nodes:
        convex_hull_increments.append(convex_hull(node_partition))
    """
    # print([len(hull) for hull in convex_hull_increments])

    # Check whether each node in convex hull of previous set is in new convex hull
    # If not incrementally add outside node into new convex hull
    # This ensures no overlap of convex hulls
    convex_hulls: List[List[Tuple[int, float, float]]] = [
        convex_hull(partitioned_nodes[0])]  # [convex_hull_increments[0]]

    for i in range(1, len(partitioned_nodes)):
        convex_hulls.append(convex_hull(partitioned_nodes[i] + convex_hulls[-1]))

    # Strip convex hulls of x, y coordinates
    return [[node[0] for node in convex_hull_region] for convex_hull_region in convex_hulls]


def convex_hull(node_list_mercator: List[Tuple[int, float, float]]) -> List[Tuple[int, float, float]]:
    """
    Note modifies node_list_mercator
    """

    # Theoretically incorrect to return 3 points
    # due to idea that points must be sorted in a convex hull
    # but for the application of this project, this does not matter
    # (mapping polygons)
    if len(node_list_mercator) <= 3:
        return node_list_mercator

    most_bottom_left = node_list_mercator[0]
    most_bottom_left_index = 0
    for i in range(1, len(node_list_mercator)):
        if node_list_mercator[i][2] < most_bottom_left[2] or (
                node_list_mercator[i][2] == most_bottom_left[2] and node_list_mercator[i][1] < most_bottom_left[1]):
            most_bottom_left_index = i
            most_bottom_left = node_list_mercator[i]

    node_list_mercator.pop(most_bottom_left_index)
    # Sorts points by descending cosine of angle it makes with x axis and most bottom left
    # Results in ascending polar angle order
    # Presumes no 3 colinear points - fixed in c++ version
    # node_list_mercator.sort(key=lambda point:
    # (point[1] - most_bottom_left[1]) / (
    #         ((point[1] - most_bottom_left[1]) ** 2 + (point[2] - most_bottom_left[2]) ** 2) ** 0.5),
    #                         reverse=True)

    node_list_mercator.sort(key=lambda point:
    (point[1] - most_bottom_left[1]) / (
            ((point[1] - most_bottom_left[1]) * (point[1] - most_bottom_left[1]) +
             (point[2] - most_bottom_left[2]) * (point[2] - most_bottom_left[2])) ** 0.5),
                            reverse=True)

    convex_hull_stack = [most_bottom_left, node_list_mercator[0], node_list_mercator[1]]
    node_list_mercator.pop(0)
    node_list_mercator.pop(0)

    for i in range(len(node_list_mercator)):
        while not left_turn(convex_hull_stack[-1][1] - convex_hull_stack[-2][1],
                            convex_hull_stack[-1][2] - convex_hull_stack[-2][2],
                            node_list_mercator[i][1] - convex_hull_stack[-1][1],
                            node_list_mercator[i][2] - convex_hull_stack[-1][2]):
            convex_hull_stack.pop()

        convex_hull_stack.append(node_list_mercator[i])

    return convex_hull_stack


def closest_node(lat, lon, nodes: List[Tuple[int, float, float]]):
    closet = 0
    closest_distance = haversine_node_distance(lat, lon, nodes[0][1], nodes[0][2])

    for i in range(1, len(nodes)):
        distance = haversine_node_distance(lat, lon, nodes[i][1], nodes[i][2])
        if distance < closest_distance:
            closet = i
            closest_distance = distance
    return closet


def reconstruct_route(end_node: int, dijkstra_previous_nodes: List[int]):
    raise DeprecationWarning()
    route = []
    current_node = end_node
    while dijkstra_previous_nodes[current_node] != -1:
        route.append(current_node)
        current_node = dijkstra_previous_nodes[current_node]

    route.append(current_node)

    # Reverse list
    return route[::-1]


def map_dijkstra(start_node_index: int, adjacency_list: List[List[Tuple[int, float]]]) -> Tuple[List[float], List[int]]:
    """
    Calculates all distances from start node, given the ids of the node and the distances between adjacent nodes.
    :param start_node_index: Index of node to start dijkstra with (index in node_ids)
    :param adjacency_list: A 2d List containing tuple pairs of node_index, distance for every pair of adjacent nodes
    :return: List of floats, containing the shortest distance between the start node and all other nodes and a list
        of ints giving the 'previous node' in the quickest route to the destination
    """

    distances: List[float] = [1000000000 for _ in range(len(adjacency_list))]
    previous_nodes: List[int] = [-1 for _ in range(len(adjacency_list))]

    distances[start_node_index] = 0
    # Create a Dijkstra Heap, with comparator passed to keep closer nodes to the top of the heap
    node_min_heap: DijkstraHeap = DijkstraHeap(start_node_index, len(adjacency_list),
                                               lambda x, y: distances[x] < distances[y])

    # While node heap is not empty
    while len(node_min_heap) > 0:
        current_node = node_min_heap.pop_top()
        for connected_node_weight_pair in adjacency_list[current_node]:
            # Only check if node has not been visited yet
            if node_min_heap.is_node_present(connected_node_weight_pair[0]):
                new_distance = connected_node_weight_pair[1] + distances[current_node]
                if new_distance < distances[connected_node_weight_pair[0]]:
                    # New quickest path to node found
                    distances[connected_node_weight_pair[0]] = new_distance
                    previous_nodes[connected_node_weight_pair[0]] = current_node
                    node_min_heap.update_node(connected_node_weight_pair[0])

    return distances, previous_nodes


class DijkstraHeap:
    """
    Customised Binary Heap made for efficiency
    - E.g. no merging
    Nodes are labelled 0 to count-1
    """

    def __len__(self):
        return len(self.heap)

    def __init__(self, start_node: int, node_count: int, node_comparator: Callable[[int, int], bool]):
        """

        :param start_node:
        :param node_count:
        :param node_comparator: Takes in two node indices, a,b and return True if a is closer to start_node
        """
        # Creates min-heap with start node at root, and all other nodes under it
        self.heap = [start_node] + [i for i in range(node_count)]
        self.heap.pop(start_node + 1)

        self.vertex_indices = []
        for i in range(0, start_node):
            self.vertex_indices.append(i + 1)
        self.vertex_indices.append(0)
        for i in range(start_node + 1, node_count):
            self.vertex_indices.append(i)

        self.node_comparator = node_comparator

    def is_node_present(self, node):
        return self.vertex_indices[node] != -1

    def pop_top(self) -> int:
        top_item = self.peek_top()

        # Swap last item with top and reheapify
        # Mark index of removed element as -1 to indicate as removed
        self.vertex_indices[self.heap[len(self.heap) - 1]] = 0
        self.vertex_indices[top_item] = -1
        self.heap[0] = self.heap[len(self.heap) - 1]
        self.heap.pop()

        node_index = 0

        while node_index * 2 + 1 < len(self.heap):
            if node_index * 2 + 2 < len(self.heap):
                # Node has two children

                if self.node_comparator(self.heap[node_index * 2 + 1], self.heap[node_index * 2 + 2]):
                    # node_index*2 + 1 is smaller
                    if self.node_comparator(self.heap[node_index * 2 + 1], self.heap[node_index]):
                        # Must swap item at node_index, with item at node_index*2 + 1
                        self.vertex_indices[self.heap[node_index]], self.vertex_indices[self.heap[node_index * 2 + 1]] = \
                            self.vertex_indices[self.heap[node_index * 2 + 1]], self.vertex_indices[
                                self.heap[node_index]]

                        self.heap[node_index * 2 + 1], self.heap[node_index] = self.heap[node_index], self.heap[
                            node_index * 2 + 1]

                        node_index = node_index * 2 + 1

                    else:
                        # Node is now in right place of heap
                        return top_item

                else:
                    # node_index*2 + 2 is smaller
                    if self.node_comparator(self.heap[node_index * 2 + 2], self.heap[node_index]):
                        # Must swap item at node_index, with item at node_index*2 + 2
                        self.vertex_indices[self.heap[node_index]], self.vertex_indices[self.heap[node_index * 2 + 2]] = \
                            self.vertex_indices[self.heap[node_index * 2 + 2]], self.vertex_indices[
                                self.heap[node_index]]

                        self.heap[node_index * 2 + 2], self.heap[node_index] = self.heap[node_index], self.heap[
                            node_index * 2 + 2]

                        node_index = node_index * 2 + 2
                    else:
                        # Node is now in right place of heap
                        return top_item
            else:
                # Node has one child
                if self.node_comparator(self.heap[node_index * 2 + 1], self.heap[node_index]):
                    # Node must be swapped with child
                    self.vertex_indices[self.heap[node_index]], self.vertex_indices[self.heap[node_index * 2 + 1]] = \
                        self.vertex_indices[self.heap[node_index * 2 + 1]], self.vertex_indices[self.heap[node_index]]

                    self.heap[node_index * 2 + 1], self.heap[node_index] = self.heap[node_index], self.heap[
                        node_index * 2 + 1]

                # We know new node has no more children so stop sifting down node in heap
                return top_item
        return top_item

    def peek_top(self):
        return self.heap[0]

    def update_node(self, node: int):
        """
        Notifies heap that a certain node's distance from start_node might have got smaller
        :param node:
        :return:
        """
        node_index: int = self.vertex_indices[node]

        while node_index > 0:
            parent_node_index = (node_index - 1) // 2

            # Check if node distance is closer to start than parent, and if so swap
            if self.node_comparator(self.heap[node_index], self.heap[parent_node_index]):
                # Needs to swap
                self.vertex_indices[self.heap[parent_node_index]], self.vertex_indices[self.heap[node_index]] = \
                    node_index, parent_node_index
                self.heap[node_index], self.heap[parent_node_index] = \
                    self.heap[parent_node_index], self.heap[node_index]

                node_index = parent_node_index
            else:
                return
