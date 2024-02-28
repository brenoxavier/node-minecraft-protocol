'use strict'

const ProtoDef = require('protodef').ProtoDef
const Serializer = require('protodef').Serializer
const Parser = require('protodef').FullPacketParser
const { ProtoDefCompiler } = require('protodef').Compiler

const nbt = require('prismarine-nbt')
const minecraft = require('../datatypes/minecraft')
const states = require('../states')
const merge = require('lodash.merge')
const get = require('lodash.get')

const minecraftData = require('minecraft-data')
const protocols = {}

function createProtocol (state, direction, version, customPackets, compiled = true) {
  const versionInfo = minecraftData.versionsByMinecraftVersion.pc[version]
  const key = getProtocolKey(state, direction, version, compiled, versionInfo.usesNetty)

  if (!protocols[key]) {
    const mcData = minecraftData(version)

    if (mcData != null) {
      return getProtodefProtocol(key, compiled, mcData, customPackets, state, direction, versionInfo.usesNetty)
    } else if (versionInfo && versionInfo.version !== mcData.version.version) {
      throw new Error(`Do not have protocol data for protocol version ${versionInfo.version} (attempted to use ${mcData.version.version} data)`)
    }

    throw new Error(`No data available for version ${version}`)
  }

  return protocols[key]
}

function getProtodefProtocol (key, compiled, mcData, customPackets, state, direction, usesNetty) {
  const protocol = merge(mcData.protocol, get(customPackets, [mcData.version.majorVersion]))
  const protocolPath = usesNetty ? [state, direction] : ['stateless', 'directionless']
  let proto

  if (compiled) {
    const compilerDataTypes = require('../datatypes/compiler-minecraft')
    const compiler = new ProtoDefCompiler()
    compiler.addTypes(compilerDataTypes)
    compiler.addProtocol(protocol, protocolPath)

    nbt.addTypesToCompiler('big', compiler)
    proto = compiler.compileProtoDefSync()
  } else {
    proto = new ProtoDef(false)
    proto.addTypes(minecraft)
    proto.addProtocol(protocol, protocolPath)
    nbt.addTypesToInterperter('big', proto)
  }

  protocols[key] = proto
  return proto
}

function getProtocolKey (state, direction, version, compiled, usesNetty) {
  if (usesNetty) {
    return state + ';' + direction + ';' + version + (compiled ? ';c' : '')
  }

  return version + (compiled ? ';c' : '')
}

function createSerializer ({ state = states.HANDSHAKING, isServer = false, version, customPackets, compiled = true } = {}) {
  return new Serializer(createProtocol(state, !isServer ? 'toServer' : 'toClient', version, customPackets, compiled), 'packet')
}

function createDeserializer ({ state = states.HANDSHAKING, isServer = false, version, customPackets, compiled = true, noErrorLogging = false } = {}) {
  return new Parser(createProtocol(state, isServer ? 'toServer' : 'toClient', version, customPackets, compiled), 'packet', noErrorLogging)
}

module.exports = {
  createSerializer,
  createDeserializer
}
