from waitress import serve
import math
from get_data import download_edges_in_relation, download_edges_around_point, search_relation
from settings import Settings
from menu import Menu
from speed_test import benchmark_device
import server
import exceptions

current_settings = Settings()


def redownload_all_data(incremental=False):
    try:

        if current_settings["RELATION_REGION_MODE"]:
            download_edges_in_relation(current_settings["AREA_RELATION_ID"],
                                       overpass_interpreter_url=current_settings["OVERPASS_INTERPRETER_URL"],
                                       incremental=incremental)

        else:
            download_edges_around_point(current_settings["LAT_CENTRE"],
                                        current_settings["LON_CENTRE"],
                                        current_settings["AREA_RADIUS"],
                                        overpass_interpreter_url=current_settings["OVERPASS_INTERPRETER_URL"],
                                        incremental=incremental)
    except ConnectionError:
        print("ERROR: Unable to connect to the Overpass API")
        print("Try checking your internet connection, or changing the Overpass API instance used")
    except exceptions.InvalidRegionError:
        print("ERROR: Unable to succesfully process region.")
        print("Please ensure valid and sensible region has been selected")


def run_development_server():
    server.reload_map_graph()
    server.app.run(host="0.0.0.0")


def run_server():
    server.reload_map_graph()
    print("Running server!")
    print("Press CTRL-C to stop server")
    serve(server.app)


def set_area_by_relation_id():
    print("Enter OpenStreetMap relation id - enter -1 to go back")

    new_area_relation_id = Menu.prompt_integer(-1, math.inf)

    if new_area_relation_id >= 0:
        current_settings["AREA_RELATION_ID"] = int(new_area_relation_id)
        current_settings["RELATION_REGION_MODE"] = True
        current_settings.save()
        print("Settings saved!")
        print("Note: data will need to be re-downloaded")


def set_area_by_searching():
    print("Enter search term for area (leave blank to go back):")
    search_term = input()
    if search_term == "":
        print("Going back.")
        return

    try:
        areas = search_relation(search_term,
                                overpass_interpreter_url=current_settings["OVERPASS_INTERPRETER_URL"])
        set_area_menu = Menu(start_text=f"Found {len(areas)} results: ", loop=False)

        def create_set_area_function(region_index):
            def set_area_function():
                current_settings["AREA_RELATION_ID"] = areas[region_index]['id']
                current_settings["RELATION_REGION_MODE"] = True
                current_settings.save()
                print("Settings saved!")
                print("Note: data will need to be re-downloaded")

            return set_area_function

        for i, item in enumerate(areas):
            set_area_menu.add_option((f"{item['tags']['name']} "
                                      f"{'- ' + item['tags']['wikipedia'] + ' ' if 'wikipedia' in item['tags'] else ''}"
                                      f"- https://www.openstreetmap.org/relation/{item['id']}",
                                      create_set_area_function(i)))
        set_area_menu.run()
    except ConnectionError:
        print("ERROR: Unable to connect to the Overpass API")
        print("Try checking your internet connection, or changing the Overpass API instance used")


def current_region_string():
    if current_settings["RELATION_REGION_MODE"]:
        return f"Current region: https://openstreetmap.org/relation/{current_settings['AREA_RELATION_ID']}"

    return "Current region: Circle centred at https://openstreetmap.org/" \
           f"?mlat={current_settings['LAT_CENTRE']}" \
           f"&mlon={current_settings['LON_CENTRE']} " \
           f"with radius {current_settings['AREA_RADIUS']}m"



def set_area_by_point_radius():
    print("Enter latitude of centre point (enter 0 to cancel)")
    lat_centre = Menu.prompt_float(-math.inf, math.inf)
    if lat_centre == 0:
        # Reload deletes any previous changes
        current_settings.reload()
        print("Operation cancelled. Going back.")
        return
    current_settings["LAT_CENTRE"] = lat_centre

    print("Enter longitude of centre point (enter 0 to cancel)")
    lon_centre = Menu.prompt_float(-math.inf, math.inf)
    if lon_centre == 0:
        # Reload deletes any previous changes
        current_settings.reload()
        print("Operation cancelled. Going back.")
        return
    current_settings["LON_CENTRE"] = lon_centre

    print("Enter radius of region around centre point in metres (enter 0 to cancel)")
    area_radius = Menu.prompt_float(-math.inf, math.inf)
    if area_radius == 0:
        # Reload deletes any previous changes
        current_settings.reload()
        print("Operation cancelled. Going back.")
        return
    current_settings["AREA_RADIUS"] = area_radius
    current_settings["RELATION_REGION_MODE"] = False

    print("Settings saved!")
    print("Note: data will need to be re-downloaded")
    # Save changes to settings
    current_settings.save()


main_menu: Menu = Menu(start_text="Welcome to server configuration")
main_menu.add_option(("Redownload all data", redownload_all_data))
main_menu.add_option(("Update data - use if region has not changed", lambda: redownload_all_data(True)))
main_menu.add_option(("Run server", run_server))

area_setting_menu: Menu = Menu(start_text=lambda: "Map target area selection\n"+current_region_string())
area_setting_menu.add_option(("Set area by OpenStreetMap relation id", set_area_by_relation_id))
area_setting_menu.add_option(("Set area by searching OpenStreetMap", set_area_by_searching))
area_setting_menu.add_option(("Set area by point and radius", set_area_by_point_radius))

main_menu.add_option(("Choose target area for maps", area_setting_menu))

overpass_api_endpoint_menu: Menu = Menu(
    start_text=lambda: "Change the overpass server instance to use when downloading data. Use if "
                       "struggling to download data from current overpass server instance "
                       "or want to use your own overpass server instance.\n"
                       f"Note the current Overpass Api connected to is: {current_settings['OVERPASS_INTERPRETER_URL']}",
    loop=False
)


def set_overpass_endpoint(url):
    current_settings['OVERPASS_INTERPRETER_URL'] = url
    current_settings.save()
    print("URL changed successfully!")


def set_custom_overpass_endpoint():
    print("Enter the new Overpass Api URL to use - leave blank to cancel")
    print("Note normally ends in /api/interpreter")
    new_url = input()
    if new_url.strip() != "":
        current_settings['OVERPASS_INTERPRETER_URL'] = new_url
        current_settings.save()
        print("URL changed successfully!")
    else:
        print("No URL chosen. Going back.")


overpass_api_endpoint_menu.add_option(
    ("Main Overpass API - https://overpass-api.de/api/interpreter",
     lambda: set_overpass_endpoint("https://overpass-api.de/api/interpreter"))
)
overpass_api_endpoint_menu.add_option(
    ("VK Maps Overpass API - https://maps.mail.ru/osm/tools/overpass/api/interpreter",
     lambda: set_overpass_endpoint("https://maps.mail.ru/osm/tools/overpass/api/interpreter"))
)
overpass_api_endpoint_menu.add_option(
    ("Kumi Systems Overpass API - https://overpass.kumi.systems/api/interpreter",
     lambda: set_overpass_endpoint("https://overpass.kumi.systems/api/interpreter"))
)
overpass_api_endpoint_menu.add_option(
    ("Custom URL",
     set_custom_overpass_endpoint)
)

main_menu.add_option(("Set overpass api instance",
                      overpass_api_endpoint_menu))
main_menu.add_option((
    "Benchmark device",
    benchmark_device
))

main_menu.run()
