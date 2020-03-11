import OSM from "ol/source/osm";
import Stamen from "ol/source/stamen";
import XYZ from "ol/source/xyz";

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
