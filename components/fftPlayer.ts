/**
 * The audio half of the player: opens a station, plays it, and analyses the
 * signal with the same Rust/WASM FFT the visualizer component uses.
 *
 * Stereo is analysed per channel (left / right split separately) so the stereo
 * presets render a real L/R image rather than a mirrored mono spectrum.
 *
 * Autoplay policy: start() must be called from a user gesture (a click).
 */
import type { FftProcessor } from '@fft-visualizer/vue/wasm'
import type { RadioChannel } from '#shared/channels'

/**
 * Progressive streams go through the Nitro proxy (server/api/radio.get.ts).
 * That is not just a CORS convenience: some origins (SomaFM) 403 the
 * `Range: bytes=0-` header every browser sends on a media fetch. The proxy
 * fetches server-side without it and pipes the bytes back, and because it is
 * same-origin the media is never tainted — so WebAudio can read real samples
 * and the visualizer reacts on every one of these stations.
 *
 * HLS is the exception: an .m3u8 playlist is not a byte stream to pipe, so the
 * browser loads it (and its segments) straight from the source. Those responses
 * carry no CORS header, which taints the element — audio plays, but the
 * analyser reads silence and the bars stay flat. Setting crossOrigin here would
 * fix the taint in theory and in practice just break playback outright, since
 * the origin would refuse the credentialled-mode request.
 */
function streamUrlFor(channel: RadioChannel) {
  return channel.hls ? channel.src : `/api/radio?station=${encodeURIComponent(channel.value)}`
}

export type OnData = (mono: Uint8Array, left: Uint8Array, right: Uint8Array) => void

/** Called with `true` once audio is actually coming out of the element, and
 *  with `false` whenever it stalls to rebuffer. start() resolving only means
 *  the graph is wired and the FFT is ready — on a cold connection that happens
 *  seconds before there is anything to hear. */
export type OnFlow = (flowing: boolean) => void

export interface RadioAudio {
  start: (channel: RadioChannel, onData: OnData, onFlow?: OnFlow) => Promise<void>
  stop: () => void
  setVolume: (value: number) => void
}

export function createRadioAudio(bins: number, fftSize = 2048): RadioAudio {
  let ctx: AudioContext | null = null
  let audioEl: HTMLAudioElement | null = null
  let analyserL: AnalyserNode | null = null
  let analyserR: AnalyserNode | null = null
  let procL: FftProcessor | null = null
  let procR: FftProcessor | null = null
  let bufL: Float32Array<ArrayBuffer> | null = null
  let bufR: Float32Array<ArrayBuffer> | null = null
  let rafId: number | null = null
  let volume = 1

  function analyse(onData: OnData) {
    if (!analyserL || !analyserR || !procL || !procR || !bufL || !bufR) return

    analyserL.getFloatTimeDomainData(bufL)
    analyserR.getFloatTimeDomainData(bufR)
    const left = new Uint8Array(procL.process(bufL))
    const right = new Uint8Array(procR.process(bufR))

    const mono = new Uint8Array(bins)
    for (let i = 0; i < bins; i++) mono[i] = (left[i]! + right[i]!) >> 1

    onData(mono, left, right)
    rafId = requestAnimationFrame(() => analyse(onData))
  }

  async function start(channel: RadioChannel, onData: OnData, onFlow?: OnFlow) {
    stop()

    // Everything the autoplay policy cares about happens here, synchronously,
    // still inside the task the click created: browsers only let audio through
    // if the AudioContext is constructed and the element played within the
    // gesture. Awaiting the WASM chunk first pushed both into a later task, so
    // the context came up suspended and the element stayed silent — with no
    // error, since play() rejections are deliberately swallowed below. It
    // looked like it needed two clicks only because the second one found the
    // module cached, collapsing the await to a microtask that stays inside the
    // gesture. Load the FFT after the graph is wired, never before.
    audioEl = new Audio()
    audioEl.preload = 'auto'
    audioEl.volume = volume
    audioEl.src = streamUrlFor(channel)

    // The element is the only thing that knows when the stream actually
    // arrives. Both listeners die with the element in stop(), so there is
    // nothing to unsubscribe.
    if (onFlow) {
      audioEl.addEventListener('playing', () => onFlow(true))
      audioEl.addEventListener('waiting', () => onFlow(false))
    }

    const own = new AudioContext()
    ctx = own
    void own.resume() // a no-op when it already came up running

    const srcNode = own.createMediaElementSource(audioEl)
    srcNode.connect(own.destination) // audible

    const splitter = own.createChannelSplitter(2)
    srcNode.connect(splitter)

    analyserL = own.createAnalyser()
    analyserR = own.createAnalyser()
    analyserL.fftSize = fftSize
    analyserR.fftSize = fftSize
    splitter.connect(analyserL, 0)
    splitter.connect(analyserR, 1)

    // Fire-and-forget: don't await or fail on a slow first connection. The bars
    // stay flat until audio actually flows, then react.
    void audioEl.play().catch(() => {})

    const wasm = await import('@fft-visualizer/vue/wasm')
    // The import resolving is not the same as the FFT being usable: the package
    // is bundled with vite-plugin-top-level-await, so `FftProcessor` stays
    // undefined until the WASM instance has initialised, and the plugin hands
    // that out as a separate `__tla` promise on the module. Constructing one
    // before it settles throws, which rejected start() and tore the audio back
    // down — the element we had just played got paused again. That was the real
    // "click play twice": by the second click the module had finished
    // initialising, so the same code worked.
    await (wasm as { __tla?: Promise<void> }).__tla

    // Superseded while the chunk loaded (another station, or a stop): the
    // context we built is already closed, so there is nothing left to drive.
    if (ctx !== own) return

    procL = new wasm.FftProcessor(fftSize, bins, 100, 18000, own.sampleRate)
    procR = new wasm.FftProcessor(fftSize, bins, 100, 18000, own.sampleRate)
    bufL = new Float32Array(fftSize)
    bufR = new Float32Array(fftSize)

    analyse(onData)
  }

  function stop() {
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
    if (procL) {
      procL.free()
      procL = null
    }
    if (procR) {
      procR.free()
      procR = null
    }
    if (audioEl) {
      // Live streams keep downloading while merely paused, so drop the source
      // outright — otherwise resuming replays minutes-old buffered audio.
      audioEl.pause()
      audioEl.removeAttribute('src')
      audioEl.load()
      audioEl = null
    }
    if (ctx) {
      void ctx.close()
      ctx = null
    }
    analyserL = null
    analyserR = null
    bufL = null
    bufR = null
  }

  function setVolume(value: number) {
    volume = value
    if (audioEl) audioEl.volume = value
  }

  return { start, stop, setVolume }
}
