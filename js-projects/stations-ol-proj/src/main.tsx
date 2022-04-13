import InitMap, {InitMapOptions, LayerVisibility} from "./models/InitMap";
import Style from "ol/style/Style";
import {
	BaseMapFilter,
	BaseMapId,
	defaultBaseMaps,
	supportedSRIDs,
	SupportedSRIDs,
	supportedSRIDsFriendlyNames
} from "icos-cp-ol";
import {Coordinate} from "ol/coordinate";

export type OlMapSettings = {
	sridsInMap: Record<SupportedSRIDs, string>,
	defaultSRID: SupportedSRIDs
	defaultBaseMap: BaseMapId
	baseMapFilter: BaseMapFilter
	iconStyles: Record<string, Style>
	fitView?: boolean
}

export const olMapSettings: OlMapSettings = {
	sridsInMap: supportedSRIDsFriendlyNames,
	defaultSRID: '3035',
	defaultBaseMap: 'physical',
	baseMapFilter: baseMap => baseMap.isWorldWide,
	iconStyles: {}
};

init(new URLSearchParams(location.search));


function init(searchParams: URLSearchParams) {
	if (searchParams.has("help")) {
		displayHelp();
		return;
	}

	const srid = searchParams.get("srid") ?? olMapSettings.defaultSRID;
	const mapRootElement = document.getElementById('map');

	if (mapRootElement === null)
		throw new Error("Map element with id='map' is missing in HTML DOM.");

	if (document.getElementById('exportCtrl') === null)
		throw new Error("Export Control element with id='exportCtrl' is missing in HTML DOM.");

	if (Object.keys(olMapSettings.sridsInMap).includes(srid)) {
		if (srid === "3006") {
			olMapSettings.baseMapFilter = _ => true;
			olMapSettings.defaultBaseMap = "lmTopoGray";
		}

		const requestedBaseMap = searchParams.get("baseMap");
		const baseMap = defaultBaseMaps.find(bm => bm.id === requestedBaseMap)?.id ?? olMapSettings.defaultBaseMap;
		const partialMapOptions: InitMapOptions = {
			updateURL: true,
			baseMap: baseMap as BaseMapId,
			sridsInMap: olMapSettings.sridsInMap,
			srid,
			baseMapFilter: olMapSettings.baseMapFilter,
			iconStyles: olMapSettings.iconStyles
		};
		const mapOptions: InitMapOptions = {...partialMapOptions, ...getInitialViewSettings(searchParams)};

		if (searchParams.has("countryFilter")) {
			mapOptions.countryFilter = searchParams.get("countryFilter")!;
		}

		const layerVisibility: LayerVisibility = {
			os: true,
			es: true,
			as: true,
			overlap: true,
			ship: true,
			bdr: true
		};

		const visibleToggles = searchParams.has('visibleToggles')
			? searchParams.get("visibleToggles")!.split(',')
			: undefined;

		if (visibleToggles) {
			Object.keys(layerVisibility).forEach(key => layerVisibility[key] = false);

			visibleToggles.forEach(p => {
				if (p in layerVisibility) layerVisibility[p] = true;
			});
		}

		new InitMap({mapOptions, layerVisibility, mapRootElement});

	} else {
		displaySridError();
	}
}

type InitialViewSettings = {fitView?: boolean, zoom?: number, center?: Coordinate}
function getInitialViewSettings(searchParams: URLSearchParams): InitialViewSettings {
	// Disregard zoom and center if fitView is requested to be true
	// fitView must be set (true or false) here, otherwise OlWrapper defaults to fitView=true
	const fitView = searchParams.has("fitView")
		? String(searchParams.get("fitView")).toLowerCase() === "true"
		: undefined;

	if (fitView)
		return {fitView};

	const result: InitialViewSettings = {fitView: false, zoom: undefined, center: undefined};
	const zoom = searchParams.get("zoom");
	const center = searchParams.get("center");

	if (zoom !== null && zoom.match(/^\d{1,2}\.?\d*$/)) {
		result.zoom = parseFloat(zoom);
	}

	if (center !== null && center.match(/^(\d+(\.\d+)?),(\d+(\.\d+)?)$/)) {
		result.center = center.split(',').map(p => parseFloat(p));
	}

	if (result.zoom === undefined || result.center === undefined){
		result.fitView = true;
	}

	return result;
}

function displayFeeback(innerHTML: string){
	const infoDiv = document.getElementById('map');

	if (infoDiv) {
		infoDiv.setAttribute('style', 'padding: 10px;');
		infoDiv.innerHTML = innerHTML;
		infoDiv.style.width = "auto";
		infoDiv.style.height = "auto";
	}
}

function getBaseUrl(){
	const port = location.port === "" ? "" : `:${location.port}`;
	return `${location.protocol}//${location.hostname}${port}${location.pathname}`;
}

function displaySridError(){
	const srids = Object.keys(olMapSettings.sridsInMap);
	const currentHost = getBaseUrl();
	const exampleUrls = srids.map(srid => `${currentHost}?srid=${srid}`);
	const innerHTML = `Illegal SRID. Must be one of these numbers: 
            ${srids.map(srid => srid + " (" + supportedSRIDs[srid] + ")").join(', ')}.<br /><br />
        Examples:<br />${exampleUrls.map(url => `<a href="${url}" target="_blank">${url}</a>`).join('<br />')}`;

	displayFeeback(innerHTML);
}

function displayHelp(){
	const currentHost = getBaseUrl();
	const srids = Object.keys(olMapSettings.sridsInMap)
		.map(srid => `<a href="https://epsg.io/${srid}" target="_blank">${srid}</a>`).join(', ');
	const defaultProj = `${olMapSettings.defaultSRID} - ${olMapSettings.sridsInMap[olMapSettings.defaultSRID]}`;
	const exampleUrl1 = `${currentHost}?srid=54030`;
	const exampleUrl2 = `${currentHost}?srid=3857&amp;center=468810,5860997&amp;zoom=5.81&amp;baseMap=ocean&amp;visibleToggles=bdr,as,es,os,overlap&amp;countryFilter=FR`;
	const innerHTML = `This map has support for these projections: ${srids}. If no projection (srid) is
        provided, it defaults to ${defaultProj}<br />
        Example: <a href="${exampleUrl1}" target="_blank">${exampleUrl1}</a><br /><br />
        Other params that can be set in URL:<br />
        zoom, center, baseMap, visibleToggles and countryFilter. These are easiest set by zooming, panning in map and turning layers
        on/off in the layer control (upper right) until you are satisfied.<br />
        The URL is automatically updated with those parameters.<br />
        Example: <a href="${exampleUrl2}" target="_blank">${exampleUrl2}</a>`;

	displayFeeback(innerHTML);
}
