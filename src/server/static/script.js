let dijkstraFromStart;
let nodeLatLons;
let nodeElevations;
let suggestedRoutePolygon = null;
// used to connect user's markers to nodes used in calculations
let startNodeMarker;
let endNodeMarker;
let startNodeConnector;
let endNodeConnector;
let convexHullRegions = [];
let convexHullRegionsLatLons = [];
let currentIndicatedConvexHull;
let convexHullIndex = 0;
let walkSuggestionDistance = 5;
let gpsAccuracy = null;
let currentChart = null;


let routeMarkers = [];
let routeNodes = [];

// i'th route line connects i'th node to i+1'th node
let routeNodeLatLons = [];
let routeChartData = [];
let routeDistances = [];
let routeTimes = [];
let routeLine;


let settings;
let defaultSettings = {
    partitionDistance: 100,
    isochroneOpacity: 0.5,
    isochroneDelay: 0,
    findShortestPathsByTime: false
};

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


    while (routeNodes.length < route.length){
        await addStop(0, false);
    }
    for (let i = 0; i < route.length; i++){
        routeMarkers[i].setLatLng(route[i]);
    }

    connectToEndNode();
    connectToStartNode();
    for (let i = 0; i < route.length-1; i++){
        await applyRoute(i);
    }

}

function setUrl(){
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
    window.history.pushState(routeString, document.title, urlObject.toString());
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

async function addStop(routeLineIndex, adjustRoute=true){
    // Partitions the route line at routeLineIndex at around the middle
    let chosenNodeIndexInRouteLine = Math.floor(routeNodeLatLons[routeLineIndex].length/2);

    // Probably suffers from some performance hit rather than just tracking all 
    // node ids on routeLine
    let chosenNode = closestNode(
        {lat: routeNodeLatLons[routeLineIndex][chosenNodeIndexInRouteLine][0],
        lng: routeNodeLatLons[routeLineIndex][chosenNodeIndexInRouteLine][1],});
    
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

async function hideSettings() {
    document.getElementById('clickBlocker').style.width = '0%';
    document.getElementById('map').classList.remove('settingsHide')
    document.getElementById('main_controls').classList.remove('settingsHide')
    document.getElementById('settings').style.display = 'none';

    settings.isochroneDelay = parseInt(document.getElementById('isochroneDelay').value)
    settings.findShortestPathsByTime = document.getElementById('findShortestPathsByTimeCheckBox').checked;


    if (settings.partitionDistance !== parseInt(document.querySelector('input[name="partitionDistance"]:checked').value)) {
        // Must regenerate if changed partition distance and reindex
        settings.partitionDistance = parseInt(document.querySelector('input[name="partitionDistance"]:checked').value)
        settings.isochroneOpacity = parseFloat(document.getElementById('regionOpacity').value)
        await generateIsochrone()
        document.getElementById("convex_hull_slider").max = convexHullRegions.length - 1;
        document.getElementById("convex_hull_slider_text").max = (settings.partitionDistance * (convexHullRegions.length - 1)) / 1000;

        // Need to change steps of convex hull viewer too
        document.getElementById("convex_hull_slider_text").step = (settings.partitionDistance) / 1000;

        convexHullIndex = Math.min(convexHullRegions.length - 1, convexHullIndex)
        displayConvexHull();


    } else if (settings.isochroneOpacity !== parseFloat(document.getElementById('regionOpacity').value)) {
        settings.isochroneOpacity = parseFloat(document.getElementById('regionOpacity').value)

        // No need to reconsider reindexing region selection since same as before
        generateIsochrone()
    }
    sessionStorage.setItem("settings", JSON.stringify(settings))
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

        addStop(0, false);
        addStop(0, false);
        routeNodes[3] = routeNodes[0];
        connectToEndNode();
        routeMarkers[3].setLatLng(routeMarkers[0].getLatLng());
        routeMarkers[1].setLatLng(nodeLatLons[suggestedCycleObject[0]]);
        routeMarkers[2].setLatLng(nodeLatLons[suggestedCycleObject[1]]);
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

function displayConvexHull() {
    document.getElementById("convex_hull_slider_text").value = (convexHullIndex * settings.partitionDistance / 1000);
    document.getElementById("convex_hull_slider").value = convexHullIndex;

    if (currentIndicatedConvexHull != null) {
        currentIndicatedConvexHull.remove(map)
    }

    if (document.getElementById("convex_hull_slider_checkbox").checked === true) {
        currentIndicatedConvexHull = L.polygon(convexHullRegionsLatLons[convexHullIndex], {
            fillOpacity: 0,
            color: 'grey',
            interactive: false
        }).addTo(map);
    }
}

async function setDestinationSearchAddress() {
    document.getElementById('destination_search').value =
        await searchReverseGeocode(routeMarkers[routeMarkers.length - 1].getLatLng());
}
async function setStartSearchAddress() {
    document.getElementById('start_search').value =
        await searchReverseGeocode(routeMarkers[0].getLatLng());
}

async function fixEnd(){
    setDestinationSearchAddress();
    setUrl();
    await applyRoute(routeMarkers.length-2);
}
async function fixStart() {
    setStartSearchAddress();
    setUrl();
    await applyRoute(0);
    dijkstraFromStart = await dijkstraDetails(routeNodes[0]);
    await generateIsochrone();
    document.getElementById("convex_hull_slider").max = convexHullRegions.length - 1;
    document.getElementById("convex_hull_slider_text").max = (settings.partitionDistance * (convexHullRegions.length - 1)) / 1000;
    convexHullIndex = Math.min(convexHullRegions.length - 1, convexHullIndex)
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
document.getElementById('destination_show_checkbox').addEventListener(
    'change',
    (event) => {
        if (event.target.checked === true) {
            routeLine.addTo(map);
            routeLine.openPopup();
            showChart();
        } else {
            routeLine.remove(map);

        }
    }
)


document.getElementById('convex_hull_slider_box').addEventListener("change", displayConvexHull)
document.getElementById('convex_hull_slider').addEventListener("input", (event) => {
    convexHullIndex = event.target.value;
    displayConvexHull();
})


document.getElementById('walk_generator_slider').addEventListener("input", (event) => {
    walkSuggestionDistance = event.target.value;
    document.getElementById('walk_generator_slider_text').value = walkSuggestionDistance;
})
document.getElementById('walk_generator_slider_text').addEventListener("input", (event) => {
    walkSuggestionDistance = event.target.value;
    document.getElementById('walk_generator_slider').value = walkSuggestionDistance;
})

document.getElementById('convex_hull_slider_text').addEventListener("input", (event) => {
    convexHullIndex = event.target.value * 1000 / settings.partitionDistance;
    displayConvexHull();
})
document.getElementById('destination_search').addEventListener("keydown", async function(e) {
    if (e.code === "Enter") {
        let geo_code_data = await searchGeocode(e.target.value);
        if (geo_code_data == null) {
            e.target.value = "Search not found!";
        } else {
            e.target.value = geo_code_data[2];
            // Need to generate function here to prevent code repetition
            routeMarkers[routeMarkers.length-1].setLatLng([geo_code_data[0],
                geo_code_data[1]
            ]);
            await applyRoute(routeMarkers.length-2);
        }
    }
});
document.getElementById('start_search').addEventListener("keydown", async function(e) {
    if (e.code === "Enter") {
        let geo_code_data = await searchGeocode(e.target.value);
        if (geo_code_data == null) {
            e.target.value = "Search not found!";
        } else {
            e.target.value = geo_code_data[2];
            // Need to generate function here to prevent code repetition
            routeMarkers[0].setLatLng([geo_code_data[0],
                geo_code_data[1]
            ]);
            await fixStart();
        }
    }
});


function colorGradient(colorCount,
    startR = 0, startG = 255, startB = 0,
    endR = 255, endG = 0, endB = 0,
) {

    if (colorCount === 1) {
        // Zero division error occurs if colorCount is 1
        return [`rgb(${startR}, ${startG}, ${startB})`]
    }

    // Uses a linear colour gradient
    let colors = []

    let rDiff = (endR - startR) / (colorCount - 1);
    let gDiff = (endG - startG) / (colorCount - 1);
    let bDiff = (endB - startB) / (colorCount - 1);
    for (let i = 0; i < colorCount; i++) {
        let r = Math.round(startR + rDiff * i);
        let g = Math.round(startG + gDiff * i);
        let b = Math.round(startB + bDiff * i);

        colors.push(`rgb(${r}, ${g}, ${b})`)
    }
    return colors;


}

function scaled_haversine_node_distance(node1lat, node1lon, node2lat, node2lon) {
    // computes the haversine node distance up to what is required
    // for distance comparisons
    // no need to scale to earths radius, use arcsin or squareroot
    // since they are all increasing functions
    //const EARTH_RADIUS = 6_371_000;

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
    let closest_distance = scaled_haversine_node_distance(latLng.lat, latLng.lng, nodeLatLons[0][0], nodeLatLons[0][1]);

    for (let i = 1; i < nodeLatLons.length; i++) {
        let distance = scaled_haversine_node_distance(latLng.lat, latLng.lng, nodeLatLons[i][0], nodeLatLons[i][1]);
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


function secondsToString(seconds){
    if (seconds < 60){
        return `${Math.round(seconds)} seconds`;
    }
    else if (seconds < 3600){
        return `${Math.round(seconds/60)} minutes`
    }
    else{
        return `${Math.floor(seconds/3600)} hours, ${Math.round((seconds%3600)/60)} minutes`
    }
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


async function generateIsochrone() {
    const convex_hull_response = await fetch(`/api/get/convex/${routeNodes[0]}/${settings.partitionDistance}`);
    data = await convex_hull_response.json();

    for (let i = 0; i < convexHullRegions.length; i++) {
        convexHullRegions[i].remove(map);
    }
    convexHullRegions = []

    convexHullRegionsLatLons = [];
    let convex_hull_lat_lons = [];
    let prev_convex_hull_lat_lons;
    let colors = colorGradient(data.length);


    for (let i = 0; i < data[0].length; i++) {
        convex_hull_lat_lons.push(nodeLatLons[data[0][i]]);
    }
    convexHullRegionsLatLons.push(convex_hull_lat_lons)

    convexHullRegions.push(L.polygon(convex_hull_lat_lons, {
            fillColor: colors[0],
            opacity: 0,
            fillOpacity: settings.isochroneOpacity,
            pane: 'isochrone_colouring',
            interactive: false
        }).addTo(map)

    );
    prev_convex_hull_lat_lons = convex_hull_lat_lons
    for (let j = 1; j < data.length; j++) {
        convex_hull_lat_lons = []

        for (let i = 0; i < data[j].length; i++) {
            convex_hull_lat_lons.push(nodeLatLons[data[j][i]]);
        }

        convexHullRegionsLatLons.push(convex_hull_lat_lons)

        // setTimeout incurs enough delay that even with 0 ms not instant
        if (settings.isochroneDelay > 0) await new Promise(r => setTimeout(r, settings.isochroneDelay));

        convexHullRegions.push(L.polygon([convex_hull_lat_lons, prev_convex_hull_lat_lons],

            {
                fillColor: colors[j],
                opacity: 0,
                fillOpacity: settings.isochroneOpacity,
                pane: 'isochrone_colouring',
                interactive: false
            }).addTo(map));

        // uncomment to show only newly coloured region
        //convexHullRegions[convexHullRegions.length-2].remove(map);

        prev_convex_hull_lat_lons = convex_hull_lat_lons;
    }


}

async function initialise() {
    // fetch region, nodes and store
    const response = await fetch("/api/get/region");
    const nodeLatLonsResponse = await fetch("/api/get/nodes")

    let outerRegionIds = await response.json();

    // get the lat/lons of all nodes
    nodeLatLons = await nodeLatLonsResponse.json()
    nodeElevations = await (await fetch("/api/get/elevations")).json();

    if (sessionStorage.getItem("settings")) {
        settings = JSON.parse(sessionStorage.getItem("settings"));
    } else {
        // Clone default settings
        settings = {...defaultSettings};
    }

    // Apply all (default) settings to checkboxes/sliders/inputs
    document.getElementById("convex_hull_slider_checkbox").checked = false;
    document.getElementById("destination_show_checkbox").checked = true;
    // Set default value of suggested route to 5k
    document.getElementById("walk_generator_slider").value = 5;
    document.getElementById("walk_generator_slider_text").value = 5;

    // set slider to 0
    document.getElementById("convex_hull_slider").value = 0;
    document.getElementById("convex_hull_slider").value = 0;
    document.getElementById("convex_hull_slider_text").value = "0";



    let outerRegionLatLngs = outerRegionIds.map((index) => nodeLatLons[index])

    // Layers allow node markers to appear on top, isochrone colouring behind
    map.createPane('node_markers');
    map.getPane('node_markers').style.zIndex = 401;
    map.createPane('isochrone_colouring');
    map.getPane('isochrone_colouring').style.zIndex = 399;



    // Creates rectangle covering entire map, except for a hole around
    // region
    let holedPolygon = L.polygon([
        [
            [90, -180],
            [90, 180],
            [-90, 180],
            [-90, -180]
        ], outerRegionLatLngs
    ], {
        color: 'grey',
        fillOpacity: 0.3,
        pane: 'isochrone_colouring',
        interactive: false
    });
    holedPolygon.addTo(map);
    let regionPolygon = L.polygon(outerRegionLatLngs);




    map = map.fitBounds(regionPolygon.getBounds());
    
    routeMarkers.push(L.marker(regionPolygon.getBounds().getCenter(), {
        draggable: true,
        autoPan: true,
        title: "Start"
    }).addTo(map));



    routeMarkers.push(L.marker(nodeLatLons[0], {
        draggable: true,
        autoPan: true,
        title: "Destination"
    }).addTo(map));

    routeMarkers[routeMarkers.length-1]._icon.classList.add("redMarker");

    routeMarkers[0].bindPopup(`<button class='textButton' onClick='addStop(0);'>Add stop after</button>`);
    routeMarkers[routeMarkers.length-1].bindPopup(`<button class='textButton' onClick='addStop(routeMarkers.length-2);'>Add stop before</button>`);

    // Get all dijkstra information before setting up
    routeNodes.push(closestNode(routeMarkers[0].getLatLng()));
    routeNodes[1] = 0;

    dijkstraFromStart = await dijkstraDetails(routeNodes[0])
    dijkstraFromEnd = await dijkstraDetails(routeNodes[routeNodes.length-1]);
    applyRoute(0);
    await generateIsochrone();

    document.getElementById("convex_hull_slider").max = convexHullRegions.length - 1;
    document.getElementById("convex_hull_slider_text").max = (settings.partitionDistance * (convexHullRegions.length - 1)) / 1000;
    document.getElementById("convex_hull_slider_text").step = (settings.partitionDistance) / 1000;



    displayConvexHull();



    document.getElementById("destination_search").value = await searchReverseGeocode(routeMarkers[routeMarkers.length-1].getLatLng());
    document.getElementById("start_search").value = await searchReverseGeocode(routeMarkers[0].getLatLng());


    routeMarkers[0].on('drag', function(){
        routeNodes[0] = closestNode(routeMarkers[0].getLatLng());
        connectToStartNode();
    });

    routeMarkers[routeMarkers.length-1].on('drag', function(){
        routeNodes[routeNodes.length-1] = closestNode(routeMarkers[routeMarkers.length-1].getLatLng());
        connectToEndNode();
    });

    // Ensure finalised route is correct once dragging ends
    routeMarkers[0].on('dragend', fixStart);
    routeMarkers[routeMarkers.length-1].on('dragend', fixEnd);

    addEventListener("popstate", (event) => {loadRouteUrl(event.state)});
    let currentURL = new URL(window.location.href);
    loadRouteUrl(currentURL.searchParams.get("route"));
}

initialise();
