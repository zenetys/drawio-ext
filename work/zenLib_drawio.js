/* File concatenated by concatLib module */

//**************************************************************************************
//Linear Gauge
//**************************************************************************************


/**
 * Extends mxShape.
 */
function zenetysShapeGaugeLinear(bounds, fill, stroke, strokewidth)
{
	mxShape.call(this);
	this.bounds = bounds;
	this.fill = fill;
	this.stroke = stroke;
	this.strokewidth = (strokewidth != null) ? strokewidth : 1;
	this.gaugePos = 25;
};
mxUtils.extend(zenetysShapeGaugeLinear, mxShape);

/**
 * Custom props
 */
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

zenetysShapeGaugeLinear.prototype.customProperties = [
	{name: 'percentage', 	dispName: 'Percentage', 		type: 'float', 	defVal: zenetysShapeGaugeLinear.prototype.defaultValues.percentage, 	min:0, max:100				},
	{name: 'gaugeType', 	dispName: 'Gauge Type', 		type: 'int',  	defVal: zenetysShapeGaugeLinear.prototype.defaultValues.gaugeType, 	min: 0, max: 1				},
	{name: 'scaleStages', dispName: 'Scale Stages', 	type: 'String',	defVal: zenetysShapeGaugeLinear.prototype.defaultValues.scaleStages	},
	{name: 'scaleColors', dispName: 'Scale Colors', 	type: 'String', defVal: zenetysShapeGaugeLinear.prototype.defaultValues.scaleColors	},
	{name: 'textSize', 		dispName: 'Text size', 			type: 'int', 		defVal: zenetysShapeGaugeLinear.prototype.defaultValues.textSize},
	{name: 'textColor', 	dispName: 'Text Color',		 	type: 'color', 	defVal: zenetysShapeGaugeLinear.prototype.defaultValues.textColor	},
];

/**
 * Paint the shape
 */
zenetysShapeGaugeLinear.prototype.paintVertexShape = function(c, x, y, w, h)
{
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
	orientation == '0'
	? c.rect(
		w * 0.00, 
		h * 0.35, 
		w * normalizedPercentage, 
		h * 0.35
	) : c.rect(
		w * 0.35, 
		h * (1 - normalizedPercentage), 
		w * 0.35, 
		h * normalizedPercentage
	);

	isOutline ? c.stroke() : c.fill();  // stroke if is outline, or fill
}

zenetysShapeGaugeLinear.prototype.background = function(c, w, h)
{
	const gaugeType = mxUtils.getValue(
		this.style, 
		zenetysShapeGaugeLinear.prototype.cst.GAUGE_TYPE, 
		zenetysShapeGaugeLinear.prototype.defaultValues.gaugeType
	);
	zenetysShapeGaugeLinear.prototype.drawGauge(c,w,h, gaugeType)

};

zenetysShapeGaugeLinear.prototype.foreground = function(c, w, h)
{
	var percentage = mxUtils.getValue(this.style, zenetysShapeGaugeLinear.prototype.cst.GAUGE_PERCENTAGE, zenetysShapeGaugeLinear.prototype.defaultValues.percentage);
	var scaleColors = mxUtils.getValue(this.style, zenetysShapeGaugeLinear.prototype.cst.SCALE_COLORS, zenetysShapeGaugeLinear.prototype.defaultValues.scaleColors).toString().split(',');
	var scaleStages = mxUtils.getValue(this.style, zenetysShapeGaugeLinear.prototype.cst.SCALE_STAGES, zenetysShapeGaugeLinear.prototype.defaultValues.scaleStages).toString().split(',');
	var textColor = mxUtils.getValue(this.style, zenetysShapeGaugeLinear.prototype.cst.TEXT_COLOR, zenetysShapeGaugeLinear.prototype.defaultValues.textColor);
	var textSize = mxUtils.getValue(this.style, zenetysShapeGaugeLinear.prototype.cst.TEXT_SIZE, zenetysShapeGaugeLinear.prototype.defaultValues.textSize);
	var gaugeType = mxUtils.getValue(this.style, zenetysShapeGaugeLinear.prototype.cst.GAUGE_TYPE, zenetysShapeGaugeLinear.prototype.defaultValues.gaugeType);
	
	const drawGauge = zenetysShapeGaugeLinear.prototype.drawGauge;

	percentage = Math.max(0, percentage);
	percentage = Math.min(100, percentage);

	function getColor(percentage) {
    const count = scaleColors.length;
    for(let iter = 0; iter < count; iter++) {    
      if (iter === count - 1) return scaleColors[iter] || 'black';
      else if (percentage <= (parseInt(scaleStages[iter]))) return scaleColors[iter] || 'black';
    }
  }

	drawGauge(c,w,h, gaugeType, getColor(percentage), percentage); 	// draw fill
	drawGauge(c,w,h, gaugeType, getColor(percentage), 100, true); 	// draw outline

	c.setFontSize(textSize);
	c.setFontColor(textColor);
	
	// add text
	c.text(
		w * 0.5, 
		h, 
		0, 
		0, 
		`${parseInt(percentage)}%`, 
		mxConstants.ALIGN_CENTER, 
		mxConstants.ALIGN_TOP, 
		0, 
		null, 
		0, 
		0, 
		0
	);
};


mxCellRenderer.registerShape(zenetysShapeGaugeLinear.prototype.cst.SHAPE, zenetysShapeGaugeLinear);

Graph.handleFactory[zenetysShapeGaugeLinear.prototype.cst.SHAPE] = function(state)
{
	var handles = [Graph.createHandle(state, ['percentage'], function(bounds)
			{
				var percentage = Math.max(0, Math.min(100, parseFloat(mxUtils.getValue(this.state.style, 'percentage', this.percentage))));

				return new mxPoint(bounds.x + bounds.width * 0.2 + percentage * 0.6 * bounds.width / 100, bounds.y + bounds.height * 0.8);
			}, function(bounds, pt)
			{
				this.state.style['percentage'] = Math.round(1000 * Math.max(0, Math.min(100, (pt.x - bounds.x) * 100 / bounds.width))) / 1000;
			})];

	return handles;
}

//**************************************************************************************
// Number Gauge
//**************************************************************************************


/**
 * Extends mxShape.
 */
function zenetysShapeGaugeNumber(bounds, fill, stroke, strokewidth)
{
	mxShape.call(this);
	this.bounds = bounds;
	this.fill = fill;
	this.stroke = stroke;
	this.strokewidth = (strokewidth != null) ? strokewidth : 1;
	this.gaugePos = 25;
};
mxUtils.extend(zenetysShapeGaugeNumber, mxShape);

/**
 * Custom props
 */
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

zenetysShapeGaugeNumber.prototype.customProperties = [
	{name: 'percentage', 		dispName: 'Percentage', 			type: 'float', 	defVal: zenetysShapeGaugeNumber.prototype.defaultValues.percentage, min:0, max:100},
	{name: 'textSize', 			dispName: 'Text size', 				type: 'int', 		defVal: zenetysShapeGaugeNumber.prototype.defaultValues.textSize, min:1},
	{name: 'strokeWidth', 	dispName: 'Stroke width', 		type: 'int', 		defVal: zenetysShapeGaugeNumber.prototype.defaultValues.strokeWidth, min:1},	

	{name: 'isFilled', 			dispName: 'Fill circle', 			type: 'bool', 	defVal: zenetysShapeGaugeNumber.prototype.defaultValues.isFilled},
	{name: 'isOutlined', 		dispName: 'Draw outline', 		type: 'bool', 	defVal: zenetysShapeGaugeNumber.prototype.defaultValues.isOutlined},
	{name: 'isColorized', 	dispName: 'Colorize text', 		type: 'bool', 	defVal: zenetysShapeGaugeNumber.prototype.defaultValues.isColorized},

	{name: 'stages', 				dispName: 'Stages', 					type: 'String', defVal: zenetysShapeGaugeNumber.prototype.defaultValues.stages},
	{name: 'fillColors', 		dispName: 'Fill colors', 			type: 'String', defVal: zenetysShapeGaugeNumber.prototype.defaultValues.fillColors},
	{name: 'outlineColors', dispName: 'Outline colors', 	type: 'String', defVal: zenetysShapeGaugeNumber.prototype.defaultValues.outlineColors},
	{name: 'textColors', 		dispName: 'Text colors', 			type: 'String', defVal: zenetysShapeGaugeNumber.prototype.defaultValues.textColors},
];

/**
 * Paint the shape
 */
zenetysShapeGaugeNumber.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, w, h);
	c.setShadow(false);
	this.foreground(c, w, h);
};

zenetysShapeGaugeNumber.prototype.background = function(c, w, h)
{
	c.setFillColor('#FFF');
	c.ellipse(0, 0, w, h);
	c.fill();
};

zenetysShapeGaugeNumber.prototype.foreground = function(c, w, h)
{
	const percentage = Math.max(
		0, Math.min ( 100,  mxUtils.getValue(this.style, zenetysShapeGaugeNumber.prototype.cst.GAUGE_PERCENTAGE, 				zenetysShapeGaugeNumber.prototype.defaultValues.percentage)
		)
	); 
	const textSize 			= mxUtils.getValue(this.style, zenetysShapeGaugeNumber.prototype.cst.TEXT_SIZE, 				zenetysShapeGaugeNumber.prototype.defaultValues.textSize);
	const strokeWidth 	= mxUtils.getValue(this.style, zenetysShapeGaugeNumber.prototype.cst.STROKE_WIDTH, 		zenetysShapeGaugeNumber.prototype.defaultValues.strokeWidth);
	
	const isFilled 			= mxUtils.getValue(this.style, zenetysShapeGaugeNumber.prototype.cst.IS_FILLED, 				zenetysShapeGaugeNumber.prototype.defaultValues.isFilled);
	const isOutlined 		= mxUtils.getValue(this.style, zenetysShapeGaugeNumber.prototype.cst.IS_OUTLINED, 			zenetysShapeGaugeNumber.prototype.defaultValues.isOutlined);
	const isColorized 	= mxUtils.getValue(this.style, zenetysShapeGaugeNumber.prototype.cst.IS_COLORIZED, 		zenetysShapeGaugeNumber.prototype.defaultValues.isColorized);
	
	const stages 				= mxUtils.getValue(this.style, zenetysShapeGaugeNumber.prototype.cst.STAGES, 					zenetysShapeGaugeNumber.prototype.defaultValues.stages).toString().split(',');
	const fillColors 		= mxUtils.getValue(this.style, zenetysShapeGaugeNumber.prototype.cst.FILL_COLORS, 			zenetysShapeGaugeNumber.prototype.defaultValues.fillColors).toString().split(',');
	const outlineColors = mxUtils.getValue(this.style, zenetysShapeGaugeNumber.prototype.cst.OUTLINE_COLORS, 	zenetysShapeGaugeNumber.prototype.defaultValues.outlineColors).toString().split(',');
	const textColors 		= mxUtils.getValue(this.style, zenetysShapeGaugeNumber.prototype.cst.TEXT_COLORS, 			zenetysShapeGaugeNumber.prototype.defaultValues.textColors).toString().split(',');
	
	function getColor(percentage, colors, stages) {
		const count = colors.length;
		for(let iter = 0; iter < count; iter++) {
			if (iter === count - 1) return colors[iter] || 'black';
			else if (percentage <= (parseInt(stages[iter]))) return colors[iter] || 'black';
		}
	}

	c.setFillColor(isFilled ? getColor(percentage, fillColors, stages) : 'white');
	c.begin();

	c.ellipse(0,0,w,h);
	c.fill();

	if (isOutlined) {
		c.setStrokeColor(getColor(percentage, outlineColors, stages));
		c.setStrokeWidth(strokeWidth);

		const normalized = strokeWidth / 100;

		c.ellipse(w * (normalized / 2), h * (normalized / 2),w * (1 - normalized),h * (1 - normalized));
		c.stroke();

		c.setStrokeWidth(1); // set stroke default value
	}

	c.setFontSize(textSize);
	if (isColorized) c.setFontColor(getColor(percentage, textColors, stages));
	c.text(
		w * 0.5, 
		h * 0.5, 
		0, 
		0, 
		`${parseInt(percentage)}%`, 
		mxConstants.ALIGN_CENTER, 
		mxConstants.ALIGN_MIDDLE, 
		0, 
		null, 
		0, 
		0, 
		0
	);

};
mxCellRenderer.registerShape(zenetysShapeGaugeNumber.prototype.cst.SHAPE, zenetysShapeGaugeNumber);

Graph.handleFactory[zenetysShapeGaugeNumber.prototype.cst.SHAPE] = function(state)
{
	const handles = [
		Graph.createHandle(
			state, 
			['percentage'], 
			function(bounds) {
				const percentage = Math.max(
					0, Math.min(
						100, parseFloat(
							mxUtils.getValue(
								this.state.style, 
								'percentage', 
								this.percentage
							)
						)
					)
				);

				return new mxPoint(
					bounds.x + bounds.width * 0.2 + percentage * 0.6 * bounds.width / 100, 
					bounds.y + bounds.height * 0.8
				);
			}, 
			function(bounds, pt) {
				this.state.style['percentage'] = Math.round(
					1000 * Math.max(
						0, Math.min(
							100, (pt.x - bounds.x) * 100 / bounds.width
						)
					)
				) / 1000;
			}
		)
	];

	return handles;
}


//**************************************************************************************
//Speedometer Gauge
//**************************************************************************************


/**
 * Extends mxShape.
 */
function zenetysShapeGaugeSpeedometer(bounds, fill, stroke, strokewidth)
{
	mxShape.call(this);
	this.bounds = bounds;
	this.fill = fill;
	this.stroke = stroke;
	this.strokewidth = (strokewidth != null) ? strokewidth : 1;
	this.gaugePos = 25;
};
mxUtils.extend(zenetysShapeGaugeSpeedometer, mxShape);

/**
 * Custom props
 */
zenetysShapeGaugeSpeedometer.prototype.cst = {
	GAUGE_PERCENTAGE : 'percentage',
  SCALE_STAGES : 'scaleStages',
  SCALE_COLORS : 'scaleColors',
  TEXT_SIZE : 'textSize',
  SHAPE : 'zenShape.gauge.speedometer',
};

zenetysShapeGaugeSpeedometer.prototype.defaultValues = {
  percentage: 25,
  scaleStages: '50,80',
  scaleColors: '#00FF00,#FF8000,#FF0000',
  textSize: 18,
};

zenetysShapeGaugeSpeedometer.prototype.customProperties = [
	{name: 'percentage',  dispName: 'Percentage',   type: 'float', 	defVal: zenetysShapeGaugeSpeedometer.prototype.defaultValues.percentage, min:0, max:100},
	{name: 'scaleStages', dispName: 'Scale Stages', type: 'String', defVal: zenetysShapeGaugeSpeedometer.prototype.defaultValues.scaleStages},
	{name: 'scaleColors', dispName: 'Scale Colors', type: 'String', defVal: zenetysShapeGaugeSpeedometer.prototype.defaultValues.scaleColors},
	{name: 'textSize', 		dispName: 'Text size', 		type: 'int', 		defVal: zenetysShapeGaugeSpeedometer.prototype.defaultValues.textSize},
];

// refacto: use method in both background and foreground
zenetysShapeGaugeSpeedometer.prototype.drawGauge = function (c,w,h, percentage, color, isOutline = false) {

  function getVertex(c,w,h, pos, side) {
    const getGaugePos = (pos) => (0.75 * (2 * Math.PI * parseFloat(pos) / 100) + 1.25 * Math.PI);
    const r = side === 'int' ? 0.25 : 0.50;
    const x = w * 0.5 + w * r * Math.sin(getGaugePos(pos));
    const y = h * 0.5 - h * r * Math.cos(getGaugePos(pos));
    return {pos, x, y};
  }

  function drawArc(c, side, vertex) {
    let rx, ry, sweep;
    
    if (side === 'int') {
      rx = w * 0.25;
      ry = h * 0.25;
      sweep = 1;		// rotation horaire
    } else {
      rx = w * 0.5;
      ry = h * 0.5;
      sweep = 0;		// rotation antihoraire
    }
    
    // 67 => if (gaugePos >= 67) => arc >= 180° => need large arc flag
    const largeArc = percentage >= 67 ? 1 : 0;
    
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

/**
 * Paint the shape
 */
zenetysShapeGaugeSpeedometer.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, w, h);
	c.setShadow(false);
	this.foreground(c, w, h);
};

zenetysShapeGaugeSpeedometer.prototype.background = function(c, w, h)
{
	zenetysShapeGaugeSpeedometer.prototype.drawGauge(c,w,h, 100, '#FFF');
};

zenetysShapeGaugeSpeedometer.prototype.foreground = function(c, w, h)
{
	let percentage	    = mxUtils.getValue(this.style, zenetysShapeGaugeSpeedometer.prototype.cst.GAUGE_PERCENTAGE, zenetysShapeGaugeSpeedometer.prototype.defaultValues.percentage);
	const scaleStages   = mxUtils.getValue(this.style, zenetysShapeGaugeSpeedometer.prototype.cst.SCALE_STAGES,     zenetysShapeGaugeSpeedometer.prototype.defaultValues.scaleStages).toString().split(',');
	const scaleColors   = mxUtils.getValue(this.style, zenetysShapeGaugeSpeedometer.prototype.cst.SCALE_COLORS,     zenetysShapeGaugeSpeedometer.prototype.defaultValues.scaleColors).toString().split(',');
	const textSize      = mxUtils.getValue(this.style, zenetysShapeGaugeSpeedometer.prototype.cst.TEXT_SIZE,        zenetysShapeGaugeSpeedometer.prototype.defaultValues.textSize);

  const drawGauge = zenetysShapeGaugeSpeedometer.prototype.drawGauge;

  // limit percentage to range [0:100]
	percentage = Math.max(0, percentage);
	percentage = Math.min(100, percentage);

  function getColor(percentage) {
    const count = scaleColors.length;
    for(let iter = 0; iter < count; iter++) {    
      if (iter === count - 1) return scaleColors[iter] || 'black';
      else if (percentage <= (parseInt(scaleStages[iter]))) return scaleColors[iter] || 'black';
    }
  }

  drawGauge(c,w,h, percentage, getColor(percentage)); // draw gauge fill
	drawGauge(c,w,h, 100, getColor(percentage), true);       // draw gauge outline

	c.setFontSize(textSize);
	c.text(
		w * 0.5, 
		h * 0.5, 
		0, 
		0, 
		`${parseInt(percentage)}%`, 
		mxConstants.ALIGN_CENTER, 
		mxConstants.ALIGN_MIDDLE, 
		0, 
		null, 
		0, 
		0, 
		0
	);

};
mxCellRenderer.registerShape(zenetysShapeGaugeSpeedometer.prototype.cst.SHAPE, zenetysShapeGaugeSpeedometer);

Graph.handleFactory[zenetysShapeGaugeSpeedometer.prototype.cst.SHAPE] = function(state)
{
	var handles = [Graph.createHandle(state, ['percentage'], function(bounds)
			{
				var percentage = Math.max(0, Math.min(100, parseFloat(mxUtils.getValue(this.state.style, 'percentage', this.percentage))));

				return new mxPoint(bounds.x + bounds.width * 0.2 + percentage * 0.6 * bounds.width / 100, bounds.y + bounds.height * 0.8);
			}, function(bounds, pt)
			{
				this.state.style['percentage'] = Math.round(1000 * Math.max(0, Math.min(100, (pt.x - bounds.x) * 100 / bounds.width))) / 1000;
			})];

	return handles;
}//********************************************************************************************
//                                          Pie Full
//********************************************************************************************


/**
* Extends mxShape.
*/
function zenetysShapePieFull(bounds, fill, stroke, strokewidth)
{
	mxShape.call(this);
	this.bounds = bounds;
	this.fill = fill;
	this.stroke = stroke;
	this.strokewidth = (strokewidth != null) ? strokewidth : 1;
};
mxUtils.extend(zenetysShapePieFull, mxActor);

/**
 * Custom props
 */
zenetysShapePieFull.prototype.cst = {
	PIE : 'mxgraph.basic.pied',
	SHAPE : 'zenShape.pie.full',
};

zenetysShapePieFull.prototype.defaultValues = {
	endAngle: 0.28,
	color1: '#00FF00',
	color2: '#DEFFFF', 
};


zenetysShapePieFull.prototype.customProperties = [
	{name: 'endAngle', dispName: 'Percentage', type: 'float', defVal: zenetysShapePieFull.prototype.defaultValues.endAngle, min:0, max:1},
	{name: 'color1'  , dispName: 'Color 1'	 , type: 'color', defVal: zenetysShapePieFull.prototype.defaultValues.color1},
	{name: 'color2'  , dispName: 'Color 2'	 , type: 'color', defVal: zenetysShapePieFull.prototype.defaultValues.color2},
	{name: 'scaleStages',     dispName: 'Scale Stages', type: 'String', defVal: zenetysShapePieFull.prototype.defaultValues.scaleStages},
	{name: 'scaleColors',     dispName: 'Scale Colors', type: 'String', defVal: zenetysShapePieFull.prototype.defaultValues.scaleColors},
	
];

/**
* Paint the shape
*/
zenetysShapePieFull.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);

	const color1 = mxUtils.getValue(this.style, 'color1', zenetysShapePieFull.prototype.defaultValues.color1);
	const color2 = mxUtils.getValue(this.style, 'color2', zenetysShapePieFull.prototype.defaultValues.color2);

	const startAngle = 0;
	const endAngle = mxUtils.getValue(this.style, 'endAngle', zenetysShapePieFull.prototype.defaultValues.endAngle) == 0.5
	? 2 * Math.PI * 0.4999 // if endAngle === 0.5 => display bug
	: 2 * Math.PI * Math.max(0, Math.min(1, parseFloat(mxUtils.getValue(this.style, 'endAngle', zenetysShapePieFull.prototype.defaultValues.endAngle))));
	const rx = w * 0.5;
	const ry = h * 0.5;

	const startX = rx + Math.sin(startAngle) * rx;
	const startY = ry - Math.cos(startAngle) * ry;
	const endX = rx + Math.sin(endAngle) * rx;
	const endY = ry - Math.cos(endAngle) * ry;
	
	const angDiff = endAngle - startAngle;
	
	if (angDiff < 0)
	{
		angDiff = angDiff + Math.PI * 2;
	}
		
	let bigArc = 0;
	
	if (angDiff > Math.PI)
	{
		bigArc = 1;
	}
		
	c.setFillColor(color1);
	c.begin();
	c.moveTo(rx, ry);
	c.lineTo(startX, startY);
	c.arcTo(rx, ry, 0, bigArc, 1, endX, endY);
	c.close();
	c.fill();

	c.setFillColor(color2);
	c.begin();
	c.moveTo(rx, ry);
	c.lineTo(startX, startY);
	c.arcTo(rx, ry, 0, endX <= w * 0.5 ? 0 : 1, 0, endX, endY);
	c.close();
	c.fill();

};

mxCellRenderer.registerShape(zenetysShapePieFull.prototype.cst.SHAPE, zenetysShapePieFull);

zenetysShapePieFull.prototype.constraints = null;

Graph.handleFactory[zenetysShapePieFull.prototype.cst.SHAPE] = function(state)
{
	const handles = [
		Graph.createHandle(
			state, 
			['endAngle'], 
			function(bounds) {
			const endAngle = 2 * Math.PI * Math.max(0, Math.min(1, parseFloat(mxUtils.getValue(this.state.style, 'endAngle', this.endAngle))));

			return new mxPoint(bounds.x + bounds.width * 0.5 + Math.sin(endAngle) * bounds.width * 0.5, bounds.y + bounds.height * 0.5 - Math.cos(endAngle) * bounds.height * 0.5);
			}, 
			function(bounds, pt) {
				const handleX = Math.round(100 * Math.max(-1, Math.min(1, (pt.x - bounds.x - bounds.width * 0.5) / (bounds.width * 0.5)))) / 100;
				const handleY = -Math.round(100 * Math.max(-1, Math.min(1, (pt.y - bounds.y - bounds.height * 0.5) / (bounds.height * 0.5)))) / 100;
				
				let res =  0.5 * Math.atan2(handleX, handleY) / Math.PI;
				
				if (res < 0)
				{
					res = 1 + res;
				}
				
				this.state.style['endAngle'] = res;
			}
		)
	];
	
	return handles;
};

