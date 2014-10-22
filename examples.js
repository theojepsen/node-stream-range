var StreamRange = require('./index.js'),
    streamifier = require('streamifier');

// Extract the middle word
streamifier.createReadStream('slovenly')
  .pipe(StreamRange(1, 5))
  .pipe(process.stdout); // love


// Use a buffered stream with multiple consumers
var bs = StreamRange.BufferedStream();
streamifier.createReadStream('0123456789').pipe(bs);

bs.range(0, 6).pipe(process.stdout); // 012345
bs.from(3).to(9).pipe(process.stdout); // 345678
bs.from(5).pipe(process.stdout); // 56789

// Use a buffered stream, specifying the buffer size and grow factor:
var bs2 = StreamRange.BufferedStream({size: 1024, growFactor: 1.5});

// Grow by 1024 bytes:
var bs3 = StreamRange.BufferedStream({size: 2048, growSize: 1024});
