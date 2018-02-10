# siphash24-stream

[![build status](http://img.shields.io/travis/chiefbiiko/siphash24-stream.svg?style=flat)](http://travis-ci.org/chiefbiiko/siphash24-stream) [![AppVeyor Build Status](https://ci.appveyor.com/api/projects/status/github/chiefbiiko/siphash24-stream?branch=master&svg=true)](https://ci.appveyor.com/project/chiefbiiko/siphash24-stream)

**SipHash24** *sign* and *verify* streams powered by [a seedable keystream](https://github.com/chiefbiiko/seed-bytes).

***

## Get it!

```
npm install --save siphash24-stream
```

***

## Usage

Create both *signing* and *verifying* streams by supplying a variable-length symmetric key that is used for seeding an internal keystream.

``` js
var crypto = require('crypto')
var passthru = require('stream').PassThrough
var sip = require('siphash24-stream')

var BUF419 = Buffer.from([ 0x00, 0x04, 0x01, 0x09, 0x04, 0x01, 0x09, 0x00 ])

var NSA = Buffer.concat([
  crypto.randomBytes(8), // bad mac
  Buffer.from('nsa pac'),
  BUF419
])

var shared = '419'
var alice = sip.createSigningStream(shared) // alice signs
var bob = sip.createVerifyingStream(shared) // bob verifies
var thru = passthru()

function ondata (msg, chunk) {
  console.log(msg, chunk.toString())
}

function ondropping (msg, chunk) {
  console.log(msg, chunk.toString())
}

alice.pipe(thru).pipe(bob)

thru.on('data', ondata.bind(null, 'bob input:'))
bob.on('data', ondata.bind(null, 'bob ok:'))
bob.on('dropping', ondropping.bind(null, 'bob dropping:'))

alice.write('push all dirty money overseas')
thru.write(NSA) // being intercepted
alice.end('and buy uzis')
```

***

## API

### `var sign = sip.createSigningStream(init[, opts])`

Create a transform stream that signs all its throughput with a SipHash24 mac. `init` is the seed for a random byte generator used as key stream.

Options default to:

``` js
{
  algo: 'alea',
  delimiter: Buffer.from([ 0x00, 0x04, 0x01, 0x09, 0x04, 0x01, 0x09, 0x00 ])
}
```

`opts.algo` indicates the algorithm to use for the internal random number generator. Check out  [`seedrandom`](https://github.com/davidbau/seedrandom#other-fast-prng-algorithms) for a list of supported algorithms. `opts.delimiter` is the message delimiter, must be a buffer.

### `var verify = sip.createVerifyingStream(init[, opts])`

Create a transform stream that verifies all its throughput against a SipHash24 mac. Bad chunks are rejected and not passed on, not pushed any further, but emitted with the `dropping` event.

### `var { sign, verify } = sip.createSipHash24Streams(init[, opts])`

Create a SipHash24 *sign* and *verify* stream duplet.

### `verify.on('dropping', ondropping)`

Emitted with every chunk that will not be pushed further. Use this if you wish to check dropouts. Calling back like `ondropping(chunk)`.

***

## License

[MIT](./license.md)
