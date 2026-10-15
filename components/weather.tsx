'use client'

import { useEffect, useState } from 'react'
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
export function fallbackWeather(): WeatherState {
  return {
    city: DEFAULT_CITY,
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

/** 逆地理编码取城市名（免费、无需 key），失败则沿用默认城市名 */
async function fetchCityName(lat: number, lon: number, signal: AbortSignal): Promise<string> {
  try {
    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=zh`,
      { signal },
    )
    if (!res.ok) return DEFAULT_CITY
    const json: unknown = await res.json()
    if (typeof json === 'object' && json !== null) {
      const rec = json as Record<string, unknown>
      for (const key of ['city', 'locality', 'principalSubdivision']) {
        const value = rec[key]
        if (typeof value === 'string' && value.trim()) return value.trim()
      }
    }
    return DEFAULT_CITY
  } catch {
    return DEFAULT_CITY
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

      try {
        coords = await getPosition()
        located = true
        city = await fetchCityName(coords.lat, coords.lon, controller.signal)
      } catch {
        // 定位失败：用默认城市继续尝试取天气
      }

      if (controller.signal.aborted) return

      try {
        const data = await fetchWeather(coords.lat, coords.lon, city, controller.signal)
        if (controller.signal.aborted) return
        if (data) setWeather(data)
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
