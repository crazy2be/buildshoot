var CHUNK_WIDTH = 16;
var CHUNK_DEPTH = 16;
var CHUNK_HEIGHT = 16;

var Chunk = (function () {
    var matrix = new THREE.Matrix4();
    
    var pxGeometry = new THREE.PlaneGeometry(1, 1);
    pxGeometry.faces[0].materialIndex = 0;
    pxGeometry.applyMatrix(matrix.makeRotationY(Math.PI / 2));
    pxGeometry.applyMatrix(matrix.makeTranslation(1, 0.5, 0.5));
    
    var nxGeometry = new THREE.PlaneGeometry(1, 1);
    nxGeometry.faces[0].materialIndex = 1;
    nxGeometry.applyMatrix(matrix.makeRotationY(-Math.PI / 2));
    nxGeometry.applyMatrix(matrix.makeTranslation(0, 0.5, 0.5));
    
    var pyGeometry = new THREE.PlaneGeometry(1, 1);
    pyGeometry.faces[0].materialIndex = 2;
    pyGeometry.applyMatrix(matrix.makeRotationX(-Math.PI / 2));
    pyGeometry.applyMatrix(matrix.makeTranslation(0.5, 1, 0.5));
    
    var nyGeometry = new THREE.PlaneGeometry(1, 1);
    nyGeometry.faces[0].materialIndex = 3;
    nyGeometry.applyMatrix(matrix.makeRotationX(Math.PI / 2));
    nyGeometry.applyMatrix(matrix.makeTranslation(0.5, 0, 0.5));
    
    var pzGeometry = new THREE.PlaneGeometry(1, 1);
    pzGeometry.faces[0].materialIndex = 4;
    pzGeometry.applyMatrix(matrix.makeTranslation(0.5, 0.5, 1));
    
    var nzGeometry = new THREE.PlaneGeometry(1, 1);
    nzGeometry.faces[0].materialIndex = 5;
    nzGeometry.applyMatrix(matrix.makeRotationY(Math.PI));
    nzGeometry.applyMatrix(matrix.makeTranslation(0.5, 0.5, 0));
    
    var materials = [
        new THREE.MeshBasicMaterial({
            color: 0xff0000,
            transparent: true,
            opacity: 0.7
        }),
        new THREE.MeshBasicMaterial({
            color: 0x00ff00,
            transparent: true,
            opacity: 0.7
        }),
        new THREE.MeshBasicMaterial({
            color: 0x0000ff,
            transparent: true,
            opacity: 0.7
        }),
        new THREE.MeshBasicMaterial({
            color: 0xffff00,
            transparent: true,
            opacity: 0.7
        }),
        new THREE.MeshBasicMaterial({
            color: 0xff00ff,
            transparent: true,
            opacity: 0.7
        }),
        new THREE.MeshBasicMaterial({
            color: 0x00ffff,
            transparent: true,
            opacity: 0.7
        })
    ];
    
    var wireMaterial = new THREE.MeshBasicMaterial({
        color: 0x000000,
        wireframe: true
    });
    
    return Chunk;
    
    function Chunk(world, blocks, cx, cy, cz) {
        var self = this;
        var isDisplayed = false;
        var mesh;
        var wireMesh;
        
        var nxc;
        var pxc;
        var nyc;
        var pyc;
        var nzc;
        var pzc;
        
        // Offset relative to chunk
        function block(ox, oy, oz) {
            if (blocks[ox] && blocks[ox][oy] && blocks[ox][oy][oz]) {
                return blocks[ox][oy][oz];
            }
            return null;
        }
        
        function addBlockGeometry(geometry, dummy, ox, oy, oz) {
            var wx = ox + cx*CHUNK_WIDTH;
            var wy = oy + cy*CHUNK_HEIGHT;
            var wz = oz + cz*CHUNK_DEPTH;
            dummy.position.x = wx;
            dummy.position.y = wy;
            dummy.position.z = wz;
            
            if (block[ox][oy][pz].isType(Block.AIR)) return;
            
            var px = block(ox + 1, oy, oz);
            if (!px) px = pxc.blockAt(0, oy, oz);
            
            var nx = block(ox - 1, oy, oz);
            if (!nx) nx = nxc.blockAt(CHUNK_WIDTH - 1, oy, oz);
            
            var pz = block(ox, oy, oz + 1);
            if (!pz) pz = pzc.blockAt(ox, oy, 0);
            
            var nz = block(ox, oy, oz - 1);
            if (!nz) nz = nzc.blockAt(ox, oy, CHUNK_DEPTH - 1);
            
            var py = block(ox, oy + 1, oz);
            if (!py) py = pyc.blockAt(ox, 0, oz);
            
            var ny = block(ox, oy - 1, oz);
            if (!ny) ny = nyc.blockAt(ox, CHUNK_HEIGHT - 1, oz);
            
            if (py.isType(Block.AIR)) {
                dummy.geometry = pyGeometry;
                THREE.GeometryUtils.merge(geometry, dummy);
            }
            if (ny.isType(Block.AIR)) {
                dummy.geometry = nyGeometry;
                THREE.GeometryUtils.merge(geometry, dummy);
            }
            if (px.isType(Block.AIR)) {
                dummy.geometry = pxGeometry;
                THREE.GeometryUtils.merge(geometry, dummy);
            }
            if (nx.isType(Block.AIR)) {
                dummy.geometry = nxGeometry;
                THREE.GeometryUtils.merge(geometry, dummy);
            }
            if (pz.isType(Block.AIR)) {
                dummy.geometry = pzGeometry;
                THREE.GeometryUtils.merge(geometry, dummy);
            }
            if (nz.isType(Block.AIR)) {
                dummy.geometry = nzGeometry;
                THREE.GeometryUtils.merge(geometry, dummy);
            }    
        }
        
        self.isDisplayed = function () {
            return isDisplayed;
        }
        
        self.addTo = function (scene) {
            var geometry = new THREE.Geometry();
            var dummy = new THREE.Mesh();
            
            if (!nxc) nxc = world.createChunk(cx - 1, cy, cz);
            if (!pxc) pxc = world.createChunk(cx + 1, cy, cz);
            if (!nyc) nyc = world.createChunk(cx, cy - 1, cz);
            if (!pyc) pyc = world.createChunk(cx, cy + 1, cz);
            if (!nzc) nzc = world.createChunk(cx, cy, cz - 1);
            if (!pzc) pzc = world.createChunk(cx, cy, cz + 1);
            
            for (var ox = 0; ox < CHUNK_WIDTH; ox++) {
                for (var oy = 0; oy < CHUNK_HEIGHT; oy++) {
                    for (var oz = 0; oz < CHUNK_DEPTH; oz++) {
                        addBlockGeometry(geometry, dummy, ox, oy, oz);
                    }
                }
            }
            mesh = new THREE.Mesh(geometry, new THREE.MeshFaceMaterial(materials));
            wireMesh = new THREE.Mesh(geometry, wireMaterial);
            scene.add(mesh);
            scene.add(wireMesh);
            isDisplayed = true;
            return self;
        }
        
        self.getMesh = function () {
            return mesh;
        }
        
        self.removeFrom = function (scene) {
            isDisplayed = false;
            if (!mesh) return;
            scene.remove(mesh);
            scene.remove(wireMesh);
        }

        self.refresh = function (scene) {
            self.removeFrom(scene);
            self.addTo(scene);
        }
        
        self.blockAt = function (ox, oy, oz) {
            return block(ox, oy, oz);
        }
    }
}());

Chunk.generateChunk = function(cx, cy, cz, world) {
    var heightMap = Generator.generateHeightMap(cx * CHUNK_WIDTH, cz * CHUNK_DEPTH, CHUNK_WIDTH, CHUNK_DEPTH, world.getSeed());

    var blocks = [];
    for (var ox = 0; ox < CHUNK_WIDTH; ox++) {
        blocks[ox] = [];
        for (var oy = 0; oy < CHUNK_HEIGHT; oy++) {
            blocks[ox][oy] = [];
            for (var oz = 0; oz < CHUNK_DEPTH; oz++) {
                if (heightMap[ox][oz] > oy + cy*CHUNK_HEIGHT) {
                    blocks[ox][oy][oz] = new Block(Block.DIRT);
                } else {
                    blocks[ox][oy][oz] = new Block(Block.AIR);
                }
            }
        }
    }
    return new Chunk(world, blocks, cx, cy, cz);
}

