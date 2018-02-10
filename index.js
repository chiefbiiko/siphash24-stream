var Transform = require('stream').Transform
var inherits = require('util').inherits
var multipipe = require('multipipe')
var siphash24 = require('siphash24')
var seed = require('seed-bytes')
var chop = require('chop-delimited-stream')

var x00 = 0
var x01 = 1
var x08 = 8
var x10 = 16
var x1000 = 4096

var ZBUF0 = Buffer.alloc(x00)
var ZBUF8 = Buffer.alloc(x08)
var ZBUF16 = Buffer.alloc(x10)
var BUF419 = Buffer.from([ 0x00, 0x04, 0x01, 0x09, 0x04, 0x01, 0x09, 0x00 ])

function Signify (init, opts) {
  if (!(this instanceof Signify)) return new Signify(init, opts)
  Transform.call(this)

  if (!opts) opts = {}

  this._DELIMITER = Buffer.isBuffer(opts.delimiter) ? opts.delimiter : BUF419
  this._next = seed(init, opts.algo)
  this._next(x1000) // drop4096
}

inherits(Signify, Transform)

Signify.prototype._transform = function transform (chunk, _, next) {
  this.push(Buffer.concat([
    siphash24(chunk, this._next(x10)),
    chunk,
    this._DELIMITER
  ]))
  next()
}

function Verify (init, opts) {
  if (!(this instanceof Verify)) return new Verify(init, opts)
  Transform.call(this)

  if (!opts) opts = {}

  this._await = ZBUF16
  this._next = seed(init, opts.algo)
  this._next(x1000) // drop4096
}

inherits(Verify, Transform)

Verify._same = function (i, n, a, b) {
  for (; i < n; i++) {
    if (a[i] !== b[i]) return false
  }
  return true
}

Verify._cut = function cut (pac) {
  if (pac.length < x08) return { mac: ZBUF8, msg: ZBUF0 }

  var mac = Buffer.alloc(x08)
  var msg = Buffer.alloc(pac.length - x08)

  pac.copy(mac, x00, x00, x08)
  pac.copy(msg, x00, x08, pac.length)

  return { mac: mac, msg: msg }
}

Verify.prototype._transform = function transform (pac, _, next) {
  var { mac, msg } = Verify._cut(pac)
  if (this._verify(mac, msg)) this.push(msg)
  else this.emit('dropping', pac)
  next()
}

Verify.prototype._verify = function verify (mac, msg) {
  var waiting = !this._await.equals(ZBUF16) // awaiting a valid key?
  var key = waiting ? this._await : this._next(x10)
  var sip = siphash24(msg, key) // the truth

  if (!Verify._same(x00, x08, mac, sip)) {
    this._await = key
    return false
  } else if (waiting) {
    this._await = ZBUF16
  }

  return true
}

function createVerifyingStream (init, opts) {
  if (!opts) opts = {}
  var choppa = chop(opts.delimiter, false)
  var verify = Verify(init, opts.algo)
  var multi = multipipe(choppa, verify)
  verify.on('dropping', multi.emit.bind(multi, 'dropping'))
  return multi
}

function createSipHash24Streams (init, opts) {
  if (!opts) opts = {}
  return {
    sign: Signify(init, opts),
    verify: createVerifyingStream(init, opts)
  }
}

module.exports = {
  createSigningStream: Signify,
  createVerifyingStream: createVerifyingStream,
  createSipHash24Streams: createSipHash24Streams
}
