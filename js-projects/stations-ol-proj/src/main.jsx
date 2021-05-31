import { OL, supportedSRIDs, getViewParams, getSearchParams, projDefinitions, LayerControl } from 'icos-cp-ol';
import {getCountriesGeoJson, getCountryLookup, getESRICopyRight} from './backend';
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
import { StationParser, fetchMergeParseStations } from '../../commonJs/tsTarget/stations';
import { Vars } from '../../commonJs/tsTarget/stations';
import bboxClip from '@turf/bbox-clip';
import { polygon } from '@turf/helpers';

// For OpenLayers version 6.2.1

const searchParams = getSearchParams();

const srid = searchParams.srid ?? '3035';

if (Object.keys(supportedSRIDs).includes(srid)){
	const mapOptions = {
		updateURL: true,
		popupProps: [Vars.stationName, Vars.country, Vars.theme, Vars.siteType, Vars.pi]
	};

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
		overlap: true,
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

async function start(srid, mapOptions, layerVisibility) {
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
	
	const countryLookup = await getCountryLookup();
	const baseMaps = getBaseMapLayers(mapOptions.baseMap);
	const controls = getControls(projection, searchParams.mode);
	const layerControl = new LayerControl(document.getElementById('layerCtrl'));
	const ol = new OL(projection, baseMaps, controls.concat([layerControl]), countryLookup, mapOptions);

	const countriesTopo = await getCountriesGeoJson();
	ol.addGeoJson('borders', 'Countries', 'baseMap', mapOptions.baseMap === 'Countries', countriesTopo, styles.countryStyle, false);

	const stationParser = new StationParser(countryLookup, transformPointFn);
	const stationsParsed = await fetchMergeParseStations(stationParser);
	const stations = new Stations(stationsParsed);

	const toggleLayers = getToggleLayers(layerVisibility, countriesTopo, stations);
	ol.addToggleLayers(toggleLayers);

	const featureFilter = new StationFilter(toggleLayers, filterFeatures(pointFilterFn, shippingFilterFn), countryLookup);
	layerControl.addCountrySelectors(featureFilter, ol);
	layerControl.addToggleForLabeledStations(featureFilter, ol);

	if (searchParams.countries) {
		const countryList = searchParams.countries.split(',');

		// Only run filter if every country code provided in URL exists in lookup
		if (countryList.every(country => countryLookup[country])) {
			featureFilter.filterFn(featureFilter, countryList, ol);
		}
	}

	const minWidth = 600;
	const width = document.getElementsByTagName('body')[0].getBoundingClientRect().width;
	if (width < minWidth) return;

	getESRICopyRight(esriBaseMapNames).then(attributions => {
		ol.attributionUpdater = new Copyright(attributions, projection, 'baseMapAttribution', minWidth);
	});
}

const clipToBbox = (layer) => {
	if (layer.id === "http://meta.icos-cp.eu/resources/stations/OS_PS-VOS") {
		const originalCoords = layer.geoJson.geometries.map(geom => geom.coordinates);
		const clippedGeometries = originalCoords
			.map(coords => bboxClip(polygon(coords), [-180, 0, 180, 90]))
			.map(f => f.geometry);
		layer.geoJson.geometries = clippedGeometries;
	}
	
	return layer;
};

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
	const shipping = srid === '3035'
		? stations.filterByAttr({ type: 'geo' }).map(clipToBbox)
		: stations.filterByAttr({ type: 'geo' });

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
			id: 'as',
			type: 'point',
			name: 'Atmosphere stations',
			visible: layerVisibility.as,
			data: stationPointsAS,
			style: styles.atmoStyle
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
			id: 'os',
			type: 'point',
			name: 'Ocean stations',
			visible: layerVisibility.os,
			data: stationPointsOS,
			style: styles.oceanStyle
		},
		{
			id: 'overlap',
			type: 'point',
			name: 'Overlapping stations',
			visible: layerVisibility.overlap,
			isEmpty: duplicates.length === 0,
			data: duplicates,
			style: styles.samePosStyle
		},
		{
			id: 'ship',
			type: 'geojson',
			name: 'Shipping geo coverage',
			visible: layerVisibility.ship,
			data: shipping.map(sl => addProps(sl)),
			style: styles.lnStyle
		}
	];
}

const pointFilterFn = (stationsToFilter, layer, ol, selectedCountry, showNonLabelledStations) => {
	const vectorSource = layer.getSource();
	const points = stationsToFilter.find(toggleGroup => toggleGroup.name === layer.get('name')).data;
	const filteredPoints = points.filter(p =>
		(selectedCountry === "0" || selectedCountry.includes(p.Country)) && (showNonLabelledStations ? true : p[Vars.labelingDate] !== "")
	);

	vectorSource.clear();
	vectorSource.addFeatures(ol.pointsToFeatures(filteredPoints));
};

const shippingFilterFn = (stationsToFilter, layer, selectedCountry, showNonLabelledStations) => {
	const groupLayers = layer.getLayers();
	const linesPolys = stationsToFilter.find(toggleGroup => toggleGroup.name === layer.get('name')).data;

	groupLayers.forEach(l => {
		const filteredLinesPolys = linesPolys.filter(lp =>
			(selectedCountry === "0" || selectedCountry.includes(lp.properties.Country)) && (showNonLabelledStations ? true : lp.properties[Vars.labelingDate])
		);
		const ids = filteredLinesPolys.map(l => l.properties.id);
		l.setVisible(ids.includes(l.get('id')));
	});
};

const filterFeatures = (pointFilter, linePolyFilter) => (stationFilter, ol, selectedCountry, showNonLabelledStations) => {
	const stationsToFilter = stationFilter.stationsToFilter;
	const stationNames = stationsToFilter.map(themeStations => themeStations.name);
	const toggleLayers = ol.getToggleLayers();

	const selectedCountryCombined = selectedCountry ?? stationFilter.selectedCountry;
	stationFilter.selectedCountry = selectedCountryCombined;
	const showNonLabelledStationsCombined = showNonLabelledStations === undefined
		? stationFilter.showNonLabelledStations
		: showNonLabelledStations;
	stationFilter.showNonLabelledStations = showNonLabelledStationsCombined;

	toggleLayers.forEach(layer => {
		if (stationNames.includes(layer.get('name'))) {

			if (layer instanceof VectorLayer) {
				// points
				pointFilter(stationsToFilter, layer, ol, selectedCountryCombined, showNonLabelledStationsCombined);

			} else {
				// shipping
				linePolyFilter(stationsToFilter, layer, selectedCountryCombined, showNonLabelledStationsCombined);
			}
		}
	});
};

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
