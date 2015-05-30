define(function(require){

var THREE = require("THREE");
var common = require("chunks/chunkCommon");
var CHUNK = common.CHUNK;

var Body = require("physics/body");
var EntityState = require("entities/model/entityState");
var Health = require("entities/model/health");
var BioticState = require("entities/model/bioticState");
var WorldItemState = require("entities/model/worldItemState");
var Biotic = require("entities/biotic");

var Protocol = {
	MSG_HANDSHAKE_REPLY:    0,
	MSG_HANDSHAKE_ERROR:    1,
	MSG_ENTITY_CREATE:      2,
	MSG_ENTITY_STATE:       3,
	MSG_ENTITY_REMOVE:      4,
	MSG_CHUNK:              5,
	MSG_BLOCK:              6,
	MSG_CONTROLS_STATE:     7,
	MSG_CHAT:               8,
	MSG_DEBUG_RAY:          9,
	MSG_NTP_SYNC:          10,
	MSG_INVENTORY_STATE:   11,
	MSG_INVENTORY_MOVE:    12,
	MSG_SCOREBOARD_ADD:    13,
	MSG_SCOREBOARD_SET:    14,
	MSG_SCOREBOARD_REMOVE: 15
};

Protocol.EntityKindPlayer = "player";
Protocol.EntityKindWorldItem = "worldItem";

Protocol.append = function(a, b) {
	var result = new Uint8Array(a.byteLength + b.byteLength);
	result.set(new Uint8Array(a), 0);
	result.set(new Uint8Array(b), a.byteLength);
	return result.buffer;
};

// Ported from varint.go
Protocol.marshalInt = function(x) {
	var buf = new Uint8Array(10);
	var ux = (x << 1) >>> 0;
	if (x < 0) {
		ux = ~ux;
	}

	var i = 0;
	while (ux >= 0x80) {
		buf[i++] = ux | 0x80;
		ux >>>= 7;
	}
	buf[i++] = ux;
	return buf.buffer.slice(0, i);
};

// Ported from varint.go
Protocol.unmarshalInt = function(offset, dataView) {
	function returnValue(ux, n) {
		var x = ux >>> 1;
		if (ux&1 !== 0) {
			x = ~x;
		}
		return { value: x, read: n };
	}

	var x = 0;
	var s = 0;
	var b;
	for (var i = 0; ; i++) {
		b = dataView.getUint8(offset + i);
		if (b < 0x80) {
			if (i > 9 || i === 9 && b > 1) {
				return returnValue(0, -(i + 1)); // overflow
			}
			return returnValue(x | (b << s) >>> 0, i + 1);
		}
		x |= ((b&0x7F) << s) >>> 0;
		s += 7;
	}
};

Protocol.marshalFloat64 = function(x) {
	var buf = new ArrayBuffer(8);
	var dataView = new DataView(buf);
	dataView.setFloat64(0, x);
	return buf;
};

Protocol.unmarshalFloat64 = function(offset, dataView) {
	return { value: dataView.getFloat64(offset), read: 8 }
};

Protocol.marshalString = function(s) {
	var utf8 = unescape(encodeURIComponent(s));
	var result = Protocol.marshalInt(utf8.length);
	console.log(result.length, utf8.length);

	var buf = new ArrayBuffer(utf8.length);
	var bufView = new Uint8Array(buf);
	for (var i = 0, len = utf8.length; i < len; i++) {
		bufView[i] = utf8.charCodeAt(i);
	}
	return Protocol.append(result, buf);
};

Protocol.unmarshalString = function(offset, dataView) {
	function uintToString(uintArray) {
		var encodedString = String.fromCharCode.apply(null, uintArray);
		return decodeURIComponent(escape(encodedString));
	}
	var returned = Protocol.unmarshalInt(offset, dataView);
	return { value: uintToString(
				new Uint8Array(
					dataView.buffer.slice(offset + returned.read, offset + returned.read + returned.value))),
			 read: returned.value + returned.read }
};

Protocol.unmarshalVec3 = function(offset, dataView) {
	return { value: new THREE.Vector3(dataView.getFloat64(offset),
	                                  dataView.getFloat64(offset + 8),
									  dataView.getFloat64(offset + 16)),
			 read: 24 }
};

Protocol.unmarshalBody = function(offset, dataView) {
	var posResult = Protocol.unmarshalVec3(offset, dataView);
	offset += posResult.read;
	var velResult = Protocol.unmarshalVec3(offset, dataView);
	offset += velResult.read;
	var dirResult = Protocol.unmarshalVec3(offset, dataView);
	offset += dirResult.read;
	var halfExtentsResult = Protocol.unmarshalVec3(offset, dataView);
	offset += halfExtentsResult.read;
	var centerOffsetResult = Protocol.unmarshalVec3(offset, dataView);
	return { value: new Body(posResult.value, velResult.value, dirResult.value,
							 halfExtentsResult.value, centerOffsetResult.value),
	         read: posResult.read + velResult.read + dirResult.read + halfExtentsResult.read
	               + centerOffsetResult.read }
};

Protocol.unmarshalEntityState = function(offset, dataView) {
	var entityIdResult = Protocol.unmarshalString(offset, dataView);
	offset += entityIdResult.read;
	var bodyResult = Protocol.unmarshalBody(offset, dataView);
	offset += bodyResult.read;
	var lastUpdatedResult = Protocol.unmarshalFloat64(offset, dataView);
	return { value: new EntityState(entityIdResult.value, bodyResult.value, lastUpdatedResult.value),
		     read: entityIdResult.read + bodyResult.read + lastUpdatedResult.read }
};

Protocol.unmarshalHealth = function(offset, dataView) {
	var result = Protocol.unmarshalInt(offset, dataView);
	return { value: new Health(result.value), read: result.read }
};

Protocol.unmarshalBioticState = function(offset, dataView) {
	var entityStateResult = Protocol.unmarshalEntityState(offset, dataView);
	offset += entityStateResult.read;
	var healthResult = Protocol.unmarshalHealth(offset, dataView);
	return { value: new BioticState(entityStateResult.value, healthResult.value),
			 read: entityStateResult.read + healthResult.read }
};

Protocol.unmarshalWorldItemState = function(offset, dataView) {
	var entityResult = Protocol.unmarshalEntityState(offset, dataView);
	offset += entityResult.read;
	return { value: new WorldItemState(entityResult.value, dataView.getUint8(offset)),
	         read: entityResult.read + 1 }
};

Protocol.unmarshalPlayerEntity = function(offset, dataView) {
	var result = Protocol.unmarshalBioticState(offset, dataView);
	return { value: new Biotic(result.value), read: result.read }
};


Protocol.unmarshalState = function(offset, dataView, kind) {
	var result;
	if (kind === Protocol.EntityKindPlayer) {
		result = Protocol.unmarshalBioticState(offset, dataView);
	} else if (kind === Protocol.EntityKindWorldItem) {
		result = Protocol.unmarshalWorldItemState(offset, dataView);
	}
	return result;
}

Protocol.MsgHandshakeReply = {
	fromProto: function(dataView) {
		var result = {};
		var offset = 1;
		var proto = Protocol.unmarshalFloat64(offset, dataView);
		result.serverTime = proto.value;
		offset += proto.read;
		proto = Protocol.unmarshalString(offset, dataView);
		result.clientID = proto.value;
		offset += proto.read;
		proto = Protocol.unmarshalPlayerEntity(offset, dataView);
		result.playerEntity = proto.value;
		return result;
	}
};

Protocol.MsgHandshakeError = {
	fromProto: function(dataView) {
		var result = {};
		result.Message = Protocol.unmarshalString(1, dataView);
		return result;
	}
};

Protocol.MsgEntityCreate = {
	fromProto: function(dataView) {
		var result = {};
		var offset = 1;
		var proto = Protocol.unmarshalString(offset, dataView);
		result.id = proto.value;
		offset += proto.read;
		proto = Protocol.unmarshalString(offset, dataView);
		result.kind = proto.value;
		offset += proto.read;
		proto = Protocol.unmarshalState(offset, dataView, result.kind);
		result.state = proto.value;
		return result;
	}
};

Protocol.MsgEntityState = {
	fromProto: function(dataView) {
		var result = {};
		var offset = 1;
		var proto = Protocol.unmarshalString(offset, dataView);
		result.id = proto.value;
		offset += proto.read;
		proto = Protocol.unmarshalString(offset, dataView);
		result.kind = proto.value;
		offset += proto.read;
		proto = Protocol.unmarshalState(offset, dataView, result.kind);
		result.state = proto.value;
		return result;
	}
};

Protocol.MsgEntityRemove = {
	fromProto: function(dataView) {
		var result = {};
		var proto = Protocol.unmarshalString(1, dataView);
		result.id = proto.value;
		return result;
	}
};

Protocol.MsgChunk = {
	fromProto: function(dataView) {
		var result = {};
		result.cc = {};
		var offset = 1;
		var proto = Protocol.unmarshalInt(offset, dataView);
		result.cc.x = proto.value;
		offset += proto.read;
		proto = Protocol.unmarshalInt(offset, dataView);
		result.cc.y = proto.value;
		offset += proto.read;
		proto = Protocol.unmarshalInt(offset, dataView);
		result.cc.z = proto.value;
		offset += proto.read;

		proto = Protocol.unmarshalVec3(offset, dataView);
		result.size = proto.value;
		offset += proto.read;
		if (result.size.x != CHUNK.WIDTH ||
			result.size.y != CHUNK.HEIGHT ||
			result.size.z != CHUNK.DEPTH
		) {
			throw "Got chunk of size which does not match our expected chunk size!";
		}

		// Blocks are Block Types (see block.js)
		result.blocks = new Uint8Array(dataView.buffer.slice(offset,
				offset + dataView.byteOffset + dataView.byteLength));
		return result;
	}
};

Protocol.MsgBlock = {
	toProto: function(wcX, wcY, wcZ, newType) {
		var buf = new ArrayBuffer(1);
		var dataView = new DataView(buf);
		dataView.setUint8(0, Protocol.MSG_BLOCK);
		buf = Protocol.append(buf, Protocol.marshalInt(Math.floor(wcX)));
		buf = Protocol.append(buf, Protocol.marshalInt(Math.floor(wcY)));
		buf = Protocol.append(buf, Protocol.marshalInt(Math.floor(wcZ)));
		var temp = new ArrayBuffer(1);
		dataView = new DataView(temp);
		dataView.setUint8(0, newType);
		buf = Protocol.append(buf, temp);
		return new DataView(buf);
	},
	fromProto: function(dataView) {
		var result = {};
		result.pos = {};
		var offset = 1;
		var proto = Protocol.unmarshalInt(offset, dataView);
		result.pos.x = proto.value;
		offset += proto.read;
		proto = Protocol.unmarshalInt(offset, dataView);
		result.pos.y = proto.value;
		offset += proto.read;
		proto = Protocol.unmarshalInt(offset, dataView);
		result.pos.z = proto.value;
		offset += proto.read;
		result.type = dataView.getUint8(offset);
		return result;
	}
};

Protocol.MsgControlsState =  {
	toProto: function(controls, time, entityTime) {
		var buf = new ArrayBuffer(1);
		var dataView = new DataView(buf);
		dataView.setUint8(0, Protocol.MSG_CONTROLS_STATE);
		buf = Protocol.append(buf, Protocol.marshalInt(controls.controlFlags));
		buf = Protocol.append(buf, Protocol.marshalFloat64(controls.lat));
		buf = Protocol.append(buf, Protocol.marshalFloat64(controls.lon));
		buf = Protocol.append(buf, Protocol.marshalFloat64(time));
		buf = Protocol.append(buf, Protocol.marshalFloat64(entityTime));
		return new DataView(buf);
	}
};

Protocol.MsgChat = {
	toProto: function(text) {
		var buf = new ArrayBuffer(1);
		var dataView = new DataView(buf);
		dataView.setUint8(0, Protocol.MSG_CHAT);
		buf = Protocol.append(buf, Protocol.marshalString(text));
		return new DataView(buf);
	},
	fromProto: function(dataView) {
		var result = {};
		var offset = 1;
		var proto = Protocol.unmarshalString(offset, dataView);
		result.displayName = proto.value;
		offset += proto.read;
		proto = Protocol.unmarshalString(offset, dataView);
		result.message = proto.value;
		return result;
	}
};

Protocol.MsgDebugRay = {
	fromProto: function(dataView) {
		var result = {};
		var proto = Protocol.unmarshalVec3(1, dataView);
		result.pos = proto.value;
		return result;
	}
};

Protocol.MsgNtpSync = {
	toProto: function() {
		var buf = new ArrayBuffer(1);
		var dataView = new DataView(buf);
		dataView.setUint8(0, Protocol.MSG_NTP_SYNC);
		return dataView;
	},
	fromProto: function(dataView) {
		var result = {};
		var proto = Protocol.unmarshalFloat64(1, dataView);
		result.serverTime = proto.value;
		return result;
	}
};

Protocol.MsgInventoryState = {
	toProto: function(equippedLeft, equippedRight) {
		var buf = new ArrayBuffer(1);
		var dataView = new DataView(buf);
		dataView.setUint8(0, Protocol.MSG_INVENTORY_STATE);
		buf = Protocol.append(buf, Protocol.marshalInt(equippedLeft));
		buf = Protocol.append(buf, Protocol.marshalInt(equippedRight));
		return new DataView(buf);
	},
	fromProto: function(dataView) {
		var result = {};
		var offset = 1;
		var proto = Protocol.unmarshalInt(offset, dataView);
		var itemLength = proto.value;
		offset += proto.read;
		result.items = new Uint8Array(dataView.buffer.slice(offset, offset + itemLength));
		return result;
	}
};

Protocol.MsgInventoryMove = {
	toProto: function(from, to) {
		var buf = new ArrayBuffer(1);
		var dataView = new DataView(buf);
		dataView.setUint8(0, Protocol.MSG_INVENTORY_MOVE);
		buf = Protocol.append(buf, Protocol.marshalInt(parseInt(from)));
		buf = Protocol.append(buf, Protocol.marshalInt(parseInt(to)));
		return new DataView(buf);
	}
};

Protocol.MsgScoreboardAdd = {
	fromProto: function(dataView) {
		var result = {};
		var offset = 1;
		var proto = Protocol.unmarshalString(offset, dataView);
		result.name = proto.value;
		offset += proto.read;
		proto = Protocol.unmarshalInt(offset, dataView);
		result.score = proto.value;
		return result;
	}
};

Protocol.MsgScoreboardSet = {
	fromProto: function(dataView) {
		var result = {};
		var offset = 1;
		var proto = Protocol.unmarshalString(offset, dataView);
		result.name = proto.value;
		offset += proto.read;
		proto = Protocol.unmarshalInt(offset, dataView);
		result.score = proto.value;
		return result;
	}
};

Protocol.MsgScoreboardRemove = {
	fromProto: function(dataView) {
		var result = {};
		var offset = 1;
		var proto = Protocol.unmarshalString(offset, dataView);
		result.name = proto.value;
		return result;
	}
};

return Protocol;

});
