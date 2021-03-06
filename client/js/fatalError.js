define(function(require) {
	function fatalError(err) {
		var container = document.getElementById('container');
		container.classList.add('error');

		var elm = splash.querySelector('.contents');
		html = [
			"<h1>Fatal Error!</h1>",
			"<p>",
				err.filename || err.fileName,
				" (",
					err.lineno || err.lineNumber,
				"):",
			"</p>",
			"<p>",
				err.message,
			"</p>",
			"<p>Press F5 to attempt a rejoin</p>",
		].join("\n");
		elm.innerHTML = html;

		exitPointerLock();
		fatalError.fatalErrorTriggered = true;
		function exitPointerLock() {
			(document.exitPointerLock ||
			document.mozExitPointerLock ||
			document.webkitExitPointerLock).call(document);
		}
	}

	fatalError.fatalErrorTriggered = false;

	return fatalError;
});