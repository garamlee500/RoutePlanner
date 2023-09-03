from load_data import load_node_list
import graph_algorithms
from timeit import timeit

THREAD_COUNT = 1

nodes = load_node_list(include_id=True)
finish_time = timeit(lambda: graph_algorithms.compute_2D_nearest_neighbours(nodes,
                                                                	grid_filename="map_data/grid2d.csv",
                                                                	grid_distance=10,
                                                                	threads=THREAD_COUNT),
                     	number=1)

print(f"Execution took {finish_time}s with {THREAD_COUNT} threads")
#
# a = graph_algorithms.MapGraphInstance()
# a.isoline(0, 1000)
# print(timeit(lambda: a.isoline(0, 10000, 100), number=1))