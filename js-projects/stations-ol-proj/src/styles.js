import Style from "ol/style/Style";
import Fill from "ol/style/Fill";
import Stroke from "ol/style/Stroke";
import Circle from "ol/style/Circle";

export default {
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
