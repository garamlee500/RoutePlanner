async function hideSettings() {
    document.getElementById('clickBlocker').style.width = '0%';
    document.getElementById('map').classList.remove('settingsHide');
    document.getElementById('main_controls').classList.remove('settingsHide');
    document.getElementById('settings').style.display = 'none';

    settings.isochroneDelay = parseInt(document.getElementById('isochroneDelay').value);
    settings.findShortestPathsByTime = document.getElementById('findShortestPathsByTimeCheckBox').checked;

    if (settings.partitionDistance !== parseInt(document.querySelector('input[name="partitionDistance"]:checked').value)) {
        // Must regenerate if changed partition distance and reindex
        settings.partitionDistance = parseInt(document.querySelector('input[name="partitionDistance"]:checked').value);
        settings.isochroneOpacity = parseFloat(document.getElementById('regionOpacity').value);
        await generateIsochrone();
        setupConvexHullInputs();

        displayConvexHull();


    } else if (settings.isochroneOpacity !== parseFloat(document.getElementById('regionOpacity').value)) {
        settings.isochroneOpacity = parseFloat(document.getElementById('regionOpacity').value);

        // No need to reconsider reindexing region selection since same as before
        generateIsochrone();
    }
    sessionStorage.setItem("settings", JSON.stringify(settings));
}

function displaySettings() {
    document.getElementById('isochroneDelay').value = settings.isochroneDelay;
    document.getElementById('regionOpacity').value = settings.isochroneOpacity;
    document.getElementById('findShortestPathsByTimeCheckBox').checked = settings.findShortestPathsByTime;


    document.getElementById('clickBlocker').style.width = '100%';
    document.getElementById('map').classList.add('settingsHide');
    document.getElementById('main_controls').classList.add('settingsHide');
    document.getElementById('settings').style.display = 'grid';

    document.getElementById('partition' + settings.partitionDistance.toString()).checked = true;

    document.getElementById('statsStartLocation').textContent = `Start Location: Latitude: ${routeMarkers[0].getLatLng().lat}, Longitude: ${routeMarkers[0].getLatLng().lng}`
    document.getElementById('statsDestinationLocation').textContent = `Destination Location: Latitude: ${routeMarkers[routeMarkers.length-1].getLatLng().lat}, Longitude: ${routeMarkers[routeMarkers.length-1].getLatLng().lng}`
    if (gpsAccuracy != null) {
        document.getElementById('statsGpsAccuracy').textContent = `Gps Accuracy (95% chance of being within this distance): ${Math.round(gpsAccuracy*100)/100}m`
    }
}
