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

