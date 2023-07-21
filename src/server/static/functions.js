function secondsToString(seconds){
    if (seconds < 60){
        return `${Math.round(seconds)} seconds`;
    }
    else if (seconds < 3600){
        return `${Math.round(seconds/60)} minutes`;
    }
    else{
        return `${Math.floor(seconds/3600)} hours, ${Math.round((seconds%3600)/60)} minutes`;
    }
}

function colorGradient(colorCount,
                       startR = 0,
                       startG = 255,
                       startB = 0,
                       endR = 255,
                       endG = 0,
                       endB = 0,) {

    if (colorCount === 1) {
        // Zero division error occurs if colorCount is 1
        return [`rgb(${startR},${startG},${startB})`];
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
        colors.push(`rgb(${r},${g},${b})`)
    }
    return colors;
}

function nodeDistanceMetric(node1lat, node1lon, node2lat, node2lon) {
    // Outputs a metric for distance between two nodes that can be used to
    // compare distances - is an increasing function of haversine node distance
    // but less computationally expensive
    // (misses out a square root, and arcsine and a scaling to the size of the earth)
    let lat2 = Math.PI * node2lat / 180;
    let lat1 = Math.PI * node1lat / 180;
    let lon2 = Math.PI * node2lon / 180;
    let lon1 = Math.PI * node1lon / 180;
    let term1 = Math.sin((lat2 - lat1) / 2) ** 2;
    let term2 = Math.cos(lat1) * Math.cos(lat2) * (Math.sin((lon2 - lon1) / 2) ** 2);
    return term1 + term2
}