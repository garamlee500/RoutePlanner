function hideSettings() {
    document.getElementById('click-blocker').style.width = '0%';
    toggleSettingsHideClasses();
    document.getElementById('settings').style.display = 'none';
    settings.findShortestPathsByTime = document.getElementById('find-shortest-paths-by-time-check-box').checked;
    sessionStorage.setItem("settings", JSON.stringify(settings));
}

function displaySettingsData() {
    document.getElementById('find-shortest-paths-by-time-check-box').checked = settings.findShortestPathsByTime;
    document.getElementById('stats-start-location').textContent =
        `Start Location: Latitude: ${routeMarkers[0].getLatLng().lat},
        Longitude: ${routeMarkers[0].getLatLng().lng}`;
    document.getElementById('stats-destination-location').textContent =
        `Destination Location: Latitude: ${routeMarkers[routeMarkers.length - 1].getLatLng().lat},
        Longitude: ${routeMarkers[routeMarkers.length - 1].getLatLng().lng}`;

    if (gpsAccuracy != null) {
        document.getElementById('stats-gps-accuracy').textContent =
            `Gps Accuracy (95% chance of being within this distance): ${Math.round(gpsAccuracy * 100) / 100}m`;
    }
}

function displaySettings() {
    document.getElementById('click-blocker').style.width = '100%';
    toggleSettingsHideClasses();
    document.getElementById('settings').style.display = 'grid';
    displaySettingsData();
}

function toggleSettingsHideClasses() {
    document.getElementById('map').classList.toggle('settings-hide');
    document.getElementById('main-controls').classList.toggle('settings-hide');
    if (document.getElementById('login-button') !== null) {
        document.getElementById('login-button').classList.toggle('settings-hide');
    }
    if (document.getElementById('account-button') !== null) {
        document.getElementById('account-button').classList.toggle('settings-hide');
    }
    document.getElementById('bottom-bar').classList.toggle('settings-hide');
}
