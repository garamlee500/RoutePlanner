import json
class Settings:
    # Allow some restricted access to settings dict
    # Partly implements interface to dictionary
    def __getitem__(self, index):
        return self.settings_dict[index]

    def __setitem__(self, key, value):
        if key in self.default_settings:
            self.settings_dict[key] = value
        else:
            raise KeyError()

    def reload(self):

        try:
            with open(self.settings_file) as file:
                self.settings_dict = json.load(file)
        except FileNotFoundError:
            self.settings_dict = {}

        # Set any unset settings to default
        for setting in self.default_settings:
            if setting not in self.settings_dict:
                self.settings_dict[setting] = self.default_settings[setting]

    def __init__(self, settings_file="server/settings.json"):
        self.settings_file = settings_file

        self.default_settings = {
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
        self.settings_dict = self.default_settings

    def save(self):
        with open(self.settings_file, 'w') as file:
            json.dump(self.settings_dict, file)
