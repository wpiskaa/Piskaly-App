from PIL import Image
import os

src = 'icons/icon-piska.jpg'
sizes = [72, 96, 128, 144, 152, 192, 384, 512]

if not os.path.exists(src):
    print(f"Error: {src} not found!")
    exit(1)

img = Image.open(src)
print(f"Loaded {src}, size: {img.size}")

for s in sizes:
    resized = img.resize((s, s), Image.LANCZOS)
    out = f'icons/icon-{s}.png'
    resized.save(out, 'PNG', optimize=True)
    print(f"Generated {out} ({s}x{s})")

# Also save a standard favicon.ico / favicon.png
img.resize((64, 64), Image.LANCZOS).save('icons/favicon.png', 'PNG')
img.resize((32, 32), Image.LANCZOS).save('favicon.ico', format='ICO')
print("All icons successfully generated from icon-piska.jpg!")
