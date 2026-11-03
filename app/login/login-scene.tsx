'use client'

/**
 * 登录页的静态场景（v1）
 *
 * 设计意图：不用站内那套动态视频背景 —— 登录是"门槛"，
 * 应该像一个**安静的桌面**：一张暖色纸、一道斜光、一封还没拆的信。
 * 全部用 CSS 画，不加载任何视频和图片，首屏最快。
 */
export function LoginScene() {
  return (
    <div className={"lg-scene"} aria-hidden="true">
      {/* 底层：暖色纸 */}
      <div className={"lg-paper"} />
      {/* 一道斜射进来的光 */}
      <div className={"lg-light"} />
      {/* 桌面上的信封（未拆） */}
      <div className={"lg-letter"}>
        <div className={"lg-letterFlap"} />
        <div className={"lg-letterBody"} />
        <div className={"lg-letterSeal"} />
      </div>
      {/* 纸张颗粒 */}
      <div className={"lg-grain"} />
      {/* 四角压暗，把视线收到中间 */}
      <div className={"lg-vignette"} />
    </div>
  )
}
