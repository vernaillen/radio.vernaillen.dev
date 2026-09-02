import { request as httpRequest, type IncomingMessage } from 'node:http'
import { request as httpsRequest } from 'node:https'
import { getChannel, DEFAULT_STATION } from '#shared/channels'

/**
 * Opens the upstream with Node's core HTTP client instead of fetch.
 *
 * Icecast/SHOUTcast servers are older than the spec undici holds them to: the
 * VRT stations answer with a status line it rejects outright ("Missing
 * expected CR after response line"), so fetch threw before a byte of audio
 * arrived and every VRT station 502'd. `insecureHTTPParser` puts the parser in
 * the lenient mode curl and every media player already use.
 *
 * Redirects are followed by hand because the core client doesn't — VRT bounces
 * /radio1/mp3-128 to a signed streamabc.net URL, and that hop is the one that
 * answers non-conformantly.
 */
function openUpstream(url: string, signal: AbortSignal, redirects = 5): Promise<IncomingMessage> {
  return new Promise((resolve, reject) => {
    const target = new URL(url)
    const send = target.protocol === 'http:' ? httpRequest : httpsRequest
    const req = send(target, {
      signal,
      insecureHTTPParser: true,
      // A User-Agent is required (SomaFM drops UA-less requests); no
      // `Icy-MetaData` header means pure audio with no in-band metadata bytes.
      headers: { 'User-Agent': 'Mozilla/5.0 (radio.vernaillen.dev proxy)' }
    }, (res) => {
      const location = res.headers.location
      const status = res.statusCode ?? 0
      if (status >= 300 && status < 400 && location) {
        res.resume() // drain the redirect body so the socket can be reused
        if (redirects === 0) reject(new Error('too many redirects'))
        else resolve(openUpstream(new URL(location, target).href, signal, redirects - 1))
        return
      }
      resolve(res)
    })
    req.on('error', reject)
    req.end()
  })
}

/**
 * Same-origin proxy for the progressive (non-HLS) stations.
 *
 * Two reasons every station goes through here rather than straight into the
 * <audio> element:
 *
 *  1. Some origins reject browsers outright. SomaFM 403s any request carrying a
 *     `Range` header, and browsers always send `Range: bytes=0-` on the first
 *     media fetch. Fetching server-side without one returns 200, and the
 *     browser's Range request to this route is simply answered with a 200
 *     stream, which plays fine.
 *  2. Same-origin media is never CORS-tainted, so WebAudio can read the samples
 *     — which is the whole point: the FFT visualizer only reacts to audio it is
 *     allowed to read.
 *
 * With no `?station=`, this serves SomaFM Groove Salad Classic. That is the
 * contract the embedded player on vernaillen.dev calls (it points its <audio>
 * at this route via NUXT_PUBLIC_RADIO_URL), so don't repoint the default.
 */
export default defineEventHandler(async (event) => {
  const station = (getQuery(event).station as string | undefined) ?? DEFAULT_STATION
  const channel = getChannel(station)

  if (!channel) {
    throw createError({ statusCode: 404, statusMessage: `Unknown station "${station}"` })
  }
  if (channel.hls) {
    // An .m3u8 is a playlist of segment URLs, not a byte stream: piping it here
    // would hand the browser segment paths it would then request from this
    // route, which knows nothing about them. The client plays these directly.
    throw createError({ statusCode: 400, statusMessage: `${channel.label} is an HLS stream; play it directly` })
  }

  // Abort the upstream connection when the browser stops listening.
  const controller = new AbortController()
  event.node.req.on('close', () => controller.abort())

  let upstream: IncomingMessage
  try {
    upstream = await openUpstream(channel.src, controller.signal)
  } catch {
    throw createError({ statusCode: 502, statusMessage: `${channel.label} is unavailable` })
  }

  const status = upstream.statusCode ?? 0
  if (status < 200 || status >= 300) {
    upstream.resume()
    throw createError({ statusCode: 502, statusMessage: `${channel.label} responded ${status}` })
  }

  setHeader(event, 'Content-Type', upstream.headers['content-type'] ?? 'audio/mpeg')
  setHeader(event, 'Cache-Control', 'no-store')
  // Public streams, no credentials. vernaillen.dev is served from a different
  // origin and loads this crossorigin=anonymous so WebAudio can analyse it,
  // which requires this header — without it the element is tainted and the
  // analyser only ever reads silence.
  setHeader(event, 'Access-Control-Allow-Origin', '*')
  return sendStream(event, upstream)
})
