var Transform = require('stream').Transform
var inherits = require('util').inherits
var timingSafeEqual = require('crypto').timingSafeEqual
var multipipe = require('multipipe')
var siphash24 = require('siphash24')
var seed = require('seed-bytes')
var chop = require('chop-delimited-stream')

var ZBUF0 = Buffer.alloc(0)
var ZBUF8 = Buffer.alloc(8)
var ZBUF16 = Buffer.alloc(16)
var BUF419 = Buffer.from([ 0x00, 0x04, 0x01, 0x09, 0x04, 0x01, 0x09, 0x00 ])

function Signify (init, opts) {
  if (!(this instanceof Signify)) return new Signify(init, opts)
  Transform.call(this)

  if (!opts) opts = {}
  this._DELIMITER = Buffer.isBuffer(opts.delimiter) ? opts.delimiter : BUF419
  this._next = seed(init, opts.algo)
  this._next(4096) // drop4096
}

inherits(Signify, Transform)

Signify.prototype._transform = function transform (chunk, _, next) {
  this.push(Buffer.concat([
    siphash24(chunk, this._next(16)),
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
  this._next(4096) // drop4096
}

inherits(Verify, Transform)

Verify._cut = function cut (pac) {
  if (pac.length < 8) return { mac: ZBUF8, msg: ZBUF0 }

  var mac = Buffer.alloc(8)
  var msg = Buffer.alloc(pac.length - 8)

  pac.copy(mac, 0, 0, 8)
  pac.copy(msg, 0, 8, pac.length)

  return { mac, msg }
}

Verify.prototype._transform = function transform (pac, _, next) {
  var { mac, msg } = Verify._cut(pac)
  if (this._verify(mac, msg)) this.push(msg)
  else this.emit('dropping', pac)
  next()
}

Verify.prototype._verify = function verify (mac, msg) {
  var waiting = !timingSafeEqual(this._await, ZBUF16) // awaiting a valid key?
  var key = waiting ? this._await : this._next(16)
  var sip = siphash24(msg, key) // the truth

  if (!timingSafeEqual(mac, sip)) {
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
  var verify = Verify(init, opts)
  var multi = multipipe(choppa, verify)
  verify.on('dropping', multi.emit.bind(multi, 'dropping'))
  return multi
}

function createSipHash24Streams (init, opts) {
  return {
    sign: Signify(init, opts),
    verify: createVerifyingStream(init, opts)
  }
}

module.exports = {
  createSigningStream: Signify,
  createVerifyingStream,
  createSipHash24Streams
}
