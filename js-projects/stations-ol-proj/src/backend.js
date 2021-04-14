import {getJson} from 'icos-cp-backend';
import {feature} from 'topojson';


export const getCountryLookup = async () => {
	return getJson('https://static.icos-cp.eu/constant/misc/countries.json');
};

export const getCountriesGeoJson = async () => {
	return getJson('https://static.icos-cp.eu/js/topojson/map-2.5k.json')
		.then(topo => feature(topo, topo.objects.map));
};

export const getESRICopyRight = async services => {
	const promises = services.map(service => getJson('https://static.arcgis.com/attribution/' + service + '?f=json'));

	return Promise.all(promises).then(results => {
		return results.reduce((acc, doc, idx) => {
			acc[services[idx]] = doc;
			return acc;
		}, {});
	});
};
