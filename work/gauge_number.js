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


