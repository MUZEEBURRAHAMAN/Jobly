import math
from pathlib import Path
from PIL import Image, ImageDraw

def create_radar_icon(size: int, output_path: Path):
    # Create image with RGBA
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    center = size / 2.0
    radius = size * 0.44

    # Background circle (Dark slate / deep indigo)
    draw.ellipse(
        [center - radius, center - radius, center + radius, center + radius],
        fill=(15, 23, 42, 255), # slate-900
        outline=(56, 189, 248, 255), # cyan-400
        width=max(1, int(size * 0.04))
    )

    # Inner concentric rings
    inner_radii = [radius * 0.65, radius * 0.35]
    for r in inner_radii:
        draw.ellipse(
            [center - r, center - r, center + r, center + r],
            outline=(14, 116, 144, 180), # cyan-700
            width=max(1, int(size * 0.025))
        )

    # Crosshair axes
    draw.line(
        [(center - radius * 0.85, center), (center + radius * 0.85, center)],
        fill=(14, 116, 144, 120),
        width=max(1, int(size * 0.02))
    )
    draw.line(
        [(center, center - radius * 0.85), (center, center + radius * 0.85)],
        fill=(14, 116, 144, 120),
        width=max(1, int(size * 0.02))
    )

    # Radar sweep line (angled ~45 degrees with glowing cyan)
    angle = math.radians(40)
    end_x = center + radius * 0.85 * math.cos(angle)
    end_y = center - radius * 0.85 * math.sin(angle)
    draw.line(
        [(center, center), (end_x, end_y)],
        fill=(56, 189, 248, 255), # glowing cyan
        width=max(2, int(size * 0.06))
    )

    # Blip target dots (active hiring opportunities detected!)
    blip_r = max(1.5, size * 0.05)
    # Blip 1: near the sweep line
    b1_x = center + radius * 0.55 * math.cos(math.radians(35))
    b1_y = center - radius * 0.55 * math.sin(math.radians(35))
    draw.ellipse(
        [b1_x - blip_r, b1_y - blip_r, b1_x + blip_r, b1_y + blip_r],
        fill=(52, 211, 153, 255), # emerald-400 blip
        outline=(255, 255, 255, 220),
        width=1
    )

    # Center ping dot
    center_r = max(1.5, size * 0.04)
    draw.ellipse(
        [center - center_r, center - center_r, center + center_r, center + center_r],
        fill=(56, 189, 248, 255)
    )

    output_path.parent.mkdir(parents=True, exist_ok=True)
    img.save(output_path, "PNG")
    print(f"Generated icon: {output_path} ({size}x{size})")

if __name__ == "__main__":
    base_dir = Path(__file__).resolve().parent.parent
    icons_dir = base_dir / "extension" / "public" / "icons"
    for s in [16, 48, 128]:
        create_radar_icon(s, icons_dir / f"icon-{s}.png")
