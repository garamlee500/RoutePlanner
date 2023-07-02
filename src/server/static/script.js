let startNode;
let endNode;
let dijkstraFromStart;
let nodeLatLons;
let nodeElevations;
let routeLine = null;
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
let currentChartData;


let routeMarkers = [];
let routeNodes = [];

// i'th route line connects i'th node to i+1'th node
let routeLines = [];


let settings;
let defaultSettings = {
    partitionDistance: 100,
    isochroneOpacity: 0.5,
    isochroneDelay: 0,
    findShortestPathsByTime: false
};

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
    //map.dragging.disable()
    //map.doubleClickZoom.disable()
    //map.scrollWheelZoom.disable()
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

function generateCycleWithDestination(targetLength,
    distanceTolerance = 0.05,
    overlapTolerance = 0.05,
    maxTries = 2 << 25) {
    // We are talking approximately 20-30 ms to run this in javascript
    // while c++ takes about 10 ms for the same call
    // While javascript is slower (even throttling for wifi), javascript has the advantage
    // of loosening server load, while the slowdown is unnoticeable for consumers,
    // additionally has required dijkstra cached without need for lookup
    // and no need to convert to json string when sending data
    let possibleNodes = [];
    for (let node = 0; node < nodeLatLons.length; node++) {
        if (dijkstraFromStart[0][node] + dijkstraFromEnd[0][node] + dijkstraFromStart[0][endNode] > targetLength * 0.75 &&
            dijkstraFromStart[0][node] + dijkstraFromEnd[0][node] + dijkstraFromStart[0][endNode] < targetLength * 1.5) {
            possibleNodes.push(node);
        }
    }
    if (possibleNodes.length < 2) {
        return [0, []];
    }
    for (let i = 0; i < maxTries; i++) {
        let node = possibleNodes[Math.floor(Math.random() * possibleNodes.length)];
        if (Math.abs(dijkstraFromStart[0][node] + dijkstraFromEnd[0][node] + dijkstraFromStart[0][endNode] - targetLength) / targetLength < distanceTolerance) {
            // Valid cycle found
            // Return distance and path

            let totalPath = [];
            // 1 duplicate is erroneously placed by selected node
            let duplicateCount = -1;
            let usedNodes = new Set();

            let currentPathNode = node;
            // start -> node excluding start
            while (currentPathNode !== startNode) {
                totalPath.push(currentPathNode);
                currentPathNode = dijkstraFromStart[1][currentPathNode];
                if (usedNodes.has(currentPathNode)) {
                    duplicateCount++;
                } else {
                    usedNodes.add(currentPathNode);
                }
            }

            totalPath.reverse();

            // Remove extra entry of selected node
            totalPath.pop();
            // node -> endNode excluding endNode
            currentPathNode = node;
            while (currentPathNode !== endNode) {
                totalPath.push(currentPathNode);
                currentPathNode = dijkstraFromEnd[1][currentPathNode];
                if (usedNodes.has(currentPathNode)) {
                    duplicateCount++;
                } else {
                    usedNodes.add(currentPathNode);
                }
            }

            // endNode -> startNode excluding startNode
            currentPathNode = endNode;
            while (currentPathNode !== startNode) {
                totalPath.push(currentPathNode);
                currentPathNode = dijkstraFromStart[1][currentPathNode];
                if (usedNodes.has(currentPathNode)) {
                    duplicateCount++;
                } else {
                    usedNodes.add(currentPathNode);
                }
            }
            // Add missing entry of startNode
            totalPath.push(startNode);

            if (duplicateCount / totalPath.length < overlapTolerance) {
                return [dijkstraFromStart[0][node] + dijkstraFromEnd[0][node] + dijkstraFromStart[0][endNode],
                    totalPath
                ];
            }
            overlapTolerance *= 1.1;

        } else {
            distanceTolerance *= 1.1;
        }
    }
    return [0, []];
}
async function suggestRoute(useEndNode = false) {
    // Set generate button to red and prevent clicks
    let buttonElement = document.getElementById("route_suggestor_button");
    buttonElement.disabled = true;
    buttonElement.textContent = "Generating...";
    buttonElement.classList.add("redOnlyButton");
    // Ask for a suggested cycle and parse to get lat lons
    let suggestedCycleObject;
    if (false){
    //if (document.getElementById("include_destination_in_cycle_checkbox").checked === true) {
        //suggestedCycle = await fetch(`api/get/fixed_cycle/${startNode}/${endNode}/${walkSuggestionDistance * 1000}`);
        try {
            suggestedCycleObject = generateCycleWithDestination(walkSuggestionDistance * 1000);
        } catch {
            // When website is not fully loaded yet
            suggestedCycleObject = [0, []];
        }
    } else {
        let suggestedCycle = await fetch(`api/get/cycle/${startNode}/${walkSuggestionDistance * 1000}`);
        suggestedCycleObject = await suggestedCycle.json();

    }
    let suggestedCycleNodeLatLons = (suggestedCycleObject)[1].map(x => nodeLatLons[x]);

    // Remove previous route polygon if present on map
    if (suggestedRoutePolygon !== null) {
        suggestedRoutePolygon.remove(map);
    }
    suggestedRoutePolygon = L.polygon(suggestedCycleNodeLatLons, {
        fillOpacity: 0
    }).addTo(map);

    if (suggestedCycleObject[0] === 0) {
        // Failed to find cycle if distance is 0
        document.getElementById("generated_walk_info").textContent =
            `Failed to generate walk. Ensure the walk distance input is suitable.`

    } else {
        // Succesful cycle generation - add message with actual distance
        document.getElementById("generated_walk_info").textContent =
            `Generated walk length is ${Math.round(suggestedCycleObject[0]) / 1000}km long.`
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
    await applyRoute();
}
async function fixStart() {
    setStartSearchAddress();
    await applyRoute();
    dijkstraFromStart = await dijkstraDetails(startNode);
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
            await applyRoute();
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
        // Pad zeroes on left if needed so that each
        // colour used 2 hexadecimal digits
        //colors.push('#'+
        //r.toString(16).padStart(2, '0')+
        //g.toString(16).padStart(2, '0')+
        //b.toString(16).padStart(2, '0'))

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
            [nodeLatLons[startNode][0],
                nodeLatLons[startNode][1]
            ]
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
        [nodeLatLons[startNode][0],
            nodeLatLons[startNode][1]
        ], {
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
            [nodeLatLons[endNode][0],
                nodeLatLons[endNode][1]
            ]
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
        [nodeLatLons[endNode][0],
            nodeLatLons[endNode][1]
        ],

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
        return `${seconds} seconds`;
    }
    else if (seconds < 3600){
        return `${Math.round(seconds/60)} minutes`
    }
    else{
        return `${Math.round(seconds/3600)} hours, ${Math.round((seconds%3600)/60)} minutes`
    }
}

async function applyRoute(event) {
    startNode = closestNode(routeMarkers[0].getLatLng());
    endNode = closestNode(routeMarkers[routeMarkers.length-1].getLatLng());

    // Redraw route from start
    let path = [];
    let currentNode = startNode;


    let a_star_data;
    if (settings.findShortestPathsByTime){
        a_star_data = await(await fetch(`api/get/a_star_time/${startNode}/${endNode}`)).json();
    }
    else{
        a_star_data = await(await fetch(`api/get/a_star_distance/${startNode}/${endNode}`)).json();
    }

    currentChartData = [];


    for (let i = 0; i < a_star_data[2].length; i++){
        path.push(nodeLatLons[a_star_data[2][i]]);
        currentChartData.push({x: a_star_data[3][i],
            y: nodeElevations[a_star_data[2][i]]})
    }


    if (routeLine != null) {
        routeLine.setLatLngs(path);
        routeLine.setPopupContent(`Distance: ${Math.round(a_star_data[0]) / 1000}km, `+
            `Time: ${secondsToString(a_star_data[1])}` +
            "<canvas id=\"elevationGraph\"></canvas>");
    }
    else{
        routeLine = L.polyline(path, {
            fillOpacity: 1,
            color: 'green'
    
        }).bindPopup(`Distance: ${Math.round(a_star_data[0]) / 1000}km, `+
            `Time: ${secondsToString(a_star_data[1])}` +
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
    currentChart = new Chart(
        document.getElementById('elevationGraph'),
        {
            type: "line",
            data: {
                datasets: [{
                    data: currentChartData,
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
    const convex_hull_response = await fetch(`/api/get/convex/${startNode}/${settings.partitionDistance}`);
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
    document.getElementById("include_destination_in_cycle_checkbox").checked = true;
    document.getElementById("convex_hull_slider_checkbox").checked = false;
    document.getElementById("destination_show_checkbox").checked = false;
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

    endNode = 0;


    routeMarkers.push(L.marker(nodeLatLons[0], {
        draggable: true,
        autoPan: true,
        title: "Destination"
    }).addTo(map));

    routeMarkers[routeMarkers.length-1]._icon.classList.add("redMarker");

    // Get all dijkstra information before setting up
    routeNodes.push(closestNode(routeMarkers[0].getLatLng()));
    dijkstraFromStart = await dijkstraDetails(routeNodes[0])
    dijkstraFromEnd = await dijkstraDetails(endNode);
    applyRoute();
    await generateIsochrone();

    document.getElementById("convex_hull_slider").max = convexHullRegions.length - 1;
    document.getElementById("convex_hull_slider_text").max = (settings.partitionDistance * (convexHullRegions.length - 1)) / 1000;
    document.getElementById("convex_hull_slider_text").step = (settings.partitionDistance) / 1000;



    displayConvexHull();



    document.getElementById("destination_search").value = await searchReverseGeocode(routeMarkers[routeMarkers.length-1].getLatLng());
    document.getElementById("start_search").value = await searchReverseGeocode(routeMarkers[0].getLatLng());


    routeMarkers[0].on('drag', function(){
        startNode = closestNode(routeMarkers[0].getLatLng());
        connectToStartNode();});

        routeMarkers[routeMarkers.length-1].on('drag', function(){
        endNode = closestNode(routeMarkers[routeMarkers.length-1].getLatLng());
        connectToEndNode();
    });

    // Ensure finalised route is correct once dragging ends
    routeMarkers[0].on('dragend', fixStart);
    routeMarkers[routeMarkers.length-1].on('dragend', fixEnd);
}

initialise();
