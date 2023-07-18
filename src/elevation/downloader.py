from typing import List, Tuple
from math import floor, ceil
from io import BytesIO
import zipfile
import requests
from distance_formulas import haversine_node_distance


def _generate_tile_identifier(lat_lon: Tuple[int, int]):
    if lat_lon[0] >= 0:
        lat_coord = "N" + str(lat_lon[0]).rjust(2, '0')
    else:
        lat_coord = "S" + str(-lat_lon[0]).rjust(2, '0')

    if lat_lon[1] >= 0:
        lon_coord = "E" + str(lat_lon[1]).rjust(3, '0')
    else:
        lon_coord = "W" + str(-lat_lon[1]).rjust(3, '0')

    return lat_coord + lon_coord


def _generate_geotiff_filename_for_tile(lat_lon: Tuple[int, int]):
    return f"ASTGTMV003_{_generate_tile_identifier(lat_lon)}_dem.tif"


def _generate_subzip_filename_for_tile(lat_lon: Tuple[int, int]):
    return f"ASTGTMV003_{_generate_tile_identifier(lat_lon)}.zip"


def _generate_zip_filename_for_tile(lat_lon: Tuple[int, int]):
    return f"Download_{_generate_tile_identifier(lat_lon)}.zip"


def get_elevation_for_nodes(nodes: List[Tuple[int, float, float]], aster_gdem_api_endpoint) -> List[float]:
    """
    Gets the elevation of all nodes in a given list of nodes
    See https://www.jspacesystems.or.jp/ersdac/GDEM/E/2.html for format of geotiff files
    :param nodes:
    :param aster_gdem_api_endpoint:
    :return:
    """

    # Moved import into only submodule that requires it due to large loading times
    # on start up of main.py despite not needing it most of the time
    import rasterio

    # Use a simple list to store all tiles - unlikely to reach beyond length 4
    required_tiles: List[Tuple[int, int]] = []
    tile_data = []

    for node in nodes:
        # Detects the 4 pixels of which to sample elevation from
        # and then the tiles these pixels are on
        tiles = [(floor(node[1]), floor(node[2])),
                 (floor(node[1] + 1 / 3600), floor(node[2])),
                 (floor(node[1]), floor(node[2] + 1 / 3600)),
                 (floor(node[1] + 1 / 3600), floor(node[2] + 1 / 3600))
                 ]
        for tile in tiles:
            if tile not in required_tiles:
                required_tiles.append(tile)

    for tile in required_tiles:
        try:
            # Server provides data in this format - not much we can do to make this cleaner
            response = requests.get(aster_gdem_api_endpoint + _generate_zip_filename_for_tile(tile))
            with zipfile.ZipFile(BytesIO(response.content)) as download_zip:
                with download_zip.open(_generate_subzip_filename_for_tile(tile)) as sub_download_zip_file:
                    with zipfile.ZipFile(sub_download_zip_file) as sub_download_zip:
                        with sub_download_zip.open(_generate_geotiff_filename_for_tile(tile)) as geotiff_file:
                            data = rasterio.open(geotiff_file)
                            tile_data.append(data.read(1))
                            data.close()
        except:
            print("Unable to get all tiles")
            tile_data.append([])

    elevations = []
    for node in nodes:
        surrounding_elevations = []
        surrounding_distances = []
        elevation_collection_points = [(node[1], node[2]),
                                       (node[1] + 1 / 3600, node[2]),
                                       (node[1], node[2] + 1 / 3600),
                                       (node[1] + 1 / 3600, node[2] + 1 / 3600)
                                       ]

        # Considering the centre of each pixel of the (combined) geotiff file as a grid point
        # This samples the 4 'corner' elevations for each node, finding the elevation, and distance
        # from the node. We then use inverse distance weighted average to approximate elevation of
        # node itself
        for elevation_point in elevation_collection_points:
            tile = (floor(elevation_point[0]), floor(elevation_point[1]))
            tile_elevations = tile_data[required_tiles.index(tile)]
            lat_index = ceil(elevation_point[0])*3600 - floor(elevation_point[0] * 3600)
            lon_index = floor(elevation_point[1] * 3600) - floor(elevation_point[1]) * 3600

            surrounding_distances.append(
                haversine_node_distance(
                    floor(elevation_point[0] * 3600)/3600,
                    floor(elevation_point[1] * 3600)/3600,
                    node[1],
                    node[2]
                )
            )

            # Prevents zero division errors during inverse distance weighting average
            surrounding_distances[-1] = max(surrounding_distances[-1], 1e-50)

            try:
                surrounding_elevations.append(tile_elevations[lat_index][lon_index])
            except IndexError:
                surrounding_elevations.append(-1)

        weighted_elevation_sum = 0
        inverse_distance_sum = 0

        for i in range(4):
            weighted_elevation_sum += surrounding_elevations[i]/surrounding_distances[i]
            inverse_distance_sum += 1/surrounding_distances[i]

        # Finds the inverse distance weighted average of elevation of 4 surrounding grid points
        # Not extremely accurate, but generally ok - grid squares are only about 30mx30m
        # Additionally interpolation is mainly to smooth out points rather than to make accurate predictions
        # This prevents 'vertical wall' edges which are really short but have huge elevation gain
        # with a slope of approximately 5-6: this really messes with Tobler's hiking function and creates an
        # untraversable edge leading to traversal time measured in hours/days
        # The other alternative would be to just set some min speed to Tobler's hiking function, but this would
        # break the convexity of the inverse of Tobler's hiking function, which would mean a star would no longer be
        # provably optimal (although I doubt the effect would be serious)
        elevations.append(weighted_elevation_sum/inverse_distance_sum)

    return elevations
