// This variable exists only so we can test running things
// on world from the console. Code should never use this!
var WORLD;
(function () {
    var container, stats;

    var scene
    var renderer;
    container = document.getElementById('container');

    var mesh;
    var world;

    var clock = new THREE.Clock();
    var player;
    
    THREE.PerspectiveCamera.prototype.clone = function () {
        var newCam = new THREE.Camera();
        newCam.matrixWorldInverse = this.matrixWorldInverse.clone();
        newCam.projectionMatrix = this.projectionMatrix.clone();
        newCam.projectionMatrixInverse = this.projectionMatrixInverse.clone();
        newCam.position = this.position.clone();
        return newCam;
    }
    
    THREE.Camera.prototype.clone = function () {
        var newCam = new THREE.Camera();
        newCam.matrixWorldInverse = this.matrixWorldInverse.clone();
        newCam.projectionMatrix = this.projectionMatrix.clone();
        newCam.projectionMatrixInverse = this.projectionMatrixInverse.clone();
        newCam.position = this.position.clone();
        return newCam;
    }

    function init() {
        scene = new THREE.Scene();
        world = new World(scene);
        WORLD = world;
        
        var position = {};
        position.y = world.findClosestGround(0, 0, 0) + 2;
        position.x = 0;
        position.z = 0;
        
        player = new Player(position, world, container);
        
        var ambientLight = new THREE.AmbientLight(0xcccccc);
        scene.add(ambientLight);
        
        var directionalLight = new THREE.DirectionalLight(0xffffff, 2);
        directionalLight.position.set(1, 1, 0.5).normalize();
        scene.add(directionalLight);
        
        renderer = new THREE.WebGLRenderer();
        renderer.setSize(window.innerWidth, window.innerHeight);
        
        container.innerHTML = "";
        
        container.appendChild(renderer.domElement);
        
        stats = new Stats();
        stats.domElement.style.position = 'absolute';
        stats.domElement.style.top = '0px';
        container.appendChild(stats.domElement);
        
        window.addEventListener('resize', onWindowResize, false);
        
    }

    function onWindowResize() {
        player.resize();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }
    
    function minMag(a, b) {
        return Math.abs(a) < Math.abs(b) ? a : b;
    }
    
    function animate() {
        requestAnimationFrame(animate);
        
        var dt = clock.getDelta();
        player.update(dt);
        player.render(renderer, scene);
        stats.update();
    }
    
    init();
    animate();
}());