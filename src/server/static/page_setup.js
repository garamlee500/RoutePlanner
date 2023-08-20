let map;
let nodeLatLons;
let nodeElevations;
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

   if (sessionStorage.getItem("settings")) {
      settings = JSON.parse(sessionStorage.getItem("settings"));
   }
   else {
      // Clone default settings
      settings = {...defaultSettings};
   }

   document.getElementById("convex-hull-slider-checkbox").checked = false;
   document.getElementById("destination-show-checkbox").checked = true;
   document.getElementById("walk-generator-slider").value = 5;
   document.getElementById("walk-generator-slider-text").value = 5;
   document.getElementById("convex-hull-slider").value = 0;
   document.getElementById("convex-hull-slider-text").value = "0";


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
   document.getElementById('convex-hull-slider-box').addEventListener("change", displayConvexHull);
   document.getElementById('convex-hull-slider').addEventListener("input", (event) => {
       convexHullIndex = event.target.value;
       displayConvexHull();
   });
   document.getElementById('walk-generator-slider').addEventListener("input", (event) => {
       walkSuggestionDistance = event.target.value;
       document.getElementById('walk-generator-slider-text').value = walkSuggestionDistance;
   });
   document.getElementById('walk-generator-slider-text').addEventListener("input", (event) => {
       walkSuggestionDistance = event.target.value;
       document.getElementById('walk-generator-slider').value = walkSuggestionDistance;
   });
   document.getElementById('convex-hull-slider-text').addEventListener("input", (event) => {
       convexHullIndex = event.target.value * 1000 / settings.partitionDistance;
       displayConvexHull();
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

   let outerRegionLatLngs = outerRegionIds.map((index) => nodeLatLons[index]);

   map.createPane('node-markers');
   map.getPane('node-markers').style.zIndex = 401;
   map.createPane('isochrone-colouring');
   map.getPane('isochrone-colouring').style.zIndex = 399;

   // Creates rectangle covering entire map, except for a hole around region
   L.polygon([
      [[90, -180], [90, 180], [-90, 180], [-90, -180]], outerRegionLatLngs], {
        color: 'grey',
        fillOpacity: 0.3,
        pane: 'isochrone-colouring',
        interactive: false
   }).addTo(map);

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
   routeMarkers[1]._icon.classList.add("red-marker");
   routeMarkers[0].bindPopup(`<button class='text-button' onClick='addStop(0);'>Add stop after</button>`);
   routeMarkers[1].bindPopup(`<button class='text-button' onClick='addStop(routeMarkers.length-2);'>Add stop before</button>`);
   routeNodes.push(closestNode(routeMarkers[0].getLatLng()));
   routeNodes[1] = 0;

   let currentURL = new URL(window.location.href);
   if (currentURL.searchParams.has("route")){
      await loadRouteUrl(currentURL.searchParams.get("route"));
   }
   applyRoute(0);
   await generateIsochrone();
   setupConvexHullInputs();
   displayConvexHull();

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