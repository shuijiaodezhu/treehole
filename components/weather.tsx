'use client'

import { useEffect, useState } from 'react'
import { peek } from './local-store'
import type { IconName } from './icons'
import { DEFAULT_CITY, DEFAULT_LAT, DEFAULT_LON } from './utils'

/* ==================== 类型 ==================== */

export type WeatherState = {
  city: string
  temp: number
  tempMax: number
  tempMin: number
  condition: string
  icon: IconName
  /** true = 实时数据；false = 占位/降级数据 */
  isLive: boolean
}

/* ==================== WMO 天气代码 → 中文描述 + 图标 ==================== */

function describeWeather(code: number): { condition: string; icon: IconName } {
  if (code === 0) return { condition: '晴', icon: 'sun' }
  if (code === 1) return { condition: '晴间多云', icon: 'sun' }
  if (code === 2) return { condition: '多云', icon: 'cloud' }
  if (code === 3) return { condition: '阴', icon: 'cloud' }
  if (code === 45 || code === 48) return { condition: '有雾', icon: 'fog' }
  if (code >= 51 && code <= 57) return { condition: '毛毛雨', icon: 'drizzle' }
  if (code === 66 || code === 67) return { condition: '冻雨', icon: 'rain' }
  if (code >= 61 && code <= 65) return { condition: '下雨', icon: 'rain' }
  if (code >= 71 && code <= 77) return { condition: '下雪', icon: 'snow' }
  if (code >= 80 && code <= 82) return { condition: '阵雨', icon: 'rain' }
  if (code === 85 || code === 86) return { condition: '阵雪', icon: 'snow' }
  if (code >= 95) return { condition: '雷阵雨', icon: 'storm' }
  return { condition: '多云', icon: 'cloud' }
}

/** 首屏 / 降级用占位数据，避免接口未返回时布局跳动 */
function fallbackWeather(): WeatherState {
  return {
    city: '',
    temp: 18,
    tempMax: 20,
    tempMin: 12,
    condition: '晴',
    icon: 'sun',
    isLive: false,
  }
}

/* ==================== 定位 ==================== */

type Coords = { lat: number; lon: number }

function getPosition(timeoutMs = 6000): Promise<Coords> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('当前环境不支持定位'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      (err) => reject(err),
      { timeout: timeoutMs, maximumAge: 10 * 60 * 1000 },
    )
  })
}

/**
 * 逆地理编码取城市名（免费、无需 key）。
 *
 * 为什么要两个接口：bigdatacloud 是境外服务，国内网络经常直接连不上；
 * 连不上时原来的实现会返回默认城市（徐州）—— 于是**每个访客都看到站主的城市**。
 * 现在：两个都试；都拿不到就返回 null，调用处会退到"不说城市"或 IP 城市。
 */
async function fetchCityName(
  lat: number,
  lon: number,
  signal: AbortSignal,
): Promise<string | null> {
  const pick = (json: unknown, keys: string[]): string | null => {
    if (typeof json !== 'object' || json === null) return null
    const rec = json as Record<string, unknown>
    for (const key of keys) {
      const value = rec[key]
      if (typeof value === 'string' && value.trim()) return value.trim()
    }
    return null
  }

  // ① bigdatacloud
  try {
    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=zh`,
      { signal },
    )
    if (res.ok) {
      /*
     * 顺序很重要：这个接口带了 localityLanguage=zh，
     *   但它同时返回
     *     city     = Xuzhou   （英文/拼音）
     *     locality = 徐州      （中文）
     *   原来先取 city ✗ → 界面上永远是拼音（用户报的"怎么是拼音"）
     *   → 先取 locality ✓ 取不到再退 city ✓
     */
    const name = pick(await res.json(), ['locality', 'city', 'principalSubdivision'])
      if (name) return name
    }
  } catch {
    /* 继续试下一个 */
  }

  // ② nominatim（OpenStreetMap）
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&zoom=10&accept-language=zh&lat=${lat}&lon=${lon}`,
      { signal },
    )
    if (res.ok) {
      const json = (await res.json()) as { address?: unknown }
      const name = pick(json?.address, ['city', 'town', 'county', 'state', 'province'])
      if (name) return name
    }
  } catch {
    /* 继续试下一个 */
  }

  return null
}

/**
 * IP 粗定位：定位被拒 / 超时 / 浏览器不支持时的兜底。
 *
 * 为什么必须有这一步：
 *   原来的兜底是写死的 DEFAULT_CITY（站主所在城市），
 *   于是**每个访客看到的都是站主的城市** —— 等于把站主的地址贴给所有人。
 *   IP 粗定位不需要授权、不弹窗，能给到大致城市，比"显示别人的城市"好得多。
 *
 * 结果缓存一天：同一个网络没必要每次都问。
 * 拿不到就返回 null（调用处会退到"不说城市"）。
 */
type IpInfo = { city: string; lat: number; lon: number }

async function ipLocate(signal: AbortSignal): Promise<IpInfo | null> {
  try {
    const cached = window.localStorage.getItem('treehole:ipcity:zh')
    if (cached) {
      const parsed = JSON.parse(cached) as IpInfo
      if (
        parsed &&
        typeof parsed.city === 'string' &&
        typeof parsed.lat === 'number' &&
        typeof parsed.lon === 'number'
      ) {
        return parsed
      }
    }
  } catch {
    /* 忽略 */
  }

  try {
    const res = await fetch('https://ipwho.is/?lang=zh', { signal })
    if (!res.ok) return null
    const json = (await res.json()) as {
      success?: boolean
      city?: string
      latitude?: number
      longitude?: number
    }
    if (json?.success === false) return null
    if (typeof json?.city !== 'string' || !json.city.trim()) return null
    if (typeof json?.latitude !== 'number' || typeof json?.longitude !== 'number') return null

    const info: IpInfo = { city: json.city.trim(), lat: json.latitude, lon: json.longitude }
    try {
      window.localStorage.setItem('treehole:ipcity:zh', JSON.stringify(info))
    } catch {
      /* 忽略 */
    }
    return info
  } catch {
    return null
  }
}

/* ==================== 天气接口（Open-Meteo，无需 API key） ==================== */

type OpenMeteoResponse = {
  current?: { temperature_2m?: number; weather_code?: number }
  daily?: { temperature_2m_max?: number[]; temperature_2m_min?: number[] }
}

async function fetchWeather(
  lat: number,
  lon: number,
  city: string,
  signal: AbortSignal,
): Promise<WeatherState | null> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,weather_code` +
    `&daily=temperature_2m_max,temperature_2m_min` +
    `&timezone=auto&forecast_days=1`

  const res = await fetch(url, { signal })
  if (!res.ok) return null

  const json = (await res.json()) as OpenMeteoResponse
  const temp = json.current?.temperature_2m
  const code = json.current?.weather_code
  if (typeof temp !== 'number' || typeof code !== 'number') return null

  const { condition, icon } = describeWeather(code)
  const max = json.daily?.temperature_2m_max?.[0]
  const min = json.daily?.temperature_2m_min?.[0]

  return {
    city,
    temp: Math.round(temp),
    tempMax: typeof max === 'number' ? Math.round(max) : Math.round(temp),
    tempMin: typeof min === 'number' ? Math.round(min) : Math.round(temp),
    condition,
    icon,
    isLive: true,
  }
}

/* ==================== 资料里的城市（最优先） ==================== */

/** 读用户资料里填的城市（开屏同步存在本机的 me-profile，0 请求） */
function readProfileCity(): string {
  try {
    const me = peek<{ location?: string | null }>('me-profile', 24 * 60 * 60 * 1000)
    const v = (me?.location ?? '').trim()
    return v
  } catch {
    return ''
  }
}

/**
 * 城市名 → 坐标（Open-Meteo 地理编码，免费无需 key）
 *
 * 为什么要它：如果只用名字、坐标却还是别处的，就会出现
 *   "写着六安、天气是徐州的" 这种错位 ✗
 * 拿不到坐标时返回 null → 上层只显示名字、坐标用默认值（至少名字是对的）
 */
async function geocodeCity(
  name: string,
  signal: AbortSignal,
): Promise<{ lat: number; lon: number; name: string } | null> {
  try {
    const url =
      'https://geocoding-api.open-meteo.com/v1/search?name=' +
      encodeURIComponent(name) +
      '&count=1&language=zh&format=json'
    const res = await fetch(url, { signal })
    if (!res.ok) return null
    const json = (await res.json()) as {
      results?: { latitude: number; longitude: number; name?: string }[]
    }
    const r = json.results?.[0]
    if (!r || typeof r.latitude !== 'number' || typeof r.longitude !== 'number') return null
    return { lat: r.latitude, lon: r.longitude, name: (r.name || name).trim() }
  } catch {
    return null
  }
}

/* ==================== Hook ==================== */

/**
 * 定位 → 取城市名 → 拉天气。
 * 定位被拒 / 网络失败 / 组件卸载 → 静默降级到占位数据，不阻塞页面、不抛错。
 */
export function useWeather(): WeatherState {
  const [weather, setWeather] = useState<WeatherState>(fallbackWeather)

  useEffect(() => {
    const controller = new AbortController()

    async function run() {
      let coords: Coords = { lat: DEFAULT_LAT, lon: DEFAULT_LON }
      let city = DEFAULT_CITY
      let located = false

      /*
       * 优先级（用户报"为啥跳到北京了"之后定的）：
       *   ① **资料里填的城市** ✓ 用户自己填的，确定、稳定、不受代理/运营商影响
       *   ② 精确定位（GPS，需要授权）
       *   ③ IP 兜底 —— 只在前两条都拿不到时用，而且它可能因为代理而指到别的地方
       * 之前是 ②③ 优先 ✗ 于是"拒绝定位 + 挂代理"就会显示成北京 ✓
       */
      const profileCity = readProfileCity()
      if (profileCity) {
        const geo = await geocodeCity(profileCity, controller.signal)
        if (controller.signal.aborted) return
        if (geo) {
          coords = { lat: geo.lat, lon: geo.lon }
          city = geo.name || profileCity
        } else {
          // 查不到坐标：名字照用，坐标用默认值（至少名字不会因为代理而变）
          city = profileCity
        }
        located = true
        try {
          const data = await fetchWeather(coords.lat, coords.lon, city, controller.signal)
          if (controller.signal.aborted) return
          if (data) setWeather({ ...data, city })
          else setWeather((prev) => ({ ...prev, city, isLive: false }))
        } catch {
          /* 保持占位数据 */
        }
        return
      }

      try {
        coords = await getPosition()
        located = true
        const named = await fetchCityName(coords.lat, coords.lon, controller.signal)
        if (named) {
          city = named
        } else {
          // 坐标有了，但查不到城市名 → 用 IP 城市补一下（不弹窗）
          const byIp = await ipLocate(controller.signal)
          city = byIp?.city ?? ''
        }
      } catch {
        /*
         * 定位被拒 / 超时 / 不支持 → 先试 IP 粗定位（不弹窗、不需要权限）。
         * 两条路都失败才退到默认值，并且**不显示城市** ——
         * 宁可不说城市，也不说错的城市（原来会让每个访客都看到"徐州"）。
         */
        const byIp = await ipLocate(controller.signal)
        if (byIp) {
          coords = { lat: byIp.lat, lon: byIp.lon }
          city = byIp.city
          located = true
        } else {
          city = ''
        }
      }

      if (controller.signal.aborted) return

      try {
        const data = await fetchWeather(coords.lat, coords.lon, city, controller.signal)
        if (controller.signal.aborted) return
        if (data) setWeather({ ...data, city, isLive: located })
        else if (located) setWeather((prev) => ({ ...prev, city, isLive: false }))
      } catch {
        // 网络异常：保持占位数据
      }
    }

    void run()
    return () => controller.abort()
  }, [])

  return weather
}

/** 给卡片用的一句体贴话术，按温度/天气生成 */
export function weatherAdvice(state: WeatherState): string {
  if (!state.isLive) return '定位未开启，先用占位数据陪你一会儿。'
  if (state.icon === 'rain' || state.icon === 'drizzle' || state.icon === 'storm') return '外面在下雨，记得带伞。'
  if (state.icon === 'snow') return '下雪了，路上小心。'
  if (state.temp >= 30) return '今天很热，多喝水。'
  if (state.temp <= 5) return '今天很冷，穿厚一点。'
  if (state.temp <= 15) return '今天有点凉，记得加件衣服。'
  return '今天温度刚好，出去走走吧。'
}
