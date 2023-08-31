function setupConvexHullInputs(){
    return;
    document.getElementById("convex-hull-slider").max = convexHullRegions.length - 1;
    document.getElementById("convex-hull-slider-text").max = (settings.partitionDistance * (convexHullRegions.length - 1)) / 1000;
    document.getElementById("convex-hull-slider-text").step = (settings.partitionDistance) / 1000;
    convexHullIndex = Math.min(convexHullRegions.length - 1, convexHullIndex);
}

async function displayConvexHull() {
    document.getElementById("convex-hull-slider-text").value = (convexHullIndex * settings.partitionDistance / 1000);
    document.getElementById("convex-hull-slider").value = convexHullIndex;

    if (currentIndicatedConvexHull != null) {
        currentIndicatedConvexHull.remove(map)
    }

    if (document.getElementById("convex-hull-slider-checkbox").checked === true) {
        const isolineResponse = await fetch(`/api/get/isoline/${routeNodes[0]}/${convexHullIndex*settings.partitionDistance}`);

        if (currentIndicatedConvexHull!=null){
            currentIndicatedConvexHull.remove(map);
        }
        currentIndicatedConvexHull = L.polyline(
            await(isolineResponse.json())
        ).addTo(map);

    }
}