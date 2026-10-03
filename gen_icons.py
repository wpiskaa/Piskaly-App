import os
import sys

# Try to use PIL/Pillow
try:
    from PIL import Image
    src = r'C:\Users\ASUS\.gemini\antigravity-ide\brain\e7875283-74fb-4248-9a6e-3f724e3416f4\app_icon_1790956174723.jpg'
    sizes = [72, 96, 128, 144, 152, 192, 384, 512]
    for s in sizes:
        img = Image.open(src).resize((s, s), Image.LANCZOS)
        img = img.convert('RGBA')
        out = f'icons/icon-{s}.png'
        img.save(out, 'PNG')
        print(f'Created {out}')
    print('All icons created!')
except ImportError:
    print('PIL not found - installing...')
    os.system('pip install pillow -q')
    try:
        from PIL import Image
        src = r'C:\Users\ASUS\.gemini\antigravity-ide\brain\e7875283-74fb-4248-9a6e-3f724e3416f4\app_icon_1790956174723.jpg'
        sizes = [72, 96, 128, 144, 152, 192, 384, 512]
        for s in sizes:
            img = Image.open(src).resize((s, s), Image.LANCZOS)
            img = img.convert('RGBA')
            out = f'icons/icon-{s}.png'
            img.save(out, 'PNG')
            print(f'Created {out}')
        print('All icons created!')
    except Exception as e:
        print(f'Error: {e}')
except Exception as e:
    print(f'Error: {e}')
