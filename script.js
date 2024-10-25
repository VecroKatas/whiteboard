const socket = new WebSocket('ws://localhost:3000');
var canvas = new fabric.Canvas('whiteboard');
var styles = [true, false, false, false];
var stylesFunctions = [function () {choosePointer()}, 
	function () {chooseFreeDraw()},
	function () {chooseRect()}, 
	function () {chooseCirc()}];
var isDrawing = false, socketId = -1;
var sentObj, sentObjs, group, groupLeft;
var isObjectMoving  = false;

var buttons = [document.getElementById("cursorTool"), 
	document.getElementById("penTool"),
	document.getElementById("rectTool"), 
	document.getElementById("circTool")
];

var colorPicker = document.getElementById("drawing-color");
var widthElem = document.getElementById("drawing-line-width");

window.addEventListener('resize', resizeCanvas);
window.addEventListener('keydown', key => {if (key.key == "Delete") removeSelected()});

function resizeCanvas() {
  canvas.setHeight(window.innerHeight);
  canvas.setWidth(window.innerWidth - document.getElementById("sidebar").clientWidth);
  canvas.renderAll();
}

resizeCanvas();

function changeStyle(styleIndex){
	for (var i = 0; i < styles.length; i++){
		if (i != styleIndex){
			styles[i] = false;
			buttons[i].classList.remove("active");
		}
		else{
			styles[i] = true;
			stylesFunctions[i]();
			buttons[i].classList.add("active");
		}
	}
}


var choosePointer = function(){
	canvas.isDrawingMode = false;
}
var chooseFreeDraw = function(){
	canvas.isDrawingMode = true;
	isDrawing = true;
}
var chooseRect = function(){
	onSolidRect();
}
var chooseCirc = function(){
	onSolidCirc();
}


var onSolidRect = function () {
  const rect = new fabric.Rect({
		left: 100,
		top: 100,
		fill: colorPicker.value,
		width: 100,
		height: 100
	});
	canvas.add(rect);
}

var onSolidCirc = function () {
  const circle = new fabric.Circle({
		left: 200,
		top: 200,
		fill: colorPicker.value,
		radius: 50
	});
	canvas.add(circle);
}

colorPicker.addEventListener('change', function() {
	canvas.freeDrawingBrush.color = this.value;
});

var removeSelected = function(){
	var obj = canvas.getActiveObject();
	if(obj)
		canvas.remove(obj);
}

function getObjectFromId(ctx, id){
	var currentObjects = ctx.getObjects();
	for (var i = currentObjects.length-1; i >= 0; i--) {
	  if(currentObjects[i].id == id)
	    return currentObjects[i];
	}
	return null;
}

function Board_OnSync(_canvas, obj){
  var existing = getObjectFromId(_canvas, obj.id);
	
	if(obj.removed){
		if(existing){
			canvas.remove(existing);
		}
		return;
	 }

	if(existing){
		existing.set(obj);
		moveObject(existing);
	}
	else{
		if(obj.type === 'rect'){
			_canvas.add(new fabric.Rect(obj));
		}
		else if(obj.type === 'circle'){
			_canvas.add(new fabric.Circle(obj));
		}
		else if (obj.type === 'path'){
			_canvas.add(new fabric.Path(obj.path));
		}
	}
	_canvas.renderAll();
}

function moveObject(obj){
	if (group)
	{
		obj.left = group.left + obj.left - groupLeft.left;
		obj.top = group.top + obj.top - groupLeft.top;
	}
}

var recieved = false;
canvas.on('object:added', function(options) {
	if (options.target) {
		var obj = options.target;
		if(obj.type == 'rect'){
		} else if (obj.type == 'path'){
			obj.fill = 'rgba(0,0,0,0)';
			obj.stroke = sentObj.stroke;
			if (sentObj){
				obj.set('socketId', sentObj.socketId);
				obj.set('id', sentObj.id);
				obj.set('removed', sentObj.removed);
			}
		}

		if (!obj.socketId && !sentObj){
			obj.set('socketId', socketId);
		}
		
		if(!obj.id && obj.socketId == socketId){
			obj.set('id', Date.now());

			obj.toJSON = (function(toJSON) {
				return function() {
					return    fabric.util.object.extend(toJSON.call(this), {
						id: this.id,
						socketId: this.socketId,
					});
				};
			})(obj.toJSON);

			let serializedObject = obj.toJSON();
			socket.send(JSON.stringify(serializedObject));
		}
	} 
});

canvas.on('object:removed', function(options) {
	if (options.target) {
		var obj = options.target;	         
		if(obj.removed)
			return;

		obj.set('removed', true);
		obj.toJSON = (function(toJSON) {
			return function() {
				return fabric.util.object.extend(toJSON.call(this), {
					id: this.id,
					socketId: this.socketId,
					removed: this.removed 
				});
			};
		})(obj.toJSON);

		let serializedObject = obj.toJSON();
		socket.send(JSON.stringify(serializedObject));
	}
});

canvas.on('object:moving', function () {
   isObjectMoving = true;
});

function findLeft(objs){
	var leftest, leftx = canvas.width;
	objs.forEach(o =>{
		if (o.left < leftx){
			leftx = o.left;
			leftest = o;
		}
	});
	return leftest;
}

canvas.on('mouse:up', function () {
  if (isObjectMoving){
    isObjectMoving = false;
		var objs = canvas.getActiveObjects();
		var left = findLeft(objs);
		if (objs[0].group)
		{
			var group = objs[0].group;
			let groups = group.toJSON();
			socket.send(JSON.stringify(groups));
		}
		
		left.toJSON = (function(toJSON) {
			return function() {
				return    fabric.util.object.extend(toJSON.call(this), {
					id: this.id,
					socketId: this.socketId,
				});
			};
		})(left.toJSON);

		let serializedLeft = left.toJSON();
		socket.send(JSON.stringify(serializedLeft));
		objs.forEach(o =>{
			if (o !== left){
				o.toJSON = (function(toJSON) {
					return function() {
						return    fabric.util.object.extend(toJSON.call(this), {
							id: this.id,
							socketId: this.socketId,
						});
					};
				})(o.toJSON);

				let serializedObject = o.toJSON();
				socket.send(JSON.stringify(serializedObject));
			}
		});
  } 
});


socket.onmessage = function(event) {
	if (socketId == -1) {
		socketId = JSON.parse(event.data).socketId;
		console.log(JSON.parse(event.data));
	}
	else{
		sentObjs = JSON.parse(event.data);
		console.log(sentObjs);

		if (sentObjs.type == 'state'){
			var objs = canvas.getObjects();
			socket.send(JSON.stringify({type: "state", objects: objs}));
		}
		else{
			if (sentObjs.type == "activeSelection"){
				group = structuredClone(sentObjs);
				groupLeft = undefined;
			}
			else
			{
					sentObj = sentObjs;
					if (!groupLeft) groupLeft = sentObj;
					Board_OnSync(canvas, sentObj);
			}
				
			sentObj = undefined;
			sentObjs = undefined;
		}
	}
};