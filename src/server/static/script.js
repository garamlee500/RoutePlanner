async function saveRoute(){
    document.getElementById('route_saver').textContent="Saving!";
    document.getElementById('route_saver').disabled=true;
    await fetch("/api/post/route", {
            method: "POST",
            body: JSON.stringify({
                route: routeToString(),
                route_name: document.getElementById('route_name').value
            }),
            headers: {
                "Content-type": "application/json; charset=UTF-8"
            }
        }
    );
    document.getElementById('route_saver').textContent="Saved!";
    setTimeout(function(){
            document.getElementById("route_saver").textContent = "Save route";
            document.getElementById("route_saver").disabled = false;
    }, 500);
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


async function loadRouteUrl(routeString){
    if (routeString === null || routeString === ''){
        return;
    }
    let route = JSON.parse(routeString);
    resetRoute();

    routeMarkers[0].setLatLng(route[0]);
    for (let i = route.length - 2; i > 0; i--){
        await addStop(0, false, route[i]);
    }
    routeMarkers[routeMarkers.length-1].setLatLng(route[route.length-1]);
    connectToEndNode();
    connectToStartNode();
    setDestinationSearchAddress();
    setStartSearchAddress();
    for (let i = 0; i < route.length-1; i++){
        await applyRoute(i);
    }
}

async function copyUrlToClipboard(){
    await navigator.clipboard.writeText(setUrl(false));
    document.getElementById("routeLinkCopier").textContent = "Copied to clipboard!";
    setTimeout(function(){
            document.getElementById("routeLinkCopier").textContent = "Share route";
    }, 500);
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

function rebindStopEventListeners(stopIndex){
    routeMarkers[stopIndex].off();
    routeMarkers[stopIndex].on("dragend", async function(){
        routeMarkers[stopIndex].setLatLng(nodeLatLons[closestNode(routeMarkers[stopIndex].getLatLng())]);
        await applyRoute(stopIndex-1);
        await applyRoute(stopIndex)
    });
    routeMarkers[stopIndex].bindPopup(
        `<button class='textButton' onClick='addStop(${stopIndex-1});'>Add stop before</button>
        <button class='textButton' onClick='addStop(${stopIndex});'>Add stop after</button>
        <button class='textButton redOnlyButton' onClick='deleteStop(${stopIndex});'>Delete stop</button>`);
    // Rebind popup/drag event listeners - erased by routeMarkers[stopIndex].off();
    routeMarkers[stopIndex].on("click", function(){routeMarkers[stopIndex].openPopup();});
    routeMarkers[stopIndex].on("dragend", function(){setUrl();});
}

async function deleteStop(stopIndex){
    routeMarkers[stopIndex].remove(map);
    routeMarkers.splice(stopIndex, 1);
    routeNodeLatLons.splice(stopIndex, 1);
    routeChartData.splice(stopIndex, 1);
    routeTimes.splice(stopIndex, 1);
    routeDistances.splice(stopIndex, 1);
    for (let i = stopIndex; i < routeMarkers.length - 1; i++){
        rebindStopEventListeners(i);
    }
    setUrl();
    await applyRoute(stopIndex-1);
}

async function addStop(routeLineIndex, adjustRoute=true, stopPostion=null){
    let chosenNode;
    if (stopPostion===null) {
        // Partitions the route line at routeLineIndex at around the middle
        let chosenNodeIndexInRouteLine = Math.floor(routeNodeLatLons[routeLineIndex].length / 2);
        chosenNode = closestNode(
            {
                lat: routeNodeLatLons[routeLineIndex][chosenNodeIndexInRouteLine][0],
                lng: routeNodeLatLons[routeLineIndex][chosenNodeIndexInRouteLine][1],
            });
    }
    else{
        chosenNode = closestNode({lat: stopPostion[0], lng: stopPostion[1]});
    }
    let newNodeMarker =  L.marker(
        nodeLatLons[chosenNode], {
            draggable: true,
            pane: "node_markers" // display marker above paths
        }).addTo(map);
    newNodeMarker._icon.classList.add("grayMarker");
    routeNodes.splice(routeLineIndex+1, 0, chosenNode);
    routeMarkers.splice(routeLineIndex+1, 0, newNodeMarker);
    routeNodeLatLons.splice(routeLineIndex+1, 0, []);
    routeChartData.splice(routeLineIndex+1, 0, []);
    routeTimes.splice(routeLineIndex+1, 0, 0);
    routeDistances.splice(routeLineIndex+1, 0, 0);
    for (let i = routeLineIndex+1; i < routeMarkers.length - 1; i++){
        rebindStopEventListeners(i);
    }
    if (adjustRoute) {
        setUrl();
        await applyRoute(routeLineIndex);
        await applyRoute(routeLineIndex + 1);
    }
}

function centreMap() {
    map.fitBounds([routeMarkers[0].getLatLng(), routeMarkers[routeMarkers.length-1].getLatLng()]);
}

function getStartGPSLocation() {
    try {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(setStartGPSLocation);
        } else {
            alert("This browser does not support geolocation.")
        }
    }
    catch (error) {
        alert("Browser did not respond with location. Please check you have set location permissions properly for this website.")
    }
}

function setStartGPSLocation(position) {
    routeMarkers[0].setLatLng([position.coords.latitude,
        position.coords.longitude
    ]);
    gpsAccuracy = position.coords.accuracy;
    fixStart();
}

async function suggestRoute() {
    // Set generate button to red and prevent clicks
    let buttonElement = document.getElementById("route_suggestor_button");
    buttonElement.disabled = true;
    buttonElement.textContent = "Generating...";
    buttonElement.classList.add("redOnlyButton");

    let suggestedCycleObject = await (
        await fetch(`api/get/cycle/${routeNodes[0]}/${walkSuggestionDistance * 1000}`)
    ).json();

    if (suggestedCycleObject[0] === suggestedCycleObject[1]) {
        // Failed to find cycle if duplicate nodes
        alert("Failed to generate walk. Ensure the walk distance input is suitable.")
    }
    else {
        resetRoute();
        addStop(0, false, nodeLatLons[suggestedCycleObject[1]]);
        addStop(0, false, nodeLatLons[suggestedCycleObject[0]]);
        routeNodes[3] = routeNodes[0];
        routeMarkers[3].setLatLng(routeMarkers[0].getLatLng());
        connectToEndNode();
        setUrl();
        await applyRoute(0);
        await applyRoute(1);
        await fixEnd();
    }

    // Reactivate generate route button
    buttonElement.textContent = "Generate Route";
    buttonElement.disabled = false;
    buttonElement.classList.remove("redOnlyButton");
}

async function setDestinationSearchAddress() {
    document.getElementById('destination_search').value =
        await searchReverseGeocode(routeMarkers[routeMarkers.length - 1].getLatLng());
}
async function setStartSearchAddress() {
    document.getElementById('start_search').value =
        await searchReverseGeocode(routeMarkers[0].getLatLng());
}

async function fixEnd(updateSearchAddress=true){
    if (updateSearchAddress) setDestinationSearchAddress();
    setUrl();
    await applyRoute(routeMarkers.length-2);
}
async function fixStart(updateSearchAddress=true) {
    if(updateSearchAddress) setStartSearchAddress();
    setUrl();
    await applyRoute(0);
    dijkstraFromStart = await dijkstraDetails(routeNodes[0]);
    await generateIsochrone();
    setupConvexHullInputs();
    displayConvexHull();
}

async function searchReverseGeocode(latLon) {
    const data =
        await (await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latLon.lat}&lon=${latLon.lng}&format=json`)).json();
    return data["display_name"];
}

async function searchGeocode(query) {
    // Make sure url is created safely since can be arbitrarily set
    // e.g. special characters such as & or ? - although nothing malicious is likely
    // could probably mess with stuff
    let requestURL = new URL("https://nominatim.openstreetmap.org/search?format=json");
    requestURL.searchParams.append('q', query);
    const data = await (await fetch(requestURL)).json();
    if (data.length > 0) {
        return [parseFloat(data[0]["lat"]), parseFloat(data[0]["lon"]), data[0]["display_name"]];
    }
    return null;
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

async function dijkstraDetails(node) {
    return await (await fetch(`/api/get/dijkstra/${node}`)).json();
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
            pane: "node_markers",
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
            pane: "node_markers",
            interactive: false
        }
    ).addTo(map);
}

async function applyRoute(routeLineIndex) {
    // Connects node at routeLineIndex to node at routeLineIndex + 1
    routeNodes[routeLineIndex] = closestNode(routeMarkers[routeLineIndex].getLatLng());
    routeNodes[routeLineIndex+1] = closestNode(routeMarkers[routeLineIndex+1].getLatLng());

    let chartData = [];
    let path = [];
    let assembledPath = [];
    let a_star_data;

    if (settings.findShortestPathsByTime){
        a_star_data = await(await fetch(`api/get/a_star_time/${routeNodes[routeLineIndex]}/${routeNodes[routeLineIndex+1]}`)).json();
    }
    else{
        a_star_data = await(await fetch(`api/get/a_star_distance/${routeNodes[routeLineIndex]}/${routeNodes[routeLineIndex+1]}`)).json();
    }

    for (let i = 0; i < a_star_data[2].length; i++){
        path.push(nodeLatLons[a_star_data[2][i]]);
        chartData.push({x: a_star_data[3][i], y: nodeElevations[a_star_data[2][i]]});
    }

    routeNodeLatLons[routeLineIndex] = path;
    routeChartData[routeLineIndex] = chartData;
    routeDistances[routeLineIndex] = a_star_data[0];
    routeTimes[routeLineIndex] = a_star_data[1];

    for (const routeNodeLatLonSegment of routeNodeLatLons){
        assembledPath = assembledPath.concat(routeNodeLatLonSegment);
    }

    let totalDistance = routeDistances.reduce((a, b) => a + b, 0);
    let totalTime = routeTimes.reduce((a, b) => a + b, 0);
    if (routeLine != null) {
        routeLine.setLatLngs(assembledPath)
        .setPopupContent(`Distance: ${Math.round(totalDistance) / 1000}km, `+
            `Time: ${secondsToString(totalTime)}` +
            "<canvas id='elevationGraph'></canvas>");
    }
    else{
        routeLine = L.polyline(assembledPath, {
            fillOpacity: 1,
        })
        .bindPopup(`Distance: ${Math.round(totalDistance) / 1000}km, `+
            `Time: ${secondsToString(totalTime)}` +
            "<canvas id='elevationGraph'></canvas>", {
            autoPan: false
        })
        .on('click', showChart)
        .addTo(map);
    }

    if (document.getElementById('destination_show_checkbox').checked === true) {
        routeLine.openPopup();
        showChart();
    }
    connectToStartNode();
    connectToEndNode();
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
        document.getElementById('elevationGraph'),
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
