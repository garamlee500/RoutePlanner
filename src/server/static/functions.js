function secondsToString(seconds){
    if (seconds < 60){
        return `${Math.round(seconds)} seconds`;
    }
    else if (seconds < 3600){
        return `${Math.round(seconds/60)} minutes`;
    }
    else{
        return `${Math.floor(seconds/3600)} hours, ${Math.round((seconds%3600)/60)} minutes`;
    }
}

function nodeDistanceMetric(node1lat, node1lon, node2lat, node2lon) {
    // Outputs a metric for distance between two nodes that can be used to
    // compare distances - is an increasing function of haversine node distance
    // but less computationally expensive
    // (misses out a square root, and arcsine and a scaling to the size of the earth)
    let lat2 = Math.PI * node2lat / 180;
    let lat1 = Math.PI * node1lat / 180;
    let lon2 = Math.PI * node2lon / 180;
    let lon1 = Math.PI * node1lon / 180;
    let term1 = Math.sin((lat2 - lat1) / 2) ** 2;
    let term2 = Math.cos(lat1) * Math.cos(lat2) * (Math.sin((lon2 - lon1) / 2) ** 2);
    return term1 + term2
}

function closestNode(latLng) {
    let closest = 0
    let closestDistance = nodeDistanceMetric(latLng.lat, latLng.lng, nodeLatLons[0][0], nodeLatLons[0][1]);
    for (let i = 1; i < nodeLatLons.length; i++) {
        const distance = nodeDistanceMetric(latLng.lat, latLng.lng, nodeLatLons[i][0], nodeLatLons[i][1]);
        if (distance < closestDistance) {
            closestDistance = distance;
            closest = i;
        }
    }
    return closest;
}

function showChart(){
    if (currentChart!=null){
        currentChart.destroy();
    }
    // Assemble elevations by patching together elevation data for each segment
    // Offset x value by tracking how far along path each segment goes
    let chartData = [];
    let offset = 0;
    for (const chartDataSegment of routeChartData){
        let maxEntry = 0;
        for (const entry of chartDataSegment){
            chartData.push({x: entry.x+offset, y: entry.y});
            maxEntry = Math.max(entry.x, maxEntry);
        }
        offset += maxEntry;
    }
    currentChart = new Chart(
        document.getElementById('elevation-graph'),
        {
            type: "line",
            data: {
                datasets: [{
                    data: chartData,
                    label: 'Elevation of journey',
                    pointRadius: 0
                }]
            },
            options: {
                legend: {display: true},
                scales: {
                    x: {
                        type: 'linear',
                        position: 'bottom',
                        title: {
                            display: true,
                            text: 'Distance from start (m)',
                            padding: 0,
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Height (m)',
                            padding: 0,
                        }
                    }
                },
                animation: {duration: 0}
            }
        }
    );
}

function connectToStartNode() {
    if (startNodeConnector != null) {
        startNodeConnector.remove(map);
    }
    if (startNodeMarker != null) {
        startNodeMarker.remove(map);
    }
    startNodeConnector = L.polyline(
        [routeMarkers[0].getLatLng(), nodeLatLons[routeNodes[0]]],
        {
            weight: 5,
            color: 'black',
            fill: true,
            fillColor: 'black',
            fillOpacity: 1,
            dashArray: [6],
            interactive: false
        }
    ).addTo(map);
    startNodeMarker = L.circleMarker(
        nodeLatLons[routeNodes[0]],
        {
            radius: 5,
            color: 'black',
            fill: true,
            fillColor: 'white',
            fillOpacity: 1,
            pane: "node-markers",
            interactive: false
        }
    ).addTo(map);
}

function connectToEndNode() {
    if (endNodeConnector != null) {
        endNodeConnector.remove(map);
    }
    if (endNodeMarker != null) {
        endNodeMarker.remove(map);
    }
    endNodeConnector = L.polyline(
        [routeMarkers[routeMarkers.length-1].getLatLng(), nodeLatLons[routeNodes[routeNodes.length-1]]],
        {
            weight: 5,
            color: 'black',
            fill: true,
            fillColor: 'black',
            fillOpacity: 1,
            dashArray: [6],
            interactive: false
        }
    ).addTo(map);
    endNodeMarker = L.circleMarker(nodeLatLons[routeNodes[routeNodes.length-1]],
        {
            radius: 5,
            color: 'black',
            fill: true,
            fillColor: 'white',
            fillOpacity: 1,
            pane: "node-markers",
            interactive: false
        }
    ).addTo(map);
}

function resetRoute(){
    for (let i = 1; i < routeMarkers.length - 1; i++){
        routeMarkers[i].remove(map);
    }
    routeNodes.splice(1, routeNodes.length-2);
    routeMarkers.splice(1, routeMarkers.length-2);
    routeNodeLatLons.splice(0, routeNodeLatLons.length-1);
    routeChartData.splice(0, routeChartData.length-1);
    routeTimes.splice(0, routeTimes.length-1);
    routeDistances.splice(0, routeDistances.length-1);
}


function setUrl(pushState=true){
    let urlObject = new URL(window.location.origin);
    const routeString = routeToString();
    urlObject.searchParams.append(
        "route",
        routeString
    );
    if (pushState){
        window.history.pushState(routeString, document.title, urlObject.toString());
    }
    return urlObject.toString();
}

function routeToString(){
    let routeString = "[";
    for (const routeMarker of routeMarkers){
        routeString += '[' + routeMarker.getLatLng().lat + ',' + routeMarker.getLatLng().lng + "],";
    }
    routeString = routeString.substring(0, routeString.length-1);
    routeString += ']';
    return routeString;
}

function setupPathData(a_star_data, routeLineIndex) {
    let chartData = [];
    let path = [];
    let assembledPath = [];

    for (let i = 0; i < a_star_data[2].length; i++) {
        path.push(nodeLatLons[a_star_data[2][i]]);
        chartData.push({ x: a_star_data[3][i], y: nodeElevations[a_star_data[2][i]] });
    }

    routeNodeLatLons[routeLineIndex] = path;
    routeChartData[routeLineIndex] = chartData;
    routeDistances[routeLineIndex] = a_star_data[0];
    routeTimes[routeLineIndex] = a_star_data[1];

    for (const routeNodeLatLonSegment of routeNodeLatLons) {
        assembledPath = assembledPath.concat(routeNodeLatLonSegment);
    }

    let totalDistance = routeDistances.reduce((a, b) => a + b, 0);
    let totalTime = routeTimes.reduce((a, b) => a + b, 0);
    if (routeLine != null) {
        routeLine.setLatLngs(assembledPath)
            .setPopupContent(`Distance: ${Math.round(totalDistance) / 1000}km, ` +
                `Time: ${secondsToString(totalTime)}` +
                "<canvas id='elevation-graph'></canvas>");
    }
    else {
        routeLine = L.polyline(assembledPath, {
            fillOpacity: 1,
        })
            .bindPopup(`Distance: ${Math.round(totalDistance) / 1000}km, ` +
                `Time: ${secondsToString(totalTime)}` +
                "<canvas id='elevation-graph'></canvas>", {
                autoPan: false
            })
            .on('click', showChart)
            .addTo(map);
    }
}

function setupStopData(routeLineIndex, stopPostion = null, interactive = true) {
    let chosenNode;
    if (stopPostion === null) {
        // Partitions the route line at routeLineIndex at around the middle
        let chosenNodeIndexInRouteLine = Math.floor(routeNodeLatLons[routeLineIndex].length / 2);
        chosenNode = closestNode(
            {
                lat: routeNodeLatLons[routeLineIndex][chosenNodeIndexInRouteLine][0],
                lng: routeNodeLatLons[routeLineIndex][chosenNodeIndexInRouteLine][1],
            });
    }
    else {
        chosenNode = closestNode({ lat: stopPostion[0], lng: stopPostion[1] });
    }
    let newNodeMarker = L.marker(
        nodeLatLons[chosenNode], {
            draggable: interactive,
            interactive: interactive,
        pane: "node-markers" // display marker above paths
    }).addTo(map);
    newNodeMarker._icon.classList.add("grey-marker");
    routeNodes.splice(routeLineIndex + 1, 0, chosenNode);
    routeMarkers.splice(routeLineIndex + 1, 0, newNodeMarker);
    routeNodeLatLons.splice(routeLineIndex + 1, 0, []);
    routeChartData.splice(routeLineIndex + 1, 0, []);
    routeTimes.splice(routeLineIndex + 1, 0, 0);
    routeDistances.splice(routeLineIndex + 1, 0, 0);
}

async function setupMap(interactive=true) {
    // Hide zoom control to allow for full control of ui
    map = L.map('map', { zoomControl: false });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);

    let outerRegionIds = await (await fetch("/api/get/region")).json();
    nodeLatLons = await (await fetch("/api/get/nodes")).json()
    nodeElevations = await (await fetch("/api/get/elevations")).json();


    let outerRegionLatLngs = outerRegionIds.map((index) => nodeLatLons[index]);

    map.createPane('node-markers');
    map.getPane('node-markers').style.zIndex = 401;
    map.createPane('region-colouring');
    map.getPane('region-colouring').style.zIndex = 399;

    // Creates rectangle covering entire map, except for a hole around region
    L.polygon([
        [[90, -180], [90, 180], [-90, 180], [-90, -180]], outerRegionLatLngs], {
        color: 'grey',
        fillOpacity: 0.3,
        pane: 'region-colouring',
        interactive: false
    }).addTo(map);

    let regionPolygon = L.polygon(outerRegionLatLngs);
    map = map.fitBounds(regionPolygon.getBounds());
    routeMarkers.push(L.marker(regionPolygon.getBounds().getCenter(), {
        interactive: interactive,
        draggable: interactive,
        autoPan: true,
        title: "Start"
    }).addTo(map));
    routeMarkers.push(L.marker(nodeLatLons[0], {
        interactive: interactive,
        draggable: interactive,
        autoPan: true,
        title: "Destination"
    }).addTo(map));
    routeMarkers[1]._icon.classList.add("red-marker");
    routeNodes.push(closestNode(routeMarkers[0].getLatLng()));
    routeNodes[1] = 0;
}