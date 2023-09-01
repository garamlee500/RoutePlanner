function adjustIsolineInputs(){
    document.getElementById("isoline-slider-text").value = (isolineIndex / 10);
    document.getElementById("isoline-slider").value = isolineIndex;
}

async function displayIsoline() {
    if (currentIndicatedIsoline != null) {
        currentIndicatedIsoline.remove(map)
    }

    const isolineResponse = await fetch(`/api/get/isoline/${routeNodes[0]}/${isolineIndex*100}`);

    if (currentIndicatedIsoline!=null){
        currentIndicatedIsoline.remove(map);
    }
    currentIndicatedIsoline = L.polyline(
        await(isolineResponse.json()),
        {
            fillOpacity: 0,
            color: 'grey',
            interactive: false
        }
    ).addTo(map);


}