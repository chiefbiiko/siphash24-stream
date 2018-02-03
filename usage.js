var crypto = require('crypto')
var passthru = require('stream').PassThrough
var sip = require('./index')

var NSA = Buffer.concat([
  crypto.randomBytes(8), // bad mac
  Buffer.from('nsa pac')
])

var shared = '419'
var alice = sip.sign(shared)
var bob = sip.verify(shared)
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
thru.write(NSA)
alice.end('and buy uzis')
