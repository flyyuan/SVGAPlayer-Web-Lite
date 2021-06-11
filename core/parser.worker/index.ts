/// <reference path="../../types/vendor.d.ts" />

import './btoa.polyfill'
import { Root } from 'protobufjs'
import svgaFileDataDescriptor from '../common/svga-file-data-descriptor'
import { Zlib } from 'zlibjs/bin/inflate.min.js'
import u8aToString from './u8a-to-string'
import VideoEntity from './video-entity'

declare var self: any
let worker: any

if (!self.document) {
  worker = self
} else {
  worker = self.SVGAParserMockWorker = {}

  worker.disableWorker = true

  worker.postMessage = function (data: VideoEntity) {
    worker.onmessageCallback && worker.onmessageCallback(data)
  }
}

const proto = Root.fromJSON(svgaFileDataDescriptor)
const message = proto.lookupType('com.opensource.svga.MovieEntity')

worker.onmessage = function (event: any) {
  const inflateData: Uint8Array = (new Zlib.Inflate(new Uint8Array(event.data))).decompress()
  const movie: any = message.decode(inflateData)
  const images: { [key: string]: string } = {}

  for (let key in movie.images) {
    const element = movie.images[key]
        // images Uint8Array 转 String，目的是可以转 base-64
    const value = u8aToString(element)
    // 编码成 base-64 ，目的是图片变成可用，原来的 Uint8Array 不是可读的图片编码
    images[key] = btoa(value)
  }

  const data = new VideoEntity(movie, images)
  worker.postMessage(data)
}
