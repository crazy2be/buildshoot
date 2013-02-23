function Chunk(blocks, geometry, scene) {
    var self = this;
    var mesh = new THREE.Mesh(geometry,
        new THREE.MeshBasicMaterial({
            vertexColors: THREE.VertexColors
        })
    );
    scene.add(mesh);

    self.remove = function () {
        scene.remove(mesh);
        mesh = null;
    }

    self.hide = function () {
        mesh.visible = false;
    }

    self.show = function () {
        mesh.visible = true;
    }

    self.block = function (oc) {
        if (validChunkOffset(oc.x, oc.y, oc.z)) {
            // A single array is mesurably faster to
            // index (approximently twice as fast),
            // and is a lot less garbage to clean up.
            return new Block(blocks[
                oc.x * CHUNK_WIDTH * CHUNK_HEIGHT +
                oc.y * CHUNK_WIDTH +
                oc.z
            ]);
        } else {
            throw "block coords out of bounds: " + oc;
        }
    }
}