let map;
let dijkstraFromStart;
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

   routeMarkers[routeMarkers.length - 1]._icon.classList.add("redMarker");

   routeMarkers[0].bindPopup(`<button class='textButton' onClick='addStop(0);'>Add stop after</button>`);
   routeMarkers[routeMarkers.length - 1].bindPopup(`<button class='textButton' onClick='addStop(routeMarkers.length-2);'>Add stop before</button>`);

// Get all dijkstra information before setting up
   routeNodes.push(closestNode(routeMarkers[0].getLatLng()));
   routeNodes[1] = 0;

   let currentURL = new URL(window.location.href);
   loadRouteUrl(currentURL.searchParams.get("route"));


   dijkstraFromStart = await dijkstraDetails(routeNodes[0])
   dijkstraFromEnd = await dijkstraDetails(routeNodes[routeNodes.length - 1]);
   applyRoute(0);
   await generateIsochrone();

   document.getElementById("convex_hull_slider").max = convexHullRegions.length - 1;
   document.getElementById("convex_hull_slider_text").max = (settings.partitionDistance * (convexHullRegions.length - 1)) / 1000;
   document.getElementById("convex_hull_slider_text").step = (settings.partitionDistance) / 1000;


   displayConvexHull();


   document.getElementById("destination_search").value = await searchReverseGeocode(routeMarkers[routeMarkers.length - 1].getLatLng());
   document.getElementById("start_search").value = await searchReverseGeocode(routeMarkers[0].getLatLng());


   routeMarkers[0].on('drag', function () {
      routeNodes[0] = closestNode(routeMarkers[0].getLatLng());
      connectToStartNode();
   });

   routeMarkers[routeMarkers.length - 1].on('drag', function () {
      routeNodes[routeNodes.length - 1] = closestNode(routeMarkers[routeMarkers.length - 1].getLatLng());
      connectToEndNode();
   });

// Ensure finalised route is correct once dragging ends
   routeMarkers[0].on('dragend', fixStart);
   routeMarkers[routeMarkers.length - 1].on('dragend', fixEnd);

   addEventListener("popstate", (event) => {
      loadRouteUrl(event.state)
   });
}
initialise();