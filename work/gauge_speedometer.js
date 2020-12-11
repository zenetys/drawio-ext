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
}