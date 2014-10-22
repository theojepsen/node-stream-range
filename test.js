var StreamRange = require('./');
var Stream = require('stream');
var streamifier = require('streamifier');
var getRawBody = require('raw-body');
var brake = require('brake');
var async = require('async');
var expect = require('expect.js');
var bufferEqual = require('buffer-equal');


var string36 = "0123456789abcdefghijklmnopqrstuvwxyz";

function makeHugeBuffer(size) {
  var buff = new Buffer(size);
  var garbage = new Buffer("mx69,78;45sbma,379bkeax348al/9,.ubad7037/9',4scda-,.py90k823[di96;<.4,w'30/m/amtnstnaoygh89l'p0<loeuid'a]/40ya-rbk45g/akuh'5bg9]k0'937");
  for (var i = 0; i < buff.length; i += garbage.length) {
    garbage.copy(buff, i);
  }
  return buff;
}

var bigBuffer = makeHugeBuffer(1024 * 1024 * 10); // 10M

describe('Unbuffered Streams', function () {
  
  describe('API', function () {
    it('should take some arguments', function (done) {
      var sr = StreamRange(2, 123);
      expect(sr._start).to.be(2);
      expect(sr._end).to.be(123);
      expect(sr.unbufferedStream).to.not.be.ok();
      done();
    });

    it('should take an options hash', function (done) {
      var sr = StreamRange({start: 2, end: 123});
      expect(sr._start).to.be(2);
      expect(sr._end).to.be(123);
      expect(sr.unbufferedStream).to.not.be.ok();
      done();
    });

    it('should take some arguments and stream', function (done) {
      var stream1 = streamifier.createReadStream(string36);
      var sr = StreamRange(stream1, 2, 123);
      expect(sr._start).to.be(2);
      expect(sr._end).to.be(123);
      expect(sr.unbufferedStream).to.be(stream1);
      done();
    });

    it('should take an options hash and stream', function (done) {
      var stream1 = streamifier.createReadStream(string36);
      var sr = StreamRange({stream: stream1, start: 2, end: 123});
      expect(sr._start).to.be(2);
      expect(sr._end).to.be(123);
      expect(sr.unbufferedStream).to.be(stream1);
      done();
    });

    it('should not accept invalid arguments', function (done) {
      var stream1 = streamifier.createReadStream(string36);
      expect(StreamRange).withArgs('hi').to.throwException(/invalid argument/);
      expect(StreamRange).withArgs(0, '12').to.throwException(/invalid argument/);
      expect(StreamRange).withArgs('0', 12).to.throwException(/invalid argument/);
      expect(StreamRange).withArgs('hi', 0, 12).to.throwException(/invalid argument/);
      expect(StreamRange).withArgs({}, 0, 12).to.throwException(/invalid argument/);
      done();
    });

    it('should not accept invalid options in hash', function (done) {
      var stream1 = streamifier.createReadStream(string36);
      expect(StreamRange).withArgs({stream: {}, start: 2, end: 123}).to.throwException(/invalid argument/);
      expect(StreamRange).withArgs({stream: stream1, start: '2', end: 123}).to.throwException(/invalid argument/);
      expect(StreamRange).withArgs({stream: stream1, start: 2, end: '123'}).to.throwException(/invalid argument/);
      expect(StreamRange).withArgs({stream: stream1, end: '123'}).to.throwException(/invalid argument/);
      done();
    });

  });

  it('should get a range from 0 to 5', function (done) {
    var stream1 = streamifier.createReadStream(string36);
    getRawBody(StreamRange(stream1, 0, 5), function (err, buff) {
      expect(buff.length).to.be(5);
      expect(buff.toString()).to.be(string36.substr(0, 5));
      done();
    });
  });

  it('should get a range from 5 to 12', function (done) {
    var stream2 = streamifier.createReadStream(string36);
    getRawBody(StreamRange(stream2, 5, 12), function (err, buff) {
      expect(buff.length).to.be(7);
      expect(buff.toString()).to.be(string36.substr(5, 7));
      done();
    });
  });

  it('should get a range from 0 to Infinity', function (done) {
    var stream3 = streamifier.createReadStream(string36);
    getRawBody(StreamRange(stream3, 0, Infinity), function (err, buff) {
      expect(buff.length).to.be(string36.length);
      expect(buff.toString()).to.be(string36);
      done();
    });
  });

  it('should get a range from 6 to Infinity', function (done) {
    var stream3 = streamifier.createReadStream(string36);
    getRawBody(StreamRange(stream3, 6, Infinity), function (err, buff) {
      expect(buff.length).to.be(string36.length - 6);
      expect(buff.toString()).to.be(string36.substr(6, string36.length-6));
      done();
    });
  });

  it('should be piped to', function (done) {
    var stream1 = streamifier.createReadStream(string36);
    getRawBody(stream1.pipe(StreamRange(0, 5)), function (err, buff) {
      expect(buff.length).to.be(5);
      expect(buff.toString()).to.be(string36.substr(0, 5));
      done();
    });
  });

  it('should pipe to another stream', function (done) {
    var stream1 = streamifier.createReadStream(string36);
    getRawBody(stream1.pipe(StreamRange(0, 5)).pipe(new Stream.PassThrough()), function (err, buff) {
      expect(buff.length).to.be(5);
      expect(buff.toString()).to.be(string36.substr(0, 5));
      done();
    });
  });

});

describe('Buffered Streams', function () {

  describe('API', function () {
    it('should take arguments', function (done) {
      var bs1 = StreamRange.BufferedStream(123);
      expect(bs1.buffer.length).to.be(123);
      var bs2 = StreamRange.BufferedStream(123, 9);
      expect(bs2.buffer.length).to.be(123);
      expect(bs2.growFactor).to.be(9);
      done();
    });

    it('should take an options hash', function (done) {
      var bs1 = StreamRange.BufferedStream({size: 123});
      expect(bs1.buffer.length).to.be(123);
      var bs2 = StreamRange.BufferedStream({size: 123, growFactor: 9});
      expect(bs2.buffer.length).to.be(123);
      expect(bs2.growFactor).to.be(9);
      done();
    });

    it('should not accept growSize and growFactor', function (done) {
      expect(StreamRange.BufferedStream).withArgs({size: 123, growFactor: 9, growSize: 3}).to.throwException();
      done();
    });

    it('should not accept invalid values', function (done) {
      expect(StreamRange.BufferedStream).withArgs('123').to.throwException(/invalid argument/);
      expect(StreamRange.BufferedStream).withArgs(123, 'aoeu').to.throwException(/invalid argument/);
      expect(StreamRange.BufferedStream).withArgs({size: -123}).to.throwException(/invalid argument/);
      expect(StreamRange.BufferedStream).withArgs({size: '123'}).to.throwException(/invalid argument/);
      expect(StreamRange.BufferedStream).withArgs({growSize: {}}).to.throwException(/invalid argument/);
      expect(StreamRange.BufferedStream).withArgs({growFactor: function () {}}).to.throwException(/invalid argument/);
      expect(StreamRange.BufferedStream).withArgs({growFactor: 2, growSize: 3}).to.throwException(/invalid argument/);
      expect(StreamRange.BufferedStream).withArgs({growFactor: 0.3}).to.throwException(/invalid argument/);
      expect(StreamRange.BufferedStream).withArgs({growSize: -2}).to.throwException(/invalid argument/);
      done();
    });

    it('should use chained .from().to() syntax', function (done) {
      var bs = StreamRange.BufferedStream(1024 * 1024 * 1);
      var stringstream = streamifier.createReadStream(string36);
      stringstream.pipe(bs);
      getRawBody(bs.from(0).to(10), function (err, buff) {
        expect(buff.length).to.be(10);
        expect(buff.toString()).to.be(string36.substr(0, 10));
        done();
      });
    });
  });

  it('should buffer from 0 to 10', function (done) {
    var bs = StreamRange.BufferedStream(1024 * 1024 * 1);
    var stringstream = streamifier.createReadStream(string36);
    stringstream.pipe(bs);
    getRawBody(bs.range(0, 10), function (err, buff) {
      expect(buff.length).to.be(10);
      expect(buff.toString()).to.be(string36.substr(0, 10));
      done();
    });
  });

  it('should wait for data to arrive and emit it', function (done) {
    var bs = StreamRange.BufferedStream(1024 * 1024 * 1);
    var stringstream = streamifier.createReadStream(string36);
    stringstream.pipe(brake(10, 100)).pipe(bs);
    getRawBody(bs.range(0, 10), function (err, buff) {
      expect(buff.length).to.be(10);
      expect(buff.toString()).to.be(string36.substr(0, 10));
      done();
    });
  });

  it('should pipe to multiple consumers', function (done) {
    var bs = StreamRange.BufferedStream(1024 * 1024 * 1);
    var stringstream = streamifier.createReadStream(string36);
    stringstream.pipe(brake(10, 100)).pipe(bs);
    async.parallel([function (cb) {
      getRawBody(bs.range(0, 10), function (err, buff) {
        expect(buff.length).to.be(10);
        expect(buff.toString()).to.be(string36.substr(0, 10));
        cb();
      });
    }, function (cb) {
      getRawBody(bs.range(5, 15), function (err, buff) { // overlap with the other range
        expect(buff.length).to.be(10);
        expect(buff.toString()).to.be(string36.substr(5, 10));
        cb();
      });
    }], done);
  });

  it('should pipe to another stream', function (done) {
    var bs = StreamRange.BufferedStream(1024 * 1024 * 1);
    var stringstream = streamifier.createReadStream(string36);
    stringstream.pipe(bs);
    getRawBody(bs.range(0, 10).pipe(new Stream.PassThrough()), function (err, buff) {
      expect(buff.length).to.be(10);
      expect(buff.toString()).to.be(string36.substr(0, 10));
      done();
    });
  });

  it('should grow buffer by constant size', function (done) {
    var bs = StreamRange.BufferedStream({size: 1024, growSize: 50});
    var bigstream = streamifier.createReadStream(bigBuffer);
    bigstream.pipe(bs);
    getRawBody(bs.range(bigBuffer.length - 40, bigBuffer.length - 1), function (err, buff) {
      expect(buff.length).to.be(39);
      expect(bufferEqual(buff, bigBuffer.slice(bigBuffer.length - 40, bigBuffer.length - 1))).to.be.ok();
      expect(bs.buffer.length).to.be.within(bigBuffer.length, Infinity);
      done();
    });
  });

  it('should grow buffer by a factor', function (done) {
    var bs = StreamRange.BufferedStream({size: 1024, growFactor: 1.5});
    var bigstream = streamifier.createReadStream(bigBuffer);
    bigstream.pipe(bs);
    getRawBody(bs.range(bigBuffer.length - 40, bigBuffer.length - 1), function (err, buff) {
      expect(buff.length).to.be(39);
      expect(bufferEqual(buff, bigBuffer.slice(bigBuffer.length - 40, bigBuffer.length - 1))).to.be.ok();
      expect(bs.buffer.length).to.be.within(bigBuffer.length, Infinity);
      done();
    });
  });

});
