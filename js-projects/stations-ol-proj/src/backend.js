import {getJson, sparql} from 'icos-cp-backend';
import {feature} from 'topojson';
import config from '../../common/config-urls';


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
