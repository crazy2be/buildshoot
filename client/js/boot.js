﻿requirejs.config({
	//We need paths because min files are annoying to handle with magicWrapper...
	paths: {
		THREE: '/lib/THREE.min',
		$: 'lib/jquery.min'

		/*
		<script src="lib/three.min.js"></script>
		<script src="lib/jquery.min.js"></script>
		<script src="lib/jquery-ui.min.js"></script>
		<script src="lib/jquery.waitforimages.min.js"></script>
		<script src="lib/async.js"></script>
		*/
	},
	//We need shims independently of the min problem.
	shim: {
		THREE: {
			exports: 'THREE'
		},
		$: {
			exports: $
		}
	},
	packages: [{
		name: 'chunkManager',
		location: '/js/chunks',
		main: 'chunkManager',
	}],
});

require(["main"], function(main) {
	main();
});