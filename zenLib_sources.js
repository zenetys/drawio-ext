/* File concatenated by concatLib module */

const inRange = (value, min = 0, max = 100) => Math.max(min, Math.min(max, value));

function addCustomProperty(name, type, shape, min = undefined, max = undefined) {
	const property = {};
	const displayedName = (
		name.charAt(0).toUpperCase() + 
		name.slice(1).replace(/([A-Z])/g, " $1").trim()
	);

	property.name = name;
	property.dispName = displayedName;
	property.type = type;
	property.defVal = shape.prototype.defaultValues[name];
	if(min) property.min = min;
	if(max) property.max = max;

	return property;
}

function getVariableValue(style, shape, variableKey, isStringArray = false) {
	const variableValue = mxUtils.getValue(
		style, 
		variableKey,
		shape.prototype.defaultValues[variableKey]
	);
	return isStringArray ? variableValue.toString().split(",") : variableValue;
}

function getColor(percentage, colors, stages, defaultColor = "black") {
	const loops = colors.length;
	const lastLoop = loops - 1;

	for(let loop = 0; loop < loops; loop++) {
		const color = colors[loop] || defaultColor;
		const stageLimit = parseInt(stages[loop]);

		if (loop === lastLoop) return color;
		else if (percentage <= stageLimit) return color;
	}
}

function addText(c, x, y, text) {
	c.text(x, y, 0, 0, `${parseInt(text, 10)}%`, mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
}

//**************************************************************************************
//Linear Gauge
//**************************************************************************************

/** Extends mxShape */
function zenetysShapeGaugeLinear(bounds, fill, stroke, strokewidth = 1) {
	mxShape.call(this);
	this.bounds = bounds;
	this.fill = fill;
	this.stroke = stroke;
	this.strokewidth = strokewidth;
	this.gaugePos = 25;
};
mxUtils.extend(zenetysShapeGaugeLinear, mxShape);

/** Custom props & default values */
zenetysShapeGaugeLinear.prototype.cst = {
  SCALE_COLORS : 'scaleColors',
  SCALE_STAGES : 'scaleStages',
  GAUGE_LABEL : 'gaugeLabel',
  TEXT_COLOR : 'textColor',
  TEXT_SIZE : 'textSize',
  GAUGE_PERCENTAGE : 'percentage',
  SHAPE: 'zenShape.gauge.linear',
  GAUGE_TYPE : 'gaugeType',
};

zenetysShapeGaugeLinear.prototype.defaultValues = {
	gaugeType: 0,
	scaleColors: '#00FF00,#FF8000,#FF0000',
	scaleStages: '50,80',
	textColor: '#000',
	textSize: 12,
	percentage: 25,
};

function addLinearProperty(name, type, min = undefined, max = undefined) {
	return addCustomProperty(name, type, zenetysShapeGaugeLinear, min, max);
}

zenetysShapeGaugeLinear.prototype.customProperties = [
	addLinearProperty("percentage", 	"float", 0, 100),
	addLinearProperty("gaugeType", 		"int",   0, 1),
	addLinearProperty("scaleStages", 	"String"),
	addLinearProperty("scaleColors", 	"String"),
	addLinearProperty("textSize", 		"int"),
	addLinearProperty("textColor", 		"color"),
];

/** Paint the shape */
zenetysShapeGaugeLinear.prototype.paintVertexShape = function(c, x, y, w, h) {
	c.translate(x, y);
	this.background(c, w, h);
	c.setShadow(false);
	this.foreground(c, w, h);
};

zenetysShapeGaugeLinear.prototype.drawGauge = function(
	c, w, h, 			// mxGraph stuff
	orientation,	// 0 => horizontal | 1 => vertical
	color = '#FFF', 
	percentage = 100, 
	isOutline = false
) {
	const normalizedPercentage = percentage / 100;
	
	c.setFillColor(color);
	c.setStrokeColor(color);
	
	c.begin();
	orientation === 0 ? c.rect(
		w * 0, 
		h * 0, 
		w * normalizedPercentage, 
		h * 1
	) : c.rect(
		w * 0, 
		h * (1 - normalizedPercentage), 
		w * 1, 
		h * normalizedPercentage
	);
	isOutline ? c.stroke() : c.fill();  // stroke if is outline, or fill
}

zenetysShapeGaugeLinear.prototype.background = function(c, w, h) {
	const gaugeType = mxUtils.getValue(
		this.style, 
		zenetysShapeGaugeLinear.prototype.cst.GAUGE_TYPE, 
		zenetysShapeGaugeLinear.prototype.defaultValues.gaugeType
	);
	zenetysShapeGaugeLinear.prototype.drawGauge(c,w,h, gaugeType);
};

zenetysShapeGaugeLinear.prototype.foreground = function(c, w, h) {
	const getLinearValue = (variableKey, isStringArray = false) => getVariableValue(
		this.style, 
		zenetysShapeGaugeLinear, 
		zenetysShapeGaugeLinear.prototype.cst[variableKey],
		isStringArray
	);

	const scaleColors = getLinearValue("SCALE_COLORS", true);
	const scaleStages = getLinearValue("SCALE_STAGES", true);
	const textColor = 	getLinearValue("TEXT_COLOR");
	const textSize =		getLinearValue("TEXT_SIZE");
	const gaugeType = 	getLinearValue("GAUGE_TYPE");
	const percentage = 	inRange(getLinearValue("GAUGE_PERCENTAGE"));

	const drawGauge = zenetysShapeGaugeLinear.prototype.drawGauge;
	drawGauge(c,w,h, gaugeType, getColor(percentage, scaleColors, scaleStages), percentage); 	// draw fill
	drawGauge(c,w,h, gaugeType, getColor(percentage, scaleColors, scaleStages), 100, true); 	// draw outline

	c.setFontSize(textSize);
	c.setFontColor(textColor);
	
	const textVerticalOffset = 10;
	// add text
	addText(c, w*.5, h + textVerticalOffset, percentage);
};

mxCellRenderer.registerShape(
	zenetysShapeGaugeLinear.prototype.cst.SHAPE, 
	zenetysShapeGaugeLinear
);

Graph.handleFactory[zenetysShapeGaugeLinear.prototype.cst.SHAPE] = function(state) {
	const handles = [Graph.createHandle(
		state, 
		['percentage'], 
		function(bounds) {
			const percentage = inRange(
				parseFloat(
					mxUtils.getValue(
						this.state.style, 
						'percentage', 
						this.percentage
					)
				)
			);
			return new mxPoint(
				bounds.x + bounds.width * .2 + percentage * .6 * bounds.width / 100, 
				bounds.y + bounds.height * .8
			);
		}, 
		function(bounds, pt) {
		// this.state.style['percentage'] = Math.round(1000 * Math.max(0, Math.min(100, (pt.x - bounds.x) * 100 / bounds.width))) / 1000;
		this.state.style['percentage'] = Math.round(
			1000 * inRange((pt.x - bounds.x) * 100 / bounds.width)
		) / 1000;
	})];

	return handles;
}

//**************************************************************************************
// Number Gauge
//**************************************************************************************


/** Extends mxShape */
function zenetysShapeGaugeNumber(bounds, fill, stroke, strokewidth) {
	mxShape.call(this);
	this.bounds = bounds;
	this.fill = fill;
	this.stroke = stroke;
	this.strokewidth = (strokewidth != null) ? strokewidth : 1;
	this.gaugePos = 25;
};
mxUtils.extend(zenetysShapeGaugeNumber, mxShape);

/** Custom props & default values */
zenetysShapeGaugeNumber.prototype.cst = {
	GAUGE_PERCENTAGE : 'percentage',
	TEXT_SIZE : 'textSize',
	STROKE_WIDTH: 'strokeWidth',
	
	IS_FILLED: 'isFilled',
	IS_OUTLINED: 'isOutlined',
	IS_COLORIZED: 'isColorized',
	
	STAGES : 'stages',
	FILL_COLORS : 'fillColors',
	OUTLINE_COLORS : 'outlineColors',
	TEXT_COLORS : 'textColors',
	
	SHAPE : 'zenetys.mockup.gauge.number',
	SHAPE : 'zenShape.gauge.number',
};

zenetysShapeGaugeNumber.prototype.defaultValues = {
	percentage:25,
	textSize:28,
	strokeWidth:10,
	
	isFilled:true,
	isOutlined:true,
	isColorized:true,

	stages:'50,80',
	fillColors: '#99FF99,#FFCC99,#FF9999',
	outlineColors: '#00FF00,#FF8000,#FF0000',
	textColors: '#009900,#994C00,#990000',
};

function addNumberProperty(name, type, min = undefined, max = undefined) {
	return addCustomProperty(name, type, zenetysShapeGaugeNumber, min, max);
}

zenetysShapeGaugeNumber.prototype.customProperties = [
	addNumberProperty("percentage",		"float", 0, 100),
	addNumberProperty("textSize",			"int", 1),
	addNumberProperty("strokeWidth",	"int", 1),
	addNumberProperty("isFilled",			"bool"),
	addNumberProperty("isOutlined",		"bool"),
	addNumberProperty("isColorized",	"bool"),
	addNumberProperty("stages",				"String"),
	addNumberProperty("fillColors",		"String"),
	addNumberProperty("outlineColors","String"),
	addNumberProperty("textColors",		"String"),
];

/** Paint the shape */
zenetysShapeGaugeNumber.prototype.paintVertexShape = function(c, x, y, w, h) {
	c.translate(x, y);
	this.background(c, w, h);
	c.setShadow(false);
	this.foreground(c, w, h);
};

zenetysShapeGaugeNumber.prototype.background = function(c, w, h) {
	c.setFillColor('#FFF');
	c.ellipse(0, 0, w, h);
	c.fill();
};

zenetysShapeGaugeNumber.prototype.foreground = function(c, w, h) {
	const getNumberValue = (variableKey, isStringArray = false) => getVariableValue(
		this.style,
		zenetysShapeGaugeNumber,
		zenetysShapeGaugeNumber.prototype.cst[variableKey],
		isStringArray
	);
	
	const percentage    = inRange(getNumberValue("GAUGE_PERCENTAGE"));
	const textSize 			= getNumberValue("TEXT_SIZE");
	const strokeWidth 	= getNumberValue("STROKE_WIDTH");
	const isFilled 			= getNumberValue("IS_FILLED");
	const isOutlined 		= getNumberValue("IS_OUTLINED");
	const isColorized 	= getNumberValue("IS_COLORIZED");	
	const stages 				= getNumberValue("STAGES", true);
	const fillColors 		= getNumberValue("FILL_COLORS", true);
	const outlineColors = getNumberValue("OUTLINE_COLORS", true);
	const textColors 		= getNumberValue("TEXT_COLORS", true);

	const DEFAULT_FILLCOLOR = "white";
	c.setFillColor(isFilled ? getColor(percentage, fillColors, stages):DEFAULT_FILLCOLOR);
	c.begin();
	c.ellipse(0,0,w,h);
	c.fill();

	if (isOutlined) {
		c.setStrokeColor(
			getColor(percentage, outlineColors, stages)
		);
		c.setStrokeWidth(strokeWidth);
		const normalized = strokeWidth / 100;

		c.ellipse(
			w * (normalized / 2), 
			h * (normalized / 2),
			w * (1 - normalized),
			h * (1 - normalized)
		);
		c.stroke();
		c.setStrokeWidth(1); // set stroke default value
	}
	c.setFontSize(textSize);
	if (isColorized) c.setFontColor(getColor(percentage, textColors, stages));
	addText(c, w * .5, h * .45, percentage);
};

mxCellRenderer.registerShape(
	zenetysShapeGaugeNumber.prototype.cst.SHAPE, 
	zenetysShapeGaugeNumber
);

Graph.handleFactory[zenetysShapeGaugeNumber.prototype.cst.SHAPE] = function(state) {
	const handles = [Graph.createHandle(
		state, 
		['percentage'], 
		function(bounds) {
			const percentage = inRange(
				parseFloat(
					mxUtils.getValue(
						this.state.style, 
						'percentage', 
						this.percentage
					)
				)
			);
			return new mxPoint(
				bounds.x + bounds.width * .2 + percentage * .6 * bounds.width / 100, 
				bounds.y + bounds.height * .8
			);
		}, 
		function(bounds, pt) {
			this.state.style['percentage'] = Math.round(
				1000 * inRange((pt.x - bounds.x) * 100 / bounds.width)
			) / 1000;			
		}
	)];
	return handles;
}

//**************************************************************************************
//Speedometer Gauge
//**************************************************************************************


/** Extends mxShape */
function zenetysShapeGaugeSpeedometer(bounds, fill, stroke, strokewidth) {
	mxShape.call(this);
	this.bounds = bounds;
	this.fill = fill;
	this.stroke = stroke;
	this.strokewidth = (strokewidth != null) ? strokewidth : 1;
	this.gaugePos = 25;
};
mxUtils.extend(zenetysShapeGaugeSpeedometer, mxShape);

/** Custom props & default values */
zenetysShapeGaugeSpeedometer.prototype.cst = {
	GAUGE_PERCENTAGE : 'percentage',
  SCALE_STAGES : 'scaleStages',
  SCALE_COLORS : 'scaleColors',
  TEXT_SIZE : 'textSize',
  SHAPE : 'zenShape.gauge.speedometer',
	GAUGE_TYPE: "gaugeType",
};

zenetysShapeGaugeSpeedometer.prototype.defaultValues = {
  percentage: 25,
  scaleStages: '50,80',
  scaleColors: '#00FF00,#FF8000,#FF0000',
  textSize: 18,
	gaugeType: 0
};

function addSpeedometerProperty(name, type, min = undefined, max = undefined) {
	return addCustomProperty(name, type, zenetysShapeGaugeSpeedometer, min, max);
}

zenetysShapeGaugeSpeedometer.prototype.customProperties = [
	addSpeedometerProperty("percentage", "float", 0, 100),
	addSpeedometerProperty("scaleStages", "String"),
	addSpeedometerProperty("scaleColors", "String"),
	addSpeedometerProperty("textSize", "int"),
	addSpeedometerProperty("gaugeType", "int", 0, 1),
];

zenetysShapeGaugeSpeedometer.prototype.drawGauge = function (c,w,h, percentage, color, type, isOutline = false) {
  function getVertex(c,w,h, pos, side) {
		const arcHeight = type === 0 ? .75 : .5; // 1 === full circle
		const arcOrientation = type === 0 ? 1.25 : 1.5;
		const percentil = {
			x: .5,
			y: .5
		};
    const getGaugePos = (pos) => (
			arcHeight * (2 * Math.PI * parseFloat(pos) / 100) + arcOrientation * Math.PI
		);
    const r = side === 'int' ? .25 : .50;
    const x = w * percentil.x + w * r * Math.sin(getGaugePos(pos));
    let y = (h * percentil.y - h * r * Math.cos(getGaugePos(pos)));
		if(type === 1) y*=2;
    return { pos, x, y };
  }

  function drawArc(c, side, vertex) {
    let rx, ry, sweep;
    
    if (side === 'int') {
      rx = w * .25;
      ry = h * (type === 0 ?.25 : .5);
      sweep = 1;		// rotation horaire
    } else {
      rx = w * .5;
      ry = h * (type === 0 ? .5 : 1);
      sweep = 0;		// rotation antihoraire
    }
    
    // 67 => if (gaugePos >= 67) => arc >= 180° => need large arc flag
    const largeArc = type === 1 ? 0 : percentage >= 67 ? 1 : 0;
    
    c.arcTo(
      rx,         // radius x
      ry,         // radius y
      0,	        // angle (effet penché dir haut-droite)
      largeArc,	  // largeArcFlag (more than 180°)
      sweep,	    // sweepFlag (direction)
      vertex.x,	  // final pos x
      vertex.y		// final pos y
    );
  }

  // get vertices
  const startInt = getVertex(c,w,h, 0, 'int');
  const startExt = getVertex(c,w,h, 0, 'ext');
  const endInt = getVertex(c,w,h, percentage, 'int');
  const endExt = getVertex(c,w,h, percentage, 'ext');

  // assign color to the new shape
  c.setFillColor(color);      
  c.setStrokeColor(color);

  c.begin();                          // starts drawing the shape
  c.moveTo(startInt.x, startInt.y);   // go to 1st vertex
  drawArc(c, 'int', endInt);          // arc to 2nd vertex
  c.lineTo(endExt.x, endExt.y);       // line to 3rd vertex
  drawArc(c, 'ext', startExt, true);  // arc to 4th vertex	
  c.close(); 													// line to 1st vertex to close the shape
  
  isOutline ? c.stroke() : c.fill();  // stroke if is outline, or fill
};

/** Paint the shape */
zenetysShapeGaugeSpeedometer.prototype.paintVertexShape = function(c, x, y, w, h) {
	c.translate(x, y);
	this.background(c, w, h);
	c.setShadow(false);
	this.foreground(c, w, h);
};

zenetysShapeGaugeSpeedometer.prototype.background = function(c, w, h) {
	const gaugeType = mxUtils.getValue(
		this.style,
		zenetysShapeGaugeSpeedometer.prototype.cst.GAUGE_TYPE,
		zenetysShapeGaugeSpeedometer.prototype.defaultValues.gaugeType
	);
	zenetysShapeGaugeSpeedometer.prototype.drawGauge(c,w,h, 100, '#FFF', gaugeType);
};

zenetysShapeGaugeSpeedometer.prototype.foreground = function(c, w, h) {
	const getSpeedometerValue = (variableKey, isStringArray = false) => getVariableValue(
		this.style,
		zenetysShapeGaugeSpeedometer,
		zenetysShapeGaugeSpeedometer.prototype.cst[variableKey],
		isStringArray
	);

	const percentage	= getSpeedometerValue("GAUGE_PERCENTAGE");
	const scaleStages = getSpeedometerValue("SCALE_STAGES", true);
	const scaleColors = getSpeedometerValue("SCALE_COLORS", true);
	const textSize    = getSpeedometerValue("TEXT_SIZE");
	const gaugeType   = getSpeedometerValue("GAUGE_TYPE");

	const drawGauge = zenetysShapeGaugeSpeedometer.prototype.drawGauge;
  drawGauge(c,w,h, percentage, getColor(percentage, scaleColors, scaleStages), gaugeType); // draw gauge fill
	drawGauge(c,w,h, 100, getColor(percentage, scaleColors, scaleStages), gaugeType, true);  // draw gauge outline

	c.setFontSize(textSize);
	addText(c, w * .5, h * (gaugeType === 0 ?.5:.8), percentage);
};
mxCellRenderer.registerShape(
	zenetysShapeGaugeSpeedometer.prototype.cst.SHAPE, 
	zenetysShapeGaugeSpeedometer
);

Graph.handleFactory[zenetysShapeGaugeSpeedometer.prototype.cst.SHAPE] = function(state) {
	const handles = [Graph.createHandle(
		state, 
		['percentage'], 
		function(bounds) {
			const percentage = inRange(
				parseFloat(
					mxUtils.getValue(
						this.state.style, 
						'percentage', 
						this.percentage
					)
				)
			);
			return new mxPoint(
				bounds.x + bounds.width * .2 + percentage * .6 * bounds.width / 100,
				bounds.y + bounds.height * .8
			);
		}, 
		function(bounds, pt) {
			this.state.style['percentage'] = Math.round(
				1000 * inRange((pt.x - bounds.x) * 100 / bounds.width)
			) / 1000;
		}
	)];
	return handles;
}

//********************************************************************************************
//                                         Tachometer
//********************************************************************************************

/** Extends mxShape */
 function zenetysShapeGaugeTachometer(bounds, fill, stroke, strokewidth) {
	mxShape.call(this);
	this.bounds = bounds;
	this.fill = fill;
	this.stroke = stroke;
	this.strokewidth = (strokewidth != null) ? strokewidth : 1;
	this.gaugePos = 25;
};
mxUtils.extend(zenetysShapeGaugeTachometer, mxShape);

/** Custom props & default values */
zenetysShapeGaugeTachometer.prototype.cst = {
	GAUGE_PERCENTAGE : 'percentage',
  TEXT_SIZE : 'textSize',
	DISPLAY_TEXT: "displayText",
  SHAPE : 'zenShape.gauge.tachometer',
};

zenetysShapeGaugeTachometer.prototype.defaultValues = {
  percentage: 25,
  textSize: 18,
	displayText: true,
};

function addTachometerProperty(name, type, min = undefined, max = undefined) {
	return addCustomProperty(name, type, zenetysShapeGaugeTachometer, min, max);
}

zenetysShapeGaugeTachometer.prototype.customProperties = [
	addTachometerProperty("percentage", "float", 0, 100),
	addTachometerProperty("displayText", "bool"),
	addTachometerProperty("textSize", "int"),
];
zenetysShapeGaugeTachometer.prototype.drawGauge = function (c,w,h, start, end, color, isOutline = false, withNeedle = false) {
  function getVertex(c,w,h, pos, side) {
		const arcHeight =.5; // 1 === full circle
		const arcOrientation = 1.5;
		const percentil = {
			x: .5,
			y: .5
		};
    const getGaugePos = (pos) => (
			arcHeight * (2 * Math.PI * parseFloat(pos) / 100) + arcOrientation * Math.PI
		);
    const r = side === 'int' ? .25 : .50;
    const x = w * percentil.x + w * r * Math.sin(getGaugePos(pos));
    const y = (h * percentil.y - h * r * Math.cos(getGaugePos(pos)))* 2;
    return { pos, x, y };
  }

  function drawArc(c, side, vertex) {
    let rx, ry, sweep;
    
    if (side === 'int') {
      rx = w * .25;
      ry = h * .5;
      sweep = 1;		// rotation horaire
    } else {
      rx = w * .5;
      ry = h * 1;
      sweep = 0;		// rotation antihoraire
    }
    
    const largeArc = 0;    
    c.arcTo(
      rx,         // radius x
      ry,         // radius y
      0,	        // angle (effet penché dir haut-droite)
      largeArc,	  // largeArcFlag (more than 180°)
      sweep,	    // sweepFlag (direction)
      vertex.x,	  // final pos x
      vertex.y		// final pos y
    );
  }

	function drawNeedle(c, endInt, endExt) {
		const posX = ((endExt.x - endInt.x) / 3) + endInt.x;
		const posY = ((endExt.y - endInt.y) / 3) + endInt.y;
		c.setStrokeColor("#000");
		c.begin();
		c.moveTo(w * .5, h * 1);
		c.lineTo(posX, posY);
		c.stroke();
		c.close();
	}

  // get vertices
  const startInt = getVertex(c,w,h, start, 'int');
  const startExt = getVertex(c,w,h, start, 'ext');
  const endInt = getVertex(c,w,h, end, 'int');
  const endExt = getVertex(c,w,h, end, 'ext');

  // assign color to the new shape
  c.setFillColor(color);      
  c.setStrokeColor(color);

  c.begin();                          // starts drawing the shape
  c.moveTo(startInt.x, startInt.y);   // go to 1st vertex
  drawArc(c, 'int', endInt);          // arc to 2nd vertex
  c.lineTo(endExt.x, endExt.y);       // line to 3rd vertex
  drawArc(c, 'ext', startExt, true);  // arc to 4th vertex	
  c.close(); 													// line to 1st vertex to close the shape
  isOutline ? c.stroke() : c.fill();  // stroke if is outline, or fill
	if(withNeedle) drawNeedle(c, endInt, endExt);
};

/** Paint the shape */
zenetysShapeGaugeTachometer.prototype.paintVertexShape = function(c, x, y, w, h) {
	c.translate(x, y);
	this.background(c, w, h);
	c.setShadow(false);
	this.foreground(c, w, h);
};

zenetysShapeGaugeTachometer.prototype.background = function(c, w, h) {
	zenetysShapeGaugeTachometer.prototype.drawGauge(c,w,h, 0, 33, '#99FF99');
	zenetysShapeGaugeTachometer.prototype.drawGauge(c,w,h, 33, 66, '#fffab3');
	zenetysShapeGaugeTachometer.prototype.drawGauge(c,w,h, 66, 100, '#FFCC99');
};

zenetysShapeGaugeTachometer.prototype.foreground = function(c, w, h) {
	const getTachometerValue = (variableKey, isStringArray = false) => getVariableValue(
		this.style,
		zenetysShapeGaugeTachometer,
		zenetysShapeGaugeTachometer.prototype.cst[variableKey],
		isStringArray
	);

	const percentage	= getTachometerValue("GAUGE_PERCENTAGE");
	const textSize    = getTachometerValue("TEXT_SIZE");
	const displayText = getTachometerValue("DISPLAY_TEXT");

	const scaleStages = [33, 66];
	const scaleColors = ["#00FF00", "#FFEE00", "#FF8000"];
	const drawGauge = zenetysShapeGaugeTachometer.prototype.drawGauge;
  drawGauge(c,w,h, 0, percentage, getColor(percentage, scaleColors, scaleStages), false, true);

	c.setFontSize(textSize);
	if(displayText) addText(c, w * .5, h * .2, percentage);
};

mxCellRenderer.registerShape(
	zenetysShapeGaugeTachometer.prototype.cst.SHAPE, 
	zenetysShapeGaugeTachometer
);

Graph.handleFactory[zenetysShapeGaugeTachometer.prototype.cst.SHAPE] = function(state) {
	const handles = [Graph.createHandle(
		state, 
		['percentage'], 
		function(bounds) {
			const percentage = inRange(
				parseFloat(
					mxUtils.getValue(
						this.state.style, 
						'percentage', 
						this.percentage
					)
				)
			);
			return new mxPoint(
				bounds.x + bounds.width * .2 + percentage * .6 * bounds.width / 100,
				bounds.y + bounds.height * .8
			);
		}, 
		function(bounds, pt) {
			this.state.style['percentage'] = Math.round(
				1000 * inRange((pt.x - bounds.x) * 100 / bounds.width)
			) / 1000;
		}
	)];
	return handles;
}

//********************************************************************************************
//                                          Pie Full
//********************************************************************************************

/** Extends mxShape */
function zenetysShapePieFull(bounds, fill, stroke, strokewidth) {
	mxShape.call(this);
	this.bounds = bounds;
	this.fill = fill;
	this.stroke = stroke;
	this.strokewidth = (strokewidth != null) ? strokewidth : 1;
};
mxUtils.extend(zenetysShapePieFull, mxActor);

/** Custom props */
zenetysShapePieFull.prototype.cst = {
	PIE : 'mxgraph.basic.pied',
	SHAPE : 'zenShape.pie.full',
	COLOR_1: "color1",
	COLOR_2: "color2",
	END_ANGLE: "endAngle",
};

zenetysShapePieFull.prototype.defaultValues = {
	endAngle: .28,
	color1: '#0F6E84',
	color2: '#17B8CE', 
};

function addPieProperty(name, type, min = undefined, max = undefined) {
	return addCustomProperty(name, type, zenetysShapePieFull, min, max);
}

zenetysShapePieFull.prototype.customProperties = [
	addPieProperty("endAngle", "float", 0, 1),
	addPieProperty("color1", "color"),
	addPieProperty("color2", "color"),
];

/** Paint the shape */
zenetysShapePieFull.prototype.paintVertexShape = function(c, x, y, w, h) {
	c.translate(x, y);

	const getPieValue = (variableKey, isStringArray = false) => getVariableValue(
		this.style,
		zenetysShapePieFull,
		zenetysShapePieFull.prototype.cst[variableKey],
		isStringArray
	);

	const startAngle = 0;
	const color1 = getPieValue("COLOR_1");
	const color2 = getPieValue("COLOR_2");
	let endAngle = 2 * Math.PI * inRange(parseFloat(getPieValue("END_ANGLE")), 0, 1);
	if(endAngle === .5) endAngle = .4999; // if endAngle === .5 => display bug

	const rx = w * .5;
	const ry = h * .5;
	const startX = rx + Math.sin(startAngle) * rx;
	const startY = ry - Math.cos(startAngle) * ry;
	const endX = rx + Math.sin(endAngle) * rx;
	const endY = ry - Math.cos(endAngle) * ry;
	const angDiff = endAngle - startAngle;
	const isBigArc = (angDiff > Math.PI);
	const secondPieIsBigArc = !(endX <= w * .5);

	function drawPie(color, bigArc, isFirst) {
		c.setFillColor(color);
		c.begin();
		c.moveTo(rx, ry);
		c.lineTo(startX, startY);
		c.arcTo(rx, ry, 0, bigArc ? 1 : 0, isFirst ? 1 : 0, endX, endY);
		c.close();
		c.fill();
	}
	drawPie(color1, isBigArc, true);
	drawPie(color2, secondPieIsBigArc, false);
};

mxCellRenderer.registerShape(
	zenetysShapePieFull.prototype.cst.SHAPE, 
	zenetysShapePieFull
);

Graph.handleFactory[zenetysShapePieFull.prototype.cst.SHAPE] = function(state) {
	const handles = [
		Graph.createHandle(
			state, 
			['endAngle'], 
			function(bounds) {
				const endAngle = 2 * Math.PI * inRange(
					parseFloat(
						mxUtils.getValue(
							this.state.style, 
							'endAngle', 
							this.endAngle
						)
					), 0, 1);
				return new mxPoint(
					bounds.x + bounds.width * .5 + Math.sin(endAngle) * bounds.width * .5, 
					bounds.y + bounds.height * .5 - Math.cos(endAngle) * bounds.height * .5
				);
			}, 
			function(bounds, pt) {
				const handleX = Math.round(
					100 * inRange((pt.x - bounds.x - bounds.width * .5) / (bounds.width * .5), -1, 1)
				) / 100;
				const handleY = -Math.round(
					100 * inRange((pt.y - bounds.y - bounds.height * .5) / (bounds.height * .5), -1, 1)
				) / 100;
				
				let res =  .5 * Math.atan2(handleX, handleY) / Math.PI;
				if (res < 0) res = 1 + res;
				
				this.state.style['endAngle'] = res;
			}
		)
	];
	return handles;
};
