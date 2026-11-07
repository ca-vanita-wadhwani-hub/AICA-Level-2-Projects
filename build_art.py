"""Compose the side artwork (fireworks, lantern, bridge, diyas) from the stand-in photo
into one transparent 1080x1080 layer with feathered edges (assets/art_layer.png)."""
from PIL import Image, ImageFilter, ImageDraw
src = Image.open('assets/photos/canva_stand_in.jpg').convert('RGB')
k = 1080 / 1710
layer = Image.new('RGBA', (1080, 1080), (0, 0, 0, 0))
# (src box x0,y0,x1,y1), feather px (poster space)
pieces = [
    ((1200, 0, 1710, 780), 60),      # fireworks
    ((0, 0, 330, 1195), 55),         # lantern + left foliage
    ((1380, 770, 1710, 1500), 60),   # bridge + water reflections
    ((1150, 790, 1390, 985), 40),    # skyline
    ((0, 1195, 640, 1500), 50),      # diyas
]
for (x0, y0, x1, y1), f in pieces:
    c = src.crop((x0, y0, x1, y1)).resize((round((x1-x0)*k), round((y1-y0)*k)), Image.LANCZOS)
    m = Image.new('L', c.size, 0)
    ImageDraw.Draw(m).rectangle((f, f, c.width-f, c.height-f), fill=255)
    # keep edges that touch the poster border sharp
    px0, py0 = round(x0*k), round(y0*k)
    if px0 == 0: ImageDraw.Draw(m).rectangle((0, 0, f, c.height), fill=255)
    if x1 >= 1710: ImageDraw.Draw(m).rectangle((c.width-f, 0, c.width, c.height), fill=255)
    if py0 == 0: ImageDraw.Draw(m).rectangle((0, 0, c.width, f), fill=255)
    m = m.filter(ImageFilter.GaussianBlur(f/2.2))
    tmp = Image.new('RGBA', (1080, 1080), (0, 0, 0, 0))
    tmp.paste(c, (px0, py0)); mm = Image.new('L', (1080, 1080), 0); mm.paste(m, (px0, py0))
    tmp.putalpha(mm)
    layer = Image.alpha_composite(layer, tmp)
layer.save('assets/art_layer.png')
