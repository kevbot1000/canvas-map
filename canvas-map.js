var canvasMap = function(element, userConfig) {
	var _div = {};
	var _layers = {};
	var _canvas = {};
	var _tileCache = {};
	var _tiles = {};
	var _ctx = {};
	var _config = {};
	var _defaultConfig = {
		'width': 640,
		'height': 480,
		'x':0,
		'y':0,
		'zoom':0,
		'static':true
	};
	var _defaultStyle = {
			'fillColor':'#FFFFFF',
			'fillOpacity':0.5,
			'strokeColor':'#000000',
			'strokeOpacity':1,
			'strokeWidth':1,
			'strokeJoin':'bevel'
	};
	var _tileSize = 256;
	var _initialResolution = 2 * Math.PI * 6378137 / _tileSize;
	var _originShift = 2 * Math.PI * 6378137 / 2.0;
	var _origin = {}, _bounds = {}, _dataBounds = null;
	var _dragging = false;
	var _listeners = {};
	var _canvasBufferSize = 50;
	var _canvasScale = 2; //default = 2
	var _tile_request = 0;
	var _useCanvas = true;

	var init = function(element, userConfig) {
		_config  = initConfig(userConfig);
		initElement(element);
	};

	var initConfig = function(userConfig) {
		var obj = _defaultConfig;
		for(var cfgItem in userConfig) obj[cfgItem] = userConfig[cfgItem];  //Merge the user defined
		return obj;
	};	

	var initElement= function(element) {

	  	element = document.getElementById(element);

	  	// create viewport
	  	_div = document.createElement('div');
	  	_div.id = 'cm-viewport';
		_div.style.width = _config['width']+'px';
	  	_div.style.height = _config['height']+'px';

	  	_config['divWidth'] = _config['width'];
	  	_config['divHeight'] = _config['height'];
	  	_config['width'] = _config['width'] * _canvasScale;
	  	_config['height'] = _config['height'] * _canvasScale;

	    _bounds = calculateMercatorBounds(LatLonToMeters({'lat':_config['y'],'lon':_config['x']}),{'w':_config['width'],'h':_config['height']},_config['zoom']);
	    _origin = PixelsToRaster(MetersToPixels({'x':_bounds['left'],'y':_bounds['top']},_config['zoom']),_config['zoom']);

	    //create layers
	  	_layers = document.createElement('div');
	  	_layers.id = 'cm-layers';
		_layers.style.width = _config['width']+'px';
	  	_layers.style.height = _config['height']+'px';
	  	_layers.style.position = 'relative';

		// offset the layers from it's container div so that it is centered
		var offsetX = (_config['width'] - _config['divWidth']) / 2;
		var offsetY = (_config['height'] - _config['divHeight']) / 2;
		var transX = offsetX * -1;
		var transY = offsetY * -1;
		_layers.style.transform = "translate3d("+transX+"px,"+transY+"px,0px)";

	    //create canvas
	    _canvas = document.createElement('canvas');
	    _canvas.id = 'cm-canvas';
		_canvas.width = _config['width'];
		_canvas.height = _config['height'];
		_canvas.style.position = 'absolute';  

		// store canvas context
		_ctx = _canvas.getContext('2d') ;

		//create tiles
	    _tiles = document.createElement('div');
	    _tiles.id = 'cm-tiles';
		_tiles.style.width = _config['width']+'px';
		_tiles.style.height = _config['height']+'px';
		_tiles.style.position = 'absolute';    

		// append elements
		_layers.appendChild(_tiles);
		_layers.appendChild(_canvas);
		_div.appendChild(_layers);
		element.appendChild(_div);

		// setup event handlers for pan and zoom
		if(_config['static']!==true) {

			// zooming
			if(window.onwheel !== undefined) {
			    _canvas.addEventListener('wheel', function(event){

			    	var oldZoom = _config['zoom'];

				    if(event.deltaY > 0) {
				    	_config['zoom'] -= 1;
				    	_config['zoom'] = Math.max(_config['zoom'],0);
				    	factor = 1;
				    } else {
				    	_config['zoom'] += 1;
				    	_config['zoom'] = Math.min(_config['zoom'],19);
				    	factor = -0.5;
				    }			    
				    
				    updateLayerFromZoom(event,oldZoom,factor,offsetX,offsetY);

				    event.preventDefault();
				});
			} else if(window.onmousewheel !== undefined) { // IE
			    _canvas.addEventListener('mousewheel', function(event){

			    	var oldZoom = _config['zoom'];

				    if(event.wheelDelta  <= -120) {
				    	_config['zoom'] -= 1;
				    	_config['zoom'] = Math.max(_config['zoom'],0);
				    	factor = 1;
				    } else if(event.wheelDelta >= 120) {
				    	_config['zoom'] += 1;
				    	_config['zoom'] = Math.min(_config['zoom'],19);
				    	factor = -0.5;
				    }			    

				    updateLayerFromZoom(event,oldZoom,factor,offsetX,offsetY);

				    event.preventDefault();
				});
			}

			draggable.initialize(_layers,{ox:transX,oy:transY,fn:updateLayerFromDrag,reset:true});
		}	
	}
	
	var updateLayerFromZoom = function(event,zoom,factor,offsetX,offsetY){
	    if(zoom != _config['zoom'] ) {
	    	
			// get mouse offset from canvas center
			var dx = event.pageX - offsetX - _div.offsetLeft;
			var dy = event.pageY - offsetY - _div.offsetTop;

			// scale mouse offset based on zoom factor
			dx = dx * factor;
			dy = dy * factor;

			// get center at old zoom
			var center = getBoundsCenter(_bounds);
			center = MetersToPixels(center,zoom);
			center = PixelsToRaster(center,zoom);
			center = RasterToCanvas(center,_origin);

		    // translate center based on scaled mouse offset
			var x = center.x - dx;
			var y = center.y - dy;

			var raster = CanvasToRaster({'x':x,'y':y},_origin);
		    var pixels = RasterToPixels(raster,zoom);
		    var meters = PixelsToMeters(pixels,zoom);

		 	center = MetersToLatLon(meters);
		    _config['x'] = center.lon;
		    _config['y'] = center.lat;	

		    // calculate bounds and origin based on new center at new zoom
		   	_bounds = calculateMercatorBounds(LatLonToMeters({'lat':_config['y'],'lon':_config['x']}),{'w':_config['width'],'h':_config['height']},_config['zoom']);
			_origin = PixelsToRaster(MetersToPixels({'x':_bounds['left'],'y':_bounds['top']},_config['zoom']),_config['zoom']);	
	
		    draw();
		}
	}

	var updateLayerFromDrag = function(){

	    // get current center
		var center = getBoundsCenter(_bounds);
		center = MetersToPixels(center,_config['zoom']);
		center = PixelsToRaster(center,_config['zoom']);
		center = RasterToCanvas(center,_origin);

	    // translate center based on last made offset
		var x = center.x - this.dx; //- transX;
	    var y = center.y - this.dy;// - transY;

	    // calculate bounds and origin based on new center
		var raster = CanvasToRaster({'x':x,'y':y},_origin);
	    var pixels = RasterToPixels(raster,_config['zoom']);
	    var meters = PixelsToMeters(pixels,_config['zoom']);

	    center = MetersToLatLon(meters);
	    _config['x'] = center.lon;
	    _config['y'] = center.lat;

	   	_bounds = calculateMercatorBounds(meters,{'w':_config['width'],'h':_config['height']},_config['zoom']);
		_origin = PixelsToRaster(MetersToPixels({'x':_bounds['left'],'y':_bounds['top']},_config['zoom']),_config['zoom']);	
		
		// redraw
	    draw();
	}

	var findCanvasPos = function(obj) {
	    var curleft = 0, curtop = 0;
	    if (obj.offsetParent) {
	        do {
	            curleft += obj.offsetLeft;
	            curtop += obj.offsetTop;
	        } while (obj = obj.offsetParent);
	        return { x: curleft, y: curtop };
	    }
	    return undefined;
	}

	function rgbToHex(r, g, b) {
	    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
	}

	function hexToRgb(hex) {
	    // Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
	    var shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
	    hex = hex.replace(shorthandRegex, function(m, r, g, b) {
	        return r + r + g + g + b + b;
	    });

	    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
	    return result ? {
	        r: parseInt(result[1], 16),
	        g: parseInt(result[2], 16),
	        b: parseInt(result[3], 16)
	    } : null;
	}

	var setStyle = function(style) {
		var fillColor = 'fillColor' in style ? style['fillColor'] : _defaultStyle['fillColor'],
			fillOpacity = 'fillOpacity' in style ? style['fillOpacity'] : _defaultStyle['fillOpacity'],
			strokeColor = 'strokeColor' in style ? style['strokeColor'] : _defaultStyle['strokeColor'],
			strokeOpacity = 'strokeOpacity' in style ? style['strokeOpacity'] : _defaultStyle['strokeOpacity'],
			strokeWidth = 'strokeWidth' in style ? style['strokeWidth'] : _defaultStyle['strokeWidth'],
			strokeJoin = 'strokeJoin' in style ? style['strokeJoin'] : _defaultStyle['strokeJoin'],
			fillStyle = '', strokeStyle = '';

		fillColor = hexToRgb(fillColor);
		fillStyle = 'rgba('+fillColor.r+','+fillColor.g+','+fillColor.b+','+fillOpacity+')';
		_ctx.fillStyle = fillStyle;

		strokeColor = hexToRgb(strokeColor);
		strokeStyle = 'rgba('+strokeColor.r+','+strokeColor.g+','+strokeColor.b+','+strokeOpacity+')';
		_ctx.strokeStyle = strokeStyle;	

		_ctx.lineWidth = parseFloat(strokeWidth);
		_ctx.lineJoin = strokeJoin;	
	}

	var draw = function() {
		// clear canvas
		_canvas.width=_canvas.width;
		_canvas.height=_canvas.height;

		// draw stuff
		if(_useCanvas) {
			drawFeatures();
			drawLabels();

			_temp_canvas = document.createElement('canvas');
			_temp_canvas.width = _canvas.width;
			_temp_canvas.height = _canvas.height;
	  		_temp_ctx = _temp_canvas.getContext('2d');
			_temp_ctx.drawImage(_canvas, 0, 0);

			drawTiles();
		} else {
			drawTiles();
			drawFeatures();
			drawLabels();
		}	
	}

	var drawTiles = function() {
		/*
			This needs improvement. 
			- Each zoom level should have its own div.
			- Shouldn't do a full clear. Add new. Update existing.
			- Give tile imgs an id. Use QuadTree number so it is unique.

			OR

			Convert drawing on canvas.
		*/

		// clear all tiles
		_tiles.innerHTML = '';

		// clip bounds to mercator bounds 
		tminx = Math.max(_bounds['left'],-20037508.342789244);
		tminy = Math.max(_bounds['bottom'],-20037508.342789244);
		tmaxx = Math.min(_bounds['right'],20037508.342789244);
		tmaxy = Math.min(_bounds['top'],20037508.342789244);
		
		// determine tiles within bounds
		var tmin = MetersToTile({'x':tminx,'y':tminy},_config['zoom']);
		var tmax = MetersToTile({'x':tmaxx,'y':tmaxy},_config['zoom']);

		// draw tiles
		// for(var i = tmax.y; i>=tmin.y; i--) {
		// 	for(var j = tmin.x; j<=tmax.x; j++) {
		// 		if(j > -1 && i > -1) {
		// 			// console.log(j+','+i)
		// 			drawTile({'x':j,'y':i});
		// 		}
		// 	}
		// }

		_tile_request++;

		var xDim = tmax.x - tmin.x + 1;
		var yDim = tmax.y - tmin.y + 1;
		var x = Math.floor(tmin.x + xDim / 2);
		var y = Math.floor(tmin.y + yDim / 2)
		var path = spiral(xDim,yDim);

		for(var i in path) {
			drawTile({'x':x+path[i][0],'y':y+path[i][1]});			
		}
	}


	var spiral = function(X,Y){
	    var x = y = dx = i = 0;
	    var dy = -1;
	    var t = Math.max(X,Y);
	    var maxI = t*t;
	    var path = [];
	    for(i = 0; i < maxI; i++){
	        if ((-X/2 <= x) && (x <= X/2) && (-Y/2 <= y) && (y <= Y/2)){
	            path.push([x,y]);
	        }
	        if( (x == y) || ((x < 0) && (x == -y)) || ((x > 0) && (x == 1-y))){
	            t = dx;
	            dx = -dy;
	            dy = t;
	        }
	        x += dx;
	        y += dy;
	    }
	    return path;
	}

	var drawTile = function(t) {
		var tile = GoogleTile(t,_config['zoom']);

		if(tile.x > -1 && tile.y > -1) {
			var tileBounds = TileBounds(t,_config['zoom']);
			var tileOrigin = {'x':tileBounds.left,'y':tileBounds.top};
				tileOrigin = MetersToPixels(tileOrigin,_config['zoom']);
				tileOrigin = PixelsToRaster(tileOrigin,_config['zoom']);
				tileOrigin = RasterToCanvas(tileOrigin,_origin);	

			if(tileOrigin.x > 0 && tileOrigin.y > 0) {
				var img = {}, index = _config['zoom']+'|'+tile.x+'|'+tile.y;
				var tile_request = _tile_request;

				if(!_tileCache.hasOwnProperty(index) || (_tileCache.hasOwnProperty(index) && !_tileCache[index].loaded )) {	
					img = new Image();	
					img.src = 'https://c.tile.openstreetmap.org/'+_config['zoom']+'/'+tile.x+'/'+tile.y+'.png';
					img.loaded = false;

					if(!_useCanvas) {
						img.style.transform = "translate3d("+tileOrigin.x+"px,"+tileOrigin.y+"px,0px)";
						img.style.position = 'absolute';
						img.onload = function() {
							if(tile_request == _tile_request) {		
								_tiles.appendChild(img);
								this.loaded = true;
							}
						};
					} else {
						img.onload = function() {
							if(tile_request == _tile_request) {								
						    	_ctx.drawImage(img, Math.floor(tileOrigin.x), Math.floor(tileOrigin.y));
						    	_ctx.drawImage(_temp_canvas, Math.floor(tileOrigin.x), Math.floor(tileOrigin.y), 256, 256, Math.floor(tileOrigin.x), Math.floor(tileOrigin.y),256,256);
						    	this.loaded = true;
						    }
						};
					}

					_tileCache[index] = img;
				} else {
					img = _tileCache[index];
					if(!_useCanvas) {
						img.style.transform = "translate3d("+tileOrigin.x+"px,"+tileOrigin.y+"px,0px)";
						_tiles.appendChild(img);
					} else {
						_ctx.drawImage(img, Math.floor(tileOrigin.x), Math.floor(tileOrigin.y));
						_ctx.drawImage(_temp_canvas, Math.floor(tileOrigin.x), Math.floor(tileOrigin.y), 256, 256, Math.floor(tileOrigin.x), Math.floor(tileOrigin.y),256,256);
					}
				}
			}

			/*
			var useCanvas = true;
			if(!useCanvas) {
				var img = document.createElement('img');

					// openstreemap
					img.src = 'https://c.tile.openstreetmap.org/'+_config['zoom']+'/'+tile.x+'/'+tile.y+'.png';

					// stamen
					// img.src = 'http://tile.stamen.com/terrain/'+_config['zoom']+'/'+tile.x+'/'+tile.y+'.jpg'; 

					img.style.transform = "translate3d("+tileOrigin.x+"px,"+tileOrigin.y+"px,0px)";
					img.style.position = 'absolute';

				_tiles.appendChild(img);
			} else {
				// Testing drawing of tiles directly to canvas
				// issue: overwrites map objects due to asynchronous nature
				//		  need to merge two different contexts on the fly
				var tile_request = _tile_request;
				var img = new Image();
					img.onload = function() {	
						if(tile_request == _tile_request) {		
					    	_ctx.drawImage(img, Math.floor(tileOrigin.x), Math.floor(tileOrigin.y));
					    	// _ctx.drawImage(_temp_canvas, Math.floor(tileOrigin.x), Math.floor(tileOrigin.y), 256, 256, Math.floor(tileOrigin.x), Math.floor(tileOrigin.y),256,256);
					    }

					};
					img.src = 'https://c.tile.openstreetmap.org/'+_config['zoom']+'/'+tile.x+'/'+tile.y+'.png';
			}
			*/
		}
	}

	/*
	var drawTile = function() {
		_tiles.innerHTML = '';

		var mapBounds = _bounds;
		var mapCenter = getBoundsCenter(mapBounds);

		var tile = GoogleTile(MetersToTile(mapCenter,_config['zoom']),_config['zoom']);
		var tileTMS = MetersToTile(mapCenter,_config['zoom']);
		var tileBounds = TileBounds(tileTMS,_config['zoom']);
		var tileOrigin = {'x':tileBounds.left,'y':tileBounds.top};
			tileOrigin = MetersToPixels(tileOrigin,_config['zoom']);
			tileOrigin = PixelsToRaster(tileOrigin,_config['zoom']);
			tileOrigin = RasterToCanvas(tileOrigin,_origin);	

		var img = document.createElement('img');
			img.src = 'http://c.tile.openstreetmap.org/'+_config['zoom']+'/'+tile.x+'/'+tile.y+'.png';
			img.style.transform = "translate("+tileOrigin.x+"px,"+tileOrigin.y+"px)";

		_tiles.appendChild(img);
	}
	*/

	var drawFeatures = function() {
		var features = _config['data']['features'], feature = {}, coords = {}, style = {};
		for(var i in features) {	
			feature = features[i]['geometry'];
            coords = feature['type']=='GeometryCollection' ? feature['geometries'] : feature['coordinates'];

			if(typeof _config['style'] === 'function') {
				style = _config['style'](features[i]);
			} else if (typeof _config['style'] === 'object') {
				style = _config['style'];
			}

			setStyle(style);

			drawFeature(coords,feature['type']);
		}

		// drawTestPoints(); //debug

		// draw bounding box...for testing
		// _ctx.beginPath();
		// _ctx.strokeStyle = 'rgba(255,0,0,1)';
		// _ctx.lineWidth = 0.5;
		// _ctx.strokeRect(_dataBounds['left'], _dataBounds['top'],_dataBounds['right']-_dataBounds['left'],_dataBounds'bottom']-_dataBounds['top']);
	}

	var drawFeature = function(coords,type) {
		switch(type) {
			case 'Point':
				drawPoint(coords);
				break;
			case 'MultiPoint':
				for(var i in coords) {
					drawPoint(coords[i]);
				}
			case 'LineString':
				drawLineString(coords);
				break;
			case 'MultiLineString':
				for(var i in coords) {
					drawLineString(coords[i]);
				}				
				break;
			case 'Polygon':	
				drawPolygon(coords);
				break;
			case 'MultiPolygon':
				for(var i in coords) {
					drawPolygon(coords[i]);
				}
				break;
			case 'GeometryCollection':
				drawGeometryCollection(coords);
				break;
			default:
				break;
		}		
	}

	var drawLabels = function() {
		var features = _config['data']['features'], 
			feature = {}, geometry = {},
			coords = [], point = [];

		for(var i in features) {
			feature = features[i]['geometry'];
			coords = feature['type']=='GeometryCollection' ? feature['geometries'] : feature['coordinates'];
			name = features[i]['properties']['name'];

			switch(feature['type']) {
				case 'Point':
					point = {'lat':coords[1],'lon':coords[0]};
					drawLabel(name,point);
					break;
				case 'MultiPoint':
					for(var i in coords) {
						point = {'lat':coords[i][1],'lon':coords[i][0]};
						drawLabel(name,point);
					}
				case 'LineString':
					// drawLabel(point);
					break;
				case 'MultiLineString':
					for(var i in coords) {
						// drawLabel(point);
					}				
					break;
				case 'Polygon':	
					drawLabel(name,getCentroid(coords));	
					break;
				case 'MultiPolygon':
					for(var i in coords) {
						drawLabel(name,getCentroid(coords[i]));
					}
					break;
				case 'GeometryCollection':
					drawGeometryCollectionLabels(coords);
					break;
				default:
					break;
			}	

			
		}
	}	

	var getCentroid = function(coords) {
		var centroid = polylabel(coords, 1.0);
		centroid = {'lat':centroid[1],'lon':centroid[0]};
		return centroid;
	}

	var drawLabel = function(text,point) {
		var point = RasterToCanvas(LatLonToRaster(point,_config['zoom']),_origin);

		// draw dot
		// _ctx.fillStyle = '#FF0000';
		// _ctx.beginPath();
		// _ctx.arc(point.x, point.y, 5, 0, Math.PI*2, true); 
		// _ctx.closePath();
		// _ctx.fill();

		// draw crosshair
		// _ctx.strokeStyle = '#0000FF';
		// _ctx.lineWidth = 2;
		// _ctx.beginPath();
		// _ctx.moveTo(point.x, point.y - 5);
		// _ctx.lineTo(point.x, point.y + 5);
		// _ctx.moveTo(point.x - 5,  point.y);
		// _ctx.lineTo(point.x + 5,  point.y);
		// _ctx.stroke();	
				
		// draw label
		_ctx.strokeStyle = '#FFFFFF';
		_ctx.fillStyle = '#000000';
		_ctx.lineWidth = 1;
		_ctx.beginPath();
		_ctx.font = "bold 10px Arial";
		_ctx.textAlign = 'center';
		_ctx.textBaseline = 'middle';
		_ctx.strokeText(text,point.x,point.y);
		_ctx.fillText(text,point.x,point.y);
	}

	var drawBoundingBox = function() {

	}

	var drawPoint = function(point) {
		drawVertex(point);
	}

	var drawLineString = function(points) {
		_ctx.beginPath();
		drawPath(points);			
		_ctx.stroke();	
	}

	var drawPolygon = function(rings) {
		_ctx.beginPath();
		for(var i in rings) {
			var ring = rings[i].slice(); // clone the array
			if(i > 0) { ring.reverse(); }
			drawPath(ring);
			_ctx.closePath();
		}
		_ctx.fill();							
		_ctx.stroke();
	}	

	var drawGeometryCollection = function(geoms) {	
		for(var i in geoms) {
			drawFeature(geoms[i]['coordinates'],geoms[i]['type']);
		}
	}

	var drawGeometryCollectionLabels = function(geoms) {	
		for(var i in geoms) {
			drawLabel(geoms[i]['coordinates'],geoms[i]['type']);
		}
	}	

	var drawVertex = function(point) {
		point = {'lat':point[1],'lon':point[0]};
		point = RasterToCanvas(LatLonToRaster(point,_config['zoom']),_origin);

		_ctx.fillStyle = '#FF0000';
		_ctx.beginPath();
		_ctx.arc(point.x, point.y, 5, 0, Math.PI*2, true); 
		_ctx.closePath();
		_ctx.fill();

		extendDataBounds(point);
	}

	var drawPath = function(points) {
		var bounds = {}, point = {};

		for(var j = 0; j < points.length; j++) {
			point = {'lat':points[j][1],'lon':points[j][0]};
			point = RasterToCanvas(LatLonToRaster(point,_config['zoom']),_origin);

			if(j==0) {
				_ctx.moveTo(point.x, point.y);
				// _ctx.moveTo((point.x+0.5)|0, (point.y+0.5)|0); // avoid sub-pixel rendering
				// _ctx.moveTo(Math.round(point.x), Math.round(point.y)); // avoid sub-pixel rendering
			} else {
				_ctx.lineTo(point.x, point.y);
				// _ctx.lineTo((point.x+0.5)|0, (point.y+0.5)|0); // avoid sub-pixel rendering
				// _ctx.lineTo(Math.round(point.x), Math.round(point.y)); // avoid sub-pixel rendering
			}

			extendDataBounds(point);
		}
	}

	var extendDataBounds = function(point) {
		point = PixelsToMeters(RasterToPixels(CanvasToRaster(point,_origin),_config['zoom']),_config['zoom']);
		if(_dataBounds === null) {
			_dataBounds = {'left':point.x,'bottom':point.y,'right':point.x,'top':point.y,}
		} else {
			_dataBounds['left'] = Math.min(_dataBounds['left'],point.x);
			_dataBounds['right'] = Math.max(_dataBounds['right'],point.x);
			_dataBounds['bottom'] = Math.min(_dataBounds['bottom'],point.y);
			_dataBounds['top'] = Math.max(_dataBounds['top'],point.y);
		}
	}

	var zoomToBounds = function() {

		// update bounds to data bounds 
		_bounds = _dataBounds;

		// calculate new center from bounds
	    var c = getBoundsCenter(_bounds);
	    var center = MetersToLatLon(c);
	    _config['x'] = center.lon;
	    _config['y'] = center.lat;

	    // calculate pixel buffers. this is to ensure that all objects fit in viewport
		var pixelBufferX = (_config['width'] - _config['divWidth']) + _canvasBufferSize;
		var pixelBufferY = (_config['height'] - _config['divHeight']) + _canvasBufferSize;

	    // calculate required zoom level to contain bounds
	    var dw = c.x-_bounds['left'];
	    var dh = _bounds['top']-c.y;
	   	var resw = (2 * dw) / (_config['width'] - pixelBufferX);
	    var resh = (2 * dh) / (_config['height'] - pixelBufferY);
	    var res = Math.max(resw,resh);
	    var zoom = Math.log(_initialResolution / res) / Math.log(2);
		_config['zoom'] = Math.floor(zoom);
		_config['zoom'] = Math.max(_config['zoom'],0);
		_config['zoom'] = Math.min(_config['zoom'],20);


	    // calculate new bounds and origin for new center and zoom
	   	_bounds = calculateMercatorBounds(c,{'w':_config['width'],'h':_config['height']},_config['zoom']);	  
		_origin = PixelsToRaster(MetersToPixels({'x':_bounds['left'],'y':_bounds['top']},_config['zoom']),_config['zoom']);

		// drawFeatures
		draw();
	}

	var drawTestPoints = function() {
		// center and boundary points	
		var points = [];

	    var point = {'lat':_config['y'],'lon':_config['x']};
	    var raster = LatLonToRaster(point,_config['zoom']);

		var nw = PixelsToRaster(MetersToPixels({'x':_bounds['left'],'y':_bounds['top']},_config['zoom']),_config['zoom']);
	   	var ne = PixelsToRaster(MetersToPixels({'x':_bounds['right'],'y':_bounds['top']},_config['zoom']),_config['zoom']);
	   	var se = PixelsToRaster(MetersToPixels({'x':_bounds['right'],'y':_bounds['bottom']},_config['zoom']),_config['zoom']);
	   	var sw = PixelsToRaster(MetersToPixels({'x':_bounds['left'],'y':_bounds['bottom']},_config['zoom']),_config['zoom']);

		points.push(RasterToCanvas(raster,nw));

		_ctx.fillStyle = '#00FF00';
		for(var i = 0; i < points.length; i++) {
			//draw a circle
			_ctx.beginPath();
			_ctx.arc(points[i].x, points[i].y, 5, 0, Math.PI*2, true); 
			_ctx.closePath();
			_ctx.fill();
		}
	}

	var isPointInPoly = function(poly, pt) {
	    for(var c = false, i = -1, l = poly.length, j = l - 1; ++i < l; j = i)
	        ((poly[i][1] <= pt[1] && pt[1] < poly[j][1]) || (poly[j][1] <= pt[1] && pt[1] < poly[i][1]))
	        && (pt[0] < (poly[j][0] - poly[i][0]) * (pt[1] - poly[i][1]) / (poly[j][1] - poly[i][1]) + poly[i][0])
	        && (c = !c);
	    return c;
	}	

	var	LatLonToMeters = function(p) {
   	 	// Converts given lat/lon in WGS84 Datum to XY in Spherical Mercator EPSG:900913
        var mx = p.lon * _originShift / 180.0;
        var my = Math.log( Math.tan((90 + p.lat) * Math.PI / 360.0 )) / (Math.PI / 180.0);
        my = my * _originShift / 180.0
        return {'x':mx,'y':my};
    }

	var MetersToLatLon = function(m) {
        // Converts XY point from Spherical Mercator EPSG:900913 to lat/lon in WGS84 Datum
        var lon = (m.x / _originShift) * 180.0
        var lat = (m.y / _originShift) * 180.0
        lat = 180 / Math.PI * (2 * Math.atan( Math.exp( lat * Math.PI / 180.0)) - Math.PI / 2.0);
        return {'lat':lat,'lon':lon};
	}

	var PixelsToMeters = function(p, zoom) {
        // Converts pixel coordinates in given zoom level of pyramid to EPSG:900913
        var res = Resolution(zoom);
        var mx = p.x * res - _originShift;
        var my = p.y * res - _originShift;
        return {'x':mx,'y':my};
	}

	var	MetersToPixels = function(m, zoom) {
        // Converts EPSG:900913 to pyramid pixel coordinates in given zoom level	
        var res = Resolution(zoom);         
        var px = (m.x + _originShift) / res;
        var py = (m.y + _originShift) / res;
        return {'x':px,'y':py};
    }

    var PixelsToRaster = function(p, zoom) {
        // Move the origin of pixel coordinates to top-left corner  
        var mapSize = _tileSize << zoom;
        return {'x':p.x,'y':mapSize - p.y};
    }

    var RasterToPixels = function(p, zoom) {
        // Move the origin of pixel coordinates to top-left corner  
        var mapSize = _tileSize << zoom;
        return {'x':p.x,'y':mapSize - p.y};
    }

    var Resolution = function(zoom) {
        // Resolution (meters/pixel) for given zoom level (measured at Equator)	       
        return _initialResolution / Math.pow(2,zoom);
    }

    var calculateMercatorBounds = function(c, s, zoom) {       
	    var res = Resolution(zoom); 
	    var dw = (s.w * res) / 2;
	    var dh = (s.h * res) / 2;
	    return {"left": c.x - dw, "bottom": c.y - dh, "right": c.x + dw, "top": c.y + dh }; 
	}

	var getBoundsCenter = function(bounds) {
		var x = bounds['left'] + (bounds['right']-bounds['left'])/2;
		var y = bounds['bottom'] + (bounds['top']-bounds['bottom'])/2;
		return {'x':x,'y':y};
	}

	var RasterToCanvas = function(r,o) {
		return {'x':r.x-o.x,'y':r.y-o.y};
	}

	var CanvasToRaster = function(c,o) {
		return {'x':c.x+o.x,'y':c.y+o.y};
	}

	var LatLonToRaster = function(p,zoom) {
		return PixelsToRaster(MetersToPixels(LatLonToMeters(p),zoom),zoom);
	}	

	var PixelsToTile = function(p) {
        // Returns a tile covering region in given pixel coordinates
        var tx = Math.ceil( p.x / _tileSize ) - 1;
        var ty = Math.ceil( p.y / _tileSize ) - 1;
        return {'x':tx,'y':ty};
    }

    var MetersToTile = function(m, zoom) {
        // Returns tile for given mercator coordinates 
        var p = MetersToPixels(m, zoom);    
        return PixelsToTile(p);
    }

 	var GoogleTile = function(t, zoom) {
        // Converts TMS tile coordinates to Google Tile coordinates      
        // coordinate origin is moved from bottom-left to top-left corner of the extent
        return {'x':t.x,'y':Math.pow(2,zoom) - 1 - t.y};
    }

	var TileBounds = function(t, zoom) {
        // Returns bounds of the given tile in EPSG:900913 coordinates
        var tmin = {'x':t.x*_tileSize,'y':t.y*_tileSize};
        var min = PixelsToMeters(tmin, zoom);
        var tmax = {'x':(t.x+1)*_tileSize,'y':(t.y+1)*_tileSize};
        var max = PixelsToMeters(tmax, zoom);
        return {"left": min.x, "bottom": min.y, "right": max.x, "top": max.y };
    }

    var TileLatLonBounds = function(t, zoom) {
        // Returns bounds of the given tile in latutude/longitude using WGS84 datum
        var bounds = TileBounds(t, zoom);
        var min = MetersToLatLon({'x':bounds['left'], 'y':bounds['bottom']});
        var max = MetersToLatLon({'x':bounds['right'], 'y':bounds['top']});     
        return {'bottom':min.lat,'left':min.lon,'top':max.lat,'right':max.lon};
    } 

	init(element,userConfig);
	draw();

	return {
		'config':_config,//debug
		'draw':draw,
		'zoomToBounds':zoomToBounds
	};

}


var draggable = {
	initialize : function(element,config) {
		this._element = element;
		this._dragging = false;
		this._listeners = [];
		this._needUpdate = true;

		this._config = {
			handle:element,
			reset:false,
			ox:0, // default x offset
			oy:0, // default y offset
			fn:function(){} // default callback
		} 

		this._config = this._configure(config);

		this._config.handle.addEventListener('mousedown',this._onDown.bind(this),false);
	},
	_configure : function(userConfig) {
		var config = this._config;
		for(var cfgItem in userConfig) config[cfgItem] = userConfig[cfgItem];  //Merge the user defined
		return config;
	},
	_onDown : function(event) {
		event.preventDefault();

		this._needUpdate = true;

		// calculate starting position
		this.sx = event.pageX;
		this.sy = event.pageY;

		if(!this._dragging) {
			this._listeners.onMove = this._onMove.bind(this);
			this._listeners.onUp = this._onUp.bind(this);

			document.addEventListener('mousemove',this._listeners.onMove,false); 
			document.addEventListener('mouseup',this._listeners.onUp,false);
			this._element.style.cursor = 'move';
		}					
	},
	_onMove : function(event) {
		event.preventDefault();

		this._dragging = true;

        // calculate change in position
       	this.dx = event.pageX - this.sx;
        this.dy = event.pageY - this.sy;

		// update element
		if(this._needUpdate) {
			this._needUpdate = false;
        	this._frame = requestAnimationFrame(this._update.bind(this));
        }
	},
	_onUp : function(event) {
		if(this._dragging) {
			if(this._frame) cancelAnimationFrame(this._frame);
			this._dragging = false;

			if(this._config.reset) {
				this._element.style.transform = 'translate3d(' + this._config.ox + 'px, ' + this._config.oy + 'px, 0px)';
			} else {
				this._config.ox = this.x;
				this._config.oy = this.y;
			}

			this._config.fn.call(this);
		}

		document.removeEventListener('mousemove',this._listeners.onMove);
		document.removeEventListener('mouseup',this._listeners.onUp);
		this._listeners = [];
		this._element.style.cursor = 'default';
	},
	_update : function() {
		this._needUpdate = true;
		this.x = this.dx + this._config.ox;
		this.y = this.dy + this._config.oy;
		this._element.style.transform = 'translate3d(' + this.x + 'px, ' + this.y + 'px, 0px)';
	}
};		
