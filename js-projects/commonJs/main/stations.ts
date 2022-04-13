export type Modifiers = Partial<Dict<(v: string, row: Dict<BindingEntry, VarName>) => string, VarName>>
export type ParsedSparqlValue = number | Date | string
export type TransformPointFn = (lonOrX: number, latOrY: number) => [number, number]
export type ReducedStation = Partial<Dict<ParsedSparqlValue | [number, number] | boolean, VarName | 'type' | 'point' | 'Short_name' | 'id' | 'hasLandingPage'>>

export class StationParser {
	constructor(private readonly countries: Dict, private readonly transformPointFn?: TransformPointFn) { }

	parse(bindings: Dict<BindingEntry, VarName>[]) {
		return this.transformPointFn === undefined
			? this.parseToRowColArrays(bindings)
			: this.parseToObjectArray(bindings);
	}

	private parseToRowColArrays(bindings: Dict<BindingEntry, VarName>[]) {
		const modifiers = this.commonModifiers(this.countries);

		var rows = bindings.map(row =>
			Columns.map(col => {
				const v = (row[col] || {}).value || "";
				const modifier = modifiers[col];
				return modifier ? modifier(v, row) : v;
			})
		);

		return ({
			rows,
			columns: Columns.map(col => ({ title: col.replace(/_/g, " ") }))
		});
	}

	private parseToObjectArray(bindings: Dict<BindingEntry, VarName>[]) {
		const localModifiers = {
			[Vars.stationId]: (v: string, row: Dict<BindingEntry, VarName>) => (row[Vars.prodUri]
				? row[Vars.prodUri].value
				: v
			),
			[Vars.labelingDate]: (v: string, row: Dict<BindingEntry, VarName>) => (row[Vars.labelingDate]
				? row[Vars.labelingDate].value
				: ""
			),
			[Vars.country]: (v: string) => v
		};
		const modifiers = { ...this.commonModifiers(this.countries), ...localModifiers };
		const isNumeric = (n: any) => {
			return !isNaN(parseInt(n)) && isFinite(n);
		};

		return bindings.reduce<ReducedStation[]>((stationAcc, currStation) => {
			// Do not include stations that does not have any geographical reference
			if (currStation.lat === undefined && currStation.lon === undefined && (currStation.geoJson === undefined || currStation.geoJson.value === ""))
				return stationAcc;

			const st = Columns.reduce<ReducedStation>((acc, col) => {
				const modifier = modifiers[col];
				const parsed = modifier === undefined
					? this.sparqlBindingToValue(currStation[col])
					: modifier((currStation[col] || {}).value || "", currStation);
				acc[col] = parsed;

				return acc;
			}, {});

			if (isNumeric(st[Vars.lat]) && isNumeric(st[Vars.lon])) {
				st.type = 'point';
				if (this.transformPointFn !== undefined)
					st.point = this.transformPointFn(st[Vars.lon] as number, st[Vars.lat] as number);

			} else if (st[Vars.geoJson]) {
				st.type = 'geo';
				st.geoJson = JSON.parse(st[Vars.geoJson] as string);
			}

			st.id = st[Vars.stationId];
			st.hasLandingPage = st[Vars.stationId] && (st[Vars.stationId] as string).startsWith('http');

			const shortName = (st[Vars.stationId] as string).split('/').pop();
			st.Short_name = shortName;

			stationAcc.push(st);
			return stationAcc;
		}, []);
	}

	private commonModifiers(countries: Dict): Modifiers {
		return {
			[Vars.theme]: (v: string, row: Dict<BindingEntry, VarName>) => themeName[row[Vars.themeShort].value as ThemeShort] ?? "?",
			[Vars.country]: (v: string) => `${countries[v]} (${v})`,
			[Vars.pi]: (v: string) => v.split(';').sort().join("<br>"),
			[Vars.stationClass]: (v: string) => (v == "Ass" ? "Associated" : v),
			[Vars.siteType]: (v: string) => v.toLowerCase(),
			[Vars.stationId]: (v: string, row: Dict<BindingEntry, VarName>) => (row[Vars.prodUri]
				? `<a target="_blank" href="${row[Vars.prodUri].value}">${v}</a>`
				: v
			)
		};
	}

	private sparqlBindingToValue(b: Dict) {
		if (!b || (b && b.value === "?")) return "";

		switch (b.datatype) {
			case "http://www.w3.org/2001/XMLSchema#integer": return parseInt(b.value);
			case "http://www.w3.org/2001/XMLSchema#float":
			case "http://www.w3.org/2001/XMLSchema#double": return parseFloat(b.value);
			case "http://www.w3.org/2001/XMLSchema#dateTime":
			case "http://www.w3.org/2001/XMLSchema#date": return new Date(b.value);
			default: return b.value;
		}
	}
}

export type Dict<Value = string, Keys extends string | number | symbol = string> = Record<Keys, Value>
export type BindingEntry = Dict<string, 'type' | 'value' | 'datatype'>
export type VarKey = keyof typeof Vars;
export type VarName = typeof Vars[VarKey];
export type SparqResp = {
	head: {
		vars: string[]
	}
	results: {
		bindings: Dict<BindingEntry, VarName>[]
	}
}

export const urls = {
	sparqlUrl: "https://meta.icos-cp.eu/sparql",
	stationVisUrl: "https://meta.icos-cp.eu/station/"
};

export type ThemeShort = 'AS' | 'ES' | 'OS'
export const themeName: Dict<string, ThemeShort> = { AS: "Atmosphere", ES: "Ecosystem", OS: "Ocean" };

export const getIconUrl = (themeShort: ThemeShort) => `https://static.icos-cp.eu/share/stations/icons/${themeShort.toLowerCase()}.png`;

export const Vars = {
	s: 's',
	lat: 'lat',
	lon: 'lon',
	geoJson: 'geoJson',
	prodUri: 'prodUri',
	stationId: 'Id',
	shortStationName: 'Short_name',
	stationName: 'Name',
	country: 'Country',
	theme: 'Theme',
	themeShort: 'themeShort',
	pi: 'PI_names',
	siteType: 'Site_type',
	seaElev: 'Elevation_above_sea',
	groundElev: 'Elevation_above_ground',
	stationClass: 'Station_class',
	labelingDate: 'Labeling_date',
	coords: 'Location'
} as const;


export const Columns: VarName[] = [
	Vars.stationId, Vars.stationName, Vars.theme, Vars.stationClass, Vars.coords, Vars.country,
	Vars.pi, Vars.siteType, Vars.seaElev, Vars.labelingDate, Vars.lat, Vars.lon, Vars.geoJson, Vars.themeShort
];

export const varNameIdx = (varName: VarName) => Columns.indexOf(varName);

const provQuery = `PREFIX cpst: <http://meta.icos-cp.eu/ontologies/stationentry/>
SELECT *
FROM <http://meta.icos-cp.eu/resources/stationentry/>
FROM NAMED <http://meta.icos-cp.eu/resources/stationlabeling/>
WHERE {
	{
		select ?s (GROUP_CONCAT(?piLname; separator=";") AS ?${Vars.pi})
		where{ ?s cpst:hasPi/cpst:hasLastName ?piLname }
		group by ?s
	}
	?s a ?owlClass .
	BIND(REPLACE(str(?owlClass),"http://meta.icos-cp.eu/ontologies/stationentry/", "") AS ?${Vars.themeShort})
	?s cpst:hasShortName ?${Vars.stationId} .
	?s cpst:hasLongName ?${Vars.stationName} .
	OPTIONAL{?s cpst:hasLat ?${Vars.lat} . ?s cpst:hasLon ?${Vars.lon} }
	OPTIONAL{?s cpst:hasSpatialReference ?${Vars.geoJson} }
	OPTIONAL{?s cpst:hasCountry ?${Vars.country} }
	OPTIONAL{?s cpst:hasSiteType ?${Vars.siteType} }
	OPTIONAL{?s cpst:hasElevationAboveSea ?${Vars.seaElev} }
	OPTIONAL{?s cpst:hasStationClass ?${Vars.stationClass} }
	OPTIONAL{
		GRAPH <http://meta.icos-cp.eu/resources/stationlabeling/> {
			?s cpst:hasAppStatusDate ?labelDt .
			?s cpst:hasApplicationStatus "STEP3APPROVED"^^xsd:string .
			BIND(SUBSTR(str(?labelDt), 1, 10) AS ?${Vars.labelingDate})
		}
	}
}`;

const prodQuery = `prefix cpmeta: <http://meta.icos-cp.eu/ontologies/cpmeta/>
prefix cpst: <http://meta.icos-cp.eu/ontologies/stationentry/>
prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#>
SELECT *
FROM <http://meta.icos-cp.eu/resources/icos/>
FROM <http://meta.icos-cp.eu/resources/cpmeta/>
FROM <http://meta.icos-cp.eu/resources/stationentry/>
WHERE{
	{
		select ?s ?ps (GROUP_CONCAT(?lname; separator=";") AS ?${Vars.pi}) where {
			?s cpst:hasProductionCounterpart ?psStr .
			bind(iri(?psStr) as ?ps)
			?memb cpmeta:atOrganization ?ps ; cpmeta:hasRole <http://meta.icos-cp.eu/resources/roles/PI> .
			filter not exists {?memb cpmeta:hasEndTime []}
			?pers cpmeta:hasMembership ?memb ; cpmeta:hasLastName ?lname .
		}
		group by ?s ?ps
	}
	?ps cpmeta:hasStationId ?${Vars.stationId} ; cpmeta:hasName ?${Vars.stationName} .
	OPTIONAL{ ?ps cpmeta:hasElevation ?${Vars.seaElev} }
	OPTIONAL{ ?ps cpmeta:hasLatitude ?${Vars.lat}}
	OPTIONAL{ ?ps cpmeta:hasLongitude ?${Vars.lon}}
	OPTIONAL{ ?ps cpmeta:hasEcosystemType/rdfs:label ?${Vars.siteType} }
	OPTIONAL{ ?ps cpmeta:hasSpatialCoverage/cpmeta:asGeoJSON ?${Vars.geoJson}}
	OPTIONAL{ ?ps cpmeta:countryCode ?${Vars.country}}
	OPTIONAL{ ?ps cpmeta:hasStationClass  ?${Vars.stationClass}}
	BIND(?ps as ?${Vars.prodUri})
}`;

const fetchStations = (query: typeof provQuery | typeof prodQuery, acceptCachedResults?: boolean): Promise<SparqResp> => {
	const defaultHeaders = {
		'Accept': 'application/json',
		'Content-Type': 'text/plain'
	};
	const cacheHeader: { 'Cache-Control': string } | {} = acceptCachedResults
		? { 'Cache-Control': 'max-age=1000000' } //server decides how old the cache can get
		: {}; //expecting no-cache default behaviour from the server
	const headers = { ...cacheHeader, ...defaultHeaders };
	
	return fetch(urls.sparqlUrl, {
		headers: new Headers(headers),
		mode: 'cors',
		method: 'POST',
		body: query
	}).then(resp => {
		if (resp.ok)
			return resp.json();
		
		return new Error(resp.statusText);
	});
};

const mergeProvAndProd = ([prov, prod]: [prov: SparqResp, prod: SparqResp]) => {
	const prodLookup = prod.results.bindings.reduce<Dict<Dict<BindingEntry, VarName>>>((acc, next) => {
		acc[next.s.value] = next;
		return acc;
	}, {});
	return prov.results.bindings.map(row => ({ ...row, ...prodLookup[row.s.value] }));
};

export const fetchMergeParseStations = (stationParser: StationParser) => {
	return Promise.all([fetchStations(provQuery, true), fetchStations(prodQuery, true)])
		.then(mergeProvAndProd)
		.then(bindings => stationParser.parse(bindings));
};
