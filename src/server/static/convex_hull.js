function setupConvexHullInputs(){
    document.getElementById("convex_hull_slider").max = convexHullRegions.length - 1;
    document.getElementById("convex_hull_slider_text").max = (settings.partitionDistance * (convexHullRegions.length - 1)) / 1000;
    document.getElementById("convex_hull_slider_text").step = (settings.partitionDistance) / 1000;
    convexHullIndex = Math.min(convexHullRegions.length - 1, convexHullIndex)
}

async function generateIsochrone() {
    const convex_hull_response = await fetch(`/api/get/convex/${routeNodes[0]}/${settings.partitionDistance}`);
    let data = await convex_hull_response.json();

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

        prev_convex_hull_lat_lons = convex_hull_lat_lons;
    }
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