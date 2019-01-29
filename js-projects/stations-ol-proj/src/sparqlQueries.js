
export const getStations = config =>{
	return `prefix cpst: <${config.cpmetaOntoStationEntryUri}>
SELECT
    (str(?s) AS ?id)
    (IF(bound(?latitude), ?latitude, "?") AS ?lat)
    (IF(bound(?longitude), ?longitude, "?") AS ?lon)
    (IF(bound(?spatRef), str(?spatRef), "?") AS ?geoJson)
    (REPLACE(str(?class),"${config.cpmetaOntoStationEntryUri}", "") AS ?themeShort)
    (IF(bound(?country), str(?country), "?") AS ?Country)
    (str(?sName) AS ?Short_name)
    (str(?lName) AS ?Long_name)
    (GROUP_CONCAT(?piLname; separator=";") AS ?PI_names)
    (IF(bound(?siteType), str(?siteType), "?") AS ?Site_type)
FROM <${config.cpmetaResStationEntryUri}>
WHERE {?s a ?class .
	OPTIONAL{?s cpst:hasLat ?latitude . ?s cpst:hasLon ?longitude } .
	OPTIONAL{?s cpst:hasSpatialReference ?spatRef } .
	OPTIONAL{?s cpst:hasCountry ?country } .
	?s cpst:hasShortName ?sName .
	?s cpst:hasLongName ?lName .
	?s cpst:hasPi ?pi .
	OPTIONAL{?pi cpst:hasFirstName ?piFname } .
	?pi cpst:hasLastName ?piLname .
	OPTIONAL{?s cpst:hasSiteType ?siteType } .
}
GROUP BY ?s ?latitude ?longitude ?spatRef ?locationDesc ?class ?country ?sName ?lName ?siteType ?elevationAboveSea
?elevationAboveGround ?stationClass ?stationKind ?preIcosMeasurements ?operationalDateEstimate ?isOperational ?fundingForConstruction`;
};

export const getIcosStations = `prefix cpmeta: <http://meta.icos-cp.eu/ontologies/cpmeta/>
select
    (str(?s) AS ?id)
    (IF(bound(?latitude), ?latitude, "?") AS ?lat)
    (IF(bound(?longitude), ?longitude, "?") AS ?lon)
#    (IF(bound(?spatRef), str(?spatRef), "?") AS ?geoJson)
    (SUBSTR(str(?s), 43, 2) AS ?themeShort)
#    (IF(bound(?country), str(?country), "?") AS ?Country)
    (str(?sName) AS ?Short_name)
    (str(?lName) AS ?Long_name)
    ?PI_names
 #   (GROUP_CONCAT(?piLname; separator=";") AS ?PI_names)
    ("?" as ?Site_type)
#    (IF(bound(?siteType), str(?siteType), "?") AS ?Site_type)
from <http://meta.icos-cp.eu/resources/icos/>
where {
   ?memb a cpmeta:Membership .
   ?memb cpmeta:hasRole <http://meta.icos-cp.eu/resources/roles/PI> .
   ?memb cpmeta:atOrganization ?s .
   ?s cpmeta:hasStationId ?sName .
   ?s cpmeta:hasName ?lName .
   ?pi cpmeta:hasMembership ?memb .
   ?pi cpmeta:hasFirstName ?piFirstName .
   ?pi cpmeta:hasLastName ?piLastName .
  BIND (CONCAT(?piFirstName, ' ', ?piLastName) AS ?PI_names)
   OPTIONAL{?s cpmeta:hasLatitude ?latitude}
   OPTIONAL{?s cpmeta:hasLongitude ?longitude}
}
order by ?id`;