<script setup lang="ts">
import { FFTVisualizer } from '@fft-visualizer/vue'
import '@fft-visualizer/vue/style.css'
import { createRadioAudio } from './fftPlayer'
import { channelFilters, channels, getChannel, isChannelTag, stepChannel } from '#shared/channels'

const BANDS = 80

const data = ref<Uint8Array>(new Uint8Array(BANDS))
const dataLeft = ref<Uint8Array>(new Uint8Array(BANDS))
const dataRight = ref<Uint8Array>(new Uint8Array(BANDS))

const channelKey = ref('zenfm')
const channel = computed(() => getChannel(channelKey.value) ?? channels[0]!)

// Which filter chip is lit. Read from storage on mount rather than in setup so
// the hydrating render matches the server's unfiltered grid, and only trusted
// if it is still a known tag.
const storedFilter = useLocalStorage('radio-filter', 'all', { initOnMounted: true })
const filter = computed(() => isChannelTag(storedFilter.value) ? storedFilter.value : 'all')
const visibleChannels = computed(() => {
  const tag = filter.value
  return tag === 'all' ? channels : channels.filter(item => item.tags.includes(tag))
})

const playing = ref(false)
const pending = ref(false)
const error = ref('')
const volume = ref(60)
const nowPlaying = ref('')

const audio = createRadioAudio(BANDS)

type VizProps = Partial<InstanceType<typeof FFTVisualizer>['$props']>

// Curated looks, carried over from the player on vernaillen.dev. Switching one
// only swaps the look via v-bind; it never touches the audio.
const presets: { name: string, props: VizProps }[] = [
  {
    name: 'Radial',
    props: {
      radial: true, radialInnerRadius: 0.35, barSpace: 0.2,
      reflexRatio: 0.65, reflexAlpha: 0.5, glow: 0.9,
      gradient: 'rainbow', gradientDirection: 'horizontal',
      showPeaks: false, smoothing: 0.65
    }
  },
  {
    name: 'Stereo',
    props: {
      stereo: true, barSpace: 0.4, reflexRatio: 0.35, reflexAlpha: 0.5, glow: 1,
      gradient: 'rainbow', gradientDirection: 'horizontal',
      showPeaks: false, smoothing: 0.65
    }
  },
  {
    name: 'Reflected',
    props: {
      gradient: 'aurora', glow: 0.5, barSpace: 0.3,
      reflexRatio: 0.3, reflexAlpha: 0.3, showPeaks: false, smoothing: 0.65
    }
  },
  {
    name: 'LED meter',
    props: {
      ledBars: true, ledShape: 'meter', barSpace: 0.35,
      gradient: [
        { stop: 0, color: '#22dd66' },
        { stop: 0.6, color: '#ffd000' },
        { stop: 1, color: '#ff3344' }
      ]
    }
  },
  {
    name: 'Lumi bars',
    props: {
      lumiBars: true, bands: 40, barSpace: 0.05,
      reflexRatio: 0.35, reflexAlpha: 0.25, glow: 1,
      gradient: 'rainbow', gradientDirection: 'horizontal',
      colorMode: 'bar-level', stereo: true,
      showPeaks: true, peakDecay: 0.99, smoothing: 0.65
    }
  },
  {
    name: 'Lazers',
    props: {
      radial: true, radialInnerRadius: 0, barSpace: 0.35, glow: 1,
      gradient: 'rainbow', gradientDirection: 'horizontal',
      stereo: true, showPeaks: false, smoothing: 0.5, bands: 40
    }
  }
]

const active = ref(presets.findIndex(preset => preset.name === 'Reflected'))
const activeProps = computed(() => presets[active.value]!.props)

// Screens sleep on their own while music plays; the visualizer is the point of
// this app, so hold the screen awake for as long as something is playing.
const { request: requestWakeLock, release: releaseWakeLock } = useWakeLock()

function feed(mono: Uint8Array, left: Uint8Array, right: Uint8Array) {
  data.value = mono
  dataLeft.value = left
  dataRight.value = right
}

function clearBars() {
  data.value = new Uint8Array(BANDS)
  dataLeft.value = new Uint8Array(BANDS)
  dataRight.value = new Uint8Array(BANDS)
}

// Bumped by every start and stop, so a station that is still connecting when
// the user clicks again knows it has been superseded and tears itself down
// instead of coming up alongside the newer one.
let runId = 0

// Live streams take seconds to open, and start() resolving only means the FFT
// is ready — not that audio is on its way. Without a deadline a dead upstream
// would spin forever, so give it one and surface the failure instead.
const CONNECT_TIMEOUT = 20000
let connectTimer: ReturnType<typeof setTimeout> | null = null

function clearConnectTimer() {
  if (connectTimer) {
    clearTimeout(connectTimer)
    connectTimer = null
  }
}

// Driven by the <audio> element: `pending` means "nothing audible yet", which
// covers both the initial connection and a mid-stream rebuffer.
function onFlow(id: number, flowing: boolean) {
  if (id !== runId) return
  pending.value = !flowing
  if (!flowing) return
  clearConnectTimer()
  if (playing.value) return // resumed after a stall; the session is already up
  playing.value = true
  void requestWakeLock('screen').catch(() => {})
  startNowPlaying()
}

async function play() {
  stop()

  const id = runId
  const target = channel.value
  pending.value = true
  connectTimer = setTimeout(() => {
    if (id !== runId) return
    stop()
    error.value = `Could not connect to ${target.label}.`
  }, CONNECT_TIMEOUT)

  try {
    await audio.start(target, feed, flowing => onFlow(id, flowing))
  } catch {
    audio.stop()
    if (id !== runId) return
    clearConnectTimer()
    pending.value = false
    error.value = `Could not connect to ${target.label}.`
    return
  }
  // Deliberately nothing here: `pending` stays true until the element reports
  // it is playing, so the spinner tracks audio rather than WASM startup.
  if (id !== runId) audio.stop()
}

function stop() {
  runId++
  clearConnectTimer()
  audio.stop()
  playing.value = false
  pending.value = false
  error.value = ''
  void releaseWakeLock()
  stopNowPlaying()
  clearBars()
}

function toggle() {
  if (playing.value || pending.value) stop()
  else void play()
}

// A tile is that station's play button: clicking one starts it whether or not
// something was already playing. The skip buttons only switch what is armed
// while stopped, so stepping through the list stays silent until you press play.
function selectChannel(value: string, autoplay = false) {
  const wasPlaying = playing.value || pending.value
  channelKey.value = value
  if (wasPlaying || autoplay) void play()
}

function step(delta: number) {
  const next = stepChannel(visibleChannels.value, channelKey.value, delta)
  if (next) selectChannel(next.value)
}

// Every SomaFM logo already says "SomaFM" on it, so the prefix only eats room
// in a tile caption. The full label still shows in the status line.
function tileLabel(label: string) {
  return label.replace(/^SomaFM /, '')
}

// Stand-in artwork for the couple of stations with no logo to be found.
function initials(label: string) {
  return label.split(/[\s-]+/).slice(0, 2).map(word => word[0]).join('').toUpperCase()
}

watch(volume, value => audio.setVolume(value / 100))

// SomaFM publishes a CORS-enabled now-playing feed per station; newest first.
let npTimer: ReturnType<typeof setInterval> | null = null

async function refreshNowPlaying() {
  const soma = channel.value.soma
  if (!soma) return
  try {
    const res = await fetch(`https://somafm.com/songs/${soma}.json`, { cache: 'no-store' })
    const json = await res.json()
    const song = json?.songs?.[0]
    nowPlaying.value = song ? `${song.artist} — ${song.title}` : ''
  } catch {
    // leave the previous value; the station name is shown either way
  }
}

function startNowPlaying() {
  stopNowPlaying()
  if (!channel.value.soma) return
  void refreshNowPlaying()
  npTimer = setInterval(refreshNowPlaying, 20000)
}

function stopNowPlaying() {
  if (npTimer) {
    clearInterval(npTimer)
    npTimer = null
  }
  nowPlaying.value = ''
}

// Space plays/stops, arrows change station — but not while a control has focus,
// where those keys already mean something.
useEventListener('keydown', (event: KeyboardEvent) => {
  const target = event.target as HTMLElement | null
  if (target?.closest('input, button, [role="slider"]')) return

  if (event.code === 'Space') {
    event.preventDefault()
    toggle()
  } else if (event.code === 'ArrowRight') {
    step(1)
  } else if (event.code === 'ArrowLeft') {
    step(-1)
  }
})

onBeforeUnmount(stop)
</script>

<template>
  <div class="flex min-h-screen w-full flex-col gap-6 px-4 py-2 sm:px-6 sm:py-4">
    <!--
      Full width, but the aspect ratio is capped: 378px is what 16/7 worked out
      to at the old max-w-4xl, and letting it grow with the viewport would push
      everything else below the fold on a wide screen.
    -->
    <div
      class="relative w-full overflow-hidden rounded-xl border border-dusk-200 dark:border-dusk-800/50"
      style="aspect-ratio: 16 / 7; min-height: 260px; max-height: 378px"
    >
      <ClientOnly>
        <FFTVisualizer
          mode="external"
          :data="data"
          :data-left="dataLeft"
          :data-right="dataRight"
          :bands="BANDS"
          background="#0a0a12"
          :show-stats="false"
          v-bind="activeProps"
        />
        <template #fallback>
          <div class="absolute inset-0 grid place-items-center bg-[#0a0a12] text-sm text-white/50">
            Loading visualizer…
          </div>
        </template>
      </ClientOnly>

      <div
        v-if="!playing"
        class="absolute inset-0 grid place-items-center bg-black/40 backdrop-blur-[1px]"
      >
        <UButton
          :icon="pending ? 'i-lucide-loader-circle' : 'i-lucide-play'"
          :label="pending ? 'Connecting…' : channel.label"
          size="lg"
          :ui="{ leadingIcon: pending ? 'animate-spin' : '' }"
          @click="toggle"
        />
      </div>
    </div>

    <div class="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      <p class="text-md">
        <span
          v-if="error"
          class="text-error"
        >{{ error }}</span>
        <template v-else>
          <span v-if="nowPlaying" class="mr-4">♫ {{ nowPlaying }}</span>
          <span><UIcon name="i-lucide-radio" class="size-5 inline-flex -mb-1" /> {{ channel.label }}</span>
          <span v-if="channel.hls"> · HLS stream: it plays, but the visualizer can't read it</span>
        </template>
      </p>
      <div class="ml-auto flex flex-wrap gap-1.5">
        <UButton
          v-for="(preset, i) in presets"
          :key="preset.name"
          :label="preset.name"
          size="xs"
          :color="i === active ? 'primary' : 'neutral'"
          :variant="i === active ? 'soft' : 'ghost'"
          @click="active = i"
        />
      </div>
    </div>

    <div class="flex flex-wrap items-center gap-3">
      <div class="flex items-center gap-1">
        <UButton
          icon="i-lucide-skip-back"
          color="neutral"
          variant="ghost"
          aria-label="Previous station"
          @click="step(-1)"
        />
        <UButton
          :icon="playing ? 'i-lucide-square' : (pending ? 'i-lucide-loader-circle' : 'i-lucide-play')"
          :color="playing ? 'neutral' : 'primary'"
          :variant="playing ? 'subtle' : 'solid'"
          :aria-label="playing || pending ? 'Stop' : 'Play'"
          :ui="{ leadingIcon: pending ? 'animate-spin' : '' }"
          @click="toggle"
        />
        <UButton
          icon="i-lucide-skip-forward"
          color="neutral"
          variant="ghost"
          aria-label="Next station"
          @click="step(1)"
        />
      </div>

      <div class="flex min-w-40 flex-1 items-center gap-2">
        <UIcon
          :name="volume === 0 ? 'i-lucide-volume-x' : 'i-lucide-volume-2'"
          class="size-4 shrink-0 text-muted"
        />
        <USlider
          v-model="volume"
          :min="0"
          :max="100"
          aria-label="Volume"
        />
      </div>
    </div>

    <div class="flex flex-wrap gap-1.5">
      <UButton
        label="All"
        size="xs"
        :color="filter === 'all' ? 'primary' : 'neutral'"
        :variant="filter === 'all' ? 'soft' : 'ghost'"
        @click="storedFilter = 'all'"
      />
      <UButton
        v-for="option in channelFilters"
        :key="option.value"
        :label="option.label"
        size="xs"
        :color="filter === option.value ? 'primary' : 'neutral'"
        :variant="filter === option.value ? 'soft' : 'ghost'"
        @click="storedFilter = option.value"
      />
    </div>

    <div class="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 2xl:grid-cols-12">
      <button
        v-for="item in visibleChannels"
        :key="item.value"
        type="button"
        :aria-pressed="item.value === channelKey"
        class="flex flex-col items-center gap-1.5 rounded-lg border p-1.5 transition"
        :class="item.value === channelKey
          ? 'border-primary bg-primary/10'
          : 'border-transparent hover:border-dusk-200 hover:bg-elevated/60 dark:hover:border-dusk-800/50'"
        @click="selectChannel(item.value, true)"
      >
        <span class="relative aspect-square w-full overflow-hidden rounded-md bg-dusk-100 dark:bg-dusk-900">
          <img
            v-if="item.logo"
            :src="item.logo"
            alt=""
            loading="lazy"
            class="size-full object-cover"
          >
          <span
            v-else
            class="grid size-full place-items-center font-heading text-lg text-muted"
          >{{ initials(item.label) }}</span>
          <span
            v-if="item.value === channelKey && pending"
            class="absolute inset-0 grid place-items-center bg-black/55"
          >
            <UIcon
              name="i-lucide-loader-circle"
              class="size-6 animate-spin text-white"
            />
          </span>
        </span>
        <span
          class="line-clamp-2 text-[11px] leading-tight"
          :class="item.value === channelKey ? 'text-default' : 'text-muted'"
        >{{ tileLabel(item.label) }}</span>
      </button>
    </div>
  </div>
</template>
