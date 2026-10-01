import L from 'leaflet';
import { Query, sparql } from 'icos-cp-backend';
import config from '../../common/config-urls';

const LM_TILES_BASE_URL = 'https://tiles.fieldsites.se';
const ESRI_SERVICES_URL = 'https://server.arcgisonline.com/arcgis/rest/services';
const ESRI_ATTRIBUTION = 'Powered by <a href="https://www.esri.com" target="_blank">Esri</a>';

interface Station {
	id: string,
	lat: number,
	lon: number,
	name: string,
	url: string
}

sparql(stationQuery(), config.sparqlEndpoint, true).then(sparqlResult => {
	const bindings = sparqlResult.results.bindings;

	return bindings
		? Promise.resolve(bindings.map(binding => {
			return {
				id: binding.id.value,
				lat: Number(binding.lat.value),
				lon: Number(binding.lon.value),
				name: binding.name.value,
				url: binding.station.value
			}
		}))
		: Promise.reject(new Error(`Could not get station list`));
}).then(stations => {
	initMap(stations)
});


function initMap(stations: Station[]) {
	var map = L.map('map', {
		minZoom: 1,
		maxBounds: [[-90, -180], [90, 180]],
		scrollWheelZoom: window.top === window.self
	}).setView([62.38583179, 16.3219987], 5);

	const leafletPrefix = map.attributionControl.options.prefix as string;
	map.attributionControl.setPrefix(leafletPrefix.replace('<a ', '<a target="_blank" '));

	var baseMaps = getBaseMaps(map, 18);
	map.addLayer(baseMaps.Topographic);

	L.control.layers(baseMaps).addTo(map);

	stations.forEach(station => {
		const popupContent = `
			<h3>${station.name}</h3>
			<a href="${station.url}" target="_top">Read more</a>
		`;
		L.marker([station.lat, station.lon])
			.bindPopup(popupContent)
			.addTo(map);
	});

}

function getLmUrl(layer) {
	return `${LM_TILES_BASE_URL}/wmts/${layer}/webmercator/{z}/{x}/{y}.png`;
}

function getBaseMaps(map: L.Map, maxZoom: number) {
	var topoLM = L.tileLayer(getLmUrl('topowebb'), {
		maxNativeZoom: 17,
		attribution: '© Lantmäteriet'
	});

	var topoTonedLM = L.tileLayer(getLmUrl('topowebb_nedtonad'), {
		maxNativeZoom: 17,
		attribution: '© Lantmäteriet'
	});

	var image = getEsriLayer(map, 'World_Imagery', maxZoom);

	var osm = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
		maxZoom,
		attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors'
	});
	return {
			"Topographic": topoLM,
			"Topographic Toned": topoTonedLM,
			"Satellite": image,
			"OSM": osm
		}
}

function getEsriLayer(map: L.Map, serviceName: string, maxZoom: number) {
	const layer = L.tileLayer(`${ESRI_SERVICES_URL}/${serviceName}/MapServer/tile/{z}/{y}/{x}`, {
		maxZoom,
		attribution: ESRI_ATTRIBUTION
	});
	loadEsriAttribution(map, layer, serviceName);
	return layer;
}

// Esri requires showing the data providers from the service's copyrightText, which can change
function loadEsriAttribution(map: L.Map, layer: L.TileLayer, serviceName: string) {
	fetch(`${ESRI_SERVICES_URL}/${serviceName}/MapServer?f=json`)
		.then(response => response.json())
		.then(service => {
			if (!service.copyrightText) return;

			const attribution = `${ESRI_ATTRIBUTION} | ${escapeHtml(service.copyrightText)}`;
			if (map.hasLayer(layer)) {
				map.attributionControl.removeAttribution(layer.options.attribution!);
				map.attributionControl.addAttribution(attribution);
			}
			layer.options.attribution = attribution;
		})
		.catch(error => console.error(`Could not load attribution for ${serviceName}`, error));
}

function escapeHtml(text: string) {
	const element = document.createElement('span');
	element.textContent = text;
	return element.innerHTML;
}

function stationQuery(): Query<"id" | "name" | "lon" | "lat" | "station", never> {
	const text = `prefix sitesonto: <https://meta.fieldsites.se/ontologies/sites/>
prefix cpmeta: <http://meta.icos-cp.eu/ontologies/cpmeta/>
select ?id ?name ?lon ?lat ?station where{
 ?station a sitesonto:Station ;
     cpmeta:hasName ?name ;
     cpmeta:hasStationId ?id ;
     cpmeta:hasLongitude ?lon ;
     cpmeta:hasLatitude ?lat .
 FILTER NOT EXISTS {?station cpmeta:isDiscontinued "true"^^xsd:boolean}
}`;

	return { text };
}
