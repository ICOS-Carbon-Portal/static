
export const getStations = config =>{
	return `prefix sitesonto: <https://meta.fieldsites.se/ontologies/sites/>
prefix cpmeta: <http://meta.icos-cp.eu/ontologies/cpmeta/>
select ?id ?name ?lon ?lat ?station where{
 ?station a sitesonto:Station ;
     cpmeta:hasName ?name ;
     cpmeta:hasStationId ?id ;
     cpmeta:hasLongitude ?lon ;
     cpmeta:hasLatitude ?lat .
}`;
};
