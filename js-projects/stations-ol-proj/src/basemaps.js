import OSM, {ATTRIBUTION} from "ol/source/OSM";
import Stamen from "ol/source/Stamen";
import TileArcGISRest from 'ol/source/TileArcGISRest';

const baseMaps = [
	{
		name: 'OpenStreetMap',
		defaultVisibility: false,
		source: new OSM({
			attributions: ATTRIBUTION,
			crossOrigin: 'anonymous'
		})
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
		esriServiceName: 'World_Imagery',
		source: new TileArcGISRest({
			url: '//server.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer',
			crossOrigin: 'anonymous'
		})
	},
	{
		name: 'Topography',
		defaultVisibility: false,
		esriServiceName: 'World_Topo_Map',
		source: new TileArcGISRest({
			url: '//server.arcgisonline.com/arcgis/rest/services/World_Topo_Map/MapServer',
			attributions: 'Fetching from server...',
			crossOrigin: 'anonymous'
		})
	},
	{
		name: 'Ocean',
		defaultVisibility: false,
		esriServiceName: 'Ocean_Basemap',
		source: new TileArcGISRest({
			url: '//server.arcgisonline.com/arcgis/rest/services/Ocean_Basemap/MapServer',
			crossOrigin: 'anonymous'
		})
	},
	{
		name: 'Physical',
		defaultVisibility: true,
		source: new TileArcGISRest({
			url: '//server.arcgisonline.com/arcgis/rest/services/World_Physical_Map/MapServer',
			attributions: "Source: US National Park Service",
			crossOrigin: 'anonymous'
		})
	},
	{
		name: 'Shaded relief',
		defaultVisibility: false,
		source: new TileArcGISRest({
			url: '//server.arcgisonline.com/arcgis/rest/services/World_Shaded_Relief/MapServer',
			attributions: "Copyright:(c) 2014 Esri",
			crossOrigin: 'anonymous'
		})
	}
];

export const esriBaseMapNames = baseMaps.filter(bm => bm.esriServiceName).map(bm => bm.esriServiceName);

export default baseMaps;
