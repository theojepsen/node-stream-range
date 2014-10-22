var Stream = require('stream');
var util = require('util');

function BufferedStream(size) {
  var self = this;

  self.buffer = new Buffer(size);
  self.growFactor = 2;
  self.growSize = undefined;

  self.cursor = 0;

  Stream.Writable.call(self);
}
util.inherits(BufferedStream, Stream.Writable);

function copyAllAvailable(self) {
  if (self.cursor === null) self.cursor = self._start;

  var buff;
  /* bufferedStream: ====================>
   * ReadRange:        |=====>------|
   */
  if (self.bufferedStream.cursor >= self._end) { // all already available
    buff = self.bufferedStream.buffer.slice(self.cursor, self._end);
    self.push(buff);
    self.cursor = self._end;
  }

  /* bufferedStream: ====================>
   * ReadRange:        |=====>-------------|
   */
  if (self.cursor < self.bufferedStream.cursor && self.bufferedStream.cursor <= self._end) {
    buff = self.bufferedStream.buffer.slice(self.cursor, self.bufferedStream.cursor);
    self.push(buff);
    self.cursor = self.bufferedStream.cursor;
  }

  if (self.cursor === self._end)
    self.push(null);
}

function ReadRange(bufferedStream, start, end) {
  var self = this;

  self.bufferedStream = bufferedStream;
  self._start = start || 0;
  self.cursor = null;
  self._end = end || Infinity;

  self.started = false;

  self.bufferedStream.on('finish', function () {
    self.push(null);
  });

  Stream.Readable.call(self);
}
util.inherits(ReadRange, Stream.Readable);

function growBuffer(self, minRequired) {
  var oldBuff = self.buffer;
  var newSize = self.growFactor ? self.buffer.length * self.growFactor : self.buffer.length + self.growSize;
  newSize = Math.max(newSize, minRequired);
  self.buffer = new Buffer(newSize);
  oldBuff.copy(self.buffer, 0);
}

BufferedStream.prototype._write = function (chunk, encoding, done) {
  var self = this;
  var prevCursor = self.cursor;
  if (self.cursor + chunk.length > self.buffer.length)
    growBuffer(self, self.cursor + chunk.length);
  chunk.copy(self.buffer, self.cursor);
  self.cursor += chunk.length;
  self.emit('data', chunk.length);
  done();
};

BufferedStream.prototype.range = function (start, end) {
  var self = this;
  var rr = new ReadRange(self, start, end);
  return rr;
};

ReadRange.prototype._read = function (size) {
  var self = this;
  if (self.started) return;
  self.started = true;
  copyAllAvailable(self);
  if (self.cursor != self._end) {
    self.bufferedStream.on('data', function (l) {
      copyAllAvailable(self);
    });
  }
};

ReadRange.prototype.to = function (pos) {
  this._end = pos;
  return this;
};
ReadRange.prototype.from = function (pos) {
  this._start = pos;
  return this;
};
BufferedStream.prototype.from = function (pos) {
  return this.range(pos, undefined);
};
BufferedStream.prototype.to = function (pos) {
  return this.range(undefined, pos);
};

function UnbufferedReadRange (unbufferedStream, start, end) {
  var self = this;

  self.unbufferedStream = unbufferedStream;
  self._start = start || 0;
  self._end = end || Infinity;

  self.cursor = self.start;
  self.seen = 0;

  Stream.Duplex.call(self);

  if (self.unbufferedStream) {
    self.unbufferedStream.on('data', function (chunk) {
      self.copyData(chunk);
    });
    self.unbufferedStream.on('end', function () {
      self.push(null);
    });
  } else
    self.on('finish', function () {
      self.push(null);
    });
}
util.inherits(UnbufferedReadRange, Stream.Duplex);

UnbufferedReadRange.prototype._read = function (size) {
  // no-op
};

UnbufferedReadRange.prototype.copyData = function (chunk) {
  var self = this;
  if (self.seen + chunk.length > self._start) {
    var a = self._start > self.seen ? self._start - self.seen : 0;
    var b = self.seen + chunk.length < self._end ? chunk.length : chunk.length - (self.seen + chunk.length - self._end);
    var buff = b - a === chunk.length ? chunk : chunk.slice(a, b);
    self.push(buff);
    self.cursor += b - a;
    if (self.cursor === self._end) {
      self.push(null);
      if (self.unbufferedStream)
        self.unbufferedStream.removeListener('data', self.copyData);
    }
  }
  self.seen += chunk.length;
};

UnbufferedReadRange.prototype._write = function (chunk, encoding, done) {
  this.copyData(chunk);
  done();
};

var StreamRange = module.exports = function () {
  var stream, start, end; 
  if (arguments.length === 1) {
    if (typeof arguments[0] !== 'object')
      throw new TypeError('StreamRange(): invalid argument: expected options hash');
    stream = arguments[0].stream; start = arguments[0].start; end = arguments[0].end;
  }
  else if (arguments.length > 1) {
    if (typeof arguments[0] === 'number') {
      start = arguments[0];
      end = arguments[1];
    } else {
      stream = arguments[0];
      start = arguments[1];
      end = arguments[2];
    }
  }
  else
    throw new TypeError('StreamRange(): invalid argument: read docs');

  if (stream !== undefined && (typeof stream !== 'object' || !stream.read))
    throw new TypeError('StreamRange(): invalid argument: `stream` must be a readable stream');
  if (start !== undefined && (typeof start !== 'number' || start < 0))
    throw new TypeError('StreamRange(): invalid argument: `start` must be a number greater than 0');
  if (end !== undefined && (typeof end !== 'number' || end < 0))
    throw new TypeError('StreamRange(): invalid argument: `end` must be a number greater than 0');
  if (start !== undefined && end !== undefined && start > end)
    throw new TypeError('StreamRange(): invalid argument: `end` must greater than `start`');

   return new UnbufferedReadRange(stream, start, end);
};

StreamRange.BufferedStream = function () {
  var size, growSize, growFactor;
  if (arguments.length === 1 && typeof arguments[0] === 'object') {
      size = arguments[0].size;
      growSize = arguments[0].growSize;
      growFactor = arguments[0].growFactor;
  } else {
    size = arguments[0];
    growFactor = arguments[1];
  }

  if (size && (typeof size !== 'number' || size < 0))
    throw new TypeError('StreamRange.BufferedStream(): invalid argument: `size` must be a non-negative number');
  if (growSize && (typeof growSize !== 'number' || growSize < 0))
    throw new TypeError('StreamRange.BufferedStream(): invalid argument: `growSize` must be a number greater than 0');
  if (growFactor && (typeof growFactor !== 'number' || growFactor < 1))
    throw new TypeError('StreamRange.BufferedStream(): invalid argument: `growFactor` must be a number greater than 1.0');
  if (growSize && growFactor)
    throw new TypeError('StreamRange.BufferedStream(): invalid arguments: cannot specify both `growFactor` and `growSize`');

  var bs = new BufferedStream(size || 1024);
  bs.growFactor = growSize ? undefined : growFactor || 2;
  bs.growSize = growSize;
  return bs;
};
