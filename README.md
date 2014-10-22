Stream Range
============
Read a specific range (slice) of a stream:

```javascript
var StreamRange = require('stream-range'),
    streamifier = require('streamifier');

// Extract the middle word
streamifier.createReadStream('slovenly')
  .pipe(StreamRange(1, 5))
  .pipe(process.stdout); // love
```

Unbuffered Streams
------------------
StreamRange does not buffer tho whole stream internally, but just spits
out what it receives, within the from-to range specified.

Buffered Streams
----------------
If you would like to buffer the data, you can pipe a stream into
`StreamRange.BufferedStream`, and then pipe a range out of that. For
example:

```javascript
// Use a buffered stream with multiple consumers
var bs = StreamRange.BufferedStream();
streamifier.createReadStream('0123456789').pipe(bs);

bs.range(0, 6).pipe(process.stdout); // 012345
bs.from(3).to(9).pipe(process.stdout); // 345678
bs.from(5).pipe(process.stdout); // 56789
```

This lets you have multiple consumers on the same stream.

### Growing internal buffer
`StreamRange.BufferedStream` uses a `Buffer` internall to buffer all the
data it receives. By default it starts off with a buffer size of 1024
bytes and grows it by a factor of 2 when it fills up. You can specify
the starting buffer size, as well as how to grow:

```javascript
// Specify the buffer size and grow factor:
var bs = StreamRange.BufferedStream({size: 1024, growFactor: 1.5});

// Grow by 1024 bytes:
var bs = StreamRange.BufferedStream({size: 2048, growSize: 1024});
```
