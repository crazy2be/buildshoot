define(function (require) {
	var THREE = require("THREE");

	var CanvasViewBase = require("./canvasViewBase");
	var __extends = require("core/extends");
	var __super = CanvasViewBase;
	__extends(HistoryBufferBar, __super);

	function HistoryBufferBar(drawFunc) {
		var self = this;

		//Call super constructor first
		if (localStorage.hpBars) {
			__super.call(self, 2, 0.1);
		} else {
			__super.call(self, 2, 0.3);
		}

		self.PRIVATE_drawFunc = drawFunc;

		self.faceViewOnAxis("x");
		self.faceViewOnAxis("y");
		self.faceViewOnAxis("z");

		var playerOffset = localStorage.hpBars ? 
			new THREE.Vector3(0, 0.20, 0) :
			new THREE.Vector3(0, 0.40, 0);

		self.trackPlayer(playerOffset);
	}

	HistoryBufferBar.prototype.fixToPlayer = function () {
		return false;
	}

	var throttle = 0;
	HistoryBufferBar.prototype.update = function (entity, clock, viewFacingPos) {
		__super.prototype.update.call(this, entity, clock, viewFacingPos);

		var ctx = this.ctx;
		ctx.clearRect(0, 0, this.canvasWidth(), this.canvasHeight());
		this.PRIVATE_drawFunc(ctx, clock.entityTime(), this.canvasWidth(), this.canvasHeight());

		this.updateCanvas();
	}

	return HistoryBufferBar;
});