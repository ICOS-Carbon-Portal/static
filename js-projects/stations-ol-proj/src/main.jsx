import 'babel-polyfill';
import {OL, supportedSRIDs, getViewParams, getSearchParams} from 'icos-cp-ol';
import {getCountriesGeoJson, getCountryLookup, queryMeta} from './backend';
import config from '../../common/config-urls';
import {getStations} from './sparqlQueries';
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
import LayerControl from './controls/LayerControl';
import ExportControl from './controls/ExportControl';


const start = (srid, mapOptions, layerVisibility) => {
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

		const ol = new OL(projection, baseMaps, controls, countryLookup, mapOptions);

		getCountriesGeoJson()
			.then(countriesTopo => {
				const styles = getStyles();

				ol.addGeoJson('Countries', 'baseMap', mapOptions.baseMap === 'Countries', countriesTopo, styles.countryBorderStyle, false);

				queryMeta(getStations(config))
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
					});

				if (epsgCode === 'EPSG:3035') {
					ol.outlineExtent(projection);
				}
			});
	});
};

const searchParams = getSearchParams();
const srid = searchParams.srid ? searchParams.srid : '3035';

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
		mapOptions.baseMap = decodeURIComponent(searchParams.baseMap);
	}

	const layerVisibility = {
		os: true,
		es: true,
		as: true,
		eas: true,
		ship: true
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


const getBaseMapLayers = (selectedtBaseMap) => {
	const getNewTile = (name, defaultVisibility, source) => {
		return new Tile({
			visible: selectedtBaseMap ? name === selectedtBaseMap : defaultVisibility,
			name,
			layerType: 'baseMap',
			source
		});
	};

	return [
		getNewTile(
			'OpenStreetMap',
			false,
			new OSM({crossOrigin: 'anonymous'})
		),
		getNewTile(
			'Watercolor',
			false,
			new Stamen({
				layer: 'watercolor',
				crossOrigin: 'anonymous'
			})
		),
		getNewTile(
			'Imagery',
			false,
			new XYZ({
				url: '//server.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
				crossOrigin: 'anonymous'
			})
		),
		getNewTile(
			'Topography',
			false,
			new XYZ({
				url: '//server.arcgisonline.com/arcgis/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
				crossOrigin: 'anonymous'
			})
		),
		getNewTile(
			'Ocean',
			false,
			new XYZ({
				url: '//server.arcgisonline.com/arcgis/rest/services/Ocean_Basemap/MapServer/tile/{z}/{y}/{x}',
				crossOrigin: 'anonymous'
			})
		),
		getNewTile(
			'Shaded relief',
			false,
			new XYZ({
				url: '//server.arcgisonline.com/arcgis/rest/services/World_Shaded_Relief/MapServer/tile/{z}/{y}/{x}',
				crossOrigin: 'anonymous'
			})
		),
		getNewTile(
			'Natural Earth',
			true,
			new TileJSON({
				url: 'https://api.tiles.mapbox.com/v3/mapbox.natural-earth-hypso-bathy.json?secure',
				crossOrigin: 'anonymous'
			})
		)
	];
};

const getControls = projection => {
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
		new LayerControl(document.getElementById('layerCtrl')),
		new ExportControl(document.getElementById('exportCtrl')),
	];
};

const getStyles = () => {
	return {
		countryBorderStyle: new Style({
			fill: new Fill({
				color: 'rgb(205,170,102)'
			}),
			stroke: new Stroke({
				color: 'rgb(100,100,100)',
				width: 1
			})
		}),
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

const addProps = feature => {
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
