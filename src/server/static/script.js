async function saveRoute(){
    document.getElementById('route-saver').textContent="Saving!";
    document.getElementById('route-saver').disabled=true;
    await fetch("/api/post/route", {
            method: "POST",
            body: JSON.stringify({
                route: routeToString(),
                route_name: document.getElementById('route-name').value
            }),
            headers: {
                "Content-type": "application/json; charset=UTF-8"
            }
        }
    );
    document.getElementById('route-saver').textContent="Saved!";
    setTimeout(function(){
            document.getElementById("route-saver").textContent = "Save route";
            document.getElementById("route-saver").disabled = false;
    }, 500);
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

async function saveShareRoute(){
    document.getElementById('route-link-copier').textContent="Saving!";
    document.getElementById('route-link-copier').disabled=true;
    const response = await fetch("/api/post/route", {
            method: "POST",
            body: JSON.stringify({
                route: routeToString(),
                route_name: document.getElementById('route-name').value
            }),
            headers: {
                "Content-type": "application/json; charset=UTF-8"
            }
        }
    );
    const route_id = (await response.json())["route_id"];
    await fetch("/api/post/public_route", {
                        method: "POST",
                        body: JSON.stringify({
                            route_id: route_id,
                            is_public: true
                        }),
                        headers: {
                            "Content-type": "application/json; charset=UTF-8"
                        }
                    }
                );
    await navigator.clipboard.writeText(window.location.origin + '/view/' + route_id.toString());
    document.getElementById('route-link-copier').textContent="Link copied to clipboard!";
    setTimeout(function(){
            document.getElementById("route-link-copier").textContent = "Save + share route";
            document.getElementById("route-link-copier").disabled = false;
    }, 500);
}



function rebindStopEventListeners(stopIndex){
    routeMarkers[stopIndex].off();
    routeMarkers[stopIndex].on("dragend", async function(){
        routeMarkers[stopIndex].setLatLng(nodeLatLons[closestNode(routeMarkers[stopIndex].getLatLng())]);
        await applyRoute(stopIndex-1);
        await applyRoute(stopIndex)
    });
    routeMarkers[stopIndex].bindPopup(
        `<button class='text-button' onClick='addStop(${stopIndex - 1});'>Add stop before</button>
        <button class='text-button' onClick='addStop(${stopIndex});'>Add stop after</button>
        <button class='text-button red-only-button' onClick='deleteStop(${stopIndex});'>Delete stop</button>`);
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
            pane: "node-markers" // display marker above paths
        }).addTo(map);
    newNodeMarker._icon.classList.add("grey-marker");
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
    let buttonElement = document.getElementById("route-suggestor-button");
    buttonElement.disabled = true;
    buttonElement.textContent = "Generating...";
    buttonElement.classList.add("red-only-button");

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
    buttonElement.classList.remove("red-only-button");
}

async function setDestinationSearchAddress() {
    document.getElementById('destination-search').value =
        await searchReverseGeocode(routeMarkers[routeMarkers.length - 1].getLatLng());
}
async function setStartSearchAddress() {
    document.getElementById('start-search').value =
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


async function dijkstraDetails(node) {
    return await (await fetch(`/api/get/dijkstra/${node}`)).json();
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
        a_star_data = await(await fetch(`/api/get/a_star_time/${routeNodes[routeLineIndex]}/${routeNodes[routeLineIndex+1]}`)).json();
    }
    else{
        a_star_data = await(await fetch(`/api/get/a_star_distance/${routeNodes[routeLineIndex]}/${routeNodes[routeLineIndex+1]}`)).json();
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
            "<canvas id='elevation-graph'></canvas>");
    }
    else{
        routeLine = L.polyline(assembledPath, {
            fillOpacity: 1,
        })
        .bindPopup(`Distance: ${Math.round(totalDistance) / 1000}km, `+
            `Time: ${secondsToString(totalTime)}` +
            "<canvas id='elevation-graph'></canvas>", {
            autoPan: false
        })
        .on('click', showChart)
        .addTo(map);
    }

    if (document.getElementById('destination-show-checkbox').checked === true) {
        routeLine.openPopup();
        showChart();
    }
    connectToStartNode();
    connectToEndNode();
}

