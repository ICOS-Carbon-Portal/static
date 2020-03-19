import {getJson, sparql} from 'icos-cp-backend';
import {feature} from 'topojson';
import config from '../../common/config-urls';
import {getDrought2018AtmoStations, getDrought2018EcoStations, getIcosStations, getStations} from "./sparqlQueries";


export const getCountryLookup = () => {
	return getJson('https://static.icos-cp.eu/constant/misc/countries.json');
};

export const getCountriesGeoJson = () => {
	return getJson('https://static.icos-cp.eu/js/topojson/map-2.5k.json')
		.then(topo => feature(topo, topo.objects.map));
};

export const queryMeta = query => {
	return sparql({text: query}, config.sparqlEndpoint, true);
};

export const getStationQuery = (searchParams) => {
	const {mode, icosMeta} = searchParams;

	switch (mode){
		case 'icos':
			return icosMeta ? getIcosStations : getStations(config);

		case 'droughtAtm':
			return getDrought2018AtmoStations;

		case 'droughtEco':
			return getDrought2018EcoStations;

		default:
			throw new Error("Unsupported 'mode' parameter. Must be one of 'icos', 'droughtAtm', 'droughtEco' or undefined");
	}
};

export const getESRICopyRight = services => {
	const promises = services.map(service => getJson('https://static.arcgis.com/attribution/' + service + '?f=json'));

	return Promise.all(promises).then(results => {
		return results.reduce((acc, doc, idx) => {
			acc[services[idx]] = doc;
			return acc;
		}, {});
	});
};
