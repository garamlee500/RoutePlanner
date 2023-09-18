let map;
let nodeLatLons;
let nodeElevations;
let startNodeMarker;
let endNodeMarker;
let startNodeConnector;
let endNodeConnector;
let currentIndicatedIsoline;
let isolineIndex = 0;
let walkSuggestionDistance = 5;
let gpsAccuracy = null;
let currentChart = null;
let routeMarkers = [];
let routeNodes = [];
let routeNodeLatLons = [];
let routeChartData = [];
let routeDistances = [];
let routeTimes = [];
let routeLine;
let settings;
let defaultSettings = {
    findShortestPathsByTime: false
};


async function initialise() {

   if (sessionStorage.getItem("settings")) {
      settings = JSON.parse(sessionStorage.getItem("settings"));
   }
   else {
      // Clone default settings
      settings = {...defaultSettings};
   }

   document.getElementById("destination-show-checkbox").checked = true;
   document.getElementById("walk-generator-slider").value = 5;
   document.getElementById("walk-generator-slider-text").value = 5;
   document.getElementById("isoline-slider").value = 0;
   document.getElementById("isoline-slider-text").value = "0";


   document.getElementById('destination-show-checkbox').addEventListener(
        'change',
        (event) => {
            if (event.target.checked === true) {
                routeLine.addTo(map);
                routeLine.openPopup();
                showChart();
            } else {
                routeLine.remove(map);
            }
        });
   document.getElementById('isoline-slider').addEventListener("input", (event) => {
       isolineIndex = event.target.value;
       adjustIsolineInputs();
   });
   document.getElementById('walk-generator-slider').addEventListener("input", (event) => {
       walkSuggestionDistance = event.target.value;
       document.getElementById('walk-generator-slider-text').value = walkSuggestionDistance;
   });
   document.getElementById('walk-generator-slider-text').addEventListener("input", (event) => {
       walkSuggestionDistance = event.target.value;
       document.getElementById('walk-generator-slider').value = walkSuggestionDistance;
   });
   document.getElementById('isoline-slider-text').addEventListener("input", (event) => {
       isolineIndex = event.target.value * 10;
       adjustIsolineInputs();
   });
   document.getElementById('destination-search').addEventListener("keydown", async function(e) {
       if (e.code === "Enter") {
           let geocodeData = await searchGeocode(e.target.value);
           if (geocodeData == null) {
               e.target.value = "Search not found!";
           }
           else {
               e.target.value = geocodeData[2];
               routeMarkers[routeMarkers.length-1].setLatLng([geocodeData[0], geocodeData[1]]);
               await fixEnd(false);
           }
       }
   });
   document.getElementById('start-search').addEventListener("keydown", async function(e) {
       if (e.code === "Enter") {
           let geocodeData = await searchGeocode(e.target.value);
           if (geocodeData == null) {
               e.target.value = "Search not found!";
           }
           else {
               e.target.value = geocodeData[2];
               routeMarkers[0].setLatLng([geocodeData[0], geocodeData[1]]);
               await fixStart(false);
           }
       }
   });

   await setupMap(true);
   routeMarkers[0].bindPopup(`<button class='text-button' onClick='addStop(0);'>Add stop after</button>`);
   routeMarkers[1].bindPopup(`<button class='text-button' onClick='addStop(routeMarkers.length-2);'>Add stop before</button>`);


   let currentURL = new URL(window.location.href);
   if (currentURL.searchParams.has("route")){
      await loadRouteUrl(currentURL.searchParams.get("route"));
   }
   applyRoute(0);
   displayIsoline();

   await setStartSearchAddress();
   await setDestinationSearchAddress();

   routeMarkers[0].on('drag', function () {
      routeNodes[0] = closestNode(routeMarkers[0].getLatLng());
      connectToStartNode();
   });
   routeMarkers[routeMarkers.length-1].on('drag', function () {
      routeNodes[routeNodes.length - 1] = closestNode(routeMarkers[routeMarkers.length - 1].getLatLng());
      connectToEndNode();
   });
   routeMarkers[0].on('dragend', fixStart);
   routeMarkers[routeMarkers.length-1].on('dragend', fixEnd);
   addEventListener("popstate", (event) => {
      loadRouteUrl(event.state);
   });
   setUrl();
}

initialise();