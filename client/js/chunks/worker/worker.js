// I use self for other things. Parent makes
// a lot more sense anyway.
var parent = self;

//Need to make threeVector basically work...
var THREE = {};
function Error(){}
var console = {};
console.warn = function(){}
THREE.Quaternion = function(){}
THREE.extend = function(){}

//Most of our required files are above us unfortunately...
importScripts(
    '../../1defaultSettings.js',
    '../../1localSettings.js',
//Have to ask Justin why it complains when I try to include three.min.js.
    'threeVector.js',
    'twoVector.js',
    '../../loopHelpers/loop.js',
    '../block.js',
    '../common.js',
    'simpleMesher.js',
    'greedyMesher.js',
    'chunkGeometry.js',
    'noise.js',
    '../../conn.js'
);

var console = {};
console.log = function (message) {
    parent.postMessage({
        kind: 'log',
        payload: message
    });
}

function sendChunk() {
    var chunk = manager.top();
    if (!chunk) return;
    var res = chunk.calculateGeometries();
    parent.postMessage({
        kind: 'chunk',
        payload: {
            blocks: chunk.blocks,
            ccpos: chunk.cc,
            geometries: res.geometries,
            quality: chunk.quality,
        }
    }, res.transferables);
    chunk.loaded = true;
    chunk.changed = false;
}

//This means we only update added and removed chunks 1000 / this rate per second.
setInterval(sendChunk, 50);

parent.onmessage = function (e) {
    if (e.data.kind === 'start-conn') {
        initConn(e.data.payload);
    } else if (e.data.kind === 'block-change') {
        processBlockChange(e.data.payload);
    } else if (e.data.kind === 'player-position') {
        processPlayerPosition(e.data.payload);
    } else {
        throw 'Warning: Unknown message recieved from parent!' + JSON.stringify(e.data);
    }
};

function initConn(payload) {
    var conn = new Conn(payload.uri);
    conn.on('chunk', processChunk);
}

var manager = new ChunkManager();

function processChunk(payload) {
    var size = payload.Size;
    if (size.X != CHUNK_WIDTH ||
        size.Y != CHUNK_HEIGHT ||
        size.Z != CHUNK_DEPTH
    ) {
        throw "Got chunk of size which does not match our expected chunk size!";
    }

    var cc = {
        x: payload.CCPos.X,
        y: payload.CCPos.Y,
        z: payload.CCPos.Z,
    };
    var data = payload.Data;

    //Blocks are Block Types (see block.js)
    //ChunkGeometry.block and .setBlock know how to transform 3D vertices
    //into indices in this array.
    var blocks = new Uint8Array(data.length);
    for (var i = 0; i < blocks.length; i++) {
        // 32 - Space character. Control characters
        // are not allowed in JSON strings.
        blocks[i] = data.charCodeAt(i) - 32;
    }

    var chunk = manager.get(cc);
    if (chunk) throw "Got chunk data twice! Server bug! Ignoring message..." + JSON.stringify(cc);

    chunk = new ChunkGeometry(cc, blocks, manager);
    manager.set(cc, chunk);
    manager.refreshNeighbouring(cc);
}

function processBlockChange(payload) {
    var pos = payload.Pos;
    var type = payload.Type;
    var x = pos.X, y = pos.Y, z = pos.Z;
    var coords = worldToChunk(x, y, z);
    var cc = coords.c;
    var oc = coords.o;

    var chunk = manager.get(cc);
    if (!chunk) {
        // Eventually this should be a throw, as the server
        // will filter block events to only cover chunks
        // we have loaded. However, for now, we get block
        // events for *all* chunks, not just loaded ones.
        // Thus, we have to ignore them here.
        return;
    }

    var block = chunk.block(oc.x, oc.y, oc.z);
    if (!block) throw "Cannot find block within chunk!";

    if (block === type) return;

    chunk.setBlock(oc.x, oc.y, oc.z, type);

    // Invalidate chunks
    var changedChunks = [];
    changedChunks.push(cc);

    //Takes block coords
    function invalidate(x, y, z) {
        coords = worldToChunk(x, y, z);
        changedChunks.push(coords.c);
    }

    //Invalidate the chunks of a bunch of blocks.
    //If they don't exist we ignore them later.
    invalidate(x + 1, y, z);
    invalidate(x - 1, y, z);
    invalidate(x, y + 1, z);
    invalidate(x, y - 1, z);
    invalidate(x, y, z + 1);
    invalidate(x, y, z - 1);

    changedChunks = unique(changedChunks);

    for (var i = 0; i < changedChunks.length; i++) {
        var cc = changedChunks[i];
        var chunk = manager.get(cc);
        if (!chunk) continue;
        chunk.changed = true;
        chunk.priority = 2;
    }
}

function unique(arr) {
    return arr.filter(function (val, i) {
        return arr.indexOf(val) === i;
    });
}

function processPlayerPosition(payload) {
    var p = payload.pos;
    var coords = worldToChunk(p.x, p.y, p.z);
    var cq = CHUNK_QUALITIES;

    manager.each(function (chunk) {
        var d = dist(coords.c, chunk.cc);

        var quality = cq[clamp(Math.floor(d/2), 0, cq.length - 1)];

        if (chunk.quality === quality || !chunk.loaded) return;

        chunk.quality = quality;
        parent.postMessage({
            'kind': 'chunk-quality-change',
            'payload': {
                'ccpos': chunk.cc,
                'quality': quality,
            },
        });
    });
}

function clamp(n, a, b) {
    return Math.min(Math.max(n, a), b);
}

function dist(p1, p2) {
    return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2) + Math.pow(p1.z - p2.z, 2));
}

function ChunkManager() {
    var self = this;
    var chunkList = {};

    self.get = function (cc) {
        return chunkList[ccStr(cc)];
    }

    self.set = function (cc, item) {
        chunkList[ccStr(cc)] = item;
    }

    self.top = function () {
        var highest = -1000;
        var key = "";
        for (var k in chunkList) {
            var item = chunkList[k];
            if (item.priority > highest
                && item.shown && item.changed
            ) {
                highest = item.priority;
                key = k;
            }
        }
        return chunkList[key];
    }

    self.each = function (cb) {
        for (var k in chunkList) {
            cb(chunkList[k])
        }
    }

    self.chunkAt = function (cx, cy, cz) {
        return self.get({x: cx, y: cy, z: cz});
    }

    self.refreshNeighbouring = function (cc) {
        var cx = cc.x;
        var cy = cc.y;
        var cz = cc.z;
        function r(cx, cy, cz) {
            var chunk = self.get({x: cx, y: cy, z: cz});
            if (chunk) chunk.changed = true;
        };
        r(cx + 1, cy, cz);
        r(cx - 1, cy, cz);
        r(cx, cy + 1, cz);
        r(cx, cy - 1, cz);
        r(cx, cy, cz + 1);
        r(cx, cy, cz - 1);
    }
}