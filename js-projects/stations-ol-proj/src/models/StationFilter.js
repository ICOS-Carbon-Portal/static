export default class StationFilter{
	constructor(toggleLayers, countryLookup, filterFn){
		this.stationsToFilter = toggleLayers.filter(tl => tl.type === 'point');
		this.countryList = this.getCountryList(countryLookup);
		this.filterFn = filterFn;
	}

	getCountryList(countryLookup){
		const iso2Filtered = this.stationsToFilter.reduce((acc, theme) => {
			const stations = theme.data;
			stations.forEach(station => acc.add(station.Country));
			return acc;
		}, new Set());

		return Array.from(iso2Filtered).map(code => {
			const name = countryLookup[code].length > 20
				? countryLookup[code].slice(0, 19) + '...'
				: countryLookup[code];
			return {
				val: code,
				name
			};
		}).sort((a, b) => a.name < b.name ? -1 : 1);
	}
}