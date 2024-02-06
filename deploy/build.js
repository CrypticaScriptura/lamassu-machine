'use strict'

// NOTE: sample command for offline computer: openssl dgst -sha256 -sign ../lamassu.key  -hex -out update.sig update.tar
var fs = require('fs')
var tar = require('tar')
var path = require('path')

var packageBase = process.argv[2]
var dependencies = process.argv[3] || null
var requiredVersion = process.argv[4] || null

var PACKAGE_DIR = packageBase + '/package'
var SUBPACKAGE_DIR = packageBase + '/subpackage'
var TAR_PATH = packageBase + '/update.tar'
var INFO_PATH = packageBase + '/info.json'

var packageJsonPath = path.resolve(__dirname, '../package.json')
var packageJson = JSON.parse(fs.readFileSync(packageJsonPath))
var version = packageJson.version
var timestamp = new Date()

function makeTar (tarPath, rootPath, cb) {
  tar.c({ file: path.resolve(tarPath) }, [path.resolve(rootPath)], cb)
}

function makeZippedTar (tarPath, rootPath, cb) {
  tar.c({ file: path.resolve(tarPath), gzip: true }, [path.resolve(rootPath)], cb)
}

function generateInfo () {
  var info = {
    version: version,
    contentSig: '<sig here>',
    timestamp: timestamp,
    dependencies: dependencies ? dependencies.split(',') : [],
    requiredVersion: requiredVersion
  }
  console.log('version: %s', version)
  fs.writeFileSync(INFO_PATH, JSON.stringify(info))
}

if (fs.existsSync(TAR_PATH)) fs.unlinkSync(TAR_PATH)

if (!fs.existsSync(SUBPACKAGE_DIR)) {
  makeTar(TAR_PATH, PACKAGE_DIR, generateInfo)
} else {
  makeZippedTar(PACKAGE_DIR + '/subpackage.tgz', SUBPACKAGE_DIR, function () {
    makeTar(TAR_PATH, PACKAGE_DIR, generateInfo)
  })
}
