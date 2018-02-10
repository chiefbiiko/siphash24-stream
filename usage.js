var crypto = require('crypto')
var passthru = require('stream').PassThrough
var sip = require('./index')

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
