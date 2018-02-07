var Transform = require('stream').Transform
var inherits = require('util').inherits
var multipipe = require('multipipe')
var siphash24 = require('siphash24')
var seed = require('seed-bytes')
var chop = require('./../chop-delimited-stream')

var x00 = 0
var x01 = 1
var x08 = 8
var x10 = 16
var x1000 = 4096

var ZBUF0 = Buffer.alloc(x00)
var ZBUF8 = Buffer.alloc(x08)
var ZBUF16 = Buffer.alloc(x10)
var BUF419 = Buffer.from([ 0x00, 0x04, 0x01, 0x09, 0x04, 0x01, 0x09, 0x00 ])

function Signify (init, algo, delimiter) {
  if (!(this instanceof Signify)) return new Signify(init, algo, delimiter)
  Transform.call(this)

  this._DELIMITER = Buffer.isBuffer(delimiter) ? delimiter : BUF419
  this._next = seed(init, algo)
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

function Verify (init, algo) {
  if (!(this instanceof Verify)) return new Verify(init, algo)
  Transform.call(this)

  this._await = ZBUF16
  this._next = seed(init, algo)
  this._next(x1000) // drop4096
}

inherits(Verify, Transform)

Verify._same = function (i, n, a, b) {
  for (; i < n; i++) {
    if (a[i] !== b[i]) return false
  }
  return true
}

Verify._slice = function slice (pac) {
  if (pac.length < x08) return { mac: ZBUF8, msg: ZBUF0 }

  var mac = Buffer.alloc(x08)
  var msg = Buffer.alloc(pac.length - x08)

  pac.copy(mac, x00, x00, x08)
  pac.copy(msg, x00, x08, pac.length)

  return { mac: mac, msg: msg }
}

Verify.prototype._transform = function transform (pac, _, next) {
  var { mac, msg } = Verify._slice(pac)
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

function createVerifyingStream (init, algo, delimiter) {
  return multipipe(chop(delimiter, false), Verify(init, algo))
}

module.exports = {
  createSigningStream: Signify,
  createVerifyingStream: createVerifyingStream
}
