define(function(require) {

var async = require("async");

var Conn = require("core/conn");
var Clock = require("core/clock");
var Controls = require("player/controls");
var FeatureTester = require("featureTester");
var Models = require("models");

var World = require("core/world");
var Protocol = require("core/protocol");

var PlayerUI = require("player/playerUI");
var EntityManager = require("entities/entityManager");

var PerfChart = require("perf/chart");
var movement = require("player/movement");
var EntityInputPredictor = require("entities/entityInputPredictor");

var fatalError = require("fatalError");

function main () {
	var container = document.getElementById('container');
	var tester = new FeatureTester();
	tester.run();
	if (!tester.pass()) {
		container.innerHeight = '';
		container.appendChild(tester.errors());
		return;
	}

	//We use this to expose certain variables for test code.
	window.testExposure = { };

	//Connect to server and shake our hands.
	var conn = new Conn(Conn.socketURI("main"));
	var clock = new Clock(conn);
	var clientID;
	var playerEntity;

	// DOIT: Proto testing
	//var append = Protocol.append;
	//conn.on(0, function(dataView) {
	//	var result = Protocol.unmarshalString(1, dataView);
	//	console.log("Got reply:", result.value);
	//});
	//var buf = new ArrayBuffer(1);
	//var dataView = new DataView(buf);
	//dataView.setUint8(0, 0);
	//buf = append(buf, Protocol.marshalString("Hello, world! こんにちは世界! 𠜎"));
	//conn.queue(new DataView(buf));
	//console.log("Sent:", "Hello, world! こんにちは世界! 𠜎");
	//return;

	async.parallel([
		function (callback) {
			Models.init(callback);
		},
		function (callback) {
			conn.on(Protocol.MSG_HANDSHAKE_REPLY, function(dataView) {
				console.log("Got handshake reply");
				var offset = 1;
				var result = Protocol.unmarshalFloat64(offset, dataView);
				clock.init(result.value);
				offset += result.read;
				result = Protocol.unmarshalString(offset, dataView);
				clientID = result.value;
				offset += result.read;
				playerEntityResult = EntityManager.createPlayerEntity(offset, dataView);
				playerEntity = playerEntityResult.value;
				offset += playerEntityResult.read;
				conn.setImmediate(false);
				callback();
			});
			conn.on(Protocol.MSG_HANDSHAKE_ERROR, function (dataView) {
				console.log("Got handshake error");
				var result = Protocol.unmarshalString(1, dataView);
				throw result.value;
			});
		}
	], function (err, results) {
		startGame();
	});

	function makePlayerController(world) {
		function collides(box, pos) {
			box.setPosition(pos);
			return box.collides(world);
		}
		var predictor = movement.simulate.bind(null, collides);
		var controller = new EntityInputPredictor(playerEntity, predictor);
		return controller;
	}

	function startGame() {
		var scene = new THREE.Scene();
		var ambientLight = new THREE.AmbientLight(0xffffff);
		scene.add(ambientLight);

		var world = new World(scene, conn, clientID, clock);
		var controls = new Controls(container);

		var playerController = makePlayerController(world);
		var playerUI = new PlayerUI(world, conn, clock, container, controls, playerEntity,
				playerController);
		world.setPlayer(clientID, playerEntity, playerController);

		window.testExposure.playerUI = playerUI;
		window.testExposure.world = world;

		var previousTime = clock.time();
		animate();
		function animate() {
			clock.update();
			var newTime = clock.time();
			var dt = newTime - previousTime;
			previousTime = newTime;

			conn.update();

			playerUI.update(dt);

			//Unfortunately this means our data relies partially on having a Player.
			//Think of this as an optimization, if our data focuses on where our Player is located,
			//it can more efficiently handle queries.
			world.update(dt, playerEntity.pos());

			playerUI.render(scene);

			if (fatalError.fatalErrorTriggered) return;
			requestAnimationFrame(animate);
		}
	}
}
return main;
});
