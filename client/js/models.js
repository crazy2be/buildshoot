function Models() {};

Models.init = function(scene) {
    // Load the static mesh and textures
    var loader = new THREE.JSONLoader();

    function getModel(geom, mats) {
        return new THREE.Mesh(geom, new THREE.MeshFaceMaterial(mats));
    }

    Models.loaded = function () {
        return Models.sniper != null && Models.world != null && Models.pistol != null;
    }

    // Load the sniper
    loader.load('models/sniper/sniper.js',
        function (geometry, mats) {
            Models.sniper = function() {
                if (model != null) {
                    scene.remove(model);
                    model = null;
                }
                return getModel(geometry, mats);
            }

            // First time adding to the scene, it will lag, do this right away.
            var model = getModel(geometry, mats);
            model.position.set(0, 0, 0);
            model.scale.set(0.001, 0.001, 0.001);
            scene.add(model);
            if (Models.loaded()) window.gameInit();
        }
    );

    loader.load('models/pistol/pistol.js',
        function (geometry, mats) {
            Models.pistol = function () {
                if (model != null) {
                    scene.remove(model);
                    model = null;
                }
                return getModel(geometry, mats);
            }

            // First time adding to the scene, it will lag, do this right away.
            var model = getModel(geometry, mats);
            model.position.set(0, 0, 0);
            model.scale.set(1, 1, 1);
            scene.add(model);
            if (Models.loaded()) window.gameInit();
        }
    )

    // Load the world
    loader.load('models/test/test.js',
        function (geometry, mats) {
            Models.world = function() {
                if (model != null) {
                    scene.remove(model);
                    model = null;
                }
                return getModel(geometry, mats);
            }

            // First time adding to the scene, it will lag, do this right away.
            var model = getModel(geometry, mats);
            model.position.set(0, 0, 0);
            model.scale.set(0.001, 0.001, 0.001);
            scene.add(model);
            if (Models.loaded()) window.gameInit();
        }
    );
}
