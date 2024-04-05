import {Coordinate} from "ol/coordinate";
import {ReducedStation, Vars} from "../../../commonJs/main/stations";
import * as condition from 'ol/events/condition';
import {getCountriesGeoJson, getCountryLookup} from "../backend";
import Projection from "ol/proj/Projection";
import {fetchMergeParseStations, StationParser} from "../../../commonJs/main/stations";
import Stations from "./Stations";
import VectorLayer from "ol/layer/Vector";
import Style from "ol/style/Style";
import {olMapSettings} from "../main";
import Feature from "ol/Feature";
import {Select} from "ol/interaction";
import {Collection, View} from "ol";
import Point from "ol/geom/Point";
import {GeometryCollection} from "ol/geom";
import {
	atmoStyle,
	BaseMapFilter,
	BaseMapId, clipToBbox, Copyright, countryBorderStyle, countryStyle, createPointData, ecoStyle,
	EpsgCode, esriBaseMapNames,
	ExportControl,
	getBaseMapLayers,
	getDefaultControls,
	getESRICopyRight, getFeatureCollection, getLayerIcon, getLayerWrapper,
	getProjection,
	getTransformPointFn,
	LayerControl, LayerWrapper, lnStyle,
	MapOptions, oceanStyle,
	OLWrapper, StationFilter,
	PersistedMapProps,
	Popup, roundCoord, round,
	SupportedSRIDs,
	TransformPointFn, VectorLayerExtended
} from "icos-cp-ol";
import VectorSource from "ol/source/Vector";

export type InitMapOptions = MapOptionsExpanded & {
	sridsInMap: Record<SupportedSRIDs, string>
	srid: SupportedSRIDs
	baseMapFilter: BaseMapFilter
	countryFilter?: string
	iconStyles: Record<string, Style>
}

const layerNames = ['os', 'es', 'as', 'overlap', 'ship', 'bdr'] as const;
type LayerName = typeof layerNames[number]
export type LayerVisibility = Record<string | LayerName, boolean>
export interface MapOptionsExpanded extends Partial<MapOptions> {
	updateURL: boolean
	center?: Coordinate
	hitTolerance?: number
	baseMap: BaseMapId
}

type OurProps = {
	mapRootElement: HTMLElement
	mapOptions: InitMapOptions
	layerVisibility: LayerVisibility
}

const countryBordersId: LayerName = 'bdr';

export default class InitMap {
	private olWrapper: OLWrapper;
	private pointTransformer: TransformPointFn;
	private countryLookup: Record<string, string>;
	private layerVisibility: LayerVisibility;
	private layerControl: LayerControl
	private mapOptions: InitMapOptions;
	private persistedMapProps: PersistedMapProps;
	private popup: Popup;
	private isPopstateEvent: boolean = false;
	private useCountrySelector: boolean = true;

	constructor(props: OurProps) {
		const {
			mapRootElement,
			mapOptions,
			layerVisibility
		} = props;

		this.countryLookup = {};
		this.layerVisibility = layerVisibility;
		this.mapOptions = mapOptions;
		this.persistedMapProps = {
			srid: mapOptions.srid,
			center: mapOptions.center,
			zoom: mapOptions.zoom,
			baseMap: mapOptions.baseMap,
			countryFilter: mapOptions.countryFilter,
			visibleToggles: Object.keys(layerVisibility).map(key => key).filter(key => layerVisibility[key])
		};
		this.useCountrySelector = mapOptions.srid !== "3006";

		const epsgCode = `EPSG:${mapOptions.srid}` as EpsgCode;
		const projection = getProjection(epsgCode)!;
		this.pointTransformer = getTransformPointFn("EPSG:4326", epsgCode);

		const tileLayers = getBaseMapLayers(mapOptions.baseMap, mapOptions.baseMapFilter);
		const controls = getDefaultControls(projection);
		controls.push(new ExportControl(document.getElementById('exportCtrl')!));

		const updatePersistedMapProps = this.persistedMapPropsWasUpdated.bind(this);

		this.layerControl = new LayerControl({
			element: document.getElementById('layerCtrl') ?? undefined,
			useCountrySelector: this.useCountrySelector,
			selectedBaseMap: mapOptions.baseMap,
			updateCtrl: updateLayerCtrl
		});
		this.layerControl.on('change', e => {
			const layerCtrl = e.target as LayerControl;
			updatePersistedMapProps({
				baseMap: layerCtrl.selectedBaseMap,
				visibleToggles: layerCtrl.visibleToggleLayerIds,
				countryFilter: layerCtrl.countrySelector?.value
			});
		});
		controls.push(this.layerControl);

		this.popup = new Popup('popover');

		const olProps = {
			mapRootElement: mapRootElement,
			projection,
			tileLayers,
			mapOptions,
			popupTemplate: this.popup,
			controls,
			fitView: mapOptions.fitView
		};

		this.olWrapper = new OLWrapper(olProps);
		const view = this.olWrapper.map.getView();

		this.start(projection, layerVisibility, mapOptions.countryFilter)
			.then(_ => this.addListeners(view, updatePersistedMapProps))
			.then(_ => updatePersistedMapProps({ center: view.getCenter(), zoom: view.getZoom() }));
	}

	private async start(projection: Projection, layerVisibility: LayerVisibility, countryFilter?: string) {
		this.countryLookup = await getCountryLookup();
		await this.fetchAndAddCountriesTopo(layerVisibility);

		const stationParser = new StationParser(this.countryLookup, this.pointTransformer);
		const stationsParsed = await fetchMergeParseStations(stationParser) as ReducedStation[];
		const stations = new Stations(stationsParsed);

		const stationToggleLayers = getStationToggleLayers(this.layerVisibility, stations, projection.getCode() as EpsgCode);
		const mapToggles = this.olWrapper.addToggleLayers(stationToggleLayers);

		if (this.useCountrySelector) {
			const filterFn = filterFeatures(mapToggles, layerFilterFn);
			const featureFilter = new StationFilter(stationToggleLayers, filterFn, this.countryLookup);
			this.layerControl.addCountrySelectors(featureFilter, countryFilter, this.persistedMapPropsWasUpdated.bind(this));
		}

		this.addInteractivity();

		const minWidth = 600;
		const width = document.getElementsByTagName('body')[0].getBoundingClientRect().width;
		if (width < minWidth) return;

		getESRICopyRight(esriBaseMapNames).then(attributions => {
			this.olWrapper.attributionUpdater = new Copyright(attributions, projection, 'baseMapAttribution', minWidth);
		});

	}

	private async addListeners(view: View, updatePersistedMapProps: (mapProps: PersistedMapProps) => void) {
		this.olWrapper.map.on("moveend", _ => {
			if (this.isPopstateEvent) {
				this.isPopstateEvent = false;
				return;
			}

			updatePersistedMapProps({ center: view.getCenter(), zoom: view.getZoom() });
		});

		window.addEventListener("popstate", () => {
			this.isPopstateEvent = true;

			const baseMaps = this.olWrapper.baseMaps;
			const toggles = this.layerControl.toggles;
			const searchParams = new URLSearchParams(location.search);
			const selectedBaseMap = searchParams.has("baseMap")
				? searchParams.get("baseMap") as BaseMapId
				: olMapSettings.defaultBaseMap;

			baseMaps.forEach(bm => bm.setVisible(bm.get('id') === selectedBaseMap));

			this.layerControl.toggleInput('radio', selectedBaseMap, true);

			const zoom = searchParams.get("zoom");
			const center = searchParams.get("center");

			if (zoom) view.setZoom(parseFloat(zoom));
			if (center) view.setCenter(center.split(',').map(v => parseFloat(v)));

			const visibleToggles = searchParams.has('visibleToggles')
				? searchParams.get("visibleToggles")!.split(',')
				: toggles.map(tl => tl.get("id"));
			toggles.forEach(tl => tl.setVisible(visibleToggles.includes(tl.get("id"))));
		});
	}

	private async fetchAndAddCountriesTopo(layerVisibility: LayerVisibility) {
		const countriesTopo = await getCountriesGeoJson();

		const countriesTopoBM: LayerWrapper = getLayerWrapper({
			id: 'countries',
			label: 'Countries',
			layerType: 'baseMap',
			visible: false,
			geoType: 'geojson',
			data: countriesTopo,
			style: countryStyle,
			zIndex: 100,
			interactive: false
		});
		this.olWrapper.addGeoJson(countriesTopoBM, 'EPSG:4326', this.olWrapper.projection, this.olWrapper.viewParams.extent);

		const countriesTopoToggle: LayerWrapper = getLayerWrapper({
			id: countryBordersId,
			label: 'Country borders',
			layerType: 'toggle',
			visible: layerVisibility[countryBordersId],
			geoType: 'geojson',
			data: countriesTopo,
			style: countryBorderStyle,
			zIndex: 100,
			interactive: false
		});
		this.olWrapper.addToggleLayers([countriesTopoToggle]);

		return countriesTopo;
	}

	private persistedMapPropsWasUpdated(mapProps: PersistedMapProps) {
		const {baseMap, visibleToggles, center, zoom, countryFilter} = mapProps;

		const newCountryFilter = countryFilter ?? this.persistedMapProps.countryFilter;

		this.persistedMapProps = {
			srid: this.persistedMapProps.srid,
			center: center ?? this.persistedMapProps.center,
			zoom: zoom ?? this.persistedMapProps.zoom,
			baseMap: baseMap ?? this.persistedMapProps.baseMap,
			visibleToggles: visibleToggles ?? this.persistedMapProps.visibleToggles,
			countryFilter: newCountryFilter === "0" ? undefined : newCountryFilter
		};
		const newSearchParams = this.persistedMapPropsToUrlSearch();

		if (document.location.search !== newSearchParams)
			history.pushState({}, "", location.origin + location.pathname + newSearchParams);
	}

	private persistedMapPropsToUrlSearch() {
		const mapProps = this.persistedMapProps;
		const countryFilter = this.persistedMapProps.countryFilter;
		const mapSRID = mapProps.srid ?? olMapSettings.defaultSRID;
		const srid = mapProps.srid === olMapSettings.defaultSRID ? undefined : mapProps.srid;
		const center = roundCoord(mapSRID, mapProps.center)?.join(',');
		const zoom = round(mapProps.zoom, 2);
		const baseMap = mapProps.baseMap === olMapSettings.defaultBaseMap
			? undefined
			: mapProps.baseMap;
		const visibleMapToggleLayers = this.olWrapper.getToggleLayers(true).map(tl => tl.get("id"));
		const showTogglesInUrl = layerNames.filter(val => !visibleMapToggleLayers.includes(val)).length > 0;
		const visibleToggles = showTogglesInUrl
			? mapProps.visibleToggles?.join(',')
			: undefined;

		const params: Record<string, string | undefined | number> = {srid, center, zoom, baseMap, visibleToggles, countryFilter};
		const searchParams = Object.keys(params).reduce<string[]>((acc, key) => {
			if (params[key] !== undefined) {
				acc.push(`${key}=${params[key]}`);
			}

			return acc;
		}, []).join('&');

		return '?' + searchParams;
	}

	private addInteractivity() {
		const map = this.olWrapper.map;
		const popupOverlay = this.olWrapper.popupOverlay;
		const popup = this.popup;

		const select = new Select({
			condition: condition.click,
			layers: layer => layer.get('interactive'),
			multi: true,
			hitTolerance: this.mapOptions.hitTolerance
		});
		map.addInteraction(select);

		select.on('select', e => {
			if (popupOverlay === undefined) return;

			const features: Collection<Feature<Point | GeometryCollection>> = e.target.getFeatures();
			const popupPosition = features.getLength()
				? e.mapBrowserEvent.coordinate
				: undefined;
			popupOverlay.setPosition(popupPosition);

			if (features.getLength()) {
				popup.resetContent();

				features.getArray().some((feature, idx) => {
					const border = idx > 0 ? 'border-top: 1px solid #eee;' : '';
					const content = `${feature.get(Vars.stationName)} (${feature.get(Vars.shortStationName)})`;
					const url = feature.get(Vars.stationId).replace(/^http:\/\//i, 'https://')
					const htmlContent = feature.get("hasLandingPage")
						? `<a href="${url}" target="_parent">${content}</a>`
						: content;

					popup.popupElement.innerHTML += `<div style="padding: 0.5rem; white-space: nowrap; ${border} ;">${htmlContent}</div>`;
				});
			}
		});

		map.on('pointermove', function (e) {
			const pixel = map.getEventPixel(e.originalEvent);
			const hit = map.hasFeatureAtPixel(pixel);
			const features = map.getFeaturesAtPixel(pixel)
				.filter(feature => {
					return !!feature.get(Vars.stationId)
				});
			const target = map.getTargetElement();
			if (target) {
				target.style.cursor = features.length && hit ? 'pointer' : '';
			}
		});
	}
}

function updateLayerCtrl(self: LayerControl): () => void {
	const defaultBaseMap = olMapSettings.defaultBaseMap;

	return () => {
		if (self.map === undefined)
			return;

		self.layersDiv.innerHTML = '';
		const baseMaps = self.baseMaps;
		const toggles = self.toggles;

		if (baseMaps.length) {
			const root = document.createElement('div');
			root.setAttribute('class', 'ol-layer-control-basemaps');
			const lbl = document.createElement('label');
			lbl.innerHTML = 'Base maps';
			root.appendChild(lbl);
			const selectedId = self.createId('radio', self.selectedBaseMap ?? defaultBaseMap);

			baseMaps.forEach(bm => {
				const row = document.createElement('div');
				const id = self.createId('radio', bm.get('id'));

				const radio = document.createElement('input');
				radio.setAttribute('id', id);
				radio.setAttribute('name', 'basemap');
				radio.setAttribute('type', 'radio');
				if (id === selectedId)
					radio.setAttribute('checked', 'true');
				radio.addEventListener('change', () => self.toggleBaseMaps(bm.get('id')));
				row.appendChild(radio);

				const lbl = document.createElement('label');
				lbl.setAttribute('for', id);
				lbl.innerHTML = bm.get('label');
				row.appendChild(lbl);

				root.appendChild(row);
			});

			self.layersDiv.appendChild(root);
		}

		if (self.useCountrySelector) {
			const row = document.createElement('div');
			self.countrySelector = document.createElement('select');
			row.appendChild(self.countrySelector);
			self.layersDiv.appendChild(row);
		}

		if (toggles.length) {
			const addToggleLayer = (toggleLayer: VectorLayer<VectorSource>) => {
				const legendItem = getLayerIcon(toggleLayer);
				const row = document.createElement('div');
				row.setAttribute('style', 'display:table;');
				const id = self.createId('toggle', toggleLayer.get('id'));

				const toggle = document.createElement('input');
				toggle.setAttribute('id', id);
				toggle.setAttribute('type', 'checkbox');
				toggle.setAttribute('style', 'display:table-cell;');
				if (toggleLayer.getVisible()) {
					toggle.setAttribute('checked', 'true');
				}
				toggle.addEventListener('change', () => self.toggleLayers(toggleLayer.get('id'), toggle.checked));
				row.appendChild(toggle);

				if (legendItem) {
					const legendItemContainer = document.createElement('span');
					legendItemContainer.setAttribute('style', 'display:table-cell; width:21px; text-align:center;');
					legendItem.title = toggleLayer.get("label");
					legendItem.setAttribute('style', 'vertical-align:sub; margin-right:unset;');

					legendItemContainer.appendChild(legendItem);
					row.appendChild(legendItemContainer);
				} else {
					const emptyCell = document.createElement('span');
					emptyCell.setAttribute('style', 'display:table-cell; width:5px;');
					row.appendChild(emptyCell);
				}

				const lbl = document.createElement('label');
				lbl.setAttribute('for', id);
				lbl.setAttribute('style', 'display:table-cell;');

				const lblTxt = document.createElement('span');
				lblTxt.innerHTML = toggleLayer.get('label');
				lbl.appendChild(lblTxt);
				row.appendChild(lbl);

				root.appendChild(row);
			};

			const root = document.createElement('div');
			root.setAttribute('class', 'ol-layer-control-toggles');
			const lbl = document.createElement('label');
			lbl.innerHTML = 'Layers';
			root.appendChild(lbl);

			toggles
				.filter(toggleLayer => toggleLayer.get('id') === countryBordersId)
				.forEach(toggleLayer => addToggleLayer(toggleLayer as VectorLayer<VectorSource>));
			toggles
				.filter(toggleLayer => toggleLayer.get('id') !== countryBordersId)
				.forEach(toggleLayer => addToggleLayer(toggleLayer as VectorLayer<VectorSource>));

			self.layersDiv.appendChild(root);
		}
	};
}

function getStationToggleLayers(layerVisibility: LayerVisibility, stations: Stations, epsgCode: EpsgCode){
	const duplicates = stations
		.getDuplicates({type: 'point'})
		.map(createPointData);
	const stationPointsOS = stations
		.filterByAttr({type: 'point', themeShort: 'OS'})
		.filter(s => !duplicates.some(d => d.attributes.id === s.id))
		.map(createPointData);
	const stationPointsES = stations
		.filterByAttr({type: 'point', themeShort: 'ES'})
		.filter(s => !duplicates.some(d => d.attributes.id === s.id))
		.map(createPointData);
	const stationPointsAS = stations
		.filterByAttr({type: 'point', themeShort: 'AS'})
		.filter(s => !duplicates.some(d => d.attributes.id === s.id))
		.map(createPointData);
	const shipping: ReducedStation[] = epsgCode === 'EPSG:3035'
		? stations.filterByAttr({ type: 'geo' }).map(clipToBbox)
		: stations.filterByAttr({ type: 'geo' });

console.log({duplicates, shipping, featureCollection: getFeatureCollection(shipping)});

	return [
		getLayerWrapper({
			id: 'as',
			label: 'Atmosphere stations',
			layerType: 'toggle',
			visible: layerVisibility.as,
			geoType: 'point',
			data: stationPointsAS,
			style: atmoStyle,
			zIndex: 100,
			interactive: true
		}),
		getLayerWrapper({
			id: 'es',
			label: 'Ecosystem stations',
			layerType: 'toggle',
			visible: layerVisibility.es,
			geoType: 'point',
			data: stationPointsES,
			style: ecoStyle,
			zIndex: 100,
			interactive: true
		}),
		getLayerWrapper({
			id: 'os',
			label: 'Ocean stations',
			layerType: 'toggle',
			visible: layerVisibility.os,
			geoType: 'point',
			data: stationPointsOS,
			style: oceanStyle,
			zIndex: 100,
			interactive: true
		}),
		getLayerWrapper({
			id: 'ship',
			label: 'Shipping geo coverage',
			layerType: 'toggle',
			visible: layerVisibility.ship,
			geoType: 'geojson',
			data: getFeatureCollection(shipping),
			style: lnStyle,
			zIndex: 100,
			interactive: true
		})
	];
}

export type LayerFilterFn = (
	layer: VectorLayerExtended,
	selectedCountry: string,
	showNonLabelledStations: boolean
) => void
const layerFilterFn: LayerFilterFn = (layer, selectedCountry, showNonLabelledStations) => {
	layer.getSource()?.forEachFeature(feature => {
		const showFeature = selectedCountry === "0" || feature.get(Vars.country) === selectedCountry
			&& (showNonLabelledStations || feature.get(Vars.labelingDate) !== "");
		feature.setStyle(showFeature ? undefined : new Style());
	});
};

export type FeaturesFilterFn = (mapToggles: VectorLayerExtended[], layerFilterFn: LayerFilterFn) =>
	(stationFilter: StationFilter, selectedCountry: string, showNonLabelledStations?: boolean) => void

const filterFeatures: FeaturesFilterFn = (mapToggles, layerFilterFn) => (stationFilter, selectedCountry, showNonLabelledStations) => {
	const stationsToFilter = stationFilter.stationsToFilter;
	const stationNames = stationsToFilter.map(themeStations => themeStations.label);

	const selectedCountryCombined = selectedCountry ?? stationFilter.selectedCountry;
	stationFilter.selectedCountry = selectedCountryCombined;
	const showNonLabelledStationsCombined = showNonLabelledStations === undefined
		? stationFilter.showNonLabelledStations
		: showNonLabelledStations;
	stationFilter.showNonLabelledStations = showNonLabelledStationsCombined;

	mapToggles.forEach(vectorLayer => {
		if (stationNames.includes(vectorLayer.get("label"))) {
			layerFilterFn(vectorLayer, selectedCountryCombined, showNonLabelledStationsCombined);
		}
	});
};
