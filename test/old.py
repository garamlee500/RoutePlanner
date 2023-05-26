EARTH_RADIUS = 6_371_000


def download_region_nodes(area_relation_id,
                          filename="map_data/region.csv",
                          overpass_interpreter_url="https://overpass-api.de/api/interpreter"):  # // -> List[Tuple[float, float]]:
    
    # Removing due to incompatability with convex hull

    query = f"[out:json];" + \
            f"relation({area_relation_id});" + \
            f"(._;>;);out;"
    response = requests.get(overpass_interpreter_url, params={'data': query})
    if response.status_code != 200:
        raise ConnectionError("Unable to successfully connect to Overpass Api")
    # print("https://overpass-api.de/api/interpreter?data="+query)
    data = json.loads(response.text)["elements"]

    region_nodes = []
    # Difficult bit here is to order the nodes correctly
    # Nodes are unordered, and ways ordering nodes are also unordered
    # Sort by ways first
    node_locations = {}
    ways = []
    for element in data:
        if element["type"] == "node":
            node_locations[element["id"]] = (element["lat"], element["lon"])

        elif element["type"] == "way":
            ways.append(element)

    current_way = ways[0]
    ways.pop(0)
    for node in current_way["nodes"]:
        region_nodes.append(node_locations[node])

    while len(ways) > 0:
        for i, way in enumerate(ways):
            if way["nodes"][0] == current_way["nodes"][-1]:
                # No need to add first element again since added when processing previous way
                for j in range(1, len(way["nodes"])):
                    region_nodes.append(node_locations[way["nodes"][j]])

                current_way = way
                ways.pop(i)
                break
            elif way["nodes"][-1] == current_way["nodes"][-1]:
                # Need to flip way
                way["nodes"].reverse()
                for j in range(1, len(way["nodes"])):
                    region_nodes.append(node_locations[way["nodes"][j]])

                current_way = way
                ways.pop(i)
                break

    # First/last element exists twice
    region_nodes.pop()

    with open(filename, 'w') as file:
        for node in region_nodes:
            file.write(str(node[0]) + ',' + str(node[1]) + '\n')


def speed_test_menu():
    option = 0



    while option != 100:
        # Clear screen
        #print("\033[H\033[3J", end="")

        print("Choose option:")
        print("1. Graph data download")
        print("2. Load Adjacency List")
        print("3. Dijkstra (used as failsafe)")
        print("4. Naive Dijkstra (not used)")
        print("5. Jsonify Dijkstra (used as failsafe)")
        print("6. Download graph region")
        print("8. C++ Dijkstra")
        print("9. Incremental Convex Hull Partitioning")
        print("10. Naive Convex Hull Partitioning (not used)")
        print("11. C++ Convex Hull Partitioning")
        print("100. Exit")
        option = int(input())

        # When no switch case before python3.10
        if option == 1:
            print("Repetitions?")
            repetitions = int(input())
            print(f"Average of {timeit(lambda: download_edges_in_relation(SOUTHAMPTON_RELATION_ID), number=repetitions)/repetitions}s")
            print("Press enter to continue: ")
            input()
        elif option == 2:
            print("Repetitions?")
            repetitions = int(input())
            print(f"Average of {timeit(load_adjacency_list, number=repetitions)/repetitions}s")
            print("Press enter to continue: ")
            input()
        elif option == 3:
            print("Repetitions?")
            repetitions = int(input())
            print(f"Average of {timeit(lambda: map_dijkstra(0, adjacency_list), number=repetitions)/repetitions}s")
            print("Press enter to continue: ")
            input()
        elif option == 4:
            print("Loaded!")
            print("Repetitions?")
            repetitions = int(input())
            print(
                f"Average of {timeit(lambda: traditional_dijkstra(0, adjacency_list), number=repetitions) / repetitions}s")
            print("Press enter to continue: ")
            input()
        elif option == 5:
            print("Repetitions?")
            repetitions = int(input())
            print(
                f"Average of {timeit(lambda: json.dumps(dijkstraResult), number=repetitions) / repetitions}s")
            print("Press enter to continue: ")
            input()
        elif option == 6:
            print("Repetitions?")
            repetitions = int(input())
            print(
                f"Average of {timeit(lambda: download_region_nodes(SOUTHAMPTON_RELATION_ID), number=repetitions) / repetitions}s")
            print("Press enter to continue: ")
            input()
        # elif option == 7:
        #     print("Preloading node list...")
        #     node_list = load_node_list()
        #     print("Loaded!")
        #     print("Repetitions?")
        #     repetitions = int(input())
        #     print(
        #         f"Average of {timeit(lambda: closest_node(50.9409990, -1.4490028, node_list), number=repetitions) / repetitions}s")
        #     print("Press enter to continue: ")
        #     input()
        elif option == 8:
            print("Repetitions?")
            repetitions = int(input())
            print(
                f"Average of {timeit(lambda: graph_algorithms.map_dijkstra(0), number=repetitions) / repetitions}s")
            print("Press enter to continue: ")
            input()
        elif option == 9:
            print("Repetitions?")
            repetitions = int(input())
            partition_distance = int(input("Partition Distance?\n"))
            print(
                f"Average of {timeit(lambda: convex_hull_partition(mercator_node_list, dijkstraResult[1], partition_distance=partition_distance), number=repetitions) / repetitions}s")
            print("Press enter to continue: ")
            input()
        elif option == 10:
            print("Repetitions?")
            repetitions = int(input())
            partition_distance = int(input("Partition Distance?\n"))

            print(
                f"Average of {timeit(lambda: old_convex_hull_partition(mercator_node_list, dijkstraResult[1], partition_distance=partition_distance), number=repetitions) / repetitions}s")
            print("Press enter to continue: ")
            input()

        elif option == 11:
            print("Repetitions?")
            repetitions = int(input())
            partition_distance = int(input("Partition Distance?\n"))
            print(
                f"Average of {timeit(lambda: graph_algorithms.convex_hull_partition(0, partition_distance), number=repetitions) / repetitions}s")
            print("Press enter to continue: ")
def menu():
    # Load settings
    current_settings = Settings()
    while True:
        print("1. Redownload all data")
        print("2. Run server (currently blocking)")
        print("3. Set area by OpenStreetMap relation id")
        print("4. Set area by searching OpenStreetMap")
        print("5. Set overpass api instance")
        print("6. Set area by point and radius")
        print("100. Leave")
        option = int(input())
        if option == 1:
            try:

                if current_settings["RELATION_REGION_MODE"]:
                    download_edges_in_relation(current_settings["AREA_RELATION_ID"],
                                               overpass_interpreter_url=current_settings["OVERPASS_INTERPRETER_URL"])
                else:
                    download_edges_around_point(current_settings["LAT_CENTRE"],
                                                current_settings["LON_CENTRE"],
                                                current_settings["AREA_RADIUS"],
                                                overpass_interpreter_url=current_settings["OVERPASS_INTERPRETER_URL"])
            except ConnectionError:
                print("Unable to connect to the Overpass API")
                print("Try checking your internet connection, or changing the Overpass API instance used")
            # download_region_nodes(current_settings["area_relation_id"])
        elif option == 2:
            import server
            server.app.run(host="0.0.0.0")
            # try:
            #    server = reload(server)
            #    server.app.run(host="0.0.0.0")
            # except NameError:
            #    server_pypy = reload(server_pypy)
            #    server_pypy.app.run(host="0.0.0.0")
            # except ImportError:
            #    server_pypy = reload(server_pypy)
            #    server_pypy.app.run(host="0.0.0.0")
        elif option == 3:
            print("Enter OpenStreetMap relation id - leave blank to go back")

            new_area_relation_id = input()

            if new_area_relation_id.isdigit():
                current_settings["AREA_RELATION_ID"] = int(new_area_relation_id)
                current_settings["RELATION_REGION_MODE"] = True
                current_settings.save()
                print("Settings saved!")
                print("Note: data will need to be re-downloaded")
        elif option == 4:
            print("Enter search term for area:")
            try:
                areas = search_relation(input(),
                                        overpass_interpreter_url=current_settings["OVERPASS_INTERPRETER_URL"])
                print(f"Found {len(areas)} results: ")
                print("0. Back")
                for i, item in enumerate(areas):
                    # 1-indexing for user friendly ness
                    print(f"{i + 1}: {item['tags']['name']} "
                          f"{'- ' + item['tags']['wikipedia'] + ' ' if 'wikipedia' in item['tags'] else ''}"
                          f"- https://www.openstreetmap.org/relation/{item['id']}")
                print("0. Back")
                print("Input your choice: ")
                area_index = int(input()) - 1
                if 0 <= area_index < len(areas):
                    current_settings["AREA_RELATION_ID"] = areas[area_index]['id']
                    current_settings["RELATION_REGION_MODE"] = True
                    current_settings.save()
                    print("Settings saved!")
                    print("Note: data will need to be re-downloaded")
                else:
                    print("No area selected. Going back.")
            except ConnectionError:
                print("Unable to connect to the Overpass API")
                print("Try checking your internet connection, or changing the Overpass API instance used")

        elif option == 5:
            print("Change the overpass server instance to use when downloading data. Use if "
                  "struggling to download data from current overpass server instance "
                  "or want to use your own overpass server instance.")

            print(f"Note the current Overpass Api connected to is: {current_settings['OVERPASS_INTERPRETER_URL']}")
            print("0. Back")
            print("1. Main Overpass API - https://overpass-api.de/api/interpreter")
            print("2. VK Maps Overpass API - https://maps.mail.ru/osm/tools/overpass/api/interpreter")
            print("3. Kumi Systems Overpass API - https://overpass.kumi.systems/api/interpreter")
            print("4. Custom URL")
            print("0. Back")

            url_chosen = int(input())
            if url_chosen == 1:
                current_settings['OVERPASS_INTERPRETER_URL'] = "https://overpass-api.de/api/interpreter"
                current_settings.save()
                print("URL changed successfully!")
            elif url_chosen == 2:
                current_settings['OVERPASS_INTERPRETER_URL'] = "https://maps.mail.ru/osm/tools/overpass/api/interpreter"
                current_settings.save()
                print("URL changed successfully!")
            elif url_chosen == 3:
                current_settings['OVERPASS_INTERPRETER_URL'] = "https://overpass.kumi.systems/api/interpreter"
                current_settings.save()
                print("URL changed successfully!")
            elif url_chosen == 4:
                print("Enter the new Overpass Api URL to use - leave blank to cancel")
                print("Note normally ends in /api/interpreter")
                new_url = input()
                if new_url.strip() != "":
                    current_settings['OVERPASS_INTERPRETER_URL'] = new_url
                    current_settings.save()
                    print("URL changed successfully!")
                else:
                    print("No URL chosen. Going back.")
            else:
                print("No URL chosen. Going back.")

        elif option == 6:
            try:
                print("Enter latitude of centre point")
                current_settings["LAT_CENTRE"] = float(input())

                print("Enter longitude of centre point")
                current_settings["LON_CENTRE"] = float(input())

                print("Enter radius of region around centre point in metres")
                current_settings["AREA_RADIUS"] = int(input())
                current_settings["RELATION_REGION_MODE"] = False
                current_settings.save()
            except ValueError:
                print("Please enter valid numbers. Going back.")
                # Erase any changes to settings done unless completed fully
                current_settings.reload()

        elif option == 100:
            print("Bye bye.")
            return

def mercator(lat, lon) -> Tuple[float, float]:
    """
    Returns an x, y coordinate pair for a given lat lon point.
    Uses the mercator projection - for the small regions we deal with,
    usually away from the poles, this is very accurate

    """

    return (pi * lat * EARTH_RADIUS) / 180, EARTH_RADIUS * log(tan(pi*(45 + lon / 2)/180))

def generate_mercator_node_list(node_list: List[Tuple[float, float]]) -> List[Tuple[int, float, float]]:
    """
    Converts a lat lng node list to a
    node_index, x, y node list using the mercator projection
    """
    result: List[Tuple[float, float]] = []
    #print(node_list)
    for i, node in enumerate(node_list):
        result.append((i,) + mercator(node[1], node[2]))

    return result

def download_edges(AREA_RELATION_ID,
                   node_distance_formula: Callable[[float, float, float, float], float] = haversine_node_distance,
                   node_filename="map_data/nodes.csv",
                   adjacency_list_filename="map_data/edges.csv",
                   dead_node_list_filename="map_data/dead.csv",
                   verbose=False):

    raise DeprecationWarning()
    """
    Downloads all nodes on a 'way' from OpenStreetMap in an area detailed by
    area_relation_id, finds the 'ways' between such nodes using node_distance_formula
    and then stores the adjacency list in adjacency_list_filename, with basic node details stored in node_filename.
    Surprisingly quicker handwritten than with overpy
    :param area_relation_id: RELATION_ID of area to get nodes from
    :param node_distance_formula: Function that takes in latitude, longitude for two nodes and returns the floating point distance between them
    :param node_filename: File to store node ids in
    :param adjacency_list_filename: File to store adjacency list in
    :param verbose: Whether to include debugging statements or not
    :return:
    """

    with open(dead_node_list_filename) as file:
        dead_nodes = set([int(dead_node_id) for dead_node_id in file.readline().split(',')])

    # 3600000000 is the magic number
    query = f"[out:json];" + \
            f"area({3600000000 + AREA_RELATION_ID})->.searchArea;" + \
            f"way['highway'](area.searchArea);" + \
            f"(._;>;);out;"

    response = requests.get("https://overpass-api.de/api/interpreter", params={'data': query})
    if response.status_code != 200:
        raise ConnectionError("Unable to succesfully connect to Overpass Api")

    if verbose:
        print("Downloaded Data")

    data = json.loads(response.text)["elements"]

    if verbose:
        print("Parsed Json")

    nodes = []
    node_indexes = {}
    for item in data:
        if item["type"] == "node":
            if item["id"] not in dead_nodes:
                node_indexes[item["id"]] = len(nodes)
                nodes.append((item["id"], item["lat"], item["lon"]))

    adjacency_list: List[List[Union[int, float]]] = [[] for _i in range(len(nodes))]

    if verbose:
        print("Loaded nodes")

    # Iterate over twice to ensure all nodes have been detected before processing ways
    for item in data:
        if item["type"] == "way":
            # If and only if first node in way is dead, are all nodes in the way dead
            if item["nodes"][0] not in dead_nodes:
                for i in range(len(item["nodes"]) - 1):
                    node_index1 = node_indexes[item["nodes"][i]]
                    node_index2 = node_indexes[item["nodes"][i+1]]
                    distance = node_distance_formula(nodes[node_index1][1],
                                                     nodes[node_index1][2],
                                                     nodes[node_index2][1],
                                                     nodes[node_index2][2])
                    adjacency_list[node_index1].append(node_index2)
                    adjacency_list[node_index2].append(node_index1)
                    adjacency_list[node_index1].append(distance)
                    adjacency_list[node_index2].append(distance)

    if verbose:
        print("Calculated edges")

    with open(node_filename, 'w') as file:
        for node in nodes:
            file.write(','.join([str(field) for field in node]) + '\n')

    if verbose:
        print("Saved node details to file")

    with open(adjacency_list_filename, 'w') as file:
        for row in adjacency_list:
            file.write(','.join([str(edge) for edge in row]))
            file.write('\n')

    if verbose:
        print("Saved adjacency list to file")
