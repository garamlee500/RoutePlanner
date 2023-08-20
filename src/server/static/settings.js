async function hideSettings() {
    document.getElementById('click-blocker').style.width = '0%';
    document.getElementById('map').classList.remove('settings-hide');
    document.getElementById('main-controls').classList.remove('settings-hide');
    if (document.getElementById('login-button') !== null){
        document.getElementById('login-button').classList.remove('settings-hide');
    }
    if (document.getElementById('account-button') !== null){
        document.getElementById('account-button').classList.remove('settings-hide');
    }
    document.getElementById('bottom-bar').classList.remove('settings-hide');
    document.getElementById('settings').style.display = 'none';
    settings.isochroneDelay = parseInt(document.getElementById('isochrone-delay').value);
    settings.findShortestPathsByTime = document.getElementById('find-shortest-paths-by-time-check-box').checked;
    if (settings.partitionDistance !== parseInt(document.querySelector('input[name="partition-distance"]:checked').value)) {
        // Must regenerate if changed partition distance and reindex
        settings.partitionDistance = parseInt(document.querySelector('input[name="partition-distance"]:checked').value);
        settings.isochroneOpacity = parseFloat(document.getElementById('region-opacity').value);
        await generateIsochrone();
        setupConvexHullInputs();
        displayConvexHull();
    }
    else if (settings.isochroneOpacity !== parseFloat(document.getElementById('region-opacity').value)) {
        settings.isochroneOpacity = parseFloat(document.getElementById('region-opacity').value);
        // No need to reconsider reindexing region selection since same as before
        generateIsochrone();
    }
    sessionStorage.setItem("settings", JSON.stringify(settings));
}

function displaySettings() {
    document.getElementById('isochrone-delay').value = settings.isochroneDelay;
    document.getElementById('region-opacity').value = settings.isochroneOpacity;
    document.getElementById('find-shortest-paths-by-time-check-box').checked = settings.findShortestPathsByTime;

    document.getElementById('click-blocker').style.width = '100%';
    document.getElementById('map').classList.add('settings-hide');
    document.getElementById('main-controls').classList.add('settings-hide');
    if (document.getElementById('login-button') !== null){
        document.getElementById('login-button').classList.add('settings-hide');
    }
    if (document.getElementById('account-button') !== null){
        document.getElementById('account-button').classList.add('settings-hide');
    }
    document.getElementById('bottom-bar').classList.add('settings-hide');
    document.getElementById('settings').style.display = 'grid';
    document.getElementById('partition' + settings.partitionDistance.toString()).checked = true;

    document.getElementById('stats-start-location').textContent =
        `Start Location: Latitude: ${routeMarkers[0].getLatLng().lat},
        Longitude: ${routeMarkers[0].getLatLng().lng}`;
    document.getElementById('stats-destination-location').textContent =
        `Destination Location: Latitude: ${routeMarkers[routeMarkers.length-1].getLatLng().lat},
        Longitude: ${routeMarkers[routeMarkers.length-1].getLatLng().lng}`;
    if (gpsAccuracy != null) {
        document.getElementById('stats-gps-accuracy').textContent =
        `Gps Accuracy (95% chance of being within this distance): ${Math.round(gpsAccuracy*100)/100}m`;
    }
}
