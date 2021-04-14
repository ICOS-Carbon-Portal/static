export default class StationFilter{
	constructor(toggleLayers, filterFn, countryLookup = undefined){
		this.stationsToFilter = toggleLayers.filter(tl => tl.type === 'point' || tl.id === 'ship');
		this.filterFn = filterFn;

		this.countryList = countryLookup
			? this.getCountryList(countryLookup)
			: undefined;
		
		this._selectedCountry = "0";
		this._showNonLabelledStations = true;
	}

	get selectedCountry() {
		return this._selectedCountry;
	}

	get showNonLabelledStations() {
		return this._showNonLabelledStations;
	}

	set selectedCountry(selectedCountry) {
		this._selectedCountry = selectedCountry;
	}

	set showNonLabelledStations(showNonLabelledStations) {
		this._showNonLabelledStations = showNonLabelledStations;
	}

	getCountryList(countryLookup){
		const iso2Filtered = this.stationsToFilter.reduce((acc, theme) => {
			const stations = theme.data;

			stations.forEach(station => {
				if (station.Country) {
					acc.add(station.Country);
				} else {
					acc.add(station.properties.Country);
				}
			});
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