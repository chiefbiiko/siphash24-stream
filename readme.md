# siphash24-stream

[![build status](http://img.shields.io/travis/chiefbiiko/siphash24-stream.svg?style=flat)](http://travis-ci.org/chiefbiiko/siphash24-stream) [![AppVeyor Build Status](https://ci.appveyor.com/api/projects/status/github/chiefbiiko/siphash24-stream?branch=master&svg=true)](https://ci.appveyor.com/project/chiefbiiko/siphash24-stream)

**SipHash24** sign and verify streams powered by a seedable keystream.

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

var NSA = Buffer.concat([
  crypto.randomBytes(8), // bad mac
  Buffer.from('nsa pac')
])

var shared = '419'
var alice = sip.sign(shared) // alice signs
var bob = sip.verify(shared) // bob verifies
var thru = passthru()

function ondata (chunk) {
  console.log('ok:', chunk.toString())
}

function ondropping (chunk) {
  console.log('dropping:', chunk.toString())
}

alice.pipe(thru).pipe(bob)

bob.on('data', ondata)
bob.on('dropping', ondropping)

alice.write('push all dirty money overseas')
thru.write(NSA) // being intercepted
alice.end('and buy uzis')
```

***

## API

### `var sign = sip.sign(init[, algo])`

Create a transform stream that signs all its throughput with a SipHash24 mac. `init` is the seed for a random byte generator used as key stream. `algo` indicates the algorithm to use for the internal random number generator, defaults to `'alea'`. Check out  [`seedrandom`](https://github.com/davidbau/seedrandom#other-fast-prng-algorithms) for a list of supported algorithms.

### `var verify = sip.verify(init[, algo])`

Create a transform stream that verifies all its throughput against a SipHash24 mac. Bad chunks are rejected and not passed on, not pushed any further, but emitted with the `dropping` event.

### `verify.on('dropping', ondropping)`

Emitted with every chunk that will not be pushed further. Use this if you wish to check dropouts. Calling back like `ondropping(chunk)`.

## License

[MIT](./license.md)
