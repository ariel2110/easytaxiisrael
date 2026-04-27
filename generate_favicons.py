#!/usr/bin/env python3
"""
Generate all EasyTaxi favicon assets.
Design: Yellow rounded square + black taxi cab silhouette
"""
import math
from PIL import Image, ImageDraw

YELLOW = (245, 197, 24)      # #F5C518
BLACK  = (15,  23,  42)      # #0F172A
WHITE  = (255, 255, 255)

def draw_taxi(draw, cx, cy, size):
    """Draw a simple taxi car silhouette centered at (cx,cy) within 'size' box."""
    u = size / 32  # 1 unit = size/32

    # Car body (lower rectangle)
    bx1 = cx - 12*u
    bx2 = cx + 12*u
    by1 = cy + 1*u
    by2 = cy + 9*u
    r = 2*u
    draw.rounded_rectangle([bx1, by1, bx2, by2], radius=r, fill=BLACK)

    # Cabin (upper trapezoid — use polygon)
    cabin = [
        cx - 7*u,  cy + 1*u,   # bottom-left
        cx + 7*u,  cy + 1*u,   # bottom-right
        cx + 5*u,  cy - 5*u,   # top-right
        cx - 5*u,  cy - 5*u,   # top-left
    ]
    draw.polygon(cabin, fill=BLACK)

    # Windows (white)
    # Left window
    draw.rounded_rectangle([cx-6.5*u, cy-4.5*u, cx-0.5*u, cy+0.5*u], radius=u*0.8, fill=WHITE)
    # Right window
    draw.rounded_rectangle([cx+0.5*u, cy-4.5*u, cx+6.5*u, cy+0.5*u], radius=u*0.8, fill=WHITE)

    # Wheels (black circle with white inner)
    wheel_y = cy + 9*u
    for wx in [cx - 8*u, cx + 8*u]:
        draw.ellipse([wx-3*u, wheel_y-3*u, wx+3*u, wheel_y+3*u], fill=BLACK)
        draw.ellipse([wx-1.5*u, wheel_y-1.5*u, wx+1.5*u, wheel_y+1.5*u], fill=WHITE)

    # Taxi sign on roof
    sign_w = 5*u
    sign_h = 2*u
    draw.rounded_rectangle(
        [cx - sign_w/2, cy - 8*u, cx + sign_w/2, cy - 8*u + sign_h],
        radius=u*0.5, fill=YELLOW
    )

def make_favicon(size):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Yellow rounded square background
    padding = size * 0.06
    radius = size * 0.22
    draw.rounded_rectangle(
        [padding, padding, size - padding, size - padding],
        radius=radius,
        fill=YELLOW
    )

    # Draw taxi centered
    cx = size / 2
    cy = size / 2 + size * 0.04
    draw_taxi(draw, cx, cy, size * 0.85)

    return img

OUTDIR = "/root/rideos-platform/passenger-webapp/dist"

# Generate all sizes
sizes = {
    "favicon-16.png":  16,
    "favicon-32.png":  32,
    "favicon-48.png":  48,
    "favicon-96.png":  96,
    "apple-touch-icon.png": 180,   # iOS home screen
    "favicon-192.png": 192,        # Android Chrome
    "favicon-512.png": 512,        # PWA splash
}

for filename, size in sizes.items():
    img = make_favicon(size)
    path = f"{OUTDIR}/{filename}"
    img.save(path, "PNG", optimize=True)
    print(f"✅ {path} ({size}x{size})")

# Create favicon.ico (multi-size: 16, 32, 48)
ico_imgs = [make_favicon(s) for s in [16, 32, 48]]
ico_path = f"{OUTDIR}/favicon.ico"
ico_imgs[0].save(ico_path, format="ICO", sizes=[(16,16),(32,32),(48,48)])
print(f"✅ {ico_path} (multi-size ICO)")

# Copy favicon-32.png as favicon.png (generic)
make_favicon(32).save(f"{OUTDIR}/favicon.png", "PNG")
print(f"✅ {OUTDIR}/favicon.png")

print("\nAll favicons generated successfully!")
