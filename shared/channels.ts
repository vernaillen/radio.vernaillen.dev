/**
 * The station list, shared by the browser UI and the Nitro proxy
 * (server/api/radio.get.ts) so both agree on what `?station=<value>` means.
 */

export interface RadioChannel {
  /** Shown on the station tile and in the status line. */
  label: string
  /** Stable key: the `?station=` value and the v-model binding. */
  value: string
  /** Upstream stream URL. Fetched by the proxy, not by the browser — except
   *  for HLS, which the browser loads directly (see `hls`). */
  src: string
  /** Station artwork under public/images/stations/. Omitted where no logo
   *  could be sourced; the tile falls back to the station's initials. */
  logo?: string
  /** HLS/m3u8 playlists can't be piped through the byte proxy, so these play
   *  straight from source. Native <audio> HLS is Safari-only, and the stream
   *  sends no CORS header, so the visualizer stays flat on these. */
  hls?: boolean
  /** SomaFM station id, enabling the now-playing feed at
   *  https://somafm.com/songs/<id>.json (CORS-enabled). */
  soma?: string
}

/** Served by /api/radio with no `?station=` — the contract the embedded player
 *  on vernaillen.dev relies on, so don't repoint it. */
export const DEFAULT_STATION = 'gsclassic'

export const channels: RadioChannel[] = [
  {
    label: 'Radio 1',
    value: 'radio1',
    src: 'https://quantumcast.vrtcdn.be/radio1/mp3-128',
    logo: '/images/stations/radio1.png'
  },
  {
    label: 'Radio 1 Classics',
    value: 'radio1classics',
    src: 'https://quantumcast.vrtcdn.be/radio1_classics/mp3-128',
    logo: '/images/stations/radio1classics.png'
  },
  {
    label: 'Radio 2 Oost-Vlaanderen',
    value: 'radio2',
    src: 'https://quantumcast.vrtcdn.be/ra2ovl/mp3-128',
    logo: '/images/stations/radio2.jpg'
  },
  {
    label: 'StuBru',
    value: 'stubru',
    src: 'https://quantumcast.vrtcdn.be/stubru/mp3-128',
    logo: '/images/stations/stubru.png'
  },
  {
    label: 'StuBru De Tijdloze',
    value: 'studbrutijdloze',
    src: 'https://quantumcast.vrtcdn.be/stubru_tijdloze/mp3-128',
    logo: '/images/stations/studbrutijdloze.jpg'
  },
  {
    label: 'StuBru UNTZ',
    value: 'stubruuntz',
    src: 'https://quantumcast.vrtcdn.be/stubru_untz/mp3-128',
    logo: '/images/stations/stubruuntz.png'
  },
  {
    label: 'StuBru Vuurland',
    value: 'stubruvuurland',
    src: 'https://quantumcast.vrtcdn.be/stubru_tgs/mp3-128',
    logo: '/images/stations/stubruvuurland.png'
  },
  {
    label: 'StuBru De Jaren Nul',
    value: 'stubrudejarennul',
    src: 'https://quantumcast.vrtcdn.be/stubru_dejarennul/mp3-128',
    logo: '/images/stations/stubrudejarennul.jpg'
  },
  {
    // Plain HTTP on a non-standard port, which only works because the proxy
    // fetches it server-side — the browser never sees the mixed-content URL.
    label: 'Urgent.fm',
    value: 'urgentfm',
    src: 'http://urgentstream.radiostudio.be:8000/live',
    logo: '/images/stations/urgentfm.png'
  },
  {
    label: 'Willy',
    value: 'willy',
    src: 'https://icecast-qmusicbe-cdp.triple-it.nl/willy.mp3',
    logo: '/images/stations/willy.jpg'
  },
  {
    label: 'ZenFM',
    value: 'zenfm',
    src: 'https://25553.live.streamtheworld.com/TOPZEN.mp3?dist=website?lsid=app:adbc632a-bb9c-46e3-b3dc-f4df5e2cb586',
    logo: '/images/stations/zenfm.png'
  },
  {
    label: 'BRUZZ',
    value: 'bruzz',
    src: 'https://i1.cdn.jetstre.am:8000/sz=fmbrussel=BRUZZ_HQ',
    logo: '/images/stations/bruzz.png'
  },
  {
    label: 'ORF Radio FM4',
    value: 'orfmf4',
    src: 'https://orf-live.ors-shoutcast.at/fm4-q2a',
    logo: '/images/stations/orfmf4.png'
  },
  {
    label: 'We House Tunein Radio',
    value: 'wehousetunein',
    src: 'https://icecast9.play.cz/zun192.mp3'
  },
  {
    label: 'SomaFM Groove Salad Classic',
    value: 'gsclassic',
    src: 'https://ice2.somafm.com/gsclassic-128-mp3',
    logo: '/images/stations/gsclassic.jpg',
    soma: 'gsclassic'
  },
  {
    label: 'SomaFM Groove Salad',
    value: 'groovesalad',
    src: 'https://ice4.somafm.com/groovesalad-128-mp3',
    logo: '/images/stations/groovesalad.png',
    soma: 'groovesalad'
  },
  {
    label: 'SomaFM Beat Blender',
    value: 'beatblender',
    src: 'https://ice2.somafm.com/beatblender-128-mp3',
    logo: '/images/stations/beatblender.png',
    soma: 'beatblender'
  },
  {
    label: 'SomaFM Suburbs of Goa',
    value: 'suburbsofgoa',
    src: 'https://ice2.somafm.com/suburbsofgoa-128-mp3',
    logo: '/images/stations/suburbsofgoa.png',
    soma: 'suburbsofgoa'
  },
  {
    label: 'SomaFM The Trip',
    value: 'thetrip',
    src: 'https://ice2.somafm.com/thetrip-128-mp3',
    logo: '/images/stations/thetrip.jpg',
    soma: 'thetrip'
  },
  {
    label: 'SomaFM Illinois Street Lounge',
    value: 'illinoisstreetlounge',
    src: 'https://ice6.somafm.com/illstreet-128-mp3',
    logo: '/images/stations/illinoisstreetlounge.jpg',
    soma: 'illstreet'
  },
  {
    label: 'SomaFM Bossa Beyond',
    value: 'bossabeyond',
    src: 'https://ice2.somafm.com/bossa-128-mp3',
    logo: '/images/stations/bossabeyond.jpg',
    soma: 'bossa'
  },
  {
    label: 'SomaFM Heavyweight Reggae',
    value: 'heavyweightreggae',
    src: 'https://ice2.somafm.com/reggae-128-mp3',
    logo: '/images/stations/heavyweightreggae.png',
    soma: 'reggae'
  },
  {
    label: 'SomaFM Lush',
    value: 'lush',
    src: 'https://ice2.somafm.com/lush-128-mp3',
    logo: '/images/stations/lush.png',
    soma: 'lush'
  },
  {
    label: 'FIP Groove',
    value: 'fipgroove',
    src: 'https://icecast.radiofrance.fr/fipgroove-midfi.mp3',
    logo: '/images/stations/fipgroove.webp'
  },
  {
    label: 'FIP Electro',
    value: 'fipelectro',
    src: 'https://icecast.radiofrance.fr/fipelectro-midfi.mp3',
    logo: '/images/stations/fipelectro.webp'
  },
  {
    label: 'FIP Reggae',
    value: 'fipreggae',
    src: 'https://icecast.radiofrance.fr/fipreggae-midfi.mp3',
    logo: '/images/stations/fipreggae.webp'
  },
  {
    label: 'FIP Cultes',
    value: 'fipcultes',
    src: 'https://icecast.radiofrance.fr/fipcultes-midfi.mp3',
    logo: '/images/stations/fipcultes.webp'
  },
  {
    label: 'Mouv\'',
    value: 'mouv',
    src: 'https://icecast.radiofrance.fr/mouv-midfi.mp3',
    logo: '/images/stations/mouv.webp'
  },
  {
    label: 'Perfect New Age',
    value: 'perfectnewage',
    src: 'https://n0e.radiojar.com/cxases7nabuvv?rj-ttl=5&rj-tok=AAABlCgq1YsANP3-MA3oVuyLjw'
  },
  {
    label: 'Zen Garden - My Noise',
    value: 'zengardenmynoise',
    src: 'https://zengarden-mynoise.radioca.st/stream',
    logo: '/images/stations/zengardenmynoise.png'
  }
]

export function getChannel(value: string): RadioChannel | undefined {
  return channels.find(channel => channel.value === value)
}

/** Wraps around at both ends so the skip buttons never dead-end. */
export function stepChannel(value: string, delta: number): RadioChannel {
  const index = channels.findIndex(channel => channel.value === value)
  const next = (index + delta + channels.length) % channels.length
  return channels[next]!
}
