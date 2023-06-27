"""
Automatically downloads and parses elevation data for a given set of nodes
"""

from typing import List, Tuple, Set
from math import floor, ceil
import rasterio
import zipfile
import requests
from io import BytesIO


def _generate_geotiff_filename_for_tile(lat_lon: Tuple[int, int]):

    if lat_lon[0] >= 0:
        lat_coord = "N" + str(lat_lon[0]).rjust(2, '0')
    else:
        lat_coord = "S" + str(-lat_lon[0]).rjust(2, '0')

    if lat_lon[1] >= 0:
        lon_coord = "E" + str(lat_lon[1]).rjust(3, '0')
    else:
        lon_coord = "W" + str(-lat_lon[1]).rjust(3, '0')


    return f"ASTGTMV003_{lat_coord}{lon_coord}_dem.tif"


def _generate_subzip_filename_for_tile(lat_lon: Tuple[int, int]):

    if lat_lon[0] >= 0:
        lat_coord = "N" + str(lat_lon[0]).rjust(2, '0')
    else:
        lat_coord = "S" + str(-lat_lon[0]).rjust(2, '0')

    if lat_lon[1] >= 0:
        lon_coord = "E" + str(lat_lon[1]).rjust(3, '0')
    else:
        lon_coord = "W" + str(-lat_lon[1]).rjust(3, '0')


    return f"ASTGTMV003_{lat_coord}{lon_coord}.zip"

def _generate_zip_filename_for_tile(lat_lon: Tuple[int, int]):

    if lat_lon[0] >= 0:
        lat_coord = "N" + str(lat_lon[0]).rjust(2, '0')
    else:
        lat_coord = "S" + str(-lat_lon[0]).rjust(2, '0')

    if lat_lon[1] >= 0:
        lon_coord = "E" + str(lat_lon[1]).rjust(3, '0')
    else:
        lon_coord = "W" + str(-lat_lon[1]).rjust(3, '0')

    return f"Download_{lat_coord}{lon_coord}.zip"

def get_elevation_for_nodes(nodes: List[Tuple[int, float, float]],
                            aster_gdem_api_endpoint: str = "https://gdemdl.aster.jspacesystems.or.jp/download/") -> List[float]:

    required_tiles: List[Tuple[int, int]] = []
    tile_data = []

    for node in nodes:
        # coordinate lat, lon is stored in tile floor(lat), floor(lon) (considering negatives as south and west)
        tile = (floor(node[1]), (floor(node[2])))
        if tile not in required_tiles:
            required_tiles.append(tile)

    for tile in required_tiles:
        try:
            response = requests.get(aster_gdem_api_endpoint + _generate_zip_filename_for_tile(tile))
            # with open('temp.zip', 'wb') as f:
            #     f.write(response.content)
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
        tile = (floor(node[1]), (floor(node[2])))
        tile_elevations = tile_data[required_tiles.index(tile)]
        lat_index = ceil(node[1]) * 3600 - ceil(node[1]*3600)
        lon_index = floor(node[2]*3600) - floor(node[2]) * 3600
        # Latitudes index backwards of size
        try:
            elevations.append(tile_elevations[lat_index][lon_index])
        except IndexError:
            elevations.append(-1)

    return elevations
