var crypto = require('crypto')
var passthru = require('stream').PassThrough
var sip = require('./index')

var NSA = Buffer.concat([
  crypto.randomBytes(8), // bad mac
  Buffer.from('nsa pac')
])

var shared = '419'
var alice = sip.createSigningStream(shared)
var bob = sip.createVerifyingStream(shared)
var thru = passthru()

function ondata (name, chunk) {
  console.log(name + ' ok:', chunk.toString())
}

function ondropping (name, chunk) {
  console.log(name + ' dropping:', chunk.toString())
}

alice.pipe(thru).pipe(bob)

alice.on('data', ondata.bind(null, 'alice'))
// alice.on('dropping', ondropping.bind(null, 'alice'))
bob.on('data', ondata.bind(null, 'bob'))
// bob.on('dropping', ondropping.bind(null, 'bob'))

alice.write('push all dirty money overseas')
thru.write(NSA)
alice.write('and buy uzis')
bob.write('ok cool')
