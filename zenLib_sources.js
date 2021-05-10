function getEnumList(enumType) {
	const normalizeOutput = (list) => list.map(name => ({
		val: name.toLowerCase(), 
		dispName: name
	}));

	const enums = {
		linear: ["Horizontal", "Vertical"],
		needleStyles: ["Auto", "Bright", "Dark", "Custom"],
		speedometer: [
			["circle", "Circle"],
			["half", "Half circle"],
			["needle", "With needle"],
		],
		status: ["Ok", "Warning", "Critical", "Down", "Unknown"],
		weather: ["Sun", "Cloudy", "Rain", "Lightning", "Night"],
	};

	if(enumType === "speedometer") return enums[enumType].map(
		([val, dispName]) => ({val, dispName})
	);
	else return normalizeOutput(enums[enumType] || []);
};

const inRange = (value, min = 0, max = 100) => Math.max(min, Math.min(max, value));

function updateColor(color, isDarker = true) {
	const length = color.length;
	const limit = isDarker ? "0" : "f";
	const [from, to] = isDarker ? ["a", "9"] : ["9", "a"];
	let updatedColor = "";

	for(let stringId = 0; stringId < length; stringId++) {
		const char = color.charAt(stringId).toLowerCase();
		if(char === "#" || char === limit) 	updatedColor += char;
		else if(char === from) 		updatedColor += to;
		else {
			const code = color.charCodeAt(stringId);
			const updatedChar = String.fromCharCode((isDarker) ? (code -1) : (code +1));
			updatedColor += updatedChar;
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

function getVariableValue(selectedShape, variableKey, isStringArray = false) {
	const variableValue = mxUtils.getValue(
		selectedShape.style, 
		variableKey, 
		selectedShape.defaultValues[variableKey]
	);
	return isStringArray ? variableValue.toString().split(",") : variableValue;
}

function getGaugeColor(percentage, colors, stages, defaultColor = "#000") {
	const loops = colors.length;
	const lastLoop = loops - 1;

	for(let loop = 0; loop < loops; loop++) {		
		let color = colors[loop] || defaultColor;		
		const stageLimit = parseInt(stages[loop]);

		if (loop === lastLoop) return color;
		else if (percentage <= stageLimit) return color;
	}
}

const getStatusColor = (status) => ({
	ok: "#0f0",
	warning: "#ff8000",
	critical: "#f00",
	down: "#000",
	// unknown: "#0fe", //! Test couleur
	unknown: "#fe0",
}[status]);

function addText(c, x, y, text, options = {isPercentage: true, isHtml: false}) {
	const {isPercentage, isHtml} = options;
	const parsedText = (isPercentage) ? `${parseInt(text, 10)}%` : text;
	const htmlText = (isHtml) ? "html" : null

	c.begin();
	c.text(x, y, 0, 0, parsedText, mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, htmlText, 0, 0, 0);
	c.close();
}

// *************************************************************************************|
// * Linear Gauge
// *************************************************************************************|

function zenetysShapeGaugeLinear(bounds, fill, stroke, strokewidth = 1) {
	mxShape.call(this);
	this.bounds = bounds;
	this.fill = fill;
	this.stroke = stroke;
	this.strokewidth = strokewidth;
};
mxUtils.extend(zenetysShapeGaugeLinear, mxShape);

zenetysShapeGaugeLinear.prototype.cst = {
  SCALE_COLORS : 'scaleColors',
  SCALE_STAGES : 'scaleStages',
  GAUGE_LABEL : 'gaugeLabel',
  TEXT_COLOR : 'textColor',
  TEXT_SIZE : 'textSize',
  PERCENTAGE : 'percentage',
  SHAPE: 'zenShape.gauge.linear',
  GAUGE_TYPE : 'gaugeType',
};

zenetysShapeGaugeLinear.prototype.defaultValues = {
	gaugeType: "horizontal",
	scaleColors: '#00FF00,#FF8000,#FF0000',
	scaleStages: '50,80',
	textColor: '#000',
	textSize: 12,
	percentage: 25,
};

function addLinearProperty(name, type, min = undefined, max = undefined) {
	const list = getEnumList("linear");
	return addCustomProperty(name, type, zenetysShapeGaugeLinear, min, max, list);
}

zenetysShapeGaugeLinear.prototype.customProperties = [
	addLinearProperty("percentage", 	"float", 0, 100),
	addLinearProperty("gaugeType", 		"enum"),
	addLinearProperty("scaleStages", 	"String"),
	addLinearProperty("scaleColors", 	"String"),
	addLinearProperty("textSize", 		"int"),
	addLinearProperty("textColor", 		"color"),
];

zenetysShapeGaugeLinear.prototype.paintVertexShape = function(c, x, y, w, h) {
	c.translate(x, y);
	this.background(c, w, h);
	c.setShadow(false);
	this.foreground(c, w, h);
};

zenetysShapeGaugeLinear.prototype.drawGauge = function(
	c, w, h, 			// mxGraph stuff
	orientation,
	color = '#FFF', 
	percentage = 100, 
	isOutline = false
) {
	const normalizedPercentage = percentage / 100;
	
	c.setFillColor(color);
	c.setStrokeColor(color);
	
	c.begin();
	orientation === "horizontal" ? c.rect(
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
		this.cst.GAUGE_TYPE, 
		this.defaultValues.gaugeType
	);
	this.drawGauge(c, w, h, gaugeType);
};

zenetysShapeGaugeLinear.prototype.foreground = function(c, w, h) {
	const scaleColors = getVariableValue(this, "scaleColors", true);
	const scaleStages = getVariableValue(this, "scaleStages", true);
	const textColor = 	getVariableValue(this, "textColor");
	const textSize =		getVariableValue(this, "textSize");
	const gaugeType = 	getVariableValue(this, "gaugeType");
	const percentage = 	inRange(getVariableValue(this, "percentage"));

	const gaugeColor = getGaugeColor(percentage, scaleColors, scaleStages);
	this.drawGauge(c, w, h, gaugeType, gaugeColor, percentage); 	// draw fill
	this.drawGauge(c, w, h, gaugeType, gaugeColor, 100, true); 	// draw outline

	c.setFontSize(textSize);
	c.setFontColor(textColor);
	
	const textVerticalOffset = 10;
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
		this.state.style['percentage'] = Math.round(
			1000 * inRange((pt.x - bounds.x) * 100 / bounds.width)
		) / 1000;
	})];

	return handles;
}

// *************************************************************************************|
// * Number Gauge
// *************************************************************************************|


function zenetysShapeGaugeNumber(bounds, fill, stroke, strokewidth) {
	mxShape.call(this);
	this.bounds = bounds;
	this.fill = fill;
	this.stroke = stroke;
	this.strokewidth = (strokewidth != null) ? strokewidth : 1;
	this.gaugePos = 25;
};
mxUtils.extend(zenetysShapeGaugeNumber, mxShape);

zenetysShapeGaugeNumber.prototype.cst = {
	PERCENTAGE : 'percentage',
	TEXT_SIZE : 'textSize',
	STROKE_WIDTH: 'strokeWidth',
	
	IS_FILLED: 'isFilled',
	IS_OUTLINED: 'isOutlined',
	IS_COLORIZED: 'isColorized',
	
	STAGES : 'stages',
	FILL_COLORS : 'fillColors',
	OUTLINE_COLORS : 'outlineColors',
	TEXT_COLORS : 'textColors',
	
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
	const percentage    = inRange(getVariableValue(this, "percentage"));
	const textSize 			= getVariableValue(this, "textSize");
	const strokeWidth 	= getVariableValue(this, "strokeWidth");
	const isFilled 			= getVariableValue(this, "isFilled");
	const isOutlined 		= getVariableValue(this, "isOutlined");
	const isColorized 	= getVariableValue(this, "isColorized");	
	const stages 				= getVariableValue(this, "stages", true);
	const fillColors 		= getVariableValue(this, "fillColors", true);
	const outlineColors = getVariableValue(this, "outlineColors", true);
	const textColors 		= getVariableValue(this, "textColors", true);

	const DEFAULT_FILLCOLOR = "#FFFFFF";
	c.setFillColor(isFilled ? getGaugeColor(percentage, fillColors, stages):DEFAULT_FILLCOLOR);
	c.begin();
	c.ellipse(0,0,w,h);
	c.fill();

	if (isOutlined) {
		c.setStrokeColor(
			getGaugeColor(percentage, outlineColors, stages)
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
	if (isColorized) c.setFontColor(getGaugeColor(percentage, textColors, stages));
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

// *************************************************************************************|
// * Speedometer Gauge
// *************************************************************************************|


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
	PERCENTAGE : "percentage",
	GAUGE_TYPE: "gaugeType",
  SCALE_COLORS : "scaleColors",
  SCALE_STAGES : "scaleStages",
  SHAPE : "zenShape.gauge.speedometer",
	TEXT_COLOR: "textColor",
	NEEDLE_STYLE: "needleStyle",
	NEEDLE_COLOR: "needleColor",
	BG_PRESET_COLORS: {
		first: "#99FF99",
		second: "#fffab3",
		third: "#FFCC99"
	},
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
	needlePresetColors: ["#00FF00", "#FFEE00", "#FF8000"],
	needlePresetStages: [33,66],

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
			if(style === "auto") return getGaugeColor(
				needlePercentage, 
				colors.map(color => updateColor(color)),
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
		this.cst.GAUGE_TYPE,
		this.defaultValues.gaugeType
	);

	if(gaugeType === "needle") {
		const {first, second, third} = this.cst.BG_PRESET_COLORS;
		this.drawGauge(c,w,h, [0, 33], first, gaugeType);
		this.drawGauge(c,w,h, [33, 66], second, gaugeType);
		this.drawGauge(c,w,h, [66, 100], third, gaugeType);
	} else this.drawGauge(c,w,h, 100, "#FFF", gaugeType);
};

zenetysShapeGaugeSpeedometer.prototype.foreground = function(c, w, h) {
	const getTextPosition = (gt) => gt === "circle" ? .5 : gt === "half" ? .8 : .15;
	const { needlePresetColors, needlePresetStages } = this.defaultValues;

	const needleStyle	= getVariableValue(this, "needleStyle");
	const needleColor	= getVariableValue(this, "needleColor");
	const displayText	= getVariableValue(this, "displayText");
	const scaleStages = getVariableValue(this, "scaleStages", true);
	const scaleColors = getVariableValue(this, "scaleColors", true);
	const percentage	= getVariableValue(this, "percentage");
	const gaugeType   = getVariableValue(this, "gaugeType");
	const textColor   = getVariableValue(this, "textColor");
	const isNeedle		= (gaugeType === "needle");
	const fontSize    = h / (gaugeType === "circle" ? 4 : 3);
	const currentColor = getGaugeColor(percentage, 
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

  this.drawGauge(c,w,h, percOutput, currentColor, gaugeType, false, withNeedle);	// draw gauge fill
	if(!isNeedle) this.drawGauge(c,w,h, 100, currentColor, gaugeType, true);  			// draw gauge outline

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

// *************************************************************************************|
// * Pie Full
// *************************************************************************************|

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

	const startAngle = 0;
	const color1 = getVariableValue(this, "color1");
	const color2 = getVariableValue(this, "color2");
	const endAngle = 2 * Math.PI * inRange(parseFloat(getVariableValue(this, "endAngle")), 0, 1);

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

// *************************************************************************************|
// * Weather Widget
// *************************************************************************************|

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
	SUN_COLOR: "#FFEE00",
	BEAMS: [
		[[50,0], [43, 18], [57, 18]],			// up
		[[50,100], [43, 82], [57, 82]],		// down
		[[0,50], [18, 43], [18, 57]],			// left
		[[100,50], [82, 43], [82, 57]],		// right
		[[32, 23], [23, 32], [15,15]],		// ul
		[[68, 23], [77, 32], [85,15]],		// ur				
		[[68, 77], [77, 68], [85,85]],		// dr
		[[32, 77], [23, 68], [15,85]],		// dl
	],
	CLOUD_COORDS: [
		[.0, .2, .4, .3],
		[.25, .5, .6, .25],
		[.25, .0, .4, .3],
		[.50, .13, .38, .35],
		[.25, .2, .75, .4],
		[.50, .1, .38, .35],
		[.10, .35, .3, .35],
	],
	CLOUD_COLORS: {
		cloudy: "#DEDEDE",
		rain: "#CCC",
		lightning: "#B3B3B3",
		night: "#EDEDED",
	},
	THUNDERBOLT_COORDS: [
		[.52, .08],
		[.28, .36],
		[.41, .52],
		[.28, .62],
		[.42, .74],
		[.24, .91],
		[.60, .74],
		[.49, .65],
		[.67, .55],
		[.55, .43],
		[.75, .31],
	],
	WATERDROPS_COORDS: {
		back: [
			[ 0, .4],
			[ .1, .6],
			[ .6, .7],
			[ .9, .45],
		],
		front: [
			[.025, .75],
			[.125, .875],
			[.225, .7],
			[.3, .8],
			[.5, .875],
			[.7, .8],
			[.79, .7],
			[.925, .875],
			
			[.1, .4],
			[.2, .45],
			[.4, .7],
			[.525, .65],
			[.6, .5],
			[.375, .45],
			[.74, .55],
			[.95, .65],
		]
	}
};

zenetysShapeWidgetWeather.prototype.defaultValues = {
	status: "sun"
};

zenetysShapeWidgetWeather.prototype.customProperties = [{
	name: "status", 
	dispName: "Status", 
	type: "enum", 
	defVal: "sun", 
	enumList: getEnumList("weather"),
}];

zenetysShapeWidgetWeather.prototype.paintVertexShape = function(c, x, y, w, h) {
	c.translate(x, y);
	c.setShadow(false);
	this.foreground(c, w, h, x, y);
};

zenetysShapeWidgetWeather.prototype.foreground = function(c, w, h) {
	const status = getVariableValue(this, "status");

	function drawCloud(cloudColor, cloudCoords) {
		function drawEllipse(coords) {
			const [posx,posy, width, height] = coords;
			c.ellipse(w*posx, h*posy, w*width, h*height);
			c.fill();
		}

		c.begin();
		c.setFillColor(cloudColor);
		cloudCoords.map(drawEllipse);
		c.close();
	}
	
	function drawSun(sunColor, beams) {
		function drawSunbeam(sunbeam) {
				c.begin();
				c.setFillColor(sunColor);				
				for(let dotId = 0; dotId < sunbeam.length; dotId++) {
					const [posx,posy] = sunbeam[dotId].map(
						(v, i) => (i === 0 ? w : h) * v / 100
					);
					(dotId === 0) ? c.moveTo(posx, posy) : c.lineTo(posx, posy);
				}
				c.fill();
				c.close();
		}

		c.begin();
		c.setFillColor(sunColor);
		c.ellipse(w*.22,h*.22, w*.56, h*.56);
		c.fill();
		c.close();
		beams.map(drawSunbeam);


	}

	function drawWeather(status, layout, coordinates) {
		const thunderboltsPositions = {
			back: [
			[0, .5],
			[.5, .54],
		],
			front: [
				[.0, .0],
				[.225, .4],
				[.5, .1],
			]
		};

		if(status === "rain") {
			c.begin();
			c.setFillColor("#66B2FF");
			coordinates[layout].forEach(
				([posX, posY]) => {
					c.ellipse(w*posX, h*posY, w*.05, h*.125);
					c.fill();
				}
			)
			c.close();
		}

		else if(status === "lightning") {
			thunderboltsPositions[layout].forEach(([originX, originY]) => {
				c.begin();
				c.setFillColor("#FF0");

				coordinates.map(([posX, posY]) => {
					const normalized = [];
					normalized.push(w * ((posX * .5) + originX));
					normalized.push(h * ((posY * .5) + originY));
					return normalized;
				}).forEach(([posX, posY], index) => (
					index === 0 ? c.moveTo(posX, posY):c.lineTo(posX, posY))
				);
				c.fill();
				c.close();
			});
		}
	}

	if(status === "sun" || status === "cloudy") drawSun(this.cst.SUN_COLOR, this.cst.BEAMS);
	if(status !== "sun") {
		const isNotNight = (status !== "night");
		const coordinates = (status === "rain")
		? this.cst.WATERDROPS_COORDS 
		: this.cst.THUNDERBOLT_COORDS;
		
		if(isNotNight) drawWeather(status, "back", coordinates);
		else {
			c.begin();
			c.setFillColor("#FFEAB8");
			c.ellipse(w*.4, h*.4, w*.6, h*.6);
			c.fill();
			c.close();
		}
		drawCloud(this.cst.CLOUD_COLORS[status], this.cst.CLOUD_COORDS);
		if(isNotNight) drawWeather(status, "front", coordinates);
	}
};

mxCellRenderer.registerShape(
	zenetysShapeWidgetWeather.prototype.cst.SHAPE, 
	zenetysShapeWidgetWeather
);

// *********************************************************************************|
// * Bicolore Line
// *********************************************************************************|

function zenetysShapeBicoloreLine(points, fill, stroke, strokewidth) {
	mxArrowConnector.call(this);
	this.points = points;
	this.fill = fill;
	this.stroke = stroke;
	this.strokewidth = Math.min(strokewidth, 8);
}
mxUtils.extend(zenetysShapeBicoloreLine, mxArrowConnector);

zenetysShapeBicoloreLine.prototype.cst = {
	SHAPE: "zenShape.bicoloreLine",
	START_COLOR: "startColor",
	END_COLOR: "endColor",
	INT_ARROWS: "intArrows",
	EXT_ARROWS: "extArrows",
	ARROW_Type: "arrowType"
};

function addArrowProperty(name, type = "color", min = undefined, max = undefined) {
	return addCustomProperty(name, type, zenetysShapeBicoloreLine, min, max);
}

zenetysShapeBicoloreLine.prototype.defaultValues = {
	startColor: "#0F6E84",
	endColor: "#17B8CE",
	intArrows: true,
	extArrows: false,
	arrowType: 1,
};

zenetysShapeBicoloreLine.prototype.customProperties = [
	addArrowProperty("startColor"),
	addArrowProperty("endColor"),
	addArrowProperty("intArrows", "bool"),
	addArrowProperty("extArrows", "bool"),
	addArrowProperty("arrowType", "int", 1, 6),
];

zenetysShapeBicoloreLine.prototype.paintEdgeShape = function(c, pts) {
	const startColor = getVariableValue(this, "startColor");
	const endColor = getVariableValue(this, "endColor");
	const intArrows = Boolean(getVariableValue(this, "intArrows"));
	const extArrows = Boolean(getVariableValue(this, "extArrows"));
	const arrowType = getVariableValue(this, "arrowType");
	// const [start, end] = pts[0].x <= pts[1].x ? pts : [pts[1], pts[0]];
	const [start, end] = pts;
	const middle = {
		x: (start.x + end.x) * .5,
		y: (start.y + end.y) * .5,
	};

	/** Draws widget's half line in corresponding color */
	function drawLine(color, fromStart) {
		/** Computes a dot position in the line */
		function getDotOnLine(pos, notFromStart = false, dot) {
			if(notFromStart) return {
				x: dot.x + ((end.x - start.x) * pos),
				y: dot.y + ((end.y - start.y) * pos)
			};
			switch(pos) {
				case 0: return [start.x, start.y];
				case 1: return [end.x, end.y];
				default: return [
					start.x + ((end.x - start.x) * pos),
					start.y + ((end.y - start.y) * pos)
				];
			}
		};

		/** offset: Stops line before boundaries if arrow is set to keep safe behaviour */
		const offset = .045;

		c.begin();
		c.setStrokeColor(color);
		if(fromStart) {
			c.moveTo(...getDotOnLine(extArrows ? offset : 0));
			c.lineTo(...getDotOnLine(intArrows ? .5 - offset : .5));
		} else {
			c.moveTo(...getDotOnLine(intArrows ? .5 + offset : .5));
			c.lineTo(...getDotOnLine(extArrows ? 1 - offset : 1));
		}
		c.stroke();	
		c.close();
	}

	/** Draws an arrow depending on dot position & arrow type in corresponding color */
	function drawArrow(color, dot, isReversedArrow, arrowType) {
		/** Computes dot polar coordinates */
		function getPolarCoords(start, end, position = .1) {
			/** Computes polar angle θ */
			const height = Math.abs(end.y - start.y);
			const hypoth = Math.sqrt(
				Math.pow((end.x - start.x), 2) +
				Math.pow((end.y - start.y), 2)
			);
			const azimut = Math.asin(height / hypoth);
			
			/** Computes polar radius r */
			const offset = position;
			const radius = Math.sqrt(
				Math.pow(end.x - start.x, 2) + 
				Math.pow(end.y - start.y, 2)
			) * offset;

			return { radius, azimut };
		}
		const {radius, azimut} = getPolarCoords(start, end);
		
		//* 9: To perform subtraction & fetch a Math.PI / n with 3 <= n <= 8
		const pt1 = {
			x: radius*Math.cos(Math.PI/(9 - arrowType)),
			y: radius*Math.sin(Math.PI/(9 - arrowType))
		};
		const pt2 = {
			x: radius*Math.cos(-Math.PI/(9 - arrowType)),
			y: radius*Math.sin(-Math.PI/(9 - arrowType))
		};

		/** Computes dot position after passed in rotation matrix */
		function getRotated(base, dot, isReversedArrow) {
			const {x, y} = dot;
			let parsedX, parsedY;
	
			if(isReversedArrow) {
				parsedX = -x*Math.cos(azimut) + y*-Math.sin(azimut);
				parsedY = -x*Math.sin(azimut) + y*Math.cos(azimut);
			}
			else {
				parsedX = x*Math.cos(azimut) + y*-Math.sin(azimut);
				parsedY = x*Math.sin(azimut) + y*Math.cos(azimut);
			}

			/** 
			 * Computes line slope & returns rotated arrow dot position
			 * If slope < 0 makes a subtraction instead of an addition
			 * to invert arrows direction & keep a safe behaviour
		   */
			const slope = (end.y - start.y) / (end.x - start.x);
			if(slope > 0) return [base.x + parsedX, base.y + parsedY];
			else 					return [base.x + parsedX, base.y - parsedY];
		}

		c.begin();
		c.setFillColor(color);
		c.moveTo(...getRotated(dot, pt1, isReversedArrow));
		c.lineTo(dot.x, dot.y);
		c.lineTo(...getRotated(dot, pt2, isReversedArrow));
		c.fill();
		c.close();
	}

	drawLine(startColor, true);
	drawLine(endColor, false);

	if(extArrows) {
		drawArrow(startColor, start, start.x > end.x, arrowType);
		drawArrow(endColor, end, start.x <= end.x, arrowType);
	}
	if(intArrows) {
		drawArrow(startColor, middle, start.x <= end.x, arrowType);
		drawArrow(endColor, middle, start.x > end.x, arrowType);
	}
}

mxCellRenderer.registerShape(
	zenetysShapeBicoloreLine.prototype.cst.SHAPE, 
	zenetysShapeBicoloreLine
);

// *************************************************************************************|
// * Status Widget
// *************************************************************************************|

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
	STATUS_LIST: {
		ok: "✓",
		warning: "!",
		critical: "✚",
		down: "✗",
		unknown: "?", 
	}
};

zenetysShapeWidgetStatus.prototype.customProperties = [{
	name: "status",
	dispName: "Status",
	type: "enum",
	defVal: "ok",
	enumList: getEnumList("status"),
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
	const status = mxUtils.getValue(this.style, "status", this.defaultValues.status);
	const text = this.cst.STATUS_LIST[status];
	const color = getStatusColor(status);

	// Draws circle
	c.begin();
	c.setFillColor(color);
	c.ellipse(0,0,w,h);
	c.fill();
	c.close();

	// Draws text content
	c.begin();
	c.setFontSize(w*.9);
	c.setFontColor("#FFF");
	c.setFontStyle("bold");
	addText(
		c, w*.5, h*.5, 
		`<span style="font-weight:bold;">${text}</span>`,
		{ isHtml: true }
	);
	c.close();
};

mxCellRenderer.registerShape(
	zenetysShapeWidgetStatus.prototype.cst.SHAPE, 
	zenetysShapeWidgetStatus
);
