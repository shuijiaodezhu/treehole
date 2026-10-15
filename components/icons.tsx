/**
 * 统一图标库
 *
 * - 具名组件（IconSun / IconMail ...）：给首页用，按需引入、可被 tree-shaking
 * - 泛型 <Icon name="..." />：给 world / play / admin 这类按名字取图标的页面用
 *
 * 所有图标共用同一套 stroke 参数，尺寸由 className（如 w-4 h-4）控制。
 */

export type IconName =
  // 首页 / 导航
  | 'leaf' | 'home' | 'sparkle' | 'box' | 'arrow' | 'mail' | 'refresh' | 'flame' | 'bell' | 'search'
  // 天气
  | 'sun' | 'moon' | 'cloud' | 'rain' | 'snow' | 'storm' | 'fog' | 'drizzle'
  // 通用
  | 'back' | 'user' | 'send' | 'heart' | 'heartfill' | 'comment' | 'alert'
  | 'pen' | 'plus' | 'clock' | 'users' | 'x' | 'check' | 'trash' | 'shield' | 'lock'
  | 'image' | 'file' | 'video' | 'download'
  | 'game' | 'music' | 'food' | 'suitcase' | 'heartbubble' | 'spiral'
  | 'dice' | 'coin' | 'target'

const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

const thin = { ...base, strokeWidth: 1.6 }

/** 图标路径表：泛型 Icon 与具名组件共用 */
function iconPath(name: IconName) {
  switch (name) {
    case 'leaf': return <><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" /><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" /></>
    case 'home': return <><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></>
    case 'sparkle': return <><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" /><circle cx="12" cy="12" r="3" /></>
    case 'box': return <><path d="M21 8v8a2 2 0 0 1-1 1.73l-7 4a2 2 0 0 1-2 0l-7-4A2 2 0 0 1 3 16V8a2 2 0 0 1 1-1.73l7-4a2 2 0 0 1 2 0l7 4A2 2 0 0 1 21 8z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" /></>
    case 'arrow': return <polyline points="9 18 15 12 9 6" />
    case 'mail': return <><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-10 5L2 7" /></>
    case 'refresh': return <><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></>
    case 'flame': return <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
    case 'bell': return <><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></>
    case 'search': return <><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></>

    case 'sun': return <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" /></>
    case 'moon': return <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    case 'cloud': return <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
    case 'rain': return <><line x1="16" y1="13" x2="16" y2="21" /><line x1="8" y1="13" x2="8" y2="21" /><line x1="12" y1="15" x2="12" y2="23" /><path d="M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25" /></>
    case 'drizzle': return <><line x1="8" y1="19" x2="8" y2="21" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="16" y1="19" x2="16" y2="21" /><path d="M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25" /></>
    case 'snow': return <><path d="M20 17.58A5 5 0 0 0 18 8h-1.26A8 8 0 1 0 4 16.25" /><line x1="8" y1="16" x2="8.01" y2="16" /><line x1="8" y1="20" x2="8.01" y2="20" /><line x1="12" y1="18" x2="12.01" y2="18" /><line x1="12" y1="22" x2="12.01" y2="22" /><line x1="16" y1="16" x2="16.01" y2="16" /><line x1="16" y1="20" x2="16.01" y2="20" /></>
    case 'storm': return <><path d="M19 16.9A5 5 0 0 0 18 7h-1.26a8 8 0 1 0-11.62 9" /><polyline points="13 11 9 17 15 17 11 23" /></>
    case 'fog': return <><path d="M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25" /><line x1="4" y1="20" x2="20" y2="20" /><line x1="6" y1="23" x2="18" y2="23" /></>

    case 'back': return <><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></>
    case 'user': return <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4.418 3.582-8 8-8s8 3.582 8 8" /></>
    case 'send': return <><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></>
    case 'heart': return <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    case 'heartfill': return <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    case 'comment': return <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    case 'alert': return <><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></>
    case 'pen': return <><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></>
    case 'plus': return <><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></>
    case 'clock': return <><circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15 15" /></>
    case 'users': return <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>
    case 'x': return <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>
    case 'check': return <polyline points="20 6 9 17 4 12" />
    case 'trash': return <><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></>
    case 'shield': return <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    case 'lock': return <><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></>
    case 'image': return <><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></>
    case 'file': return <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="8" y1="13" x2="16" y2="13" /><line x1="8" y1="17" x2="13" y2="17" /></>
    case 'video': return <><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" /></>
    case 'download': return <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></>

    case 'game': return <><line x1="6" y1="11" x2="10" y2="11" /><line x1="8" y1="9" x2="8" y2="13" /><line x1="15" y1="12" x2="15.01" y2="12" /><line x1="18" y1="10" x2="18.01" y2="10" /><path d="M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0 0 17.32 5z" /></>
    case 'music': return <><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></>
    case 'food': return <><path d="M18 8h1a4 4 0 0 1 0 8h-1" /><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" /><line x1="6" y1="1" x2="6" y2="4" /><line x1="10" y1="1" x2="10" y2="4" /><line x1="14" y1="1" x2="14" y2="4" /></>
    case 'suitcase': return <><rect x="2" y="7" width="20" height="14" rx="2" ry="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></>
    case 'heartbubble': return <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    case 'spiral': return <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="3" /></>
    case 'dice': return <><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="8" cy="8" r="1" fill="currentColor" /><circle cx="16" cy="8" r="1" fill="currentColor" /><circle cx="8" cy="16" r="1" fill="currentColor" /><circle cx="16" cy="16" r="1" fill="currentColor" /><circle cx="12" cy="12" r="1" fill="currentColor" /></>
    case 'coin': return <><circle cx="12" cy="12" r="9" /><path d="M12 7v10M9 9h4.5a2 2 0 0 1 0 4H9M9 13h4.5a2 2 0 0 1 0 4H9" /></>
    case 'target': return <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" fill="currentColor" /></>
  }
}

export function Icon({ name, className = '' }: { name: IconName; className?: string }) {
  const isFilled = name === 'heartfill'
  return (
    <svg {...(isFilled ? { ...base, fill: 'currentColor' } : base)} className={className}>
      {iconPath(name)}
    </svg>
  )
}

/* ==================== 具名图标（首页使用，按需引入） ==================== */

type IconProps = { className?: string }

export const IconLeaf = ({ className = '' }: IconProps) => <svg {...thin} className={className}>{iconPath('leaf')}</svg>
export const IconHome = ({ className = '' }: IconProps) => <svg {...thin} className={className}>{iconPath('home')}</svg>
export const IconSparkle = ({ className = '' }: IconProps) => <svg {...thin} className={className}>{iconPath('sparkle')}</svg>
export const IconBox = ({ className = '' }: IconProps) => <svg {...thin} className={className}>{iconPath('box')}</svg>
export const IconMail = ({ className = '' }: IconProps) => <svg {...thin} className={className}>{iconPath('mail')}</svg>
export const IconSearch = ({ className = '' }: IconProps) => <svg {...base} className={className}>{iconPath('search')}</svg>
export const IconRefresh = ({ className = '' }: IconProps) => <svg {...base} className={className}>{iconPath('refresh')}</svg>
export const IconSun = ({ className = '' }: IconProps) => <svg {...thin} className={className}>{iconPath('sun')}</svg>
export const IconFlame = ({ className = '' }: IconProps) => <svg {...thin} className={className}>{iconPath('flame')}</svg>
export const IconArrow = ({ className = '' }: IconProps) => <svg {...base} className={className}>{iconPath('arrow')}</svg>

/** 天气图标：按天气代码挑一个 */
export const WeatherIcon = ({ name, className = '' }: { name: IconName; className?: string }) => (
  <svg {...thin} className={className}>{iconPath(name)}</svg>
)
