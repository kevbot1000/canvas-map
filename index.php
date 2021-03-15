<?php
ini_set('display_errors',1);
error_reporting(-1);
$range_id = 360;

$sql = "SELECT a.id, a.name, b.lat, b.lon
		FROM look_area a
		INNER JOIN lookarea_wgs84 b ON a.id = b.area_id
		WHERE a.id > 0
		AND a.active = 1
		AND NVL(a.area_type,'XXX') != 'PLAT'
		AND a.range_id = $range_id
		-- AND a.range_id IN(444,14)
		-- AND a.name LIKE '%MOA%'
		ORDER BY a.name, a.id, b.point";
$result = $ODbo->eq($sql,'','ASSOC',0);
// adump($result);
require_once("{$_SERVER['DOCUMENT_ROOT']}/lib/odboToGeoJSON.php");
$json = odboToGeoJSON($result);
// adump($json);

/*
$sql = "SELECT A.id, A.name, A.type, A.cycle, SDO_GEOM.SDO_AREA(A.geom,0.05,'unit=SQ_M') AS area, SDO_UTIL.TO_WKTGEOMETRY(A.geom) AS wkt, B.name as boundary
		FROM orc_area A
		LEFT JOIN orc_area B ON B.id = A.boundary_area_id
		WHERE A.range_id = $range_id
        AND A.active = 1
        AND A.type = 'CLEARANCE'
        AND A.geom IS NOT NULL";
$result = $ODbo->eq($sql,'','ASSOC',0);
require_once("{$_SERVER['DOCUMENT_ROOT']}/lib/geoPHP/geoPHP.inc"); // for converting WKT (from oracle) to GeoJSON (for Google)
$features = array();
foreach($result as $row) {
	$wkt = $row['WKT'];
	$geom = geoPHP::load($wkt,'wkt');
	$geom = $geom->out('json');

	unset($row['WKT']);

	$geojson = array(
		'type'=>'Feature',
		'properties'=>$row,
		'geometry'=>json_decode($geom),
	);

	$features[] = json_encode($geojson);
}
$json = '{"type":"FeatureCollection","features":['.implode(',',$features).']}';
*/

// $json  = '{
//     "type": "Feature",
//     "geometry": {
//         "type": "GeometryCollection",
//         "geometries": [
//             {
//                 "type": "Point",
//                 "coordinates": [
//                     -80.23569,
//                     35.23614
//                 ]
//             },{
//                 "type": "Point",
//                 "coordinates": [
//                     -83.92465,
//                     37.55484
//                 ]
//             }
//         ]
//     },
//     "properties": {
//     	"name":"test"
//     }
// }';

// $json  = '{
//     "type": "Feature",
//     "geometry": { "type": "Point", "coordinates": [100.0, 0.0] },
//     "properties": {
//     	"name":"test"
//     }
// }';

// $json = '{"type":"FeatureCollection","features":['.$json.']}';
?>
<!DOCTYPE html>
<html>
	<head>
		<title>Canvas Map Test</title>
		<script type="text/javascript" src="canvasMap.js"></script>
		<script type="text/javascript" src="/js/tinyqueue.js"></script>
		<script type="text/javascript" src="/js/polylabel.js"></script>
		<style type='text/css'>
			body {
				margin:0;
				padding:0;
				overflow:hidden;
			}

			#map {
				/*margin:200px 300px;*/
			}

			#cm-layers {
				/*border:2px solid #000000;*/
			}

			#cm-viewport {
				/*border:1px solid #000000;*/
			}

			img{
				border:0;
				padding:0;
				outline:0;
			}
		</style>
	</head>
	<body>
		<div id='map'></div>
	</body>
	<script type="text/javascript">
		var geoJSON = <?php echo $json; ?>;
		var width = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth;
		var height = window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight;
		// width = 500;
		// height = 300;

		var style = function(feature) {
			if(typeof(feature.properties) != 'undefined' && feature.properties.name == 'ZIRCON ATCAA') {
				fillColor = '#FF0000';
			} else {
				fillColor = '#FF8080';
			}

			return {
				'fillColor':fillColor,
				'fillOpacity':0.5,
				'strokeWidth':2
			}
		}

		var map = new canvasMap('map',{'data':geoJSON,'style':style,'width':width,'height':height,'static':	false});

		map.zoomToBounds();
	</script>
</html>
