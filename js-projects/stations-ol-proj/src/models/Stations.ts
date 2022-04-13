import {ReducedStation} from "../../../commonJs/main/stations";


export default class Stations{
	constructor(public readonly stations: ReducedStation[]) {}

	getDuplicates(filterObj: Record<string, string>): ReducedStation[]{
		const dupes = new Set<ReducedStation>();
		const stations = this.filterByAttr(filterObj);

		stations.reduce((acc, station) => {
			if (acc.size === acc.add(station.lon + '' + station.lat).size){
				dupes.add(station);
				const stationMaybe = stations.find(s => s.lat === station.lat && s.lon === station.lon);
				if (stationMaybe)
					dupes.add(stationMaybe);
			}

			return acc;
		}, new Set());

		return Array.from(dupes) as ReducedStation[];
	}

	filterByAttr(filterObj: Record<string, string>): ReducedStation[]{
		return this.stations.filter(s =>
			Object.keys(filterObj).reduce<boolean>((acc, key) => {
				return acc && s[key as keyof ReducedStation] === filterObj[key];
			}, true)
		);
	}
}
