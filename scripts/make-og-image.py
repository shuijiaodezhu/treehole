#!/usr/bin/env python
"""
生成分享卡片 app/opengraph-image.png（1200x630）

用法：
    python scripts/make-og-image.py

改了站名/文案之后重新跑一次即可。用系统自带的微软雅黑，
所以中文不会变成方框（Next.js 的 ImageResponse 渲染中文要额外塞字体，
直接用 Pillow 画更省事）。

版面：
    纸面 + 白卡 + 内层虚线框（边缘装饰）
    左侧：邮票（齿孔 + 虚线内框 + 笑脸）
    右上：纸飞机；左下：信封；右下：邮戳——装饰元素统一在「信」这个主题上
    右侧：站名 / 英文名 / 一句话 / 三个平级区域（院子 · 小屋 · 聚会）
"""

import math
from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H = 1200, 630
PAPER, CARD = (245, 240, 232), (255, 253, 251)
ACCENT, DEEP, INK, MUTED = (217, 119, 87), (177, 99, 73), (43, 38, 32), (180, 139, 126)
LINE, STAMP = (243, 223, 214), (253, 243, 236)
W1, W2 = (250, 221, 206), (238, 192, 170)          # 纸飞机两翼
POST = (238, 205, 187)                             # 邮戳
FONT_DIR = "C:/Windows/Fonts/"

img = Image.new("RGB", (W, H), PAPER)
glow = Image.new("RGB", (W, H), PAPER)
gd = ImageDraw.Draw(glow)
gd.ellipse([-180, -220, 520, 420], fill=(251, 233, 223))
gd.ellipse([780, 280, 1440, 880], fill=(247, 228, 216))
img = Image.blend(img, glow.filter(ImageFilter.GaussianBlur(95)), 0.5)
d = ImageDraw.Draw(img)


def text_w(text, font):
    try:
        return d.textsize(text, font=font)[0]
    except Exception:
        return font.getsize(text)[0]


def dots(dr, pts, color, w):
    r = w / 2.0
    for (x, y) in pts:
        dr.ellipse([x - r, y - r, x + r, y + r], fill=color)


def arc_pts(cx, cy, rx, ry, a0, a1, n=100, up=True):
    return [
        (
            cx + rx * math.cos(math.radians(a0 + (a1 - a0) * i / n)),
            cy - (ry * math.sin(math.radians(a0 + (a1 - a0) * i / n)) if up
                  else -ry * math.sin(math.radians(a0 + (a1 - a0) * i / n))),
        )
        for i in range(n + 1)
    ]


def circle(cx, cy, r, color):
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=color)


def rounded_on(dr, box, r, fill=None, outline=None, w=2):
    x0, y0, x1, y1 = box
    if fill:
        dr.rectangle([x0 + r, y0, x1 - r, y1], fill=fill)
        dr.rectangle([x0, y0 + r, x1, y1 - r], fill=fill)
        for cx, cy in ((x0 + r, y0 + r), (x1 - r, y0 + r), (x0 + r, y1 - r), (x1 - r, y1 - r)):
            dr.ellipse([cx - r, cy - r, cx + r, cy + r], fill=fill)
    if outline:
        dots(dr, arc_pts(x0 + r, y0 + r, r, r, 180, 270) + arc_pts(x1 - r, y0 + r, r, r, 270, 360)
             + arc_pts(x1 - r, y1 - r, r, r, 0, 90) + arc_pts(x0 + r, y1 - r, r, r, 90, 180), outline, w)
        dr.line([x0 + r, y0, x1 - r, y0], fill=outline, width=w)
        dr.line([x0 + r, y1, x1 - r, y1], fill=outline, width=w)
        dr.line([x0, y0 + r, x0, y1 - r], fill=outline, width=w)
        dr.line([x1, y0 + r, x1, y1 - r], fill=outline, width=w)


def dashed_rounded(box, r, color, w=2, seg=11, gap=12):
    """沿圆角矩形周长铺虚线（角上连续，不会断）"""
    x0, y0, x1, y1 = box

    def walk(pts):
        acc, out = 0.0, []
        for i in range(len(pts) - 1):
            (ax, ay), (bx, by) = pts[i], pts[i + 1]
            L = math.hypot(bx - ax, by - ay)
            t = 0.0
            while t < L:
                phase = (acc + t) % (seg + gap)
                if phase < seg:
                    tt = min(t + (seg - phase), L)
                    out.append(((ax + (bx - ax) * t / L, ay + (by - ay) * t / L),
                                (ax + (bx - ax) * tt / L, ay + (by - ay) * tt / L)))
                    t = tt
                else:
                    t += (seg + gap - phase)
            acc += L
        return out

    def corner(cx, cy, a0):
        return [(cx + r * math.cos(math.radians(a)), cy + r * math.sin(math.radians(a)))
                for a in [a0 + (90 * i / 10) for i in range(11)]]

    path = (corner(x0 + r, y0 + r, 180) + corner(x1 - r, y0 + r, 270)
            + corner(x1 - r, y1 - r, 0) + corner(x0 + r, y1 - r, 90)
            + [corner(x0 + r, y0 + r, 180)[0]])
    for (p, q) in walk(path):
        d.line([p, q], fill=color, width=w)


# ---------- 卡片 + 内层虚线框 ----------
rounded_on(d, [52, 52, W - 52, H - 52], 42, fill=CARD, outline=LINE)
dashed_rounded([92, 92, W - 92, H - 92], 30, LINE, 2, 11, 13)


# ---------- 装饰一：纸飞机（右上） ----------
def plane(ox, oy, s):
    def P(x, y):
        return (ox + x * s, oy + y * s)

    A, B, C, D = P(30, 0), P(0, 22), P(14, 26), P(22, 36)
    d.polygon([A, B, C], fill=W1)
    d.polygon([A, C, D], fill=W2)
    d.line([A, C], fill=ACCENT, width=max(2, int(1.1 * s)))
    for i, (x, y) in enumerate([(-4, 10), (-11, 16), (-18, 22)]):
        dots(d, [P(x, y)], (243, 208, 190), max(2, int((1.6 - i * 0.4) * s * 2.2)))


plane(985, 126, 3.0)


# ---------- 装饰二：信封（直接画，不用旋转图层） ----------


def draw_envelope(cx, cy, width, color, seal=(240, 196, 176)):
    h = int(width * 0.66)
    x0, y0 = int(cx - width / 2), int(cy - h / 2)
    x1, y1 = x0 + width, y0 + h
    rounded_on(d, [x0, y0, x1, y1], 10, fill=(253, 246, 241), outline=color, w=3)
    # 信封盖：两角向中间收
    tipy = y0 + h * 0.46
    d.line([x0 + 5, y0 + 5, (x0 + x1) / 2, tipy], fill=color, width=3)
    d.line([x1 - 5, y0 + 5, (x0 + x1) / 2, tipy], fill=color, width=3)
    # 火漆印
    scx, scy = (x0 + x1) / 2, tipy + 7
    r = max(8, int(width * 0.075))
    d.ellipse([scx - r, scy - r, scx + r, scy + r], fill=seal)
    d.ellipse([scx - r / 2.4, scy - r / 2.4, scx + r / 2.4, scy + r / 2.4], fill=(252, 236, 228))


# ---------- 装饰三：邮戳（右下） ----------
def postmark(cx, cy, r):
    circle(cx, cy, r, POST)
    circle(cx, cy, r - 3, CARD)
    circle(cx, cy, r - 9, POST)
    circle(cx, cy, r - 12, CARD)
    # 中间的日期短线
    d.line([cx - 15, cy - 2, cx + 15, cy - 2], fill=POST, width=3)
    d.line([cx - 10, cy + 8, cx + 10, cy + 8], fill=POST, width=3)
    # 右侧的波浪销票纹
    for k in range(3):
        pts = [(cx + r + 8 + i * 2.6, cy - 14 + k * 14 + 4 * math.sin(i / 2.4 + k)) for i in range(17)]
        dots(d, pts, POST, 4)


postmark(1006, 452, 38)

for i, (x, y) in enumerate([(1046, 232), (1070, 258), (1094, 284), (1070, 206)]):
    dots(d, [(x, y)], (246, 216, 200), 6 - (i % 2) * 2)


# ---------- 邮票（含笑脸） ----------
sx0, sy0, sx1, sy1 = 152, 168, 372, 436
for x in range(sx0 + 6, sx1 - 4, 20):
    for y in (sy0, sy1):
        d.ellipse([x - 8, y - 8, x + 8, y + 8], fill=CARD)
for y in range(sy0 + 6, sy1 - 4, 20):
    for x in (sx0, sx1):
        d.ellipse([x - 8, y - 8, x + 8, y + 8], fill=CARD)
rounded_on(d, [sx0, sy0, sx1, sy1], 12, fill=STAMP, outline=(240, 208, 192))
dashed_rounded([sx0 + 14, sy0 + 14, sx1 - 14, sy1 - 14], 8, (247, 224, 210), 2, 8, 9)


# 邮票里放信封（原来是笑脸）
draw_envelope((sx0 + sx1) / 2, sy0 + 115, 150, ACCENT)

f_title = ImageFont.truetype(FONT_DIR + "msyhbd.ttc", 78)
f_sub = ImageFont.truetype(FONT_DIR + "msyh.ttc", 31)
f_desc = ImageFont.truetype(FONT_DIR + "msyh.ttc", 25)
f_top = ImageFont.truetype(FONT_DIR + "msyhbd.ttc", 27)
f_tiny = ImageFont.truetype(FONT_DIR + "msyh.ttc", 18)

label = "Dear You"
d.text(((sx0 + sx1) / 2 - text_w(label, f_tiny) / 2, sy0 + 184), label, font=f_tiny, fill=(216, 166, 142))

# ---------- 文字 ----------
tx = 442
d.text((tx, 190), "你的来信", font=f_title, fill=INK)
d.text((tx, 296), "Dear You", font=f_sub, fill=ACCENT)
d.text((tx, 344), "这里有一封，你的来信", font=f_desc, fill=MUTED)
d.line([tx, 402, tx + 52, 402], fill=ACCENT, width=3)

# 三个平级区域
top_y = 434
xs = [tx, tx + 92, tx + 184]
for i, (txt, x) in enumerate(zip(["院子", "小屋", "聚会"], xs)):
    d.text((x, top_y), txt, font=f_top, fill=DEEP)
    if i < 2:
        d.text((x + 64, top_y + 2), "·", font=f_top, fill=(230, 202, 188))

img.save("app/opengraph-image.png")
print("已写入 app/opengraph-image.png")
