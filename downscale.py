from PIL import Image; import os
Image.open('output/_2x.png').convert('RGB').resize((1080,1080), Image.LANCZOS).save('output/diwali_dar_es_salaam.png', optimize=True)
os.remove('output/_2x.png')
