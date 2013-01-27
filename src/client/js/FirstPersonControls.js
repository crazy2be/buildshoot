/**
 * @author mrdoob / http://mrdoob.com/
 * @author alteredq / http://alteredqualia.com/
 * @author paulirish / http://paulirish.com/
 */

THREE.FirstPersonControls = function (object, domElement) {
    this.object = object;
    this.target = new THREE.Vector3(0, 0, 0);

    this.domElement = (domElement !== undefined) ? domElement : document;

    this.movementSpeed = 1.0;
    this.lookSpeed = 0.005;

    this.heightCoef = 1.0;
    this.heightMin = 0.0;
    this.heightMax = 1.0;

    this.verticalMin = -Math.PI * 0.9;
    this.verticalMax = Math.PI * 0.9;

    this.movementX = 0;
    this.movementY = 0;

    this.lat = -45;
    this.lon = 0;
    this.phi = 0;
    this.theta = 0;

    this.moveForward = false;
    this.moveBackward = false;
    this.moveLeft = false;
    this.moveRight = false;
    this.freeze = false;

    this.viewHalfX = 0;
    this.viewHalfY = 0;

    if (this.domElement !== document) {
        this.domElement.setAttribute('tabindex', -1);
    }

    this.handleResize = function () {
        if (this.domElement === document) {
            this.viewHalfX = window.innerWidth / 2;
            this.viewHalfY = window.innerHeight / 2;
        } else {
            this.viewHalfX = this.domElement.offsetWidth / 2;
            this.viewHalfY = this.domElement.offsetHeight / 2;
        }
    };
    
    var havePointerLock = 'pointerLockElement' in document ||
            'mozPointerLockElement' in document ||
            'webkitPointerLockElement' in document;
    
    if (havePointerLock) {
        this.domElement.requestPointerLock = this.domElement.requestPointerLock ||
                this.domElement.mozRequestPointerLock ||
                this.domElement.webkitRequestPointerLock;
    } else {
        alert("You should probably use the latest Chrome or Firefox. Pointer lock is required");
    }

    this.onMouseDown = function (event) {
        if (this.domElement !== document) {
            this.domElement.focus();
        }

        event.preventDefault();
        event.stopPropagation();
        
        this.domElement.requestPointerLock();
    };

    this.onMouseUp = function (event) {
        event.preventDefault();
        event.stopPropagation();
        // TODO: Add use for this?
    };

    this.onMouseMove = function (event) {
        this.movementX += event.movementX ||
                event.mozMovementX        ||
                event.webkitMovementX     ||
                0;
        this.movementY += event.movementY ||
                event.mozMovementY        ||
                event.webkitMovementY     ||
                0;
    };
    
    this.mouseMoveFunction = bind(this, this.onMouseMove);
    
    this.onPointerLockChange = function () {
        if (document.pointerLockElement === this.domElement ||
                document.mozPointerLockElement === this.domElement ||
                document.webkitPointerLockElement === this.domElement) {
            // Pointer was just locked, enable the mousemove listener
            this.domElement.addEventListener('mousemove', this.mouseMoveFunction, false);
        } else {
            // Pointer was just unlocked, disable the mousemove listener
            this.domElement.removeEventListener('mousemove', this.mouseMoveFunction, false);
        }
    };

    this.onKeyDown = function (event) {
        switch (event.keyCode) {
            case 38: /*up*/
            case 87: /*W*/ this.moveForward = true; break;

            case 37: /*left*/
            case 65: /*A*/ this.moveLeft = true; break;

            case 40: /*down*/
            case 83: /*S*/ this.moveBackward = true; break;

            case 39: /*right*/
            case 68: /*D*/ this.moveRight = true; break;
        }
    };

    this.onKeyUp = function (event) {
        switch(event.keyCode) {
            case 38: /*up*/
            case 87: /*W*/ this.moveForward = false; break;

            case 37: /*left*/
            case 65: /*A*/ this.moveLeft = false; break;

            case 40: /*down*/
            case 83: /*S*/ this.moveBackward = false; break;

            case 39: /*right*/
            case 68: /*D*/ this.moveRight = false; break;
        }
    };

    this.update = function(dt) {
        var actualMoveSpeed = dt * this.movementSpeed;

        if (this.moveForward) {
            this.object.translateZ(-actualMoveSpeed);
        }
        if (this.moveBackward) {
            this.object.translateZ(actualMoveSpeed);
        }

        if (this.moveLeft) {
            this.object.translateX(-actualMoveSpeed);
        }
        if (this.moveRight) {
            this.object.translateX(actualMoveSpeed);
        }
        
        var actualLookSpeed = dt * this.lookSpeed;

        this.lon += this.movementX * 20 * actualLookSpeed;
        
        var verticalLookRatio = Math.PI / (this.verticalMax - this.verticalMin);
        this.lat -= this.movementY * 20 * actualLookSpeed * verticalLookRatio;
        
        this.movementX = 0;
        this.movementY = 0;

        this.lat = Math.max(-85, Math.min(85, this.lat));
        this.phi = THREE.Math.degToRad(90 - this.lat);

        this.theta = THREE.Math.degToRad(this.lon);
        this.phi = THREE.Math.mapLinear(this.phi, 0, Math.PI, this.verticalMin, this.verticalMax);

        var targetPosition = this.target;
        var position = this.object.position;

        targetPosition.x = position.x + 100 * Math.sin(this.phi) * Math.cos(this.theta);
        targetPosition.y = position.y + 100 * Math.cos(this.phi);
        targetPosition.z = position.z + 100 * Math.sin(this.phi) * Math.sin(this.theta);

        this.object.lookAt(targetPosition);
    };

    document.addEventListener('pointerlockchange', bind(this, this.onPointerLockChange), false);
    document.addEventListener('mozpointerlockchange', bind(this, this.onPointerLockChange), false);
    document.addEventListener('webkitpointerlockchange', bind(this, this.onPointerLockChange), false); 

    this.domElement.addEventListener('contextmenu', function (event) { event.preventDefault(); }, false);
    
    this.domElement.addEventListener('mousedown', bind(this, this.onMouseDown), false);
    this.domElement.addEventListener('mouseup', bind(this, this.onMouseUp), false);
    this.domElement.addEventListener('keydown', bind(this, this.onKeyDown), false);
    this.domElement.addEventListener('keyup', bind(this, this.onKeyUp), false);

    function bind(scope, fn) {
        return function () {
            fn.apply(scope, arguments);
        };
    };

    this.handleResize();
};
