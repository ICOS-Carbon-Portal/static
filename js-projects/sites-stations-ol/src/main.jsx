import 'babel-polyfill';
import {OL, supportedSRIDs, getViewParams} from 'icos-cp-ol';
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


const start = (srid, mapOptions) => {
	getCountryLookup().then(countryLookup => {
		const epsgCode = 'EPSG:' + srid;

		proj.setProj4(proj4);
		proj4.defs("EPSG:3006","+proj=utm +zone=33 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs");

		const projection = proj.get(epsgCode);
		const layers = getLayers();
		const controls = getControls(projection);

		const sitesMapOptions = {
			popupHeader: 'name',
			popupProps: ['id']
		};

		const map = new OL(projection, layers, controls, countryLookup, sitesMapOptions);

		getCountriesGeoJson()
			.then(countriesTopo => {
				const styles = getStyles();

				map.addGeoJson('Countries', 'baseMap', false, countriesTopo, styles.countryBorderStyle, false);

				queryMeta(getStations(config))
					.then(sparqlResult => {

						const transformPointFn = projection.getCode() === 'EPSG:4326'
							? (lon, lat) => [lon, lat]
							: (lon, lat) => proj.transform([lon, lat], 'EPSG:4326', projection);

						const stations = new Stations(sparqlResult, transformPointFn);
						const duplicates = stations.getDuplicates({type: 'point'});

						const stationPointsSites = stations
							.filterByAttr({type: 'point'})
							.filter(s => !duplicates.some(d => d.id === s.id));
						map.addPoints('Sites stations', 'toggle', stationPointsSites, styles.ptStyle('green'));
					});
			});
	});
};

const searchStr = window.decodeURIComponent(window.location.search).replace(/^\?/, '');
const keyValpairs = searchStr.split('&');
const searchParams = keyValpairs.reduce((acc, curr) => {
	const p = curr.split('=');
	acc[p[0]] = p[1];
	return acc;
}, {});

const srid = searchParams.srid ? searchParams.srid : '3006';
const mapOptions = {};

if (searchParams.zoom && searchParams.zoom.match(/^\d{1,2}$/)) {
	Object.assign(mapOptions, {zoom: parseInt(searchParams.zoom)});
}

if (searchParams.center && searchParams.center.match(/^\d+,\d+$/)) {
	Object.assign(mapOptions, {center: searchParams.center.split(',').map(p => parseInt(p))});
}

if (mapOptions.zoom && mapOptions.center) {
	Object.assign(mapOptions, {fitView: false});
}

if (supportedSRIDs.includes(srid)){
	start(srid, mapOptions);
} else {
	const infoDiv = document.getElementById('map');
	infoDiv.setAttribute('style', 'padding: 10px;');
	infoDiv.innerHTML = "Illegal SRID. Must be one of these: " + supportedSRIDs.join(', ');
}

const getLayers = () => {
	return [
		new Tile({
			visible: false,
			name: 'OpenStreetMap',
			layerType: 'baseMap',
			source: new OSM({crossOrigin: 'anonymous'})
		}),
		new Tile({
			visible: false,
			name: 'Watercolor',
			layerType: 'baseMap',
			source: new Stamen({
				layer: 'watercolor',
				crossOrigin: 'anonymous'
			})
		}),
		new Tile({
			visible: false,
			name: 'Imagery',
			layerType: 'baseMap',
			source: new XYZ({
				url: '//server.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
				crossOrigin: 'anonymous'
			})
		}),
		new Tile({
			visible: false,
			name: 'Topology',
			layerType: 'baseMap',
			source: new XYZ({
				url: '//server.arcgisonline.com/arcgis/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
				crossOrigin: 'anonymous'
			})
		}),
		new Tile({
			visible: false,
			name: 'Ocean',
			layerType: 'baseMap',
			source: new XYZ({
				url: '//server.arcgisonline.com/arcgis/rest/services/Ocean_Basemap/MapServer/tile/{z}/{y}/{x}',
				crossOrigin: 'anonymous'
			})
		}),
		new Tile({
			visible: false,
			name: 'Shaded relief',
			layerType: 'baseMap',
			source: new XYZ({
				url: '//server.arcgisonline.com/arcgis/rest/services/World_Shaded_Relief/MapServer/tile/{z}/{y}/{x}',
				crossOrigin: 'anonymous'
			})
		}),
		new Tile({
			visible: true,
			name: 'Natural Earth',
			layerType: 'baseMap',
			source: new TileJSON({
				url: 'https://api.tiles.mapbox.com/v3/mapbox.natural-earth-hypso-bathy.json?secure',
				crossOrigin: 'anonymous'
			})
		})
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
		new LayerControl(document.getElementById('layerCtrl'))
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
