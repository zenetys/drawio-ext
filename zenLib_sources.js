function getEnumList(enumType) {
	const normalizeOutput = (arr) => arr.map(name => ({
		val: name.toLowerCase(), 
		dispName: name
	}));

	switch(enumType) {
		case "needleStyles": return normalizeOutput(["Auto", "Bright", "Dark", "Custom"]);
		case "speedometer": return [
			{ val: "circle", dispName: "Circle" },
			{ val: "half", dispName: "Half circle" },
			{ val: "needle", dispName: "With needle" },
		];
		case "status": return normalizeOutput(["Ok", "Warning", "Critical", "Down", "Unknown"]);
		default: return [];
	}
};

const shapes = {
	WEATHER_OK: "jZLBbsIwDIafJkeqpGGI6yiFyybtDaYApo2WxlXiduXt55IwtklIO0SyP9t/bCdCV920D6ZvX/EETuha6CogUrK6qQLnRCntSeitKEvJR5S7B1F1jcreBPD0n4IyFYzGDZBIApEuLoPYmn42u6mZ2yyibXwsvKEhQBEH/66F3rTUce9bxWaP1hOEeuQWYmYjBLJH417MAdwbRksWPccOSITdj4Rnx+ocIOyZmuwdYVZkECngB1TokL2tRw9zVuzhOE97thPwXJuzde6WI0q929W1lMzzrHwVTA/3dUV5WXvADihcOCUXLHSxVHIln5RWq+V6uVawUDqpfNoTtVlEprXLFmzT0h9oYgLNt/z9hdjIj3Rz75/hGvv1V74A",
}

const inRange = (value, min = 0, max = 100) => Math.max(min, Math.min(max, value));

function getUpdatedColor(color, isDarker = true) {
	const length = color.length;
	let updatedColor = "";
	for(let stringId = 0; stringId < length; stringId++) {
		const char = color.charAt(stringId);
		if(char === "#" || char === "0") updatedColor += char;
		else if(char.toLowerCase() === "a") updatedColor += "9";
		else {
			const code = color.charCodeAt(stringId);
			const updatedChar = String.fromCharCode(code - 1);
			updatedColor += updatedChar
		}
	}
	return updatedColor;
}

function addCustomProperty(name, type, shape, min = undefined, max = undefined, enumList = []) {
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
	if(type === "enum") property.enumList = enumList;

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

function getColor(percentage, colors, stages, defaultColor = "#000000") {
	const loops = colors.length;
	const lastLoop = loops - 1;

	for(let loop = 0; loop < loops; loop++) {		
		let color = colors[loop] || defaultColor;		
		const stageLimit = parseInt(stages[loop]);

		if (loop === lastLoop) return color;
		else if (percentage <= stageLimit) return color;
	}
}

function addText(c, x, y, text, isPercentage = true) {
	const parsedText = isPercentage ? `${parseInt(text, 10)}%` : text;
	c.begin();
	c.text(x, y, 0, 0, parsedText, mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
	c.close();
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

	const DEFAULT_FILLCOLOR = "#FFFFFF";
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
};
mxUtils.extend(zenetysShapeGaugeSpeedometer, mxShape);

/** Custom props & default values */
zenetysShapeGaugeSpeedometer.prototype.cst = {
	DISPLAY_TEXT: "displayText",
	GAUGE_PERCENTAGE : "percentage",
	GAUGE_TYPE: "gaugeType",
  SCALE_COLORS : "scaleColors",
  SCALE_STAGES : "scaleStages",
  SHAPE : "zenShape.gauge.speedometer",
	TEXT_COLOR: "textColor",
	NEEDLE_STYLE: "needleStyle",
	NEEDLE_COLOR: "needleColor",
};

zenetysShapeGaugeSpeedometer.prototype.defaultValues = {
  percentage: 25,
  scaleStages: "50,80",
  scaleColors: "#00FF00,#FF8000,#FF0000",
	gaugeType: "circle",
	displayText: true,
	textColor: "#000",
	needleStyle: "auto",
	needleColor: "#aaa",
};

function addSpeedometerProperty(name, type, min = undefined, max = undefined, list = "") {
	const enumList = getEnumList(list);
	return addCustomProperty(name, type, zenetysShapeGaugeSpeedometer, min, max, enumList);
}

zenetysShapeGaugeSpeedometer.prototype.customProperties = [
	addSpeedometerProperty("gaugeType", "enum", null, null, "speedometer"),
	addSpeedometerProperty("percentage", "float", 0, 100),
	addSpeedometerProperty("displayText", "bool"),
	addSpeedometerProperty("textColor", "color"),
	addSpeedometerProperty("scaleStages", "String"),
	addSpeedometerProperty("scaleColors", "String"),
	addSpeedometerProperty("needleStyle", "enum", null, null, "needleStyles"),
	addSpeedometerProperty("needleColor", "color"),
];

const getSpeedometerValuesss = (variableKey, isStringArray = false, style) => getVariableValue(
	style,
	zenetysShapeGaugeSpeedometer,
	zenetysShapeGaugeSpeedometer.prototype.cst[variableKey],
	isStringArray
);

zenetysShapeGaugeSpeedometer.prototype.drawGauge = function (c,w,h, percentage, color, type, isOutline = false, withNeedle = false) {
	const isCircle = (type === "circle");
	const isNeedle = (type === "needle");

  function getVertex(pos, side) {
		const arcHeight = isCircle ? .75 : .5; // 1 === full circle
		const arcOrientation = isCircle ? 1.25 : 1.5;
		const percentil = { x: .5, y: .5 };
    const getGaugePos = (pos) => (
			arcHeight * (2 * Math.PI * parseFloat(pos) / 100) 
			+ (arcOrientation * Math.PI)
		);

		const r = side === "int" ? .25 : .50;
    const x = w * percentil.x + w * r * Math.sin(getGaugePos(pos));
    const y = h * percentil.y - h * r * Math.cos(getGaugePos(pos));
		return { pos, x, y: isCircle ? y : y * 2 };
  }

  function drawArc(c, side, vertex) {
    let rx, ry, sweep;
    if (side === "int") {
      rx = w * .25;
      ry = h * (isCircle ? .25 : .5);
      sweep = 1;		// rotation horaire
    } else {
      rx = w * .5;
      ry = h * (isCircle ? .5 : 1);
      sweep = 0;		// rotation antihoraire
    }
    
    // 67 => if (gaugePos >= 67) => arc >= 180° => need large arc flag
		const isOverLargeLimit = (percentage >= 67);
    const largeArc = !isCircle ? 0 : isOverLargeLimit ? 1 : 0;
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
	
	function drawNeedle(c, dots) {
		const { style, customColor, colors, stages } = withNeedle;
		const needlePercentage = percentage[1];
		const {int, ext} = dots;
		function getNeedlePos(rate = 2, percentageMax = 6) {
			const quotient = rate / percentageMax;
			const getVertexPos = (xy) => (ext[xy] - int[xy]) * quotient + int[xy];
			return { x: getVertexPos("x"), y: getVertexPos("y") };
		}
		const pos = getNeedlePos();
		function getNeedleColor() {
			if(style === "auto") return getColor(
				needlePercentage, 
				colors.map(getUpdatedColor), 
				stages
			);
			else if(style === "custom") return customColor;
			else {
				const list = {
					bright: "#ddd",
					grey: "#aaa",
					dark: "#777"
				};
				return list[style]
			}
		}

		c.setStrokeColor(getNeedleColor());
		c.begin();
		c.moveTo(w * .5, h * 1);
		c.lineTo(pos.x, pos.y);
		c.stroke();
		c.close();
	}

	const start = {
		int: getVertex(isNeedle ? percentage[0] : 0, "int"),
		ext: getVertex(isNeedle ? percentage[0] : 0, "ext"),
	};
	const end = {
		int: getVertex(isNeedle ? percentage[1] : percentage, "int"),
		ext: getVertex(isNeedle ? percentage[1] : percentage, "ext"),
	};

	// assign color to the new shape
  c.setFillColor(color);      
  c.setStrokeColor(color);

  c.begin();                          // starts drawing the shape
  c.moveTo(start.int.x, start.int.y);   // go to 1st vertex
  drawArc(c, 'int', end.int);          // arc to 2nd vertex
  c.lineTo(end.ext.x, end.ext.y);       // line to 3rd vertex
  drawArc(c, 'ext', start.ext, true);  // arc to 4th vertex	
  c.close(); 													// line to 1st vertex to close the shape
  isOutline ? c.stroke() : c.fill();  // stroke if is outline, or fill
	if(withNeedle) drawNeedle(c, end);
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
	const drawGauge = zenetysShapeGaugeSpeedometer.prototype.drawGauge;

	if(gaugeType === "needle") {
		drawGauge(c,w,h, [0, 33], "#99FF99", gaugeType);
		drawGauge(c,w,h, [33, 66], "#fffab3", gaugeType);
		drawGauge(c,w,h, [66, 100], "#FFCC99", gaugeType);
	} else {
		drawGauge(c,w,h, 100, "#FFF", gaugeType);
	}
};

zenetysShapeGaugeSpeedometer.prototype.foreground = function(c, w, h) {
	const getSpeedometerValue = (variableKey, isStringArray = false) => getVariableValue(
		this.style,
		zenetysShapeGaugeSpeedometer,
		zenetysShapeGaugeSpeedometer.prototype.cst[variableKey],
		isStringArray
	);
	const getTextPosition = (gt) => gt === "circle" ? .5 : gt === "half" ? .8 : .15;
	const needlePresetColors = ["#00FF00", "#FFEE00", "#FF8000"];
	const needlePresetStages = [33,66];

	const needleStyle	= getSpeedometerValue("NEEDLE_STYLE");
	const needleColor	= getSpeedometerValue("NEEDLE_COLOR");
	const displayText	= getSpeedometerValue("DISPLAY_TEXT");
	const scaleStages = getSpeedometerValue("SCALE_STAGES", true);
	const scaleColors = getSpeedometerValue("SCALE_COLORS", true);
	const percentage	= getSpeedometerValue("GAUGE_PERCENTAGE");
	const gaugeType   = getSpeedometerValue("GAUGE_TYPE");
	const isNeedle		= (gaugeType === "needle");
	const textColor   = getSpeedometerValue("TEXT_COLOR");
	const fontSize    = h / (gaugeType === "circle" ? 4 : 3);
	const currentColor = getColor(percentage, 
		isNeedle ? needlePresetColors : scaleColors, 
		isNeedle ? needlePresetStages : scaleStages
	);
	const percOutput = isNeedle ? [0, percentage] : percentage;
	const withNeedle = isNeedle ? { 
		style: needleStyle, 
		customColor: needleColor,
		colors: needlePresetColors,
		stages: needlePresetStages,
	} : false;

	const drawGauge = zenetysShapeGaugeSpeedometer.prototype.drawGauge;
  drawGauge(c,w,h, percOutput, currentColor, gaugeType, false, withNeedle);	// draw gauge fill
	if(!isNeedle) drawGauge(c,w,h, 100, currentColor, gaugeType, true);  			// draw gauge outline

	if(displayText) {
		c.setFontSize(fontSize);
		c.setFontColor(textColor);
		addText(c, w * .5, h * getTextPosition(gaugeType), percentage);
	}
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

//**************************************************************************************
// Weather Widget
//**************************************************************************************

/** Extends mxShape */
function zenetysShapeWidgetWeather(bounds, fill, stroke, strokewidth = 1) {
	mxShape.call(this);
	this.bounds = bounds;
	this.fill = fill;
	this.stroke = stroke;
	this.strokewidth = strokewidth;
};
mxUtils.extend(zenetysShapeWidgetWeather, mxShape);

/** Custom props & default values */
zenetysShapeWidgetWeather.prototype.cst = {
  SHAPE: 'zenShape.widget.weather',
	STATUS: "status",
};

zenetysShapeWidgetWeather.prototype.defaultValues = {
	status: "ok"
};

zenetysShapeWidgetWeather.prototype.customProperties = [{
	name: "status", 
	dispName: "Status", 
	type: "enum", 
	defVal: "ok", 
	enumList: getEnumList("status"),
}];

zenetysShapeWidgetWeather.prototype.paintVertexShape = function(c, x, y, w, h) {
	c.translate(x, y);
	// this.background(c, w, h);
	c.setShadow(false);
	this.foreground(c, w, h, x, y);
};

// zenetysShapeWidgetWeather.prototype.background = function(c, w, h) {
// 	c.begin();
// 	c.setFillColor("#333");
// 	c.rect(0,0,w,h);
// 	c.fill();
// 	c.close();
// };

zenetysShapeWidgetWeather.prototype.foreground = function(c, w, h) {
	const status = getVariableValue(
		this.style, 
		zenetysShapeWidgetWeather, 
		zenetysShapeWidgetWeather.prototype.cst.STATUS,
	);

	function drawCloud(color) {
		function drawEllipse(posx,posy, width, height) {
			c.ellipse(w*posx, h*posy, w*width, h*height);
			c.fill();
		}
		const cloudCoords = [
			[.0, .2, .4, .3],
			[.25, .5, .6, .25],
			[.25, .0, .4, .3],
			[.50, .13, .38, .35],
			[.25, .2, .75, .4],
			[.50, .1, .38, .35],
			[.10, .35, .3, .35],
		];
		c.begin();
		c.setFillColor(color);
		cloudCoords.map(coords => drawEllipse(...coords));
		c.close();
	}
	function drawSun() {
		const SUNCOLOR = "#FFEE00";
		function drawSunbeams() {
			const BEAMS = [
				[[50,0], [43, 18], [57, 18]],			// up
				[[50,100], [43, 82], [57, 82]],		// down
				[[0,50], [18, 43], [18, 57]],			// left
				[[100,50], [82, 43], [82, 57]],		// right
				[[32, 77], [23, 68], [15,85]],		// dl
				[[68, 77], [77, 68], [85,85]],		// dr
				[[32, 23], [23, 32], [15,15]],		// ul
				[[68, 23], [77, 32], [85,15]],		// ur				
			];
			BEAMS.map(sunbeam => {
				c.begin();
				c.setFillColor(SUNCOLOR);				
				for(let dotId = 0; dotId < sunbeam.length; dotId++) {
					const [posx,posy] = sunbeam[dotId].map((v, i) => (i === 0 ? w:h)*v/100);
					(dotId === 0) ? c.moveTo(posx, posy) : c.lineTo(posx, posy);
				}
				c.fill();
				c.close();
			})
		}
		c.begin();
		c.setFillColor(SUNCOLOR);
		c.ellipse(w*.22,h*.22, w*.56, h*.56);
		c.fill();
		c.close();
		drawSunbeams();
	}

	function drawStatus(status) {
		function drawArea() {
			const COLORS = {
				warning: "#ff8000",
				critical: "#f00",
				down: "#000",
				unknown: "#fe0",
			}
			c.begin();
			c.setFillColor(COLORS[status]);
			c.ellipse(w*.5, h*.5, w*.5, h*.5);
			c.fill();
			c.close();
		}

		function drawPicto() {
			function normalizeValues(x, y, wx = null, hy = null) {
				const normalized = [];
				normalized.push(w * ((x * .005) + .5));
				normalized.push(h * ((y * .005) + .5));
				if(wx) normalized.push(w * ((wx * .005)));
				if(hy) normalized.push(h * ((hy * .005)));
				return normalized;
			}
			c.begin();
			c.setFillColor("#fff");

			switch(status) {
				case "warning": {
					const dots = [[50,10], [20,50], [50, 90],[80, 50]];
					for(let dot = 0; dot < dots.length; dot++) {
						const [posx, posy] = normalizeValues(...dots[dot]);
						(dot === 0) ? c.moveTo(posx, posy) : c.lineTo(posx, posy);
					}
					break;
				};
				case "critical": {
					const dots = [
						[52, 08],
						[28, 36],
						[41, 52],
						[28, 62],
						[42, 74],
						[24, 91],
						[60, 74],
						[49, 65],
						[67, 55],
						[55, 43],
						[75, 31],
					];
					for(let dot = 0; dot < dots.length; dot++) {
						const [posx, posy] = normalizeValues(...dots[dot]);
						(dot === 0) ? c.moveTo(posx, posy) : c.lineTo(posx, posy);
					}
					break;
				}
				case "down": {
					const BASE_COORDS = [6, 40, 88, 20];
					const [posx, posy, rwidth, rheight] = normalizeValues(...BASE_COORDS);
					c.rect(posx, posy, rwidth, rheight);
					break;
				}
				case "unknown": {
					c.setFontSize(w*.45);
					c.setFontColor("#fff");
					addText(c, w*.75, h*.66, "---", false);
					break;
				};
				default: break;
				;
			}
			c.fill();
			c.close();
		}
		drawArea();
		drawPicto();
	}
	if(status === "ok") drawSun();
	else {
		const CLOUDCOLOR = {
			warning: "#DEDEDE",
			critical: "#CCC",
			down: "#B3B3B3",
			unknown: "#EDEDED",
		}
		drawCloud(CLOUDCOLOR[status]);
		drawStatus(status);
	}
};

mxCellRenderer.registerShape(
	zenetysShapeWidgetWeather.prototype.cst.SHAPE, 
	zenetysShapeWidgetWeather
);

function zenetysShapeArrow() {
	mxArrowConnector.call(this);
}
mxUtils.extend(zenetysShapeArrow, mxArrowConnector);

zenetysShapeArrow.prototype.cst = {
	SHAPE: "zenShape.arrow",
	START_COLOR: "startColor",
	END_COLOR: "endColor",
};

function addArrowProperty(name, type = "color") {
	return addCustomProperty(name, type, zenetysShapeArrow);
}

zenetysShapeArrow.prototype.defaultValues = {
	startColor: "#0F6E84",
	endColor: "#17B8CE",
};

zenetysShapeArrow.prototype.customProperties = [
	addArrowProperty("startColor"),
	addArrowProperty("endColor"),
];

zenetysShapeArrow.prototype.paintEdgeShape = function(c, pts) {
	const [start, end] = pts;
	const middle = {
		x: (start.x + end.x) * .5,
		y: (start.y + end.y) * .5,
	};

	const computeDots = (vectorStart, vectorEnd, isIntern) => {
		const distance = Math.hypot(
			(vectorEnd.x - vectorStart.x), 
			(vectorEnd.y - vectorStart.y)
		);
		const normalizedVector = {
			x: ((vectorEnd.x - vectorStart.x) / distance),
			y: ((vectorEnd.y - vectorStart.y) / distance)
		};
		const graduation = (axis, number, grades = 10) => vectorStart[axis] + ((number / grades * distance) * (normalizedVector[axis] !== 0 ? normalizedVector[axis] : 1))
		
		const startDot = {
			x: graduation("x", -.25),
			y: graduation("y", -.25),
		}
		const dot1 = {
			x: graduation("x", 1),
			// y: graduation("y", .5)
			y: vectorStart.y + (1.1 * this.strokewidth)
		};
		const dot2 = {
			x: graduation("x", 1),
			y: vectorStart.y + (-1.1 * this.strokewidth)
			// y: graduation("y", -.5)
		};
		const arrowMiddle = {
			x: graduation("x", .8),
			y: graduation("y", 0),
		};
		return { startDot, dot1, dot2, normalizedVector, arrowMiddle };
	}

	const computeDots2 = (vectorStart, vectorEnd, isIntern) => {
		const distance = Math.hypot(
			(vectorEnd.x - vectorStart.x), 
			(vectorEnd.y - vectorStart.y)
		);
		const normalizedVector = {
			x: ((vectorEnd.x - vectorStart.x) / distance),
			y: ((vectorEnd.y - vectorStart.y) / distance)
		};
		// console.log({noNz: {x:distance*normalizedVector.x, y:distance*normalizedVector.y},distance,normalizedVector})

		const angle = (function vectorsAngle(vector) {
			const baseVector = {x:.707,y:.707};
			const coefDir = (vector.y - baseVector.y) / (vector.x - baseVector.x);

			// console.log("coefDir:" ,coefDir)

			// const cos = (
			// 	((baseVector.x * vector.x) + (baseVector.y * vector.y)) /
			// 	(Math.hypot(baseVector.x, baseVector.y) * Math.hypot(vector.x, vector.y))
			// );

			// const scal = (vector.x * baseVector.x) + (vector.y * baseVector.y);

			// console.log(vectorsAngle({x:1, y:1}))

			// return Math.cos(cos) * 180 / Math.PI ;
		})(normalizedVector);

		// console.log("angle: ", angle)

		const dot1 = {
			r: distance*.2,
			o: (angle + 30) * Math.PI / 180
		};
		const dot2 = {
			r: distance*.2,
			o: (angle + 330) * Math.PI / 180
		};

		function fromPolarToCart(dot) {
			return {
				x: vectorStart.x + ((dot.r * Math.cos(dot.o)) * normalizedVector.x),
				y: vectorStart.y + ((dot.r * Math.sin(dot.o)) * normalizedVector.y),
			};
		}


		return {
			dot1: fromPolarToCart(dot1),
			dot2: fromPolarToCart(dot2),
		};
	}

	const computeDots3 = (vectorStart, vectorEnd, isIntern) => {
		const distance = Math.hypot(
			(vectorEnd.x - vectorStart.x), 
			(vectorEnd.y - vectorStart.y)
		);
		const normalizedVector = {
			x: ((vectorEnd.x - vectorStart.x) / distance),
			y: ((vectorEnd.y - vectorStart.y) / distance)
		};

		const tempDot = {
			x: vectorStart.x + distance*.2,
			y: vectorStart.y + distance*.2,
		}

		const tempV = {
			x: tempDot.x - vectorStart.x,
			y: tempDot.y - vectorStart.y,
		}



		const mainV = {}
		return {};
	}
	// const {startDot, dot1, dot2, arrowMiddle} = computeDots(start, middle);
	// const { dot1, dot2 } = computeDots2(start, middle);


	const arrows = {
		start: {
			ext: [
				start,

			],
			int: [
				middle,

			]
		},
		end: {
			ext: [
				start,

			],
			int: [
				middle,

			]
		},
	};
	const getArrowValue = (variableKey, isStringArray = false) => getVariableValue(
		this.style,
		zenetysShapeArrow,
		zenetysShapeArrow.prototype.cst[variableKey],
		isStringArray
	);
	const startColor = getArrowValue("START_COLOR");
	const endColor = getArrowValue("END_COLOR");
	
	// draws line's first half
	c.begin();
	c.setStrokeColor(startColor);
	c.moveTo(start.x, start.y);
	c.lineTo(middle.x, middle.y);
	c.stroke();	
	c.close();

	// triangle
	// c.begin();
	// c.setStrokeColor("green");
	// c.setFillColor("green");
	// // c.moveTo(arrowMiddle.x, arrowMiddle.y);
	// c.moveTo(dot1.x, dot1.y);
	// c.lineTo(start.x, start.y);
	// c.lineTo(dot2.x, dot2.y);
	// // c.lineTo(arrowMiddle.x, arrowMiddle.y);
	// // c.lineTo(startDot.x, startDot.y);
	// // c.fill();
	// c.fillAndStroke();
	// c.close();

	// draws line's second half
	c.begin();
	c.moveTo(middle.x, middle.y);
	c.setStrokeColor(endColor);
	c.lineTo(end.x, end.y);
	c.stroke();
	c.close();
}

mxCellRenderer.registerShape(
	"zenShape.arrow", 
	zenetysShapeArrow
);

//**************************************************************************************
// Status Widget
//**************************************************************************************

function zenetysShapeWidgetStatus(bounds, fill, stroke, strokewidth = 1) {
	mxShape.call(this);
	this.bounds = bounds;
	this.fill = fill;
	this.stroke = stroke;
	this.strokewidth = strokewidth;
};
mxUtils.extend(zenetysShapeWidgetStatus, mxShape);

zenetysShapeWidgetStatus.prototype.cst = {
  SHAPE: "zenShape.widget.status",
	STATUS: "status",
};

zenetysShapeWidgetStatus.prototype.customProperties = [{
	name: "status",
	dispName: "Status",
	type: "enum",
	defVal: "ok",
	enumList: [...getEnumList("status").slice(0,1), ...getEnumList("status").slice(2)]
}];

zenetysShapeWidgetStatus.prototype.defaultValues = {
	status: "ok",
};

zenetysShapeWidgetStatus.prototype.paintVertexShape = function(c, x, y, w, h) {
	c.translate(x, y);
	c.setShadow(false);
	this.foreground(c, w, h, x, y);
};

zenetysShapeWidgetStatus.prototype.foreground = function(c, w, h, x, y) {
	console.log(x,y)
	const STATUS_LIST = {
		ok: ["#00FF00", "✓"],
		critical: ["#FF8000", "!"],
		down: ["#FF0000", "✗"],
		unknown: ["#FFEE00", "?"],
	};
	const status = mxUtils.getValue(
		this.style, "status",
		zenetysShapeWidgetStatus.prototype.defaultValues.status
	);
	const [color, text] = STATUS_LIST[status];

	// Draws circle
	c.begin();
	c.setFillColor(color);
	c.ellipse(0,0,w,h);
	c.fill();
	c.close();

	// Draws text content
	c.begin();
	c.setFontSize(w*.9);
	c.setFontColor("#FFFFFF");
	c.setFontStyle("bold");
	c.text(
		w*.5, 
		h*.5, 
		0, 0, 
		`<span style="font-weight:bold;">${text}</span>`, 
		mxConstants.ALIGN_CENTER, 
		mxConstants.ALIGN_MIDDLE, 
		0, "html", 0, 0, 0
	);
	c.close();
};

mxCellRenderer.registerShape(
	zenetysShapeWidgetStatus.prototype.cst.SHAPE, 
	zenetysShapeWidgetStatus
);
