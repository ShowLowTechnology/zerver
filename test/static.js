var assert      = require('assert'),
	extend      = require('util')._extend,
	zlib        = require('zlib'),
	test        = require(__dirname+'/index'),
	StaticFiles = require(__dirname+'/../server/static');

var postfix = '\n# Zerver timestamp: '+new Date();

function testObj(options) {
	return function (root, callback) {
		var cache = new StaticFiles(
			root,
			extend({
				memoryCache : true,
				ignores     : '/zerver/',
			}, options),
			function () {
				process.nextTick(function () {
					callback(cache);
				});
			}
		);
	};
}



test.runTest(testObj({ disableManifest: true }), {
	'manifest.appcache' : 'CACHE MANIFEST\nmain.js',
}, function (cache, files, callback) {
	var data = cache.get('/manifest.appcache');
	assert.equal(data.body, files['manifest.appcache']);

	callback();
});
test.runTest(testObj({ ignoreManifest: 'manifest.appcache' }), {
	'manifest.appcache' : 'CACHE MANIFEST\nmain.js',
}, function (cache, files, callback) {
	var data = cache.get('/manifest.appcache');
	assert.equal(data.body, files['manifest.appcache']);

	callback();
});

test.runTest(testObj({ inline: true }), {
	'index.html'        : '<script src="main.js?inline=1"></script>',
	'manifest.appcache' : 'CACHE MANIFEST\nmain.js?inline=1',
	'main.js'           : 'console.log("hello, world");',
	'main.css'          : '#a{background-image:url(i.png?inline=1)}',
	'i.png'             : new Buffer('aaaa', 'base64'),
}, function (cache, files, callback) {
	var data1 = cache.get('/index.html');
	assert.equal(data1.body, '<script>//<![CDATA[\n'+files['main.js']+'\n//]]></script>');

	var data2 = cache.get('/manifest.appcache');
	assert.equal(data2.body, 'CACHE MANIFEST'+postfix);

	var data3 = cache.get('/main.css');
	assert.equal(data3.body, '#a{background-image:url(data:image/png;base64,aaaa)}');

	callback();
});

test.runTest(testObj({ concat: true }), {
	'index.html'        : '<!-- zerver:main2.js -->\n<script src="main.js"></script>\n<script src="main.js"></script>\n<!-- /zerver -->',
	'manifest.appcache' : 'CACHE MANIFEST\n# zerver:alt2.js\nalt.js\nalt.js\n# /zerver',
	'main.js'           : 'console.log("hello, world");',
	'alt.js'            : 'console.log("alt world");',
}, function (cache, files, callback) {
	var data1 = cache.get('/index.html');
	assert.equal(data1.body, '<script src="main2.js"></script>');

	var data2 = cache.get('/main2.js');
	assert.equal(data2.body, files['main.js']+'\n'+files['main.js']);

	var data3 = cache.get('/manifest.appcache');
	assert.equal(data3.body, 'CACHE MANIFEST\nalt2.js'+postfix);

	var data4 = cache.get('/alt2.js');
	assert.equal(data4.body, files['alt.js']+'\n'+files['alt.js']);

	callback();
});

test.runTest(testObj({ compile: true, inline: true }), {
	'index.html' : '<script src="main.js?inline=1"></script>',
	'main.js'    : 'console.log("hello, world");',
	'main.css'   : '#a { color : red }',
}, function (cache, files, callback) {
	var data1 = cache.get('/main.js');
	assert.equal(data1.body, 'console.log("hello, world")');

	var data2 = cache.get('/main.css');
	assert.equal(data2.body, '#a{color:red}');

	var data3 = cache.get('/index.html');
	assert.equal(data3.body, '<script>//<![CDATA[\nconsole.log("hello, world")\n//]]></script>');

	callback();
});

test.runTest(testObj({ gzip: true }), {
	'index.html' : '<script src="main.js?inline=1"></script>',
	'main.js'    : 'console.log("hello, world");',
	'main.css'   : '#a { color : red }',
	'i.png'      : new Buffer('aaaa', 'base64'),
}, function (cache, files, callback) {
	var data1 = cache.get('/index.html');
	zlib.gzip(files['index.html'], function (_, body) {
		assert.deepEqual(data1.body, body);
	});

	var data2 = cache.get('/main.js');
	zlib.gzip(files['main.js'], function (_, body) {
		assert.deepEqual(data2.body, body);
	});

	var data3 = cache.get('/main.css');
	zlib.gzip(files['main.css'], function (_, body) {
		assert.deepEqual(data3.body, body);
	});

	var data4 = cache.get('/i.png');
	assert.deepEqual(data4.body, files['i.png']);

	callback();
});
