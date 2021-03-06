define(function (require) {
var THREE = require("THREE");
var async = require("async");

function Models() { };

Models.init = function (loadedCallback) {
	var loader = new THREE.JSONLoader();
	var models = [
		'pistol',
		'shovel',
	];

	async.map(models, loadModel, loadedCallback);

	function loadModel(name, done) {
		var path = 'models/' + name + '/' + name + '.js';
		loader.load(path, function (geom, mats) {
			var mat = new THREE.MeshFaceMaterial(mats);
			if (name === 'shovel') {
				shovelFix(mat.materials);
			}
			Models[name] = function () {
				return new THREE.Mesh(geom, mat);
			};
			done();
		});
	}

	function shovelFix(mats) {
		for (var i = 0; i < mats.length; i++) {
			mats[i].side = THREE.DoubleSide;
		}
	}
};

return Models;
});
