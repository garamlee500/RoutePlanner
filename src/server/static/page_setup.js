// Hide zoom control to allow for full control of ui
let map = L.map('map', {zoomControl: false});
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
   maxZoom: 19,
   attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);



// Make search container draggable and lock to map
// Only allow to the right
$('#main_controls').resizable({containment: "#map", handles: 'e, w'}).draggable({ scroll: false,
    containment: "#map"});