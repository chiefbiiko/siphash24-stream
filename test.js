var crypto = require('crypto')
var passthru = require('stream').PassThrough
var tape = require('tape')
var sip = require('./index')

tape('passes all true positives', function (t) {

  var shared = '419'
  var a = sip.sign(shared)
  var b = sip.verify(shared)
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
  var a = sip.sign(shared)
  var b = sip.verify(shared)
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
