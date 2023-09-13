import json


class Settings:
    # Allow some restricted access to settings dict
    # Partly implements interface to dictionary
    # https://docs.python.org/3/reference/datamodel.html#emulating-container-types
    def __getitem__(self, index):
        return self._settings_dict[index]

    def __setitem__(self, key, value):
        if key in self._default_settings:
            self._settings_dict[key] = value
        else:
            raise KeyError()

    def reload(self):
        try:
            with open(self._settings_file) as file:
                self._settings_dict = json.load(file)
        except FileNotFoundError:
            self._settings_dict = {}

        # Set any unset settings to default
        for setting in self._default_settings:
            if setting not in self._settings_dict:
                self._settings_dict[setting] = self._default_settings[setting]

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

    def reset(self):
        self._settings_dict = self._default_settings

    def save(self):
        with open(self._settings_file, 'w') as file:
            json.dump(self._settings_dict, file)
