var fromArgs = require('watchify/bin/args')
var Emitter = require('events/')
var debounce = require('debounce')
var concat = require('concat-stream')

module.exports = function (args, opt) {
  opt = opt || {}
  var emitter = new Emitter()
  var delay = opt.delay || 0
  var closed = false
  var pending = true

  // turn off watchify delay
  args = args.slice()
  args.push('--delay', 0)

  var watchify = fromArgs(args)
  if (opt.plugin) {
    watchify.plugin(opt.plugin)
  }

  var contents = null

  emitter.close = function () {
    if (closed) {
      return
    }
    closed = true
    if (watchify) {
      // needed for watchify@3.0.0
      // see test-close-immediate
      // this needs to be revisited upstream
      setTimeout(function () {
        watchify.close()
      }, 50)
    }
  }

  var bundleDebounced = debounce(bundle, delay)
  watchify.on('update', function () {
    emitter.emit('pending')
    pending = true
    bundleDebounced()
  })

  // initial bundle
  emitter.emit('pending')
  pending = true
  bundle()

  function bundle () {
    if (closed) {
      update()
      return
    }

    var didError = false

    var outStream = concat(function (body) {
      if (!didError) {
        contents = body
        bundleEnd()
      }
    })

    var wb = watchify.bundle()
    wb.on('error', function (err) {
      err = String(err)
      console.error(err)
      contents = 'console.error(' + JSON.stringify(err) + ');'
      didError = true
      bundleEnd()
    })
    wb.pipe(outStream)

    function bundleEnd () {
      update()
    }
  }
  return emitter

  function update () {
    if (pending) {
      pending = false
      emitter.emit('update', contents)
    }
  }
}
