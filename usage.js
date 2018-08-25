var crypto = require('crypto')
var stream = require('stream')
var sip = require('./index')

var DELIMITER = Buffer.from([ 0, 4, 1, 9, 4, 1, 9, 0 ])

var NSA = Buffer.concat([ // pac
  crypto.randomBytes(8),  // bad mac
  Buffer.from('nsa pac'), // msg
  DELIMITER
])

var shared = '419'
var opts = { algo: 'alea', delimiter: DELIMITER } // default options
var alice = sip.createSigningStream(shared, opts) // alice signs
var bob = sip.createVerifyingStream(shared, opts) // bob verifies
var thru = new stream.PassThrough()

function onpac (info, chunk) {
  console.log(info, chunk.toString())
}

alice.pipe(thru).pipe(bob)

thru.on('data', onpac.bind(null, 'bob input:'))
bob.on('data', onpac.bind(null, 'bob ok:'))
bob.on('dropping', onpac.bind(null, 'bob dropping:'))

alice.write('push all dirty money overseas')
thru.write(NSA) // being intercepted
alice.end('and buy uzis')
