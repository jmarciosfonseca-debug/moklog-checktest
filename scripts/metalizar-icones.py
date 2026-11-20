#!/usr/bin/env python3
"""Aplica o padrão metálico (aro de aço escovado + reflexo) aos ícones de módulo em public/icones/modulos/*.svg.
Idempotente: remove o bloco anterior (marcadores mk-metal) e reaplica. Rodar da raiz do repositório."""
import glob, re
BLOCO = '''<!-- mk-metal -->
<defs>
  <linearGradient id="mkm-aco" gradientUnits="userSpaceOnUse" x1="60" y1="40" x2="964" y2="984">
    <stop offset="0" stop-color="#F8FAFC"/><stop offset=".14" stop-color="#9CA3AF"/><stop offset=".27" stop-color="#E5E7EB"/>
    <stop offset=".45" stop-color="#4B5563"/><stop offset=".6" stop-color="#CBD5E1"/><stop offset=".78" stop-color="#6B7280"/>
    <stop offset=".9" stop-color="#E2E8F0"/><stop offset="1" stop-color="#94A3B8"/>
  </linearGradient>
  <pattern id="mkm-escovado" width="1024" height="7" patternUnits="userSpaceOnUse">
    <rect width="1024" height="7" fill="#fff" fill-opacity="0"/><rect y="0" width="1024" height="2" fill="#fff" fill-opacity=".20"/><rect y="4" width="1024" height="1.4" fill="#000" fill-opacity=".16"/>
  </pattern>
  <linearGradient id="mkm-brilho" gradientUnits="userSpaceOnUse" x1="80" y1="60" x2="620" y2="520">
    <stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset=".55" stop-color="#fff" stop-opacity=".0"/>
  </linearGradient>
  <linearGradient id="mkm-reflexo" gradientUnits="userSpaceOnUse" x1="100" y1="100" x2="700" y2="900">
    <stop offset="0" stop-color="#fff" stop-opacity=".16"/><stop offset=".35" stop-color="#fff" stop-opacity=".04"/><stop offset=".36" stop-color="#fff" stop-opacity="0"/>
  </linearGradient>
  <clipPath id="mkm-placa"><rect x="51.2" y="51.2" width="921.6" height="921.6" rx="202.75" ry="202.75"/></clipPath>
  <radialGradient id="mkm-parafuso" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#fff"/><stop offset=".45" stop-color="#9CA3AF"/><stop offset="1" stop-color="#374151"/></radialGradient>
</defs>
<g clip-path="url(#mkm-placa)">
  <rect x="51.2" y="51.2" width="921.6" height="921.6" fill="url(#mkm-escovado)" opacity=".5"/>
  <rect x="51.2" y="51.2" width="921.6" height="921.6" fill="url(#mkm-reflexo)"/>
</g>
<rect x="82" y="82" width="860" height="860" rx="176" ry="176" fill="none" stroke="#000" stroke-opacity=".45" stroke-width="64"/>
<rect x="82" y="82" width="860" height="860" rx="176" ry="176" fill="none" stroke="url(#mkm-aco)" stroke-width="56"/>
<rect x="82" y="82" width="860" height="860" rx="176" ry="176" fill="none" stroke="url(#mkm-escovado)" stroke-width="56"/>
<rect x="55" y="55" width="914" height="914" rx="200" ry="200" fill="none" stroke="#fff" stroke-opacity=".75" stroke-width="5"/>
<rect x="110" y="110" width="804" height="804" rx="150" ry="150" fill="none" stroke="#000" stroke-opacity=".6" stroke-width="6"/>
<rect x="82" y="82" width="860" height="860" rx="176" ry="176" fill="none" stroke="url(#mkm-brilho)" stroke-width="22" transform="translate(-6 -6)" opacity=".9"/>
<g stroke="#111827" stroke-opacity=".7" stroke-width="3">
  <circle cx="146" cy="146" r="17" fill="url(#mkm-parafuso)"/><circle cx="878" cy="146" r="17" fill="url(#mkm-parafuso)"/>
  <circle cx="146" cy="878" r="17" fill="url(#mkm-parafuso)"/><circle cx="878" cy="878" r="17" fill="url(#mkm-parafuso)"/>
</g>
<!-- /mk-metal -->
'''
for f in sorted(glob.glob('public/icones/modulos/*.svg')):
    s = open(f, encoding='utf-8').read()
    s = re.sub(r'<!-- mk-metal -->.*?<!-- /mk-metal -->\n?', '', s, flags=re.S)
    i = s.rstrip().rfind('</svg>')
    assert i > 0, f
    s = s[:i] + BLOCO + s[i:]
    open(f, 'w', encoding='utf-8').write(s)
    print('ok', f)
