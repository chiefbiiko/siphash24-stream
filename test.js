var crypto = require('crypto')
var net = require('net')
var passthru = require('stream').PassThrough
var multipipe = require('multipipe')
var tape = require('tape')
var sip = require('./index')

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

  var SHIFTING = 'nsa pac'
  var NSA = Buffer.concat([
    crypto.randomBytes(8), // bad mac
    Buffer.from(SHIFTING)
  ])

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
    t.false(chunks.includes(SHIFTING), 'nsa rejected')
    t.true(drops.includes(NSA), 'nsa trashed')
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
    console.log('server got a connection...')

    var s = sip.createSigningStream(shared)
    var v = sip.createVerifyingStream(shared)

    s.pipe(socket)
    socket.pipe(v)

    msgs.forEach(function (msg) {
      console.log('writing ' + msg + '...')
      s.write(msg)
    })

    v.on('dropping', function (chunk) {
      console.log('server dropping', chunk.toString(), '...')
    })

    v.on('data', function (chunk) {
      serverinbox.push(chunk.toString())
      console.log(serverinbox)
      t.same(clientinbox, msgs, 'client got all msgs')
      t.same(serverinbox, [ 'with joy' ], 'server got all msgs')
      client.destroy()
      server.close()
      t.end()
    })

  }

  server.listen(4190, '127.0.0.1', function () {
    console.log('server listening...')

    client = net.connect(4190, '127.0.0.1', function () {
      console.log('client connected...')

      var s = sip.createSigningStream(shared)
      var v = sip.createVerifyingStream(shared)

      s.pipe(client)
      client.pipe(v)

      v.on('dropping', function (chunk) {
        console.log('client dropping', chunk.toString(), '...')
      })

      v.on('data', function (chunk) {
        clientinbox.push(chunk.toString())
        console.log(clientinbox)
        if (clientinbox.length === 3) s.write('with joy')
      })
    })

  })

})
