function ChunkManager(scene, conn, player) {
    var self = this;

    conn.on('player-id', startChunkConn);

    var chunks = {};
    var geometryWorker = new Worker('js/chunks/worker.js');

    self.chunk = function (cc) {
        return chunks[ccStr(cc)];
    }

    var accumulatedTime = 0;
    self.update = function (dt) {
        accumulatedTime += dt;
        if (accumulatedTime > 1) {
            accumulatedTime -= 1;
            var p = player.pos();
            geometryWorker.postMessage({
                'kind': 'player-position',
                'payload': {
                    'pos': {x: p.x, y: p.y, z: p.z},
                },
            })
        }

    }

    self.queueBlockChange = function (wx, wy, wz, newType) {
        geometryWorker.postMessage({
            'kind': 'block-change',
            'payload': {
                'wc': {x: wx, y: wy, z: wz},
                'type': newType,
            }
        });
    }

    geometryWorker.onmessage = function (e) {
        var payload = e.data.payload;
        if (e.data.kind === 'chunk') {
            processChunk(payload);
        } else if (e.data.kind === 'show-chunk') {
            processShowChunk(payload);
        } else if (e.data.kind === 'hide-chunk') {
            processHideChunk(payload);
        }
    }

    function startChunkConn(payload) {
        var id = payload.id;
        geometryWorker.postMessage({
            'kind': 'start-conn',
            'payload': {
                'uri': getWSURI('/ws/chunks/' + id),
            },
        })
    }

    function processChunk(payload) {
        var geometry = new THREE.BufferGeometry();
        geometry.attributes = payload.attributes;
        geometry.offsets = payload.offsets;

        var cc = payload.ccpos;

        var chunk = self.chunk(cc);
        if (chunk) chunk.remove();

        chunk = new Chunk(payload.blocks, geometry, scene);
        chunks[ccStr(cc)] = chunk;

        console.log("Added chunk at ", cc);
    }

    function processShowChunk(payload) {
        var chunk = self.chunk(payload.ccpos);
        if (!chunk) {
            console.warn("Got show chunk command for chunk that is not loaded. Likely server bug.");
            return;
        }

        chunk.show();
    }

    function processHideChunk(payload) {
        var chunk = self.chunk(payload.ccpos);
        if (!chunk) {
            console.warn("Got hide chunk command for chunk that is not loaded. Likely server bug.");
            return;
        }

        chunk.hide();
    }
}
