import {OL, supportedSRIDs, getViewParams, getSearchParams, projDefinitions, LayerControl} from 'icos-cp-ol';
import {getCountriesGeoJson, getCountryLookup, getESRICopyRight, getStationQuery, queryMeta} from './backend';
import Stations from './models/Stations';
import TileLayer from 'ol/layer/Tile';
import * as olProj from 'ol/proj';
import {register} from 'ol/proj/proj4';
import Projection from 'ol/proj/Projection';
import proj4 from 'proj4';
import Zoom from 'ol/control/Zoom';
import ZoomSlider from 'ol/control/ZoomSlider';
import ScaleLine from 'ol/control/ScaleLine';
import ZoomToExtent from 'ol/control/ZoomToExtent';
import ExportControl from './controls/ExportControl';
import StationFilter from "./models/StationFilter";
import availableBaseMaps, {esriBaseMapNames} from "./basemaps";
import styles from "./styles";
import Copyright from "./models/Copyright";
import VectorLayer from "ol/layer/Vector";

// For OpenLayers version 6.2.1

const searchParams = getSearchParams();
searchParams.mode = searchParams.mode ?? 'icos';

const srid = searchParams.srid ?? '3035';

const stationsQuery = getStationQuery(searchParams);

if (Object.keys(supportedSRIDs).includes(srid)){
	const mapOptions = {updateURL: true};

	if (searchParams.zoom && searchParams.zoom.match(/^\d{1,2}\.?\d*$/)) {
		mapOptions.zoom = parseInt(searchParams.zoom);
	}

	if (searchParams.center && searchParams.center.match(/^(\d+(\.\d+)?),(\d+(\.\d+)?)$/)) {
		mapOptions.center = searchParams.center.split(',').map(p => parseFloat(p));
	}

	if (mapOptions.zoom && mapOptions.center) {
		mapOptions.fitView = false;
	}

	if (searchParams.baseMap){
		mapOptions.baseMap = availableBaseMaps.find(bm => bm.name === searchParams.baseMap)
			? decodeURIComponent(searchParams.baseMap)
			: availableBaseMaps.find(bm => bm.defaultVisibility).name;
	}

	const layerVisibility = {
		os: true,
		es: true,
		as: true,
		eas: true,
		ship: true,
		bdr: true
	};

	const showParams = searchParams.hasOwnProperty('show') ? searchParams.show.split(',') : undefined;
	if (showParams){
		Object.keys(layerVisibility).forEach(key => layerVisibility[key] = false);

		showParams.forEach(p => {
			if (p in layerVisibility) layerVisibility[p] = true;
		});
	}

	start(srid, mapOptions, layerVisibility);

} else {
	const srids = Object.keys(supportedSRIDs).map(srid => srid + " (" + supportedSRIDs[srid] + ")").join(', ');
	const infoDiv = document.getElementById('map');
	infoDiv.setAttribute('style', 'padding: 10px;');
	infoDiv.innerHTML = "Illegal SRID. Must be one of these numbers: " + srids;
}

function start(srid, mapOptions, layerVisibility) {
	const epsgCode = 'EPSG:' + srid;

	if (Object.keys(projDefinitions).includes(epsgCode)) {
		proj4.defs(epsgCode, projDefinitions[epsgCode]);
		register(proj4);

		olProj.addProjection(new Projection({
			code: epsgCode,
			extent: getViewParams(epsgCode).extent,
			worldExtent: getViewParams(epsgCode).extent
		}));
	}
	const projection = olProj.get(epsgCode);

	const transformPointFn = projection.getCode() === 'EPSG:4326'
		? (lon, lat) => [lon, lat]
		: (lon, lat) => olProj.transform([lon, lat], 'EPSG:4326', projection);

	getCountryLookup().then(countryLookup => {
		const baseMaps = getBaseMapLayers(mapOptions.baseMap);
		const controls = getControls(projection, searchParams.mode);
		const layerControl = new LayerControl(document.getElementById('layerCtrl'), searchParams.mode === 'icos');

		return {
			ol: new OL(projection, baseMaps, controls.concat([layerControl]), countryLookup, mapOptions),
			countryLookup,
			layerControl
		};

	}).then(({ol, countryLookup, layerControl}) => {
		return getCountriesGeoJson().then(countriesTopo => {
			ol.addGeoJson('borders', 'Countries', 'baseMap', mapOptions.baseMap === 'Countries', countriesTopo, styles.countryStyle, false);

			return {
				ol,
				countryLookup,
				layerControl,
				countriesTopo
			};
		});

	}).then(({ol, countryLookup, layerControl, countriesTopo}) => {
		queryMeta(stationsQuery).then(sparqlResult => {
			const stations = new Stations(sparqlResult, transformPointFn);
			const toggleLayers = getToggleLayers(searchParams.mode, layerVisibility, countriesTopo, stations);
			ol.addToggleLayers(toggleLayers);

			if (searchParams.mode === 'icos') {
				const stationFilter = new StationFilter(toggleLayers, countryLookup, filterFeatures);
				layerControl.addCountrySelectors(stationFilter, ol);

				if (searchParams.countries) {
					const countryList = searchParams.countries.split(',');

					// Only run filter if every country code provided in URL exists in lookup
					if (countryList.every(country => countryLookup[country])) {
						stationFilter.filterFn(stationFilter, countryList, ol);
					}
				}
			}

		}).then(_ => {
			const minWidth = 600;
			const width = document.getElementsByTagName('body')[0].getBoundingClientRect().width;
			if (width < minWidth) return;

			getESRICopyRight(esriBaseMapNames).then(attributions => {
				ol.attributionUpdater = new Copyright(attributions, projection, 'baseMapAttribution', minWidth);
			});
		});
	});
}

function getToggleLayers(mode, layerVisibility, countriesTopo, stations){
	if (mode === 'icos'){
		return getToggleLayersIcos(layerVisibility, countriesTopo, stations);

	} else if (mode === 'droughtAtm') {
		return [getCountryBorders(layerVisibility, countriesTopo), getToggleLayersDrought2018Atm(layerVisibility, stations.stations)];

	} else if (mode === 'droughtEco') {
		return [getCountryBorders(layerVisibility, countriesTopo), getToggleLayersDrought2018Eco(layerVisibility, stations.stations)];

	}
}

function getCountryBorders(layerVisibility, countriesTopo){
	return {
		id: 'bdr',
		type: 'geojson',
		name: 'Country borders',
		interactive: false,
		visible: layerVisibility.bdr,
		data: countriesTopo,
		style: styles.countryBorderStyle
	};
}

function getToggleLayersDrought2018Atm(layerVisibility, stations){
	return {
		id: 'droughtAtm',
		type: 'point',
		name: 'Drought Atmosphere stations',
		visible: layerVisibility.droughtAtm,
		data: stations,
		style: styles.atmoStyle
	};
}

function getToggleLayersDrought2018Eco(layerVisibility, stations){
	return {
		id: 'droughtEco',
		type: 'point',
		name: 'Drought Ecosystem stations',
		visible: layerVisibility.droughtEco,
		data: stations,
		style: styles.ecoStyle
	};
}

function getToggleLayersIcos(layerVisibility, countriesTopo, stations){
	const duplicates = stations.getDuplicates({type: 'point'});
	const stationPointsOS = stations
		.filterByAttr({type: 'point', themeShort: 'OS'})
		.filter(s => !duplicates.some(d => d.id === s.id));
	const stationPointsES = stations
		.filterByAttr({type: 'point', themeShort: 'ES'})
		.filter(s => !duplicates.some(d => d.id === s.id));
	const stationPointsAS = stations
		.filterByAttr({type: 'point', themeShort: 'AS'})
		.filter(s => !duplicates.some(d => d.id === s.id));
	const shippingLines = stations.filterByAttr({type: 'line'});

	return [
		getCountryBorders(layerVisibility, countriesTopo),
		{
			id: 'os',
			type: 'point',
			name: 'Ocean stations',
			visible: layerVisibility.os,
			data: stationPointsOS,
			style: styles.oceanStyle
		},
		{
			id: 'es',
			type: 'point',
			name: 'Ecosystem stations',
			visible: layerVisibility.es,
			data: stationPointsES,
			style: styles.ecoStyle
		},
		{
			id: 'as',
			type: 'point',
			name: 'Atmosphere stations',
			visible: layerVisibility.as,
			data: stationPointsAS,
			style: styles.atmoStyle
		},
		{
			id: 'eas',
			type: 'point',
			name: 'Ecosystem-Atmosphere',
			visible: layerVisibility.eas,
			data: duplicates,
			style: styles.ecoAtmoStyle
		},
		{
			id: 'ship',
			type: 'geojson',
			name: 'Shipping lines',
			visible: layerVisibility.ship,
			data: shippingLines.map(sl => addProps(sl)),
			style: styles.lnStyle
		}
	];
}

function filterFeatures(stationFilter, selected, ol) {
	const stationsToFilter = stationFilter.stationsToFilter;
	const stationNames = stationsToFilter.map(themeStations => themeStations.name);
	const toggleLayers = ol.getToggleLayers();

	toggleLayers.forEach(layer => {
		if (stationNames.includes(layer.get('name'))) {

			if (layer instanceof VectorLayer) {
				// points
				const vectorSource = layer.getSource();
				const points = stationsToFilter.find(theme => theme.name === layer.get('name')).data;
				const filteredPoints = points.filter(p => selected === "0" || selected.includes(p.Country));
				vectorSource.clear();
				vectorSource.addFeatures(ol.pointsToFeatures(filteredPoints));
			} else {
				// shipping lines
				const groupLayers = layer.getLayers();
				const lines = stationsToFilter.find(theme => theme.name === layer.get('name')).data;

				groupLayers.forEach(l => {
					const filteredLines = lines.filter(p => selected === "0" || selected.includes(p.properties.Country));
					const ids = filteredLines.map(l => l.properties.id);
					l.setVisible(ids.includes(l.get('id')));
				});
			}
		}
	});
}

function getBaseMapLayers(selectedtBaseMap){
	const getNewTileLayer = ({name, defaultVisibility, source, esriServiceName}) => {
		return new TileLayer({
			visible: selectedtBaseMap ? name === selectedtBaseMap : defaultVisibility,
			name,
			esriServiceName,
			layerType: 'baseMap',
			source
		});
	};

	return availableBaseMaps.map(bm => getNewTileLayer(bm));
}

function getControls(projection, mode) {
	return [
		new Zoom(),
		new ZoomSlider(),
		new ScaleLine(),
		new ZoomToExtent({extent: getViewParams(projection.getCode()).extent}),
		new ExportControl(document.getElementById('exportCtrl'), mode),
	];
}

function addProps(feature) {
	const props = Object.keys(feature).reduce((acc, key) => {
		if (key !== 'geoJson' && feature[key]){
			acc[key] = feature[key];
		}
		return acc;
	}, {});

	return {
		type: "Feature",
		geometry: feature.geoJson,
		properties: props
	};
}
