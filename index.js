var fs = require('fs')
var OSS = require('ali-oss')
var crypto = require('crypto')
var getRawBody = require('raw-body')
var imageToBase64 = require('image-to-base64')

function validUrl(url) {
  return /http(s)?:\/\/(\w+:?\w*@)?(\S+)(:\d+)?((?<=\.)\w+)+(\/([\w#!:.?+=&%@!\-/])*)?/gi.test(url)
}

function errMsg(msg) {
  return JSON.stringify({ status: 'error', msg })
}

exports.handler = (req, resp) => {
  getRawBody(req, function (err, body) {
    const bodyStr = body.toString()
    let json = null
    try {
      json = JSON.parse(bodyStr)
    } catch (err) {
      resp.send(errMsg('JSON.parse(request body) error'))
    }
    if (!json) {
      resp.send(errMsg('参数不得为空'))
    }
    if (
      !json.region ||
      !json.bucket ||
      !json.stsToken ||
      !json.accessKeyId ||
      !json.accessKeySecret
    ) {
      resp.send(errMsg('OSS配置有误'))
    }
    if (!json.cdnOrigin) {
      resp.send(errMsg('cdnOrigin不得为空'))
    }
    if (!validUrl(json.imgUrl)) {
      resp.send(errMsg('图片地址不合法'))
    }
    const { region, bucket, stsToken, accessKeyId, accessKeySecret, cdnOrigin, imgUrl } = json
    let ossClient = null
    try {
      ossClient = new OSS({
        region,
        bucket,
        stsToken,
        accessKeyId,
        accessKeySecret,
        internal: true
      })
    } catch (err) {
      resp.send({ error })
    }
    imageToBase64(imgUrl)
      .then((response) => {
        const base64Str = response
        const bufferObj = new Buffer.from(base64Str, 'base64')
        const key = crypto.createHash('md5').update(base64Str).digest('hex')
        const filename = `/tmp/img-${key}.png`
        fs.writeFileSync(filename, bufferObj)
        ossClient
          .put('image-mirror/' + key, filename)
          .then((res) => {
            resp.send(
              JSON.stringify({
                status: 'ok',
                url: `${cdnOrigin}/image-mirror/${key}`
              })
            )
          })
          .catch((err) => {
            resp.send({ error })
          })
      })
      .catch((error) => {
        resp.send({ error })
      })
  })
}
