#!/usr/bin/env python3
"""
build.py — Araguatos · Ing3dreco
Combina todos los archivos en index_build.html para uso local.

USO:  python build.py
"""
import os, base64, re

HERE = os.path.dirname(os.path.abspath(__file__))

def read(p):
    with open(os.path.join(HERE, p), encoding='utf-8') as f: return f.read()

def read_b64(p):
    with open(os.path.join(HERE, p), 'rb') as f: return base64.b64encode(f.read()).decode()

print("Araguatos · Build")
print("="*40)

css     = read('css/style.css')
logo    = 'data:image/png;base64,' + read_b64('logo.png')

js_files = ['js/data.js','js/minuta.js','js/tab-resumen.js','js/tab-lotes.js',
            'js/tab-precios.js','js/tab-flujo.js','js/tab-venta.js',
            'js/tab-vendedor.js','js/tab-ingresos.js','js/tab-config.js','js/main.js']

all_js = ''
for p in js_files:
    c = read(p)
    all_js += '\n/* == '+p+' == */\n' + c
    print('  OK '+p+' ('+str(len(c))+' chars)')

html = read('index.html')
# Embed CSS
html = re.sub(r'<link[^>]*href="css/[^"]*"[^>]*>', '<style>\n'+css+'\n</style>', html)
# Embed logo
html = html.replace('src="logo.png"', 'src="'+logo+'"')
# Remove old script src tags and replace with inline JS
html = re.sub(r'\s*<script src="[^"]+"></script>', '', html)
html = re.sub(r'\s*<script src="[^"]+">\s*</script>', '', html)
html = re.sub(r'\s*<script src="[^"]+">', '', html)
# Insert our JS before </body>
html = html.replace('</body>', '<script>\n'+all_js+'\n</script>\n</body>')

out = os.path.join(HERE, 'index_build.html')
with open(out, 'w', encoding='utf-8') as f: f.write(html)
print('\nGenerado: index_build.html ('+str(len(html)//1024)+' KB)')
print('Abre index_build.html en cualquier navegador.')
