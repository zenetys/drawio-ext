//********************************************************************************************
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

