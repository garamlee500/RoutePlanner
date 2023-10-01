import math
from waitress import serve
from get_data import download_edges_in_relation, download_edges_around_point, search_relation
from settings import Settings
from menu import Menu
import server
import database

current_settings = Settings()

def unknown_error(e):
    print(e)
    print("An unknown error occurred. Please see error message above.")
    print("If this continues happening, try closing and restarting this program.")



def redownload_all_data():
    # Runs download_edges with current settings applied
    try:
        if current_settings["RELATION_REGION_MODE"]:
            download_edges_in_relation(current_settings["AREA_RELATION_ID"],
                                       overpass_interpreter_url=current_settings["OVERPASS_INTERPRETER_URL"],
                                       aster_gdem_api_endpoint=current_settings["ASTER_GDEM_API_URL"])
        else:
            download_edges_around_point(current_settings["LAT_CENTRE"],
                                        current_settings["LON_CENTRE"],
                                        current_settings["AREA_RADIUS"],
                                        overpass_interpreter_url=current_settings["OVERPASS_INTERPRETER_URL"],
                                        aster_gdem_api_endpoint=current_settings["ASTER_GDEM_API_URL"])
    except ConnectionError:
        print("ERROR: Unable to connect to the Overpass API")
        print("Try checking your internet connection, or changing the Overpass API instance used")
    except ValueError:
        print("ERROR: Unable to successfully process region.")
        print("Please ensure valid and sensible region has been selected")
    except Exception as e:
        unknown_error(e)

def run_server():
    try:
        server.reload_map_graph()
    except ValueError:
        print("Invalid map data!")
        print("Have you tried 'Redownload all data'?")
        return
    except Exception as e:
        unknown_error(e)
        return
    print("Running server!")
    print("Press CTRL-C to stop server")
    try:
        serve(server.app)
    except Exception as e:
        unknown_error(e)


def set_area_by_relation_id():
    print("Enter OpenStreetMap relation id - enter -1 to go back")

    new_area_relation_id = Menu.prompt_integer(-1, math.inf)
    if new_area_relation_id >= 0:
        current_settings["AREA_RELATION_ID"] = new_area_relation_id
        current_settings["RELATION_REGION_MODE"] = True
        current_settings.save()
        print("Settings saved!")
        print("Note: data will need to be re-downloaded")
    else:
        print("Going back.")


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
    except Exception as e:
        unknown_error(e)


def current_region_string():
    # Creates a formatted string describing the region that is currently selected
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
    current_settings.save()


main_menu: Menu = Menu(start_text="Welcome to server configuration")
main_menu.add_option(("Redownload all data", redownload_all_data))
main_menu.add_option(("Run server", run_server))

area_setting_menu: Menu = Menu(start_text=lambda: "Map target area selection\n" + current_region_string())
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

aster_gdem_api_menu: Menu = Menu(
    start_text=lambda: "Change the ASTER GDEM api server used when downloading elevation data. Use if "
                       "struggling to download data from current ASTER GDEM server "
                       "or want to use your own ASTER GDEM server.\n"
                       f"Note the current ASTER GDEM server connected to is: {current_settings['ASTER_GDEM_API_URL']}",
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
        set_overpass_endpoint(new_url)
    else:
        print("No URL chosen. Going back.")


def set_gdem_aster_endpoint(url):
    current_settings['ASTER_GDEM_API_URL'] = url
    current_settings.save()
    print("URL changed successfully!")


def set_custom_gdem_aster_endpoint():
    print("Enter the new ASTER GDEM Api URL to use - leave blank to cancel")
    print("Note data must be stored in same format as https://gdemdl.aster.jspacesystems.or.jp/download/")
    new_url = input()
    if new_url.strip() != "":
        set_gdem_aster_endpoint(new_url)
    else:
        print("No URL chosen. Going back.")


def reset_database_prompt():
    print("Are you sure you want to delete all user data?")
    print(
        "Type - 'Hello World!' exactly without the quotes and press enter to delete data, otherwise just press enter.")
    if input() == "Hello World!":
        database.reset_database()
        print("Database reset!")
    else:
        print("Going back.")


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

aster_gdem_api_menu.add_option(
    ("Default ASTER GDEM server (Japan Space Systems) - https://gdemdl.aster.jspacesystems.or.jp/download/",
     lambda: set_gdem_aster_endpoint("https://gdemdl.aster.jspacesystems.or.jp/download/"))
)

aster_gdem_api_menu.add_option(
    ("Github ASTER GDEM backup (England only) - https://cdn.jsdelivr.net/gh/garamlee500/ASTER_GDEM_ENGLAND@main/",
     lambda: set_gdem_aster_endpoint("https://cdn.jsdelivr.net/gh/garamlee500/ASTER_GDEM_ENGLAND@main/"))
)
aster_gdem_api_menu.add_option(
    ("Custom URL",
     set_custom_gdem_aster_endpoint)
)

main_menu.add_option(("Set overpass api instance",
                      overpass_api_endpoint_menu))

main_menu.add_option(("Set ASTER GDEM api url",
                      aster_gdem_api_menu))

main_menu.add_option((
    "Reset database (use to delete test database)",
    reset_database_prompt
))

main_menu.run()
