import * as olProj from 'ol/proj';
import Map from 'ol/Map';
import View from 'ol/View';
import Overlay from 'ol/Overlay';
import VectorSource from 'ol/source/Vector';
import Group from 'ol/layer/Group';
import VectorLayer from 'ol/layer/Vector';
import TileLayer from 'ol/layer/Tile';
import GeoJSON from 'ol/format/GeoJSON';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import Polygon from 'ol/geom/Polygon';
import Select from 'ol/interaction/Select';
import * as condition from 'ol/events/condition';
import {Popup} from './Popup';
import Stroke from "ol/style/Stroke";
import Style from "ol/style/Style";
import Fill from 'ol/style/Fill';

// For OpenLayers version 6.2.1

const defaultMapOptions = {
	// Initial zoom level
	zoom: 4,
	// Fit view (defined in getViewParams) on initial load (overrides zoom and center)
	fitView: true,
	popupEnabled: true,
	// What key in props to use for popup header
	popupHeader: 'Short_name',
	// What keys in props to use for popup
	popupProps: ['Country', 'Site_type', 'Long_name', 'PI_names'],
	// Should a popup slide map so it fits the popup
	autoPan: false,
	// Radius in pixels around mouse position where features should be selected for popup
	hitTolerance: 5,
	// Update URL when zoom, pan, base map and toggle layers change
	updateURL: false
};

export class OL{
	constructor(projection, layers = [], controls = [], countryLookup, mapOptions){
		this._projection = projection;
		this._layers = layers;
		this._controls = controls;
		this._layerCtrl = controls.find(ctrl => ctrl.isLayerControl);
		this._mapOptions = Object.assign(defaultMapOptions, mapOptions);
		this._viewParams = getViewParams(projection.getCode());
		this._map = undefined;
		this._points = [];
		this._isPopstateEvent = false;
		this._toggleLayers = undefined;

		if (this._mapOptions.updateURL){
			const baseMaps = layers.filter(l => l.get('layerType') === 'baseMap');
			baseMaps.forEach(bm => bm.on('change:visible', () => this.updateURL()));
		}

		this.initMap(countryLookup);
	}

	get map(){
		return this._map;
	}

	initMap(countryLookup){
		const view = new View({
			projection: this._projection,
			center: this._mapOptions.center || this._viewParams.initCenter,
			zoom: this._mapOptions.zoom,
			extent: this._viewParams.extent,
			showFullExtent: true
		});

		const pp = this._mapOptions.popupEnabled
			? new Popup('popover', this._mapOptions.popupProps, countryLookup)
			: undefined;
		const popup = this._mapOptions.popupEnabled
			? new Overlay({
				element: pp.popupElement,
				autoPan: this._mapOptions.autoPan,
				autoPanAnimation: {
					duration: 250
				}
			})
			: undefined;
		const overlays = this._mapOptions.popupEnabled ? [popup] : [];

		if (this._mapOptions.updateURL) {
			const baseMaps = this._layers.filter(l => l.get('layerType') === 'baseMap');
			const visibleBaseMap = getVisibleBaseMap(baseMaps);

			if (visibleBaseMap) this._layerCtrl.setDefaultBaseMap(visibleBaseMap.get('name'));
		}

		this._map = new Map({
			target: 'map',
			view,
			layers: this._layers,
			overlays,
			controls: this._controls
		});

		if (this._mapOptions.popupEnabled) {
			this.addPopup(popup, pp);
		}

		if (this._mapOptions.fitView) {
			view.fit(this._viewParams.extent);
		}

		if (this._mapOptions.updateURL) {
			this._map.on("moveend", e => {
				if (this._isPopstateEvent){
					this._isPopstateEvent = false;
					return;
				}

				const searchParams = getSearchParams();
				const newURL = getNewUrl(searchParams, view);
				history.pushState({}, "", newURL);
			});

			window.addEventListener("popstate", () => {
				this._isPopstateEvent = true;
				if (this._toggleLayers === undefined) return;

				const searchParams = getSearchParams();

				const baseMaps = this.getBaseMaps();
				const selectedBaseMap = searchParams.baseMap ? searchParams.baseMap : this._layerCtrl.defaultBaseMap;

				baseMaps.forEach(bm => {
					if (bm instanceof Group){
						bm.getLayers().getArray().forEach(l => l.setVisible(l.get('name') === selectedBaseMap));
					} else {
						bm.setVisible(bm.get('name') === selectedBaseMap)
					}
				});
				this._layerCtrl.toggleInput('radio', selectedBaseMap, true);


				if (searchParams.zoom) view.setZoom(searchParams.zoom);
				if (searchParams.center) view.setCenter(searchParams.center.split(','));

				const toggleLayers = this._toggleLayers;
				const showLayers = searchParams.hasOwnProperty('show')
					? searchParams.show.split(',')
					: toggleLayers.map(tl => tl.id);
				const layerCollection = this._map.getLayers();

				layerCollection.forEach(l => {
					const isVector = l instanceof VectorLayer;
					const isTile = l instanceof TileLayer;
					const id = name2id(toggleLayers, l.get('name'));

					if (id) {
						l.setVisible(showLayers.includes(id));
					}
				});
			});
		}
	}

	getBaseMaps(){
		return this.getLayers('baseMap');
	}

	getToggleLayers(){
		return this.getLayers('toggle');
	}

	getLayers(layerType){
		const allLayers = this._map.getLayers().getArray();
		return allLayers.filter(l => l.get('layerType') === layerType);
	}

	updateURL(){
		if (this._isPopstateEvent){
			this._isPopstateEvent = false;
			if (this._layerCtrl && this._toggleLayers) {
				this._layerCtrl.setChecked(getSearchParams(), id2name(this._toggleLayers));
			}

			return;
		}

		if (this._toggleLayers) {
			const visibleBaseMap = getVisibleBaseMap(this.getBaseMaps());

			const toggles = this.getToggleLayers();
			const toggleLayers = this._toggleLayers;
			const idSet = new Set();

			toggles.forEach(tl => {
				if (tl.getVisible()) idSet.add(name2id(toggleLayers, tl.get('name')));
			});

			const visibleToggles = Array.from(idSet);
			const allVisible = !!toggleLayers.reduce((acc, l) => {
				return acc * visibleToggles.includes(l.id);
			}, true);

			const searchParams = getSearchParams();
			const currentShow = searchParams.show;

			if (allVisible) {
				delete searchParams.show;
			} else {
				searchParams.show = visibleToggles.join(',');
			}

			const defaultBaseMap = this._layerCtrl.defaultBaseMap;
			const urlBaseMap = searchParams.baseMap;
			const shownBaseMap = visibleBaseMap ? visibleBaseMap.get('name') : undefined;
			searchParams.baseMap = shownBaseMap;

			const pushBaseMapChangeToHistory = (
				searchParams.baseMap !== undefined && urlBaseMap !== searchParams.baseMap
				|| shownBaseMap === defaultBaseMap && shownBaseMap !== urlBaseMap
			);

			if (currentShow !== searchParams.show || pushBaseMapChangeToHistory) {
				const newURL = getNewUrl(searchParams, this._map.getView());
				history.pushState({}, "", newURL);
			}
		}
	}

	addPopup(popup, pp){
		const map = this._map;
		const select = new Select({
			condition: condition.pointerMove,
			layers: layer => layer.get('interactive'),
			multi: true,
			hitTolerance: this._mapOptions.hitTolerance,
			// wrapX: false
		});
		map.addInteraction(select);

		select.on('select', e => {
			const features = e.target.getFeatures();

			if (features.getLength()) {
				pp.reset();

				for (let [idx, f] of features.getArray().entries()){
					if (idx <= 1){
						const id = f.get('id');
						const type = f.get('type');
						const props = type === 'point'
							? this._points.find(props => props.id === id)
							: f.getProperties();

						pp.addObject("Station information for " + props[this._mapOptions.popupHeader], props);
					} else {
						pp.addTxt(`Zoom in to see ${features.getLength() - 2} more`);
						return;
					}
				}

				popup.setPosition(e.mapBrowserEvent.coordinate);
			} else {
				popup.setPosition(undefined);
			}
		});

		map.on('pointermove', e => {
			const pixel = map.getEventPixel(e.originalEvent);
			const f = map.forEachFeatureAtPixel(pixel, (feature, layer) => feature);

			if (popup.getPosition()) {
				popup.setPosition(e.coordinate);

			} else if (f && f.get('id')){
				const id = f.get('id');
				const type = f.get('type');
				const props = type === 'point'
					? this._points.find(props => props.id === id)
					: f.getProperties();

				pp.reset();
				pp.addObject("Station information for " + props[this._mapOptions.popupHeader], props);
				popup.setPosition(e.coordinate);
			}
		});
	}

	addToggleLayers(toggleLayers){
		toggleLayers.forEach(tl => {
			if (tl.type === 'point'){
				this.addPoints(tl.id, tl.name, 'toggle', tl.visible, tl.data, tl.style);
			} else if (tl.type === 'geojson'){
				const isInteractive = tl.interactive === undefined ? true : tl.interactive;

				if (Array.isArray(tl.data)) {

					const vectorLayers = tl.data.map(data =>
						this.addGeoJson(data.properties.id, tl.name, 'toggle', true, data, tl.style, isInteractive, false)
					);
					const group = new Group({
						layers: vectorLayers,
						name: tl.name,
						layerType: 'toggle',
						visible: tl.visible
					});
					if (this._mapOptions.updateURL) {
						group.on('change:visible', () => this.updateURL());
					}
					this._map.addLayer(group);

				} else {
					this.addGeoJson(tl.id, tl.name, 'toggle', tl.visible, tl.data, tl.style, isInteractive, true);
				}
			}
		});

		this._toggleLayers = toggleLayers;
	}

	addGeoJson(id, name, layerType, visible = true, geoJson, style, interactive = true, addToMap = true){
		const vectorSource = new VectorSource({
			features: this.geoJsonToFeatures(geoJson)
		});

		const vectorLayer = new VectorLayer({
			id,
			name,
			visible,
			layerType,
			interactive,
			extent: this._viewParams.extent,
			source: vectorSource,
			style
		});

		if (addToMap) {
			if (this._mapOptions.updateURL) {
				if (visible && getVisibleBaseMap(this.getBaseMaps()) === undefined) {
					this._layerCtrl.setDefaultBaseMap(name);
				}

				vectorLayer.on('change:visible', () => this.updateURL());
			}

			this._map.addLayer(vectorLayer);
		} else {
			return vectorLayer;
		}
	}

	addPoints(id, name, layerType, visible = true, points, style, renderOrder){
		this._points = this._points.concat(points);

		const vectorSource = new VectorSource({
			features: this.pointsToFeatures(points)
		});

		const vectorLayer = new VectorLayer({
			id,
			name,
			visible,
			layerType,
			interactive: true,
			extent: this._viewParams.extent,
			renderOrder,
			source: vectorSource,
			style
		});

		if (this._mapOptions.updateURL) {
			vectorLayer.on('change:visible', () => {
				this.updateURL();
			});
		}

		this._map.addLayer(vectorLayer);
	}

	pointsToFeatures(points){
		return points.map(p => new Feature({
			id: p.id,
			country: p.Country,
			type: p.type,
			geometry: new Point(p.point, 'XY')
		}));
	}

	geoJsonToFeatures(geoJson){
		return (new GeoJSON()).readFeatures(geoJson, {
			dataProjection: 'EPSG:4326',
			featureProjection: this._projection
		});
	}

	outlineExtent(projection){
		const rectCoords = getViewParams(projection.getCode()).rect;
		const rect = [
			[rectCoords[0], rectCoords[1]],
			[rectCoords[2], rectCoords[3]],
			[rectCoords[4], rectCoords[5]],
			[rectCoords[6], rectCoords[7]],
			[rectCoords[8], rectCoords[9]],
		];

		const vectorSource = new VectorSource({
			features: [new Feature({geometry: new Polygon([rect])})]
		});

		const vectorLayer = new VectorLayer({
			source: vectorSource,
			style: new Style({
				stroke: new Stroke({
					color: 'rgb(100,100,100)',
					width: 1
				})
			}),
			zIndex: 99
		});

		this._map.addLayer(vectorLayer);

		//Add blue background in the extent
		const bgRect = new VectorLayer({
			source: vectorSource,
			style: new Style({
				fill: new Fill({
					color: 'rgb(174,225,230)'
				})
			})
		});

		const layerCollection = this._map.getLayers();
		layerCollection.insertAt(0, bgRect);
	}
}

export const supportedSRIDs = ['3006', '3035', '4326', '3857'];

export const getViewParams = epsgCode => {
	const bBox3006 = [[190000, 6101648], [970000, 7689478]];
	const bBox4326 = [[-180, -90], [180, 90]];
	const bBox3857 = [[-20026376.39, -20048966.10], [20026376.39, 20048966.10]];
	const bBox3035 = [[1896628.618, 1330000], [7058042.778, 6827128.02]];

	switch (epsgCode){
		case 'EPSG:3006':
			return {
				initCenter: [682519, 1587830],
				extent: [bBox3006[0][0], bBox3006[0][1], bBox3006[1][0], bBox3006[1][1]],
				rect:[
					bBox3006[0][0], bBox3006[0][1],
					bBox3006[0][0], bBox3006[1][1],
					bBox3006[1][0], bBox3006[1][1],
					bBox3006[1][0], bBox3006[0][1],
					bBox3006[0][0], bBox3006[0][1]
				],
			};

		case 'EPSG:4326':
			return {
				initCenter: [0, 20],
				extent: [bBox4326[0][0], bBox4326[0][1], bBox4326[1][0], bBox4326[1][1]]
			};

		case 'EPSG:3857':
			return {
				initCenter: olProj.fromLonLat([0, 20], 'EPSG:3857'),
				extent: [bBox3857[0][0], bBox3857[0][1], bBox3857[1][0], bBox3857[1][1]]
			};

		case 'EPSG:3035':
			return {
				initCenter: [4321000, 4080000],
				extent: [bBox3035[0][0], bBox3035[0][1], bBox3035[1][0], bBox3035[1][1]],
				rect:[
					bBox3035[0][0], bBox3035[0][1],
					bBox3035[0][0], bBox3035[1][1],
					bBox3035[1][0], bBox3035[1][1],
					bBox3035[1][0], bBox3035[0][1],
					bBox3035[0][0], bBox3035[0][1]
				],
			};

		default:
			throw new Error('Unsupported projection: ' + epsgCode);
	}
};

export const getSearchParams = () => {
	const searchStr = decodeURIComponent(window.location.search).replace(/^\?/, '');
	const keyValpairs = searchStr.split('&');
	return keyValpairs.reduce((acc, curr) => {
		const p = curr.split('=');
		if (p[0]) acc[p[0]] = p[1];
		return acc;
	}, {});
};

const getNewUrl = (searchParams, view) => {
	searchParams.center = view.getCenter().join(',');
	searchParams.zoom = view.getZoom();
	const newSearch = '?' + Object.keys(searchParams).reduce((acc, key) => {
		acc.push(key + '=' + searchParams[key]);
		return acc;
	}, []).join('&');

	return location.origin + location.pathname + newSearch;
};

const id2name = (toggleLayers) => {
	return id => {
		const layer = toggleLayers.find(l => l.id === id);
		return layer ? layer.name : undefined;
	}
};

const name2id = (toggleLayers, name) => {
	const layer = toggleLayers.find(l => l.name === name);
	return layer ? layer.id : undefined;
};

const getVisibleBaseMap = baseMaps => {
	return baseMaps.reduce((acc, bm) => {
		if (bm instanceof Group){
			const visibleLayer = bm.getLayers().getArray().find(l => l.getVisible());
			if (visibleLayer) acc = visibleLayer;
		} else {
			if (bm.getVisible()) acc = bm;
		}

		return acc;
	}, undefined);
};
