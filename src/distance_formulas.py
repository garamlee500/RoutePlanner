from math import radians, sin, cos, asin, e

EARTH_RADIUS = 6_371_000


def walking_time(distance: float, elevation_gain: float) -> float:
    """
    Uses Tobler's hiking function to find walking distance between two nodes
    (presuming straight road between two)
    https://en.wikipedia.org/wiki/Tobler%27s_hiking_function
    """
    slope = elevation_gain/distance
    # Factor of 3.6 is for km/h -> m/s
    speed = 6*(e**(-3.5*(abs(slope + 0.05)))) / 3.6
    return distance / speed


def haversine_node_distance(node1lat, node1lon, node2lat, node2lon) -> float:
    """
    Find direct distance between two nodes, using the
    Haversine formula. See https://en.wikipedia.org/wiki/Haversine_formula
    :return: Float giving distance 'as-the-crow-flies' between two nodes,
        taking into account the earth's curvature
    """
    lat2 = radians(node2lat)
    lat1 = radians(node1lat)
    lon2 = radians(node2lon)
    lon1 = radians(node1lon)
    term1 = sin((lat2 - lat1) / 2) ** 2
    term2 = cos(lat1) * cos(lat2) * (sin((lon2 - lon1) / 2) ** 2)
    return 2 * EARTH_RADIUS * asin((term1 + term2) ** 0.5)
