These are the exposed parameters that can be set in the URL.

srid: [integer] - The SRID of wanted reference system. Defaults to 3035. Currently available SRIDs: 3035 (European Lambert), 4326 (lat-lng), 3857 (Web mercator), 3006 (SWEREF 99TM).

zoom: [integer] - From 1 and up. Higher value means more zoomed in.

center: [float,float] - Coordinate pair in specified reference system where you want the initial map view to center on.

show: [str,...] - If 'show' is present in URL, specify which stations to show. To show all -> show=os,es,as,eas,ship. If 'show' is not present in URL, all stations are shown.

baseMap: [str] - Set initial base map. Available base maps are OpenStreetMap, Watercolor, Imagery, Topography, Ocean, Shaded relief, Natural Earth and Countries. Map defaults to Natural Earth if no base map is specified. 

Example: https://static.icos-cp.eu/share/stationsproj/?srid=3857&zoom=6&center=1000000,5900000&show=os,ship&baseMap=Topography