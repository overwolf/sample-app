"""
Generate app icons for Ward Optimizer.
Creates IconMouseNormal.png (grayscale), IconMouseOver.png (colored), desktop-icon.ico
"""

from PIL import Image, ImageDraw, ImageFilter
import os

ICONS_DIR = os.path.join(os.path.dirname(__file__), '..', 'public', 'icons')

# Colors
GOLD = (200, 155, 60)
TEAL = (10, 200, 185)
DARK = (10, 20, 40)

def draw_ward(size, colored=True):
    """Draw a ward icon at the given size."""
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    cx, cy = size // 2, size // 2
    scale = size / 256  # Scale relative to 256px

    # Ward body
    body_color = GOLD if colored else (160, 160, 160)
    body_top = int(60 * scale)
    body_bot = int(210 * scale)
    body_left = int(85 * scale)
    body_right = int(171 * scale)

    # Body shape (tapered rectangle)
    body_points = [
        (int(95 * scale), body_top),   # top-left
        (int(161 * scale), body_top),  # top-right
        (body_right, body_bot),         # bottom-right
        (body_left, body_bot),          # bottom-left
    ]
    draw.polygon(body_points, fill=DARK, outline=body_color, width=max(1, int(3 * scale)))

    # Ward eye
    eye_color = TEAL if colored else (180, 180, 180)
    eye_cx, eye_cy = cx, int(120 * scale)
    eye_rx, eye_ry = int(22 * scale), int(30 * scale)
    draw.ellipse(
        [eye_cx - eye_rx, eye_cy - eye_ry, eye_cx + eye_rx, eye_cy + eye_ry],
        fill=eye_color
    )
    # Pupil
    pupil_rx, pupil_ry = int(10 * scale), int(16 * scale)
    draw.ellipse(
        [eye_cx - pupil_rx, eye_cy - pupil_ry, eye_cx + pupil_rx, eye_cy + pupil_ry],
        fill=DARK
    )

    # Eye glow ring
    glow_rx, glow_ry = int(28 * scale), int(36 * scale)
    glow_color = (*eye_color, 80) if colored else (180, 180, 180, 80)
    # Draw as outline
    for offset in range(-1, 2):
        draw.ellipse(
            [eye_cx - glow_rx + offset, eye_cy - glow_ry, eye_cx + glow_rx + offset, eye_cy + glow_ry],
            outline=eye_color if colored else (150, 150, 150),
            width=max(1, int(1 * scale))
        )

    # Top spike
    spike_color = body_color
    spike_points = [
        (int(118 * scale), body_top),
        (cx, int(30 * scale)),
        (int(138 * scale), body_top),
    ]
    draw.polygon(spike_points, fill=spike_color)

    # Base ellipse
    base_color = (120, 90, 40) if colored else (100, 100, 100)
    base_cy = int(220 * scale)
    base_rx, base_ry = int(40 * scale), int(12 * scale)
    draw.ellipse(
        [cx - base_rx, base_cy - base_ry, cx + base_rx, base_cy + base_ry],
        fill=base_color
    )

    # Vision lines (small rays from the eye)
    if colored:
        ray_color = (*TEAL, 100)
    else:
        ray_color = (150, 150, 150, 100)

    ray_len = int(30 * scale)
    for dx, dy in [(-1, -0.3), (1, -0.3), (-1.2, 0), (1.2, 0)]:
        x1 = eye_cx + int(glow_rx * dx * 0.8)
        y1 = eye_cy + int(glow_ry * dy * 0.8)
        x2 = x1 + int(ray_len * dx)
        y2 = y1 + int(ray_len * dy)
        draw.line([(x1, y1), (x2, y2)], fill=eye_color if colored else (140, 140, 140), width=max(1, int(1.5 * scale)))

    return img


def main():
    os.makedirs(ICONS_DIR, exist_ok=True)
    print("Generating Ward Optimizer icons...")

    # IconMouseOver.png — colored, 256x256
    colored = draw_ward(256, colored=True)
    over_path = os.path.join(ICONS_DIR, 'IconMouseOver.png')
    colored.save(over_path, 'PNG', optimize=True)
    sz = os.path.getsize(over_path) / 1024
    print(f"  IconMouseOver.png: 256x256, {sz:.1f}KB {'OK' if sz < 30 else 'WARNING >30KB'}")

    # IconMouseNormal.png — grayscale, 256x256
    grayscale = draw_ward(256, colored=False)
    normal_path = os.path.join(ICONS_DIR, 'IconMouseNormal.png')
    grayscale.save(normal_path, 'PNG', optimize=True)
    sz = os.path.getsize(normal_path) / 1024
    print(f"  IconMouseNormal.png: 256x256, {sz:.1f}KB {'OK' if sz < 30 else 'WARNING >30KB'}")

    # desktop-icon.ico — multi-layer
    sizes = [16, 32, 48, 256]
    ico_images = [draw_ward(s, colored=True) for s in sizes]

    ico_path = os.path.join(ICONS_DIR, 'desktop-icon.ico')
    ico_images[0].save(
        ico_path,
        format='ICO',
        sizes=[(s, s) for s in sizes],
        append_images=ico_images[1:]
    )
    sz = os.path.getsize(ico_path) / 1024
    print(f"  desktop-icon.ico: {sizes}, {sz:.1f}KB {'OK' if sz < 150 else 'WARNING >150KB'}")

    print("Done!")


if __name__ == '__main__':
    main()
