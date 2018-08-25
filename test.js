var crypto = require('crypto')
var net = require('net')
var passthru = require('stream').PassThrough
var multipipe = require('multipipe')
var tape = require('tape')
var sip = require('./index')

var BUF419 = Buffer.from([ 0x00, 0x04, 0x01, 0x09, 0x04, 0x01, 0x09, 0x00 ])

function arrIncludesBuf (arr, buf) {
  return arr.some(function (item) {
    return buf.equals(item)
  })
}

tape('passes all true positives', function (t) {

  var shared = '419'
  var a = sip.createSigningStream(shared)
  var b = sip.createVerifyingStream(shared)
  var thru = passthru()

  var msgs = [ 'push', 'dirty money', 'overseas' ]
  var chunks = []

  function ondata (chunk) {
    chunks.push(chunk.toString())
  }

  function onend () {
    t.same(chunks, msgs, 'got all thru to bob')
    t.end()
  }

  a.pipe(thru).pipe(b)

  b.on('data', ondata)
  b.on('end', onend)

  msgs.forEach(function (msg, i) {
    a.write(msg)
    if (i === msgs.length - 1) a.end()
  })

})

tape('drops true negatives', function (t) {

  var NSA_MSG = 'nsa pac'

  var NSA_MAC_MSG = Buffer.concat([
    crypto.randomBytes(8), // bad mac
    Buffer.from(NSA_MSG)
  ])

  var NSA = Buffer.concat([ NSA_MAC_MSG, BUF419 ])

  var shared = '419'
  var a = sip.createSigningStream(shared)
  var b = sip.createVerifyingStream(shared)
  var thru = passthru()

  var msgs = [ 'push', 'dirty money', 'overseas' ]
  var chunks = []
  var drops = []

  function ondata (chunk) {
    chunks.push(chunk.toString())
  }

  function ondropping (chunk) {
    drops.push(chunk)
  }

  function onend () {
    t.false(chunks.includes(NSA_MSG), 'nsa rejected')
    t.true(arrIncludesBuf(drops, NSA_MAC_MSG), 'nsa trashed')
    t.same(chunks, msgs, 'got all ok msgs')
    t.end()
  }

  a.pipe(thru).pipe(b)

  b.on('data', ondata)
  b.on('dropping', ondropping)
  b.on('end', onend)

  msgs.forEach(function (msg, i) {
    a.write(msg)
    if (!i) thru.write(NSA) // injecting a bad segment
    if (i === msgs.length - 1) a.end()
  })

})

tape('bidirectional communication', function (t) {

  var msgs = [ 'push', 'dirty money', 'overseas' ]
  var shared = '419'
  var serverinbox = []
  var server = net.createServer(onconnection)
  var clientinbox = []
  var client

  function onconnection (socket) {

    var s = sip.createSigningStream(shared)
    var v = sip.createVerifyingStream(shared)

    s.pipe(socket)
    socket.pipe(v)

    var i = 0, interval = setInterval(function () {
      s.write(msgs[i++])
      if (i === 3) clearInterval(interval)
    }, 100).unref()

    v.on('data', function (chunk) {
      serverinbox.push(chunk.toString())
      t.same(clientinbox, msgs, 'client got all msgs')
      t.same(serverinbox, [ 'with joy' ], 'server got all msgs')
      client.destroy()
      server.close()
      t.end()
    })

  }

  server.listen(4190, '127.0.0.1', function () {
    client = net.connect(4190, '127.0.0.1', function () {
      var s = sip.createSigningStream(shared)
      var v = sip.createVerifyingStream(shared)

      s.pipe(client)
      client.pipe(v)

      v.on('data', function (chunk) {
        clientinbox.push(chunk.toString())
        if (clientinbox.length === 3) s.write('with joy')
      })
    })

  })

})
