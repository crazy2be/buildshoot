function EntityManager(scene, conn) {
	var self = this;

	var entities = {};

	conn.on('entity-create', function (payload) {
		var id = payload.ID;
		if (entities[id]) {
			console.warn("Got entity-create message for entity which already exists!", id);
			return;
		}
		var entity = new Entity(id);
		entity.addTo(scene);
		entities[id] = entity;
	});

	conn.on('entity-position', function (payload) {
		var id = payload.ID;
		var entity = entities[id];
		if (!entity) {
			console.warn("Got entity-position message for entity which does not exist!", id);
			return;
		}
		//Hopefully this can eventually be directly loaded, and then every tick a simple
		//entity.Update() can be called.
		entity.setPos(new THREE.Vector3(
			payload.Pos.X,
			payload.Pos.Y,
			payload.Pos.Z
		));
		entity.setRot(new THREE.Vector3(
			payload.Rot.X,
			payload.Rot.Y,
			payload.Rot.Z
		));
		entity.setHealth(payload.Health);
	});

	conn.on('entity-remove', function (payload) {
		var id = payload.ID;
		var entity = entities[id];
		if (!entity) {
			console.warn("Got entity-remove message for entity which does not exist: ", id);
		}
		entity.removeFrom(scene);
		delete entities[id];
	});

	self.entityAt = function (wx, wy, wz) {
		for (var id in entities) {
			var entity = entities[id];
			if (entity.contains(wx, wy, wz)) {
				return entity;
			}
		}
	};

	//I am pretty sure this is okay to have.
	self.getEntityByID = function (entityID) {
		return entities[entityID];
	};

	//Eventually this should probably be more directly exposed
	//Returns [{pos, hp, maxHP}]
	self.getEntityInfos = function () {
		var infos = [];
		for (var id in entities) {
			var entity = entities[id];
			infos.push({
				pos: entity.pos(),
				id: entity.id(),
				hp: entity.health(),
				maxHP: 100 //TODO: Don't hardcode this...
			});
		}
		return infos;
	}
}
