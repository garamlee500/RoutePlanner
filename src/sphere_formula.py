from math import radians, sin, cos, asin

EARTH_RADIUS = 6_371_000


def haversine_node_distance(node1lat, node1lon, node2lat, node2lon) -> float:
    """
    Find direct distance between two nodes, using the
    Haversine formula. See https://en.wikipedia.org/wiki/Haversine_formula
    :return: Float giving distance 'as-the-crow-flies' between two nodes,
        taking into account the earth's curvature
    """
    # Earth average radius in metres

    lat2 = radians(node2lat)
    lat1 = radians(node1lat)
    lon2 = radians(node2lon)
    lon1 = radians(node1lon)
    term1 = sin((lat2 - lat1) / 2) ** 2
    term2 = cos(lat1) * cos(lat2) * (sin((lon2 - lon1) / 2) ** 2)

    return 2 * EARTH_RADIUS * asin((term1 + term2) ** 0.5)
