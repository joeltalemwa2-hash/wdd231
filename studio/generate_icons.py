#!/usr/bin/env python3
"""
Generate TALJOE Studios PWA icons.
Run: python3 generate_icons.py
"""
import os

# Icon sizes required for full PWA coverage
SIZES = [72, 96, 128, 144, 152, 192, 384, 512]

def svg_icon(size, maskable=False):
    """Generate an SVG icon at the given size."""
    padding = size * 0.12 if maskable else 0
    inner = size - 2 * padding
    radius = size * 0.22
    font_size = size * 0.35
    
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" viewBox="0 0 {size} {size}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#6c63ff"/>
      <stop offset="100%" style="stop-color:#ff6584"/>
    </linearGradient>
  </defs>
  <rect width="{size}" height="{size}" fill="#0a0a0f"/>
  <rect x="{padding}" y="{padding}" width="{inner}" height="{inner}" rx="{radius}" fill="url(#bg)"/>
  <text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle"
        font-family="system-ui, -apple-system, sans-serif"
        font-weight="900" font-size="{font_size}" fill="white" letter-spacing="-1">TJ</text>
</svg>'''

os.makedirs('icons', exist_ok=True)

# Try to use cairosvg or PIL for PNG conversion, otherwise save as SVG
try:
    import cairosvg
    for size in SIZES:
        svg = svg_icon(size, maskable=(size in [192, 512]))
        cairosvg.svg2png(bytestring=svg.encode(), write_to=f'icons/icon-{size}.png')
        print(f'Generated icons/icon-{size}.png')
    print('✅ All PNG icons generated with cairosvg')
except ImportError:
    try:
        from PIL import Image, ImageDraw, ImageFont
        import io
        
        for size in SIZES:
            img = Image.new('RGBA', (size, size), (10, 10, 15, 255))
            draw = ImageDraw.Draw(img)
            
            maskable = size in [192, 512]
            padding = int(size * 0.12) if maskable else int(size * 0.08)
            inner = size - 2 * padding
            
            # Gradient background rectangle (simplified as solid purple)
            draw.rounded_rectangle(
                [padding, padding, padding + inner, padding + inner],
                radius=int(size * 0.22),
                fill=(108, 99, 255, 255)
            )
            
            # Text "TJ"
            font_size = size // 3
            try:
                font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', font_size)
            except:
                font = ImageFont.load_default()
            
            bbox = draw.textbbox((0, 0), 'TJ', font=font)
            tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
            x = (size - tw) // 2
            y = (size - th) // 2
            draw.text((x, y), 'TJ', fill=(255, 255, 255, 255), font=font)
            
            img.save(f'icons/icon-{size}.png', 'PNG')
            print(f'Generated icons/icon-{size}.png')
        print('✅ All PNG icons generated with Pillow')
    except ImportError:
        print('⚠️  Neither cairosvg nor Pillow found. Saving as SVG files instead.')
        print('   Install with: pip install cairosvg  OR  pip install Pillow')
        print('   Or use an online converter like https://svgtopng.com')
        print()
        for size in SIZES:
            svg = svg_icon(size, maskable=(size in [192, 512]))
            path = f'icons/icon-{size}.svg'
            with open(path, 'w') as f:
                f.write(svg)
            print(f'Saved {path} (rename to .png after converting)')

print('\nDone! Place the icons/ folder inside your studio/ directory.')