let map;
let nodeLatLons;
let nodeElevations;
let startNodeMarker;
let endNodeMarker;
let startNodeConnector;
let endNodeConnector;
let currentChart = null;
let routeMarkers = [];
let routeNodes = [];
let routeNodeLatLons = [];
let routeChartData = [];
let routeDistances = [];
let routeTimes = [];
let routeLine;

async function rateRoute(){
    let rating = document.getElementById("rating-number").value;
    if (!["0", "1", "2", "3", "4", "5"].includes(rating)){
        return;
    }
    document.getElementById('rate-route-button').textContent="Rating...";
    document.getElementById('rate-route-button').disabled=true;
    await fetch("/api/post/rate_route", {
            method: "POST",
            body: JSON.stringify({
                rating: rating,
                route_id: routeId
            }),
            headers: {
                "Content-type": "application/json; charset=UTF-8"
            }
        }
    );
    document.getElementById('rate-route-button').textContent="Rated!";
    setTimeout(function(){
            document.getElementById("rate-route-button").textContent = "Rate the route out of 5!";
            document.getElementById("rate-route-button").disabled = false;
    }, 500);
}

async function applyRoute(routeLineIndex) {
    // Connects node at routeLineIndex to node at routeLineIndex + 1
    routeNodes[routeLineIndex] = closestNode(routeMarkers[routeLineIndex].getLatLng());
    routeNodes[routeLineIndex+1] = closestNode(routeMarkers[routeLineIndex+1].getLatLng());

    let chartData = [];
    let path = [];
    let assembledPath = [];
    let a_star_data = await(await fetch(`/api/get/a_star_time/${routeNodes[routeLineIndex]}/${routeNodes[routeLineIndex+1]}`)).json();

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

    routeLine.openPopup();
    showChart();

    connectToStartNode();
    connectToEndNode();
}

async function initialise() {
    // Hide zoom control to allow for full control of ui
   map = L.map('map', {zoomControl: false});
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
      interactive: false,
      autoPan: true,
      title: "Start"
   }).addTo(map));
   routeMarkers.push(L.marker(nodeLatLons[0], {
      interactive: false,
      autoPan: true,
      title: "Destination"
   }).addTo(map));
   routeMarkers[1]._icon.classList.add("red-marker");
   routeNodes.push(closestNode(routeMarkers[0].getLatLng()));
   routeNodes[1] = 0;
   await loadRouteUrl(routeString);
}

function editRoute(){
    window.location.href = setUrl(false);
}


async function loadRouteUrl(routeString){
    if (routeString === null || routeString === ''){
        return;
    }
    let route = JSON.parse(routeString);
    resetRoute();

    routeMarkers[0].setLatLng(route[0]);
    for (let i = route.length - 2; i > 0; i--){
        await addStop(0, route[i]);
    }
    routeMarkers[routeMarkers.length-1].setLatLng(route[route.length-1]);
    connectToEndNode();
    connectToStartNode();
    for (let i = 0; i < route.length-1; i++){
        await applyRoute(i);
    }
}


async function addStop(routeLineIndex, stopPostion=null){
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
            interactive: false,
            pane: "node-markers" // display marker above paths
        }).addTo(map);
    newNodeMarker._icon.classList.add("grey-marker");
    routeNodes.splice(routeLineIndex+1, 0, chosenNode);
    routeMarkers.splice(routeLineIndex+1, 0, newNodeMarker);
    routeNodeLatLons.splice(routeLineIndex+1, 0, []);
    routeChartData.splice(routeLineIndex+1, 0, []);
    routeTimes.splice(routeLineIndex+1, 0, 0);
    routeDistances.splice(routeLineIndex+1, 0, 0);

}

initialise();