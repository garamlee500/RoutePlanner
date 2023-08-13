import matplotlib
import requests
import random
import json
from matplotlib import pyplot as plt
from src.load_data import load_node_list

# Set figure dpi
matplotlib.rcParams['figure.dpi'] = 300

# Process files, and load locations we want
node_list = load_node_list("src/map_data/nodes.csv")
with open("src/map_data/elevation.csv") as file:
    elevations = file.readline().split(',')

sampled_elevations = []
sampled_nodes = []
location_string = ""
for i in range(100):
    # Pick a random node
    node_index = random.randint(0, len(node_list))
    sampled_elevations.append(elevations[node_index])
    sampled_nodes.append(node_list[node_index])
    location_string += str(node_list[node_index][0]) + ',' + str(node_list[node_index][1]) + '|'

location_string = location_string[:-1]

print("Choose data source (see https://www.opentopodata.org/)")
dataset = input()


# Get OpenTopoData data
response = requests.get(f"https://api.opentopodata.org/v1/{dataset}", params={"locations": location_string})
results = json.loads(response.content)["results"]


errors = []

for i, result in enumerate(results):
    print (f"Predicted elevation {sampled_elevations[i]}, Open Topo Data says {result['elevation']}, {sampled_nodes[i]}")
    errors.append((float(sampled_elevations[i]) - result['elevation']))

plt.boxplot(errors)
plt.title(f"Elevation for 100 random points compared to Open Topo Data ({dataset})")
plt.ylabel("Elevation difference (m)")
plt.savefig("elevation_errors.png")
plt.show()