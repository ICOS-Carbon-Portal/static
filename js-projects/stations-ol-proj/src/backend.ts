import {getJson} from 'icos-cp-backend';
import {feature} from 'topojson-client';
import * as GeoJSON from "geojson";
import { GeometryCollection } from "topojson-specification";
import {GeoJsonFeatureCollection} from "icos-cp-ol";

export type AsyncResult<F extends (...args: any[]) => Promise<any>> = F extends (...args: any[]) => Promise<infer R> ? R : never;

export const getCountryLookup = async (): Promise<Record<string, string>> => {
	const sessionStorageKey = 'countryLookup';
	const countryLookupStorage = sessionStorage.getItem(sessionStorageKey);

	if (countryLookupStorage)
		return Promise.resolve(JSON.parse(countryLookupStorage));

	return getJson('https://static.icos-cp.eu/constant/misc/countries.json').then(countryLookup => {
		sessionStorage.setItem(sessionStorageKey, JSON.stringify(countryLookup));
		return countryLookup;
	});
};

export const getCountriesGeoJson = async (): Promise<GeoJsonFeatureCollection> => {
	const sessionStorageKey = 'countriesTopo';
	const countriesTopoStorage = sessionStorage.getItem(sessionStorageKey);

	if (countriesTopoStorage)
		return Promise.resolve(JSON.parse(countriesTopoStorage));

	return getJson('https://static.icos-cp.eu/js/topojson/map-2.5k.json')
		.then(topo => {
			const countriesTopo = feature(topo, topo.objects.map as GeometryCollection<GeoJSON.GeoJsonProperties>);
			sessionStorage.setItem(sessionStorageKey, JSON.stringify(countriesTopo));

			return countriesTopo
		});
};
