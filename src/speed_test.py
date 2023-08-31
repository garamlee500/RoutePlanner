from load_data import load_node_list
import graph_algorithms
from timeit import timeit

# nodes = load_node_list(include_id=True)
#
# print(timeit(lambda: graph_algorithms.compute_2D_nearest_neighbours(nodes,
#                                                                     grid_filename="map_data/grid2d.csv",
#                                                                     grid_distance=10,
#                                                                     threads=300),
#              number=1)
#       )

a = graph_algorithms.MapGraphInstance()
a.isoline(0, 1000)
print(timeit(lambda: a.isoline(0, 10000), number=1))