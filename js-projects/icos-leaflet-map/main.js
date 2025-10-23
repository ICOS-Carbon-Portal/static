const zoomSetting = mapSettings.allowZoom ?? false;
const map = L.map('map', {
	zoomControl: zoomSetting,
	doubleClickZoom: zoomSetting,
	scrollWheelZoom: zoomSetting,
	touchZoom: zoomSetting
}).setView(mapSettings.coords ?? [58, 15], mapSettings.zoom ?? 4);

initMap();

async function initMap() {
	const stations = await fetch('https://meta.icos-cp.eu/sparql', {
		method: 'post',
		headers: new Headers({
			'Accept': 'application/json',
			'Content-Type': 'text/plain'
		}),
		body: sparqlQuery
	}).then(response => response.json());
	const markers = stations.results.bindings.map(station => {
		return {
			coordinates: [station.lat.value, station.lon.value],
			link: station.station.value,
			name: station.name.value,
			countryCode: station.cc.value
		}
	})

	const countries = await fetch('/constant/misc/countries.json').then(response => response.json());

	//extend Leaflet to create a GeoJSON layer from a TopoJSON file
	L.TopoJSON = L.GeoJSON.extend({
		addData: function (data) {
			var geojson, key;
			if (data.type === "Topology") {
				for (key in data.objects) {
					if (data.objects.hasOwnProperty(key)) {
						geojson = topojson.feature(data, data.objects[key]);
						L.GeoJSON.prototype.addData.call(this, geojson);
					}
				}
				return this;
			}
			L.GeoJSON.prototype.addData.call(this, data);
			return this;
		}
	});
	L.topoJson = function (data, options) {
		return new L.TopoJSON(data, options);
	};

	var geojson = L.topoJson(null, {
		style: function () {
			return {
				weight: 2,
				color: '#139bbd',
				fillColor: '#c2ebf0',
				fillOpacity: 1,
				interactive: false
			}
		},
		onEachFeature: function (feature, layer) {
			layer.bindPopup('<p>' + feature.properties.name + '</p>')
		}
	}).addTo(map);

	async function getGeoData(url) {
		let response = await fetch(url);
		let data = await response.json();
		return data;
	}

	getGeoData('https://static.icos-cp.eu/js/topojson/map-2.5k.json').then(data => geojson.addData(data));

	markers.map(marker => {
		let popupContent = `<a href="${marker.link}" target="_top"><b>${marker.name}</b></a><br>${countries[marker.countryCode]}`;
		L.marker(marker.coordinates, { title: marker.name, riseOnHover: true }).bindPopup(popupContent).addTo(map);
	})
}
