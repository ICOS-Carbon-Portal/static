import OSM from "ol/source/OSM";
import Stamen from "ol/source/Stamen";
import XYZ from "ol/source/XYZ";
import TileArcGISRest from 'ol/source/TileArcGISRest';

export default [
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
		source: new TileArcGISRest({
			url: '//server.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer',
			crossOrigin: 'anonymous'
		})
	},
	{
		name: 'Topography',
		defaultVisibility: false,
		source: new TileArcGISRest({
			url: '//server.arcgisonline.com/arcgis/rest/services/World_Topo_Map/MapServer',
			crossOrigin: 'anonymous'
		})
	},
	{
		name: 'Ocean',
		defaultVisibility: false,
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
			crossOrigin: 'anonymous'
		})
	},
	{
		name: 'Shaded relief',
		defaultVisibility: false,
		source: new TileArcGISRest({
			url: '//server.arcgisonline.com/arcgis/rest/services/World_Shaded_Relief/MapServer',
			crossOrigin: 'anonymous'
		})
	}
];
