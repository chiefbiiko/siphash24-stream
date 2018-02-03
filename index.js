var Transform = require('stream').Transform
var inherits = require('util').inherits
var siphash24 = require('siphash24')
var seed = require('seed-bytes')

var x00 = 0
var x08 = 8
var x10 = 16
var x1000 = 4096

var ZBUF16 = Buffer.alloc(x10)

function Signify (init, algo) {
  if (!(this instanceof Signify)) return new Signify(init, algo)
  Transform.call(this)

  this._next = seed(init, algo)
  this._next(x1000) // drop4096
}

inherits(Signify, Transform)

Signify.prototype._transform = function transform (chunk, _, next) {
  var key = this._next(x10) // 16 byte key
  var mac = siphash24(chunk, key) // 8 byte mac
  var pac = Buffer.concat([ mac, chunk ])

  this.push(pac)
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

Verify.prototype._transform = function transform (chunk, _, next) {
  if (chunk.length < x08) return this._drop(chunk, next)

  var mac = Buffer.alloc(x08) // 8 byte mac
  var msg = Buffer.alloc(chunk.length - x08)

  chunk.copy(mac, x00, x00, x08)
  chunk.copy(msg, x00, x08, chunk.length)

  var waiting = !this._await.equals(ZBUF16) // awaiting a valid key?

  var key = waiting ? this._await : this._next(x10) // 16 byte key
  var sip = siphash24(msg, key) // the truth

  if (!Verify._same(x00, x08, mac, sip)) return this._drop(chunk, key, next)
  else if (waiting) this._await = ZBUF16

  this.push(msg)
  next()
}

Verify.prototype._drop = function drop (chunk, key, next) {
  if (!Buffer.isBuffer(key)) return this._drop(chunk, this._next(x10), key)
  this._await = key
  this.emit('dropping', chunk)
  next()
}

module.exports = { sign: Signify, verify: Verify }
