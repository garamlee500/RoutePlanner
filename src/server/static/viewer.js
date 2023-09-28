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

    let a_star_data = await(await fetch(`/api/get/a_star_time/${routeNodes[routeLineIndex]}/${routeNodes[routeLineIndex+1]}`)).json();

    setupPathData(a_star_data, routeLineIndex);

    routeLine.openPopup();
    showChart();

    connectToStartNode();
    connectToEndNode();
}

async function initialise() {
    await setupMap(false);
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
        await setupStopData(0, route[i], false);
    }
    routeMarkers[routeMarkers.length-1].setLatLng(route[route.length-1]);
    connectToEndNode();
    connectToStartNode();
    for (let i = 0; i < route.length-1; i++){
        await applyRoute(i);
    }
}

initialise();
