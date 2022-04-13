These are the exposed parameters that can be set in the URL.

srid: [integer] - The SRID of wanted reference system. Defaults to 3035. Currently available SRIDs: 3035 (European Lambert), 4326 (lat-lng), 3857 (Web mercator), 3006 (SWEREF 99TM) and 54030 (Robinson).

zoom: [float] - From 1 and up. Higher value means more zoomed in.

center: [float,float] - Coordinate pair in specified reference system where you want the initial map view to center on.

visibleToggles: [str,...] - If 'visibleToggles' is present in URL, specify which stations to show. To show all -> visibleToggles=os,es,as,overlap,ship,bdr. If 'visibleToggles' is not present in URL, all stations and country boundary are shown.

baseMap: [str] - Set initial base map. Available base maps are openStreetMap, watercolor, imagery, topography, ocean, physical, shadedRelief, lmTopo and lmTopoGray. Map defaults to physical if no base map is specified.

countryFilter: [str] - Country code (two characters, upper case) to filter on.

Example: https://static.icos-cp.eu/share/stationsproj/?srid=3857&center=468810,5860997&zoom=5.81&baseMap=ocean&visibleToggles=os,es,as,overlap,bdr&countryFilter=FR