function setupConvexHullInputs(){
    document.getElementById("convex_hull_slider").max = convexHullRegions.length - 1;
    document.getElementById("convex_hull_slider_text").max = (settings.partitionDistance * (convexHullRegions.length - 1)) / 1000;
    document.getElementById("convex_hull_slider_text").step = (settings.partitionDistance) / 1000;
    convexHullIndex = Math.min(convexHullRegions.length - 1, convexHullIndex);
}

async function generateIsochrone() {
    const convexHullResponse = await fetch(`/api/get/convex/${routeNodes[0]}/${settings.partitionDistance}`);
    let data = await convexHullResponse.json();

    for (let i = 0; i < convexHullRegions.length; i++) {
        convexHullRegions[i].remove(map);
    }

    convexHullRegions = []
    convexHullRegionsLatLons = [];
    let currentConvexHullLatLons = [];
    let prevConvexHullLatLons;
    let colors = colorGradient(data.length);

    // Generate convex hull for very first region
    for (let i = 0; i < data[0].length; i++) {
        currentConvexHullLatLons.push(nodeLatLons[data[0][i]]);
    }
    convexHullRegionsLatLons.push(currentConvexHullLatLons)

    convexHullRegions.push(L.polygon(currentConvexHullLatLons,
        {
            fillColor: colors[0],
            opacity: 0,
            fillOpacity: settings.isochroneOpacity,
            pane: 'isochrone_colouring',
            interactive: false
        }).addTo(map)
    );
    prevConvexHullLatLons = currentConvexHullLatLons;
    for (let j = 1; j < data.length; j++) {
        currentConvexHullLatLons = [];
        for (let i = 0; i < data[j].length; i++) {
            currentConvexHullLatLons.push(nodeLatLons[data[j][i]]);
        }
        convexHullRegionsLatLons.push(currentConvexHullLatLons);

        // Create delay if needed
        if (settings.isochroneDelay > 0) await new Promise(r => setTimeout(r, settings.isochroneDelay));

        convexHullRegions.push(L.polygon([currentConvexHullLatLons, prevConvexHullLatLons],
        {
            fillColor: colors[j],
            opacity: 0,
            fillOpacity: settings.isochroneOpacity,
            pane: 'isochrone_colouring',
            interactive: false
        }).addTo(map));
        prevConvexHullLatLons = currentConvexHullLatLons;
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