import 'babel-polyfill';
import {OL, supportedSRIDs, getViewParams, getSearchParams} from 'icos-cp-ol';
// import {OL, supportedSRIDs, getViewParams, getSearchParams} from './OL';
import {getCountriesGeoJson, getCountryLookup, queryMeta} from './backend';
import config from '../../common/config-urls';
import {getStations, getIcosStations} from './sparqlQueries';
import Stations from './models/Stations';
import Style from 'ol/style/style';
import Fill from 'ol/style/fill';
import Stroke from 'ol/style/stroke';
import Circle from 'ol/style/circle';
import Tile from 'ol/layer/tile';
import OSM from 'ol/source/osm';
import Stamen from 'ol/source/stamen';
import XYZ from 'ol/source/xyz';
import TileJSON from 'ol/source/tilejson';
import proj from 'ol/proj';
import Projection from 'ol/proj/projection';
import proj4 from 'proj4';
import Zoom from 'ol/control/zoom';
import ZoomSlider from 'ol/control/zoomslider';
import ScaleLine from 'ol/control/scaleline';
// import MousePosition from 'ol/control/mouseposition';
import ZoomToExtent from 'ol/control/zoomtoextent';
import {LayerControl} from 'icos-cp-ol';
// import {LayerControl} from './controls/LayerControl';
import ExportControl from './controls/ExportControl';
import StationFilter from "./models/StationFilter";


const availableBaseMaps = [
	{
		name: 'OpenStreetMap',
		defaultVisibility: false,
		source: new OSM({crossOrigin: 'anonymous'})
	},
	{
		name: 'Watercolor',
		defaultVisibility: false,
		source: new Stamen({
			layer: 'watercolor',
			crossOrigin: 'anonymous'
		})
	},
	{
		name: 'Imagery',
		defaultVisibility: false,
		source: new XYZ({
			url: '//server.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
			crossOrigin: 'anonymous'
		})
	},
	{
		name: 'Topography',
		defaultVisibility: false,
		source: new XYZ({
			url: '//server.arcgisonline.com/arcgis/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
			crossOrigin: 'anonymous'
		})
	},
	{
		name: 'Ocean',
		defaultVisibility: false,
		source: new XYZ({
			url: '//server.arcgisonline.com/arcgis/rest/services/Ocean_Basemap/MapServer/tile/{z}/{y}/{x}',
			crossOrigin: 'anonymous'
		})
	},
	{
		name: 'Physical',
		defaultVisibility: true,
		source: new XYZ({
			url: '//server.arcgisonline.com/arcgis/rest/services/World_Physical_Map/MapServer/tile/{z}/{y}/{x}',
			crossOrigin: 'anonymous'
		})
	},
	{
		name: 'Shaded relief',
		defaultVisibility: false,
		source: new XYZ({
			url: '//server.arcgisonline.com/arcgis/rest/services/World_Shaded_Relief/MapServer/tile/{z}/{y}/{x}',
			crossOrigin: 'anonymous'
		})
	}
];

const searchParams = getSearchParams();
const srid = searchParams.srid ? searchParams.srid : '3035';

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
			proj.setProj4(proj4);
			proj4.defs("EPSG:3035", "+proj=laea +lat_0=52 +lon_0=10 +x_0=4321000 +y_0=3210000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs");

			proj.addProjection(new Projection({
				code: epsgCode,
				extent: getViewParams(epsgCode).extent,
				worldExtent: getViewParams(epsgCode).extent
			}));
		}
		const projection = proj.get(epsgCode);

		const baseMaps = getBaseMapLayers(mapOptions.baseMap);
		const controls = getControls(projection);
		const layerControl = new LayerControl(document.getElementById('layerCtrl'));

		const ol = new OL(projection, baseMaps, controls.concat([layerControl]), countryLookup, mapOptions);

		getCountriesGeoJson()
			.then(countriesTopo => {
				const styles = getStyles();

				ol.addGeoJson('borders', 'Countries', 'baseMap', mapOptions.baseMap === 'Countries', countriesTopo, styles.countryStyle, false);

				queryMeta(stationsQuery)
					.then(sparqlResult => {

						const transformPointFn = projection.getCode() === 'EPSG:4326'
							? (lon, lat) => [lon, lat]
							: (lon, lat) => proj.transform([lon, lat], 'EPSG:4326', projection);

						const stations = new Stations(sparqlResult, transformPointFn);
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

						const toggleLayers = [
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

						ol.addToggleLayers(toggleLayers);

						const stationFilter = new StationFilter(toggleLayers, countryLookup, filterFeatures);
						layerControl.addCountrySelectors(stationFilter, ol);
					});

				if (epsgCode === 'EPSG:3035') {
					ol.outlineExtent(projection);
				}
			});
	});
};

function filterFeatures(stationFilter, selected, ol) {
	const stationsToFilter = stationFilter.stationsToFilter;
	const stationNames = stationsToFilter.map(themeStations => themeStations.name);
	const toggleLayers = ol.getToggleLayers();

	toggleLayers.forEach(layer => {
		if (stationNames.includes(layer.get('name'))) {

			if (layer.type === 'VECTOR') {
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
};

function getBaseMapLayers(selectedtBaseMap){
	const getNewTile = ({name, defaultVisibility, source}) => {
		return new Tile({
			visible: selectedtBaseMap ? name === selectedtBaseMap : defaultVisibility,
			name,
			layerType: 'baseMap',
			source
		});
	};

	return availableBaseMaps.map(bm => getNewTile(bm));
};

function getControls(projection) {
	return [
		new Zoom(),
		new ZoomSlider(),
		new ScaleLine(),
		// new MousePosition({
		// 	undefinedHTML: 'Mouse position',
		// 	projection,
		// 	coordinateFormat: coord => `X: ${coord[0].toFixed(0)}, Y: ${coord[1].toFixed(0)}`
		// }),
		new ZoomToExtent({extent: getViewParams(projection.getCode()).extent}),
		new ExportControl(document.getElementById('exportCtrl')),
	];
};

function getStyles() {
	return {
		countryStyle: new Style({
			fill: new Fill({
				color: 'rgb(205,170,102)'
			}),
			stroke: new Stroke({
				color: 'rgb(100,100,100)',
				width: 1
			})
		}),
		countryBorderStyle: [
			new Style({
				stroke: new Stroke({
					color: 'rgb(175,175,175)',
					width: 3
				})
			}),
			new Style({
				stroke: new Stroke({
					color: 'rgb(50,50,50)',
					width: 1
				})
			})
		],
		ptStyle: (fillColor, strokeColor = 'black', strokeWidth = 1, radius = 4) => new Style({
			image: new Circle({
				radius,
				snapToPixel: true,
				fill: new Fill({color: fillColor}),
				stroke: new Stroke({color: strokeColor, width: strokeWidth})
			})
		}),
		lnStyle: new Style({
			stroke: new Stroke({
				color: 'rgb(50,50,200)',
				width: 2
			})
		})
	};
};

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
};
