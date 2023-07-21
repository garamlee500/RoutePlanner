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
    for (let i = 0; i < route.length-1; i++){
        await applyRoute(i);
    }

}

function copyUrlToClipboard(){
    navigator.clipboard.writeText(setUrl(false));
    document.getElementById("routeLinkCopier").textContent = "Copied to clipboard!";
    setTimeout(function(){
            document.getElementById("routeLinkCopier").textContent = "Share route";
    },
        500);
}

function setUrl(pushState=true){
    let urlObject = new URL(window.location.origin);
    let routeString = "[";
    for (const routeMarker of routeMarkers){
        routeString += '[' + routeMarker.getLatLng().lat + ',' + routeMarker.getLatLng().lng + "],";
    }
    routeString = routeString.substring(0, routeString.length-1);
    routeString += ']';
    urlObject.searchParams.append(
        "route",
        routeString
    );
    if (pushState){
        window.history.pushState(routeString, document.title, urlObject.toString());
    }
    return urlObject.toString();
}

async function deleteStop(stopIndex){
    routeMarkers[stopIndex].remove(map);
    routeMarkers.splice(stopIndex, 1);
    routeNodeLatLons.splice(stopIndex, 1);
    routeChartData.splice(stopIndex, 1);
    routeTimes.splice(stopIndex, 1);
    routeDistances.splice(stopIndex, 1);

    for (let i = stopIndex; i < routeMarkers.length - 1; i++){
        routeMarkers[i].off();
        routeMarkers[i].on("dragend", async function(){
            routeMarkers[i].setLatLng(nodeLatLons[closestNode(routeMarkers[i].getLatLng())]);
            await applyRoute(i-1);
            await applyRoute(i)});

            
        routeMarkers[i].bindPopup(`<button class='textButton' onClick='addStop(${i-1});'>Add stop before</button>
                            <button class='textButton' onClick='addStop(${i});'>Add stop after</button>
                            <button class='textButton redOnlyButton' onClick='deleteStop(${i});'>Delete stop</button>`);
        // Rebind popup click event listener - erased by routeMarkers[i].off();
        routeMarkers[i].on("click", function(){routeMarkers[i].openPopup();});
        routeMarkers[i].on("dragend", function(){setUrl();});
    }
    setUrl();
    await applyRoute(stopIndex-1);
}

async function addStop(routeLineIndex, adjustRoute=true, stopPostion=null){
    let chosenNode;
    if (stopPostion===null) {
        // Partitions the route line at routeLineIndex at around the middle
        let chosenNodeIndexInRouteLine = Math.floor(routeNodeLatLons[routeLineIndex].length / 2);

        // Probably suffers from some performance hit rather than just tracking all
        // node ids on routeLine
        chosenNode = closestNode(
            {
                lat: routeNodeLatLons[routeLineIndex][chosenNodeIndexInRouteLine][0],
                lng: routeNodeLatLons[routeLineIndex][chosenNodeIndexInRouteLine][1],
            });
    }
    else{
        chosenNode = closestNode({lat: stopPostion[0], lng: stopPostion[1]});
    }

    routeNodes.splice(routeLineIndex+1, 0, chosenNode);
    let newNodeMarker =  L.marker(
        nodeLatLons[chosenNode], {
            draggable: true,
            pane: "node_markers" // display marker above paths
        }).addTo(map);
    newNodeMarker._icon.classList.add("grayMarker");
    newNodeMarker.on("dragend", async function(){
        newNodeMarker.setLatLng(nodeLatLons[closestNode(newNodeMarker.getLatLng())]);
        await applyRoute(routeLineIndex);
        await applyRoute(routeLineIndex+1)});

    newNodeMarker.bindPopup(`<button class='textButton' onClick='addStop(${routeLineIndex});'>Add stop before</button>
                            <button class='textButton' onClick='addStop(${routeLineIndex+1});'>Add stop after</button>
                            <button class='textButton redOnlyButton' onClick='deleteStop(${routeLineIndex+1});'>Delete stop</button>`);
    newNodeMarker.on("dragend", function(){setUrl();});

    routeMarkers.splice(routeLineIndex+1, 0, newNodeMarker);
    routeNodeLatLons.splice(routeLineIndex+1, 0, []);
    routeChartData.splice(routeLineIndex+1, 0, []);
    routeTimes.splice(routeLineIndex+1, 0, 0);
    routeDistances.splice(routeLineIndex+1, 0, 0);

    for (let i = routeLineIndex+2; i < routeMarkers.length - 1; i++){
        routeMarkers[i].off();
        routeMarkers[i].on("dragend", async function(){
            routeMarkers[i].setLatLng(nodeLatLons[closestNode(routeMarkers[i].getLatLng())]);
            await applyRoute(i-1);
            await applyRoute(i)});

        routeMarkers[i].bindPopup(`<button class='textButton' onClick='addStop(${i-1});'>Add stop before</button>
                                <button class='textButton' onClick='addStop(${i});'>Add stop after</button>
                                <button class='textButton redOnlyButton' onClick='deleteStop(${i});'>Delete stop</button>`);
        // Rebind popup click event listener - erased by routeMarkers[i].off();
        routeMarkers[i].on("click", function(){routeMarkers[i].openPopup();});
        routeMarkers[i].on("dragend", function(){setUrl();});
    }

    if (adjustRoute) {
        setUrl();
        await applyRoute(routeLineIndex);
        await applyRoute(routeLineIndex + 1);
    }
}



function centreMap() {
    map.fitBounds([
        routeMarkers[0].getLatLng(),
        routeMarkers[routeMarkers.length-1].getLatLng()
    ]);

}



function getStartGPSLocation() {
    try {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(setStartGPSLocation);
        } else {
            alert("This browser does not support geolocation.")
        }
    } catch (error) {
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


async function suggestRoute(useEndNode = false) {
    // Set generate button to red and prevent clicks
    let buttonElement = document.getElementById("route_suggestor_button");
    buttonElement.disabled = true;
    buttonElement.textContent = "Generating...";
    buttonElement.classList.add("redOnlyButton");

    let suggestedCycle = await fetch(`api/get/cycle/${routeNodes[0]}/${walkSuggestionDistance * 1000}`);
    let suggestedCycleObject = await suggestedCycle.json();


    if (suggestedCycleObject[0] === suggestedCycleObject[1]) {
        // Failed to find cycle if second node = third node
        alert("Failed to generate walk. Ensure the walk distance input is suitable.")

    } else {


        resetRoute();

        addStop(0, false, nodeLatLons[suggestedCycleObject[0]]);
        addStop(0, false, nodeLatLons[suggestedCycleObject[1]]);
        routeNodes[3] = routeNodes[0];
        connectToEndNode();
        routeMarkers[3].setLatLng(routeMarkers[0].getLatLng());
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
    let data =
        await (await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latLon.lat}&lon=${latLon.lng}&format=json`)).json();
    return data["display_name"];
}

async function searchGeocode(query) {


    // Make sure url is created safely since can be arbitrarily set
    // e.g. special characters such as & or ?
    let requestURL = new URL("https://nominatim.openstreetmap.org/search?format=json");
    requestURL.searchParams.append('q', query);
    let data = await (await fetch(requestURL)).json();
    if (data.length > 0) {

        // Everyone needs to get together and decide whether its lon or lng
        return [parseFloat(data[0]["lat"]),
            parseFloat(data[0]["lon"]),
            data[0]["display_name"]
        ]
    }
    return null;

}





function closestNode(latLng) {
    let closest = 0
    let closest_distance = nodeDistanceMetric(latLng.lat, latLng.lng, nodeLatLons[0][0], nodeLatLons[0][1]);

    for (let i = 1; i < nodeLatLons.length; i++) {
        let distance = nodeDistanceMetric(latLng.lat, latLng.lng, nodeLatLons[i][0], nodeLatLons[i][1]);
        if (distance < closest_distance) {
            closest_distance = distance;
            closest = i;
        }
    }
    return closest;
}

async function dijkstraDetails(node) {
    const response = await fetch(`/api/get/dijkstra/${node}`);
    return await response.json();
}

function connectToStartNode() {
    if (startNodeConnector != null) {
        startNodeConnector.remove(map);
    }
    if (startNodeMarker != null) {
        startNodeMarker.remove(map);
    }

    startNodeConnector = L.polyline(
        [routeMarkers[0].getLatLng(),
            nodeLatLons[routeNodes[0]]
        ], {
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
        nodeLatLons[routeNodes[0]], {
            radius: 5,
            color: 'black',
            fill: true,
            fillColor: 'white',
            fillOpacity: 1,
            pane: "node_markers", // display marker above paths
            interactive: false
        }).addTo(map);
}

function connectToEndNode() {
    if (endNodeConnector != null) {
        endNodeConnector.remove(map);
    }
    if (endNodeMarker != null) {
        endNodeMarker.remove(map);
    }

    endNodeConnector = L.polyline(
        [routeMarkers[routeMarkers.length-1].getLatLng(),
            nodeLatLons[routeNodes[routeNodes.length-1]]
        ], {
            weight: 5,
            color: 'black',
            fill: true,
            fillColor: 'black',
            fillOpacity: 1,
            dashArray: [6],
            interactive: false

        }

    ).addTo(map);

    endNodeMarker = L.circleMarker(
        nodeLatLons[routeNodes[routeNodes.length-1]],

        {
            radius: 5,
            color: 'black',
            fill: true,
            fillColor: 'white',
            fillOpacity: 1,
            pane: "node_markers",
            interactive: false
        }).addTo(map);
}



async function applyRoute(routeLineIndex) {
    // Connects node at routeLineIndex to node at routeLineIndex + 1

    routeNodes[routeLineIndex] = closestNode(routeMarkers[routeLineIndex].getLatLng());
    routeNodes[routeLineIndex+1] = closestNode(routeMarkers[routeLineIndex+1].getLatLng());

    // Redraw route from start
    let path = [];


    let a_star_data;
    if (settings.findShortestPathsByTime){
        a_star_data = await(await fetch(`api/get/a_star_time/${routeNodes[routeLineIndex]}/${routeNodes[routeLineIndex+1]}`)).json();
    }
    else{
        a_star_data = await(await fetch(`api/get/a_star_distance/${routeNodes[routeLineIndex]}/${routeNodes[routeLineIndex+1]}`)).json();
    }

    let chartData = [];


    for (let i = 0; i < a_star_data[2].length; i++){
        path.push(nodeLatLons[a_star_data[2][i]]);
        chartData.push({x: a_star_data[3][i],
            y: nodeElevations[a_star_data[2][i]]})
    }

    routeNodeLatLons[routeLineIndex] = path;
    routeChartData[routeLineIndex] = chartData;

    let assembledPath = [];

    for (const routeNodeLatLonSegment of routeNodeLatLons){
        assembledPath = assembledPath.concat(routeNodeLatLonSegment);
    }

    routeDistances[routeLineIndex] = a_star_data[0];
    routeTimes[routeLineIndex] = a_star_data[1];

    let totalDistance = routeDistances.reduce((a, b) => a + b, 0);
    let totalTime = routeTimes.reduce((a, b) => a + b, 0);

    if (routeLine != null) {
        routeLine.setLatLngs(assembledPath);
        routeLine.setPopupContent(`Distance: ${Math.round(totalDistance) / 1000}km, `+
            `Time: ${secondsToString(totalTime)}` +
            "<canvas id=\"elevationGraph\"></canvas>");
    }
    else{
        routeLine = L.polyline(assembledPath, {
            fillOpacity: 1,
        }).bindPopup(`Distance: ${Math.round(totalDistance) / 1000}km, `+
            `Time: ${secondsToString(totalTime)}` +
            "<canvas id=\"elevationGraph\"></canvas>", {
            autoPan: false
        }).on('click', showChart);

    }

    // Don't draw route if not needed - but get everything else ready for when it is checked
    if (document.getElementById('destination_show_checkbox').checked === true) {
        routeLine.addTo(map);
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
                legend: {
                    display: true,
                    labels: {
                    }
                },
        
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
                animation: {
                    duration: 0
                }
            }

        }
    );
}






