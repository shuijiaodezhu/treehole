'use client'

/**
 * 兜底错误边界
 *
 * app/error.tsx 管的是「页面内部」出错；如果连根 layout 都挂了
 * （比如主题脚本、字体加载阶段炸了），就要靠这个。
 * 它必须自己带 <html> / <body>，而且**不能用任何依赖 layout 的东西**
 * （主题变量、字体类名都可能还没生效），所以这里只写最朴素的内联样式。
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="zh-CN">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f5f0e8',
          color: '#2b2620',
          fontFamily: 'system-ui, -apple-system, "Microsoft YaHei", sans-serif',
          padding: '24px',
          textAlign: 'center',
        }}
      >
        <h1 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>站点没能打开</h1>
        <p style={{ fontSize: '12.5px', color: '#b48b7e', marginTop: '10px', lineHeight: 1.7 }}>
          刷新一下多半就好。
          <br />
          要是一直这样，跟站主说一声。
        </p>
        {error.digest && (
          <p style={{ fontSize: '10px', color: '#b48b7e', marginTop: '8px' }}>
            编号 {error.digest}
          </p>
        )}
        <button
          type="button"
          onClick={reset}
          style={{
            marginTop: '20px',
            border: 'none',
            borderRadius: '999px',
            padding: '10px 20px',
            background: '#d97757',
            color: '#fff',
            fontSize: '12.5px',
            cursor: 'pointer',
          }}
        >
          再试一次
        </button>
      </body>
    </html>
  )
}
