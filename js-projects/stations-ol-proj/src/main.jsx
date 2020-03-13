// import {OL, supportedSRIDs, getViewParams, getSearchParams} from 'icos-cp-ol';
import {OL, supportedSRIDs, getViewParams, getSearchParams} from './OL';
import {getCountriesGeoJson, getCountryLookup, queryMeta} from './backend';
import config from '../../common/config-urls';
import {getStations, getIcosStations} from './sparqlQueries';
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
// import {LayerControl} from 'icos-cp-ol';
import {LayerControl} from './controls/LayerControl';
import ExportControl from './controls/ExportControl';
import StationFilter from "./models/StationFilter";
import availableBaseMaps from "./basemaps";
import styles from "./styles";

const searchParams = getSearchParams();
const srid = searchParams.srid ?? '3035';

const stationsQuery = searchParams.icosMeta ? getIcosStations : getStations(config);

if (supportedSRIDs.includes(srid)){
	const mapOptions = {updateURL: true};

	if (searchParams.zoom && searchParams.zoom.match(/^\d{1,2}$/)) {
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
	const infoDiv = document.getElementById('map');
	infoDiv.setAttribute('style', 'padding: 10px;');
	infoDiv.innerHTML = "Illegal SRID. Must be one of these: " + supportedSRIDs.join(', ');
}

function start(srid, mapOptions, layerVisibility) {
	getCountryLookup().then(countryLookup => {
		const epsgCode = 'EPSG:' + srid;

		if (epsgCode === 'EPSG:3035') {
			proj4.defs("EPSG:3035", "+proj=laea +lat_0=52 +lon_0=10 +x_0=4321000 +y_0=3210000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs");
			register(proj4);

			olProj.addProjection(new Projection({
				code: epsgCode,
				extent: getViewParams(epsgCode).extent,
				worldExtent: getViewParams(epsgCode).extent
			}));
		}
		const projection = olProj.get(epsgCode);

		const baseMaps = getBaseMapLayers(mapOptions.baseMap);
		const controls = getControls(projection);
		const layerControl = new LayerControl(document.getElementById('layerCtrl'), false);

		return {
			ol: new OL(projection, baseMaps, controls.concat([layerControl]), countryLookup, mapOptions),
			countryLookup,
			layerControl,
			projection
		};

	}).then(({ol, countryLookup, layerControl, projection}) => {
		return getCountriesGeoJson().then(countriesTopo => {
			ol.addGeoJson('borders', 'Countries', 'baseMap', mapOptions.baseMap === 'Countries', countriesTopo, styles.countryStyle, false);

			return {
				ol,
				countryLookup,
				layerControl,
				projection,
				countriesTopo
			};
		});

	}).then(({ol, countryLookup, layerControl, projection, countriesTopo}) => {
		queryMeta(stationsQuery).then(sparqlResult => {
			const transformPointFn = projection.getCode() === 'EPSG:4326'
				? (lon, lat) => [lon, lat]
				: (lon, lat) => olProj.transform([lon, lat], 'EPSG:4326', projection);

			const stations = new Stations(sparqlResult, transformPointFn);
			const toggleLayers = getToggleLayers(layerVisibility, countriesTopo, stations);
			ol.addToggleLayers(toggleLayers);

			const stationFilter = new StationFilter(toggleLayers, countryLookup, filterFeatures);
			layerControl.addCountrySelectors(stationFilter, ol);
		})
	});
}

function getToggleLayers(layerVisibility, countriesTopo, stations){
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
		{
			id: 'bdr',
			type: 'geojson',
			name: 'Country borders',
			interactive: false,
			visible: layerVisibility.bdr,
			data: countriesTopo,
			style: styles.countryBorderStyle
		},
		{
			id: 'os',
			type: 'point',
			name: 'Ocean stations',
			visible: layerVisibility.os,
			data: stationPointsOS,
			style: styles.ptStyle('blue')
		},
		{
			id: 'es',
			type: 'point',
			name: 'Ecosystem stations',
			visible: layerVisibility.es,
			data: stationPointsES,
			style: styles.ptStyle('green')
		},
		{
			id: 'as',
			type: 'point',
			name: 'Atmosphere stations',
			visible: layerVisibility.as,
			data: stationPointsAS,
			style: styles.ptStyle('rgb(255,50,50)')
		},
		{
			id: 'eas',
			type: 'point',
			name: 'Ecosystem-Atmosphere',
			visible: layerVisibility.eas,
			data: duplicates,
			style: styles.ptStyle('rgb(248,246,26)')
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

			if (layer.constructor.name === 'VectorLayer') {
				// points
				const vectorSource = layer.getSource();
				const points = stationsToFilter.find(theme => theme.name === layer.get('name')).data;
				const filteredPoints = points.filter(p => selected === "0" || p.Country === selected);
				vectorSource.clear();
				vectorSource.addFeatures(ol.pointsToFeatures(filteredPoints));
			} else {
				// shipping lines
				const groupLayers = layer.getLayers();
				const lines = stationsToFilter.find(theme => theme.name === layer.get('name')).data;

				groupLayers.forEach(l => {
					const filteredLines = lines.filter(p => selected === "0" || p.properties.Country === selected);
					const ids = filteredLines.map(l => l.properties.id);
					l.setVisible(ids.includes(l.get('id')));
				});
			}
		}
	});
}

function getBaseMapLayers(selectedtBaseMap){
	const getNewTileLayer = ({name, defaultVisibility, source}) => {
		return new TileLayer({
			visible: selectedtBaseMap ? name === selectedtBaseMap : defaultVisibility,
			name,
			layerType: 'baseMap',
			source
		});
	};

	return availableBaseMaps.map(bm => getNewTileLayer(bm));
}

function getControls(projection) {
	return [
		new Zoom(),
		new ZoomSlider(),
		new ScaleLine(),
		new ZoomToExtent({extent: getViewParams(projection.getCode()).extent}),
		new ExportControl(document.getElementById('exportCtrl')),
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
