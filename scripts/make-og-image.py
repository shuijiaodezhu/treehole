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
    左侧：邮票（齿孔 + 虚线内框 + 可爱笑脸）
    右上：纸飞机；左下：叶子小枝；右下：小点
    右侧：站名 / 英文名 / 一句话 / 三个平级区域 + 小屋的子项（树形连接）
"""

import math
from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H = 1200, 630
PAPER, CARD = (245, 240, 232), (255, 253, 251)
ACCENT, DEEP, INK, MUTED = (217, 119, 87), (177, 99, 73), (43, 38, 32), (180, 139, 126)
LINE, STAMP = (243, 223, 214), (253, 243, 236)
W1, W2 = (250, 221, 206), (238, 192, 170)
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


def dots(pts, color, w):
    r = w / 2.0
    for (x, y) in pts:
        d.ellipse([x - r, y - r, x + r, y + r], fill=color)


def arc_pts(cx, cy, rx, ry, a0, a1, n=100, up=True):
    return [
        (
            cx + rx * math.cos(math.radians(a0 + (a1 - a0) * i / n)),
            cy - (ry * math.sin(math.radians(a0 + (a1 - a0) * i / n)) if up
                  else -ry * math.sin(math.radians(a0 + (a1 - a0) * i / n))),
        )
        for i in range(n + 1)
    ]


def rounded(box, r, fill, outline=None, w=2):
    x0, y0, x1, y1 = box
    d.rectangle([x0 + r, y0, x1 - r, y1], fill=fill)
    d.rectangle([x0, y0 + r, x1, y1 - r], fill=fill)
    for cx, cy in ((x0 + r, y0 + r), (x1 - r, y0 + r), (x0 + r, y1 - r), (x1 - r, y1 - r)):
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=fill)
    if outline:
        dots(
            arc_pts(x0 + r, y0 + r, r, r, 180, 270) + arc_pts(x1 - r, y0 + r, r, r, 270, 360)
            + arc_pts(x1 - r, y1 - r, r, r, 0, 90) + arc_pts(x0 + r, y1 - r, r, r, 90, 180),
            outline, w,
        )
        d.line([x0 + r, y0, x1 - r, y0], fill=outline, width=w)
        d.line([x0 + r, y1, x1 - r, y1], fill=outline, width=w)
        d.line([x0, y0 + r, x0, y1 - r], fill=outline, width=w)
        d.line([x1, y0 + r, x1, y1 - r], fill=outline, width=w)


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
rounded([52, 52, W - 52, H - 52], 42, CARD, LINE)
dashed_rounded([92, 92, W - 92, H - 92], 30, LINE, 2, 11, 13)


# ---------- 装饰：纸飞机（右上） ----------
def plane(ox, oy, s):
    def P(x, y):
        return (ox + x * s, oy + y * s)

    A, B, C, D = P(30, 0), P(0, 22), P(14, 26), P(22, 36)
    d.polygon([A, B, C], fill=W1)
    d.polygon([A, C, D], fill=W2)
    d.line([A, C], fill=ACCENT, width=max(2, int(1.1 * s)))
    for i, (x, y) in enumerate([(-4, 10), (-11, 16), (-18, 22)]):
        dots([P(x, y)], (243, 208, 190), max(2, int((1.6 - i * 0.4) * s * 2.2)))


plane(985, 126, 3.0)


# ---------- 装饰：叶子小枝（左下，整个留在虚线框内） ----------
def leaf(cx, cy, angle_deg, length, width, color):
    a = math.radians(angle_deg)
    pts = []
    for side in (1, -1):
        rng = range(0, 33) if side == 1 else range(32, -1, -1)
        for i in rng:
            t = i / 32.0
            px, py = t * length, side * math.sin(math.pi * t) * width / 2.0
            pts.append((cx + px * math.cos(a) - py * math.sin(a),
                        cy + px * math.sin(a) + py * math.cos(a)))
    d.polygon(pts, fill=color)


stem = [(126 + 8 * math.sin(i / 22 * math.pi), 526 - i * 2.9) for i in range(23)]
dots(stem, (226, 186, 166), 5)
for (bx, by), ang, L, Wd, col in [((132, 500), -50, 70, 30, (249, 218, 202)),
                                  ((138, 472), -130, 64, 27, (252, 228, 216)),
                                  ((144, 448), -44, 56, 23, (247, 212, 196))]:
    leaf(bx, by, ang, L, Wd, col)

for i, (x, y) in enumerate([(1096, 336), (1122, 362), (1148, 388), (1122, 312)]):
    dots([(x, y)], (246, 216, 200), 6 - (i % 2) * 2)


# ---------- 邮票（含笑脸） ----------
sx0, sy0, sx1, sy1 = 152, 168, 372, 436
for x in range(sx0 + 6, sx1 - 4, 20):
    for y in (sy0, sy1):
        d.ellipse([x - 8, y - 8, x + 8, y + 8], fill=CARD)
for y in range(sy0 + 6, sy1 - 4, 20):
    for x in (sx0, sx1):
        d.ellipse([x - 8, y - 8, x + 8, y + 8], fill=CARD)
rounded([sx0, sy0, sx1, sy1], 12, STAMP, (240, 208, 192), 2)
dashed_rounded([sx0 + 14, sy0 + 14, sx1 - 14, sy1 - 14], 8, (247, 224, 210), 2, 8, 9)


def draw_face(ox, oy, size, color, bg):
    """和站内表情按钮同一张笑脸（比例经渲染核对过）"""
    k = size / 24.0

    def P(x, y):
        return (ox + x * k, oy + y * k)

    d.ellipse([P(12 - 9.2, 12 - 9.2), P(12 + 9.2, 12 + 9.2)], fill=color)
    inner = 9.2 - 0.7
    d.ellipse([P(12 - inner, 12 - inner), P(12 + inner, 12 + inner)], fill=bg)
    for cx in (9.6, 14.4):
        d.polygon(arc_pts(*P(cx, 10.5), 1.2 * k, 1.05 * k, 180, 360)
                  + arc_pts(*P(cx, 10.5), 1.2 * k, 0.35 * k, 180, 360), fill=color)
    dots(arc_pts(*P(12, 14.2), 3.0 * k, 1.35 * k, 0, 180, up=False), color, max(2.0, 1.15 * k))
    for cx in (6.9, 17.1):
        d.ellipse([P(cx - 0.85, 13 - 0.85), P(cx + 0.85, 13 + 0.85)], fill=(240, 202, 190))


draw_face(sx0 + 42, sy0 + 34, 136, ACCENT, STAMP)

f_title = ImageFont.truetype(FONT_DIR + "msyhbd.ttc", 78)
f_sub = ImageFont.truetype(FONT_DIR + "msyh.ttc", 31)
f_desc = ImageFont.truetype(FONT_DIR + "msyh.ttc", 25)
f_top = ImageFont.truetype(FONT_DIR + "msyhbd.ttc", 27)
f_child = ImageFont.truetype(FONT_DIR + "msyh.ttc", 22)
f_tiny = ImageFont.truetype(FONT_DIR + "msyh.ttc", 18)

label = "Dear You"
d.text(((sx0 + sx1) / 2 - text_w(label, f_tiny) / 2, sy1 - 50), label, font=f_tiny, fill=(216, 166, 142))

# ---------- 文字 ----------
tx = 442
d.text((tx, 168), "你的来信", font=f_title, fill=INK)
d.text((tx, 274), "Dear You", font=f_sub, fill=ACCENT)
d.text((tx, 322), "这里有一封，你的来信", font=f_desc, fill=MUTED)
d.line([tx, 380, tx + 52, 380], fill=ACCENT, width=3)

# 三个平级区域
top_y = 408
xs = [tx, tx + 92, tx + 184]
for i, (txt, x) in enumerate(zip(["院子", "小屋", "聚会"], xs)):
    d.text((x, top_y), txt, font=f_top, fill=DEEP)
    if i < 2:
        d.text((x + 64, top_y + 2), "·", font=f_top, fill=(230, 202, 188))

# 子项：连接线挂在「小屋」下面，表明从属，不与父级并列
parent_cx = xs[1] + 27
d.line([parent_cx, top_y + 38, parent_cx, top_y + 54], fill=(233, 202, 184), width=2)
d.line([parent_cx, top_y + 54, parent_cx + 14, top_y + 54], fill=(233, 202, 184), width=2)
d.text((parent_cx + 20, top_y + 42), "好友 · 朋友圈 · 储物箱 · 计划书", font=f_child, fill=(200, 166, 150))

img.save("app/opengraph-image.png")
print("已写入 app/opengraph-image.png")
