export default class Stations{
	constructor(stations) {
		this._stations = stations;
	}

	getDuplicates(filterObj){
		const dupes = new Set();
		const stations = this.filterByAttr(filterObj);

		stations.reduce((acc, station) => {
			if (acc.size === acc.add(station.lon + '' + station.lat).size){
				dupes.add(station);
				dupes.add(stations.find(s => s.lat === station.lat && s.lon === station.lon));
			}

			return acc;
		}, new Set());

		return Array.from(dupes);
	}

	filterByAttr(filterObj){
		return this._stations.filter(s =>
			Object.keys(filterObj).reduce((acc, key) => {
				acc *= s[key] === filterObj[key];
				return acc;
			}, true)
		);
	}

	get stations(){
		return this._stations;
	}
}
