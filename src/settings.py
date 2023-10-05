import json


class Settings:
    # Allow some restricted access to settings dict
    # Partly implements interface to dictionary
    # https://docs.python.org/3/reference/datamodel.html#emulating-container-types
    def __getitem__(self, key):
        return self._settings_dict[key]

    def __setitem__(self, key, value):
        if key in self._default_settings:
            self._settings_dict[key] = value
        else:
            # Ensure that all keys are names of valid settings
            raise KeyError()

    def reload(self):
        try:
            with open(self._settings_file) as file:
                # Override all settings with ones from file, while preserving non-set defaults
                self._settings_dict = self._default_settings | json.load(file)
        except FileNotFoundError:
            pass

    def __init__(self, settings_file="server/settings.json"):
        self._settings_file = settings_file
        self._default_settings = {
            "AREA_RELATION_ID": 127864,  # Area relation to download data from
            "OVERPASS_INTERPRETER_URL": "https://overpass-api.de/api/interpreter",
            "RELATION_REGION_MODE": True,
            # True - download region from area_relation_id. False - Download from radius/lat/lon
            "AREA_RADIUS": 3_000,
            "LAT_CENTRE": 50.9617786,
            "LON_CENTRE": -1.3651394,
            "ASTER_GDEM_API_URL": "https://gdemdl.aster.jspacesystems.or.jp/download/"
        }
        self.reload()

    def save(self):
        with open(self._settings_file, 'w') as file:
            json.dump(self._settings_dict, file)
