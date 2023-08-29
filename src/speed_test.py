from load_data import load_node_list
import graph_algorithms
from timeit import timeit

nodes = load_node_list(include_id=True)

print(timeit(lambda: graph_algorithms.compute_2D_nearest_neighbours(nodes,
                                                              grid_file="map_data/grid2d.csv",
                                                              grid_distance=10,
                                                                    threads=300),
       number=1)
      )