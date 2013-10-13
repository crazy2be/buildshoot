define(function (require) {

var THREE = require("THREE");

// Could be used for various types of bars or canvases
// we want to have in the scene if somebody wants to make
// it generic.
return function EntityBar(drawFunc) {
	var self = this;
	var canvas = document.createElement('canvas');
	canvas.width = 200;
	canvas.height = 30;

	if(localStorage.hpBars) {
		canvas.height = 10;
	}

	var ctx = canvas.getContext('2d');

	var texture = new THREE.Texture(canvas);
	texture.needsUpdate = true;

	var material = new THREE.MeshBasicMaterial({
		map: texture,
		side: THREE.DoubleSide,
	});
	material.transparent = true;

	var mesh = new THREE.Mesh(
		new THREE.PlaneGeometry(canvas.width, canvas.height),
		material);

	mesh.scale.set(1/100, 1/100, 1/100);
	mesh.position.set(0, 1.25, 0);

	if(localStorage.hpBars) {
		mesh.position.set(0, 1.15, 0);
	}

	self.update = function (entity, clock, viewFacingPos) {
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		drawFunc(ctx, clock.entityTime(), canvas.width, canvas.height);
		texture.needsUpdate = true;
	};

	self.meshes = function () {
		return [mesh];
	};
}
});