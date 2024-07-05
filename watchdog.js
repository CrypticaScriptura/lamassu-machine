// This just looks for a script file, checks it's signature, and runs it
'use strict'

const fs = require('fs')
const cp = require('child_process')
const path = require('path')

const watchdogInfoLoader = require('./lib/watchdog-info')

var log = console.log;
var error = console.error;

console.log = function(){
  var date = (new Date).toISOString() 
  log(date, 'LOG', ...arguments)
};

console.error = function(){
  var date = (new Date).toISOString() 
  error(date, 'ERROR', ...arguments)
};

const BASE = '/opt/lamassu-updates/extract'
const DONE_PATH = path.join(BASE, 'done.txt')
const SCRIPT_PATH = path.join(BASE, 'package', 'updatescript.js')
const RUNNING_PATH = path.join(BASE, 'running.txt')
const TIMEOUT = 600000

var child = null
var t0 = null
var running = false

var platform = process.argv[2] || 'N7G1'
var model = process.argv[3] || (platform === 'upboard' ? 'gaia' : null)

var DEVICE_CONFIG_PATH = path.resolve(__dirname, 'device_config.json')

var deviceConfig = JSON.parse(fs.readFileSync(DEVICE_CONFIG_PATH))
var dataPath = path.resolve(__dirname, deviceConfig.brain.dataPath)

watchdogInfoLoader.save(dataPath, { model: model, platform: platform})

process.on('SIGUSR2', function () {
  // USR1 is reserved by node
  console.log('Got SIGUSR2. Immune.')
})

process.on('uncaughtException', console.log)
process.on('unhandledRejection', console.log)
process.on('exit', () => console.log('lamassu-watchdog exiting'))

setInterval(watch, 1000)
setInterval(function () {
  if (running) return
  process.exit(0)
}, 600000)

function watch () {
  if (running) {
    var interval = Date.now() - t0
    if (interval > TIMEOUT) {
      kill()
    }
    return
  }
  if (fs.existsSync(DONE_PATH)) executeScript()
}

function kill () {
  console.log('killing child on timeout')
  if (child) child.kill('SIGINT')
}

function executeScript () {
  // TODO: check sig, and make sure we only run this once to completion
  if (running) return

  if (!fs.existsSync(SCRIPT_PATH)) {
    console.error('Script file not present: %s', SCRIPT_PATH)
    return
  }
  if (!start()) {
    console.log("Can't run, there's a new update")
    return
  }
  console.log('in execute')
  const UPDATED_PATH = true
  child = cp.fork(SCRIPT_PATH, [platform, model, UPDATED_PATH])
  child.on('error', function (err) {
    cleanUp()
    console.log(err)
  })
  child.on('exit', function () {
    cleanUp()
    console.log('done')
  })
}

function start () {
  t0 = Date.now()
  running = true
  fs.unlinkSync(DONE_PATH)
  fs.writeFileSync(RUNNING_PATH, 'RUNNING\n')
  return fs.existsSync(RUNNING_PATH)   // check for race conditions
}

function cleanUp () {
  t0 = null
  child = null
  fs.unlinkSync(RUNNING_PATH)
  running = false
}
