import * as olProj from 'ol/proj';
import * as olExtent from 'ol/extent';

// https://developers.arcgis.com/terms/attribution/
export default class Copyright {
	constructor(attributionESRI, projection, htmlElementId, minWidth){
		this._attributionESRI = attributionESRI;
		this._projection = projection;
		this._attributionElement = document.getElementById(htmlElementId);
		this._minWidth = minWidth;
	}

	getAttribution(bbox, zoom, serviceName){
		const projectedExtent = this._projection.getCode() === 'EPSG:4326'
			? bbox
			: olProj.transformExtent(bbox, this._projection, olProj.get('EPSG:4326'));

		const filteredAttributions = this._attributionESRI[serviceName].contributors.filter(contributor => {
			return contributor.coverageAreas.some(coverage => {
				const coverageExtent = [coverage.bbox[1], coverage.bbox[0], coverage.bbox[3], coverage.bbox[3]];
				return zoom >= coverage.zoomMin && zoom <= coverage.zoomMax && olExtent.intersects(projectedExtent, coverageExtent);
			});
		});

		return filteredAttributions
			.sort(attr => attr.coverageAreas[0].score)
			.map(attr => attr.attribution);
	}

	updateAttribution(view, layers) {
		const width = document.getElementsByTagName('body')[0].getBoundingClientRect().width;
		if (width < this._minWidth) return;

		const currentBasemap = layers.find(layer => layer.getVisible() && layer.get('layerType') === 'baseMap');
		const esriServiceName = currentBasemap.get('esriServiceName');

		if (esriServiceName) {
			const attributions = this.getAttribution(view.calculateExtent(), view.getZoom(), esriServiceName);
			this._attributionElement.innerHTML = attributions.join(', ');
		} else {
			const source = currentBasemap.getSource();
			this._attributionElement.innerHTML = source.getAttributions()().join(', ');
		}
	}
}
