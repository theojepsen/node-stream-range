var StreamRange = require('./index.js'),
    async = require('async'),
    getRawBody = require('raw-body'),
    streamifier = require('streamifier');

function makeHugeBuffer(size) {
  var buff = new Buffer(size);
  var garbage = new Buffer("mx69,78;45sbma,379bkeax348al/9,.ubad7037/9',4scda-,.py90k823[di96;<.4,w'30/m/amtnstnaoygh89l'p0<loeuid'a]/40ya-rbk45g/akuh'5bg9]k0'937");
  for (var i = 0; i < buff.length; i += garbage.length) {
    garbage.copy(buff, i);
  }
  return buff;
}

var bigBuffer = makeHugeBuffer(1024 * 1024 * 50); // 50M
var i, count = 100;

function doNormal(cb) {
  getRawBody(streamifier.createReadStream(bigBuffer), function (err, buff) {
    cb();
  });
}

function doStreamRange(cb) {
  getRawBody(streamifier.createReadStream(bigBuffer).pipe(StreamRange(0, bigBuffer.length)), function (err, buff) {
    cb();
  });
}

function doBufferedStream(cb) {
  var bs = StreamRange.BufferedStream(1024 * 1024 * 50);
  streamifier.createReadStream(bigBuffer).pipe(bs);
  getRawBody(bs.range(0, bigBuffer.length), function (err, buff) {
    cb();
  });
}


var normals = [];
for (i = 0; i < count; i++)  normals.push(doNormal);

var streamranges = [];
for (i = 0; i < count; i++)  streamranges.push(doStreamRange);

var bufferedstreams = [];
for (i = 0; i < count; i++)  bufferedstreams.push(doBufferedStream);

async.waterfall([
function (cb) {
  console.time('Normal');
  async.waterfall(normals, function () {
    console.timeEnd('Normal');
    cb();
  });
},
function (cb) {
  console.time('StreamRange');
  async.waterfall(streamranges, function () {
    console.timeEnd('StreamRange');
    cb();
  });
},
function (cb) {
  console.time('BufferedStream');
  async.waterfall(bufferedstreams, function () {
    console.timeEnd('BufferedStream');
    cb();
  });
}]);

