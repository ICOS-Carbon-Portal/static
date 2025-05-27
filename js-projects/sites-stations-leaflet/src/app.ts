import L from 'leaflet';
import { Query, sparql } from 'icos-cp-backend';
import config from '../../common/config-urls';

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

	var baseMaps = getBaseMaps(18);
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
	return "//maps.icos-cp.eu/lm/open/topowebb-ccby/v1/wmts/1.0.0/"
		+ layer
		+ "/default/3857/{z}/{y}/{x}.png";
}

function getBaseMaps(maxZoom) {
	var topoLM = L.tileLayer(window.location.protocol + getLmUrl('topowebb'), {
		maxNativeZoom: 14
	});

	var topoTonedLM = L.tileLayer(window.location.protocol + getLmUrl('topowebb_nedtonad'), {
		maxNativeZoom: 14
	});

	var image = L.tileLayer(window.location.protocol + '//server.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
		maxZoom
	});

	var osm = L.tileLayer(window.location.protocol + "//{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
		maxZoom
	});
	return {
			"Topographic": topoLM,
			"Topographic Toned": topoTonedLM,
			"Satellite": image,
			"OSM": osm
		}
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
