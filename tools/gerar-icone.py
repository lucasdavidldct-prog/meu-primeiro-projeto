"""Gera o ícone do Troco Certo (a Moedinha) a partir de um único desenho.

Saídas:
- android/.../drawable/ic_launcher_background.xml e ic_launcher_foreground.xml (ícone adaptável)
- arte/icone.svg (desenho completo, usado para a imagem da Play Store e como favicon)
Coordenadas no espaço 108x108 do ícone adaptável: só o círculo central de
raio 33 aparece em todos os celulares, então a moeda fica dentro dele.
Uso: python3 tools/gerar-icone.py
"""
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RES = ROOT / "android/app/src/main/res/drawable"
C = 54  # centro


def circle(cx, cy, r):
    return f"M{cx - r:.2f},{cy:.2f} a{r:.2f},{r:.2f} 0 1,0 {2 * r:.2f},0 a{r:.2f},{r:.2f} 0 1,0 {-2 * r:.2f},0 Z"


def star(cx, cy, r, inner):
    pts = []
    for k in range(8):
        a = math.pi / 4 * k - math.pi / 2
        rr = r if k % 2 == 0 else inner
        pts.append(f"{cx + rr * math.cos(a):.2f},{cy + rr * math.sin(a):.2f}")
    return "M" + " L".join(pts) + " Z"


# Fundo: céu azul com raios de sol, como um "tchã!"
background = [dict(d="M0,0 H108 V108 H0 Z", fill="#2F9BEF")]
for k in range(12):
    a0 = math.radians(k * 30 - 7)
    a1 = math.radians(k * 30 + 7)
    R = 110
    background.append(dict(
        d=f"M{C},{C} L{C + R * math.cos(a0):.2f},{C + R * math.sin(a0):.2f} L{C + R * math.cos(a1):.2f},{C + R * math.sin(a1):.2f} Z",
        fill="#5DB8FF"))
background.append(dict(d=circle(C, C, 40), fill="#7CC8FF", alpha=0.55))

# Frente: a Moedinha
foreground = [
    dict(d=circle(C, C + 2.5, 30), fill="#1B5E9E", alpha=0.35),        # sombra
    dict(d=circle(C, C, 30), fill="#F2C230", stroke="#A77E1C", sw=2.4),  # anel dourado
]
for k in range(24):                                                     # serrilhado
    a = math.radians(k * 15)
    foreground.append(dict(d=circle(C + 26.3 * math.cos(a), C + 26.3 * math.sin(a), 0.9), fill="#C99A22"))
foreground += [
    dict(d=circle(C, C, 20.5), fill="#E6E9ED", stroke="#A77E1C", sw=1.2),  # miolo prateado
    dict(d="M43,42.5 Q54,37.5 65,42.5", fill="none", stroke="#FFFFFF", sw=1.6, alpha=0.55),  # brilho
    dict(d=circle(47.2, 51, 2.8), fill="#1F2B52"),                        # olhos
    dict(d=circle(60.8, 51, 2.8), fill="#1F2B52"),
    dict(d=circle(48.1, 50, 0.95), fill="#FFFFFF"),
    dict(d=circle(61.7, 50, 0.95), fill="#FFFFFF"),
    dict(d=circle(42.6, 57, 2.7), fill="#FF6B9A", alpha=0.6),            # bochechas
    dict(d=circle(65.4, 57, 2.7), fill="#FF6B9A", alpha=0.6),
    dict(d="M46.5,56.5 Q54,66.5 61.5,56.5 Z", fill="#1F2B52"),           # sorrisão
    dict(d="M50,60.8 Q54,64.2 58,60.8 Q54,59.4 50,60.8 Z", fill="#FF8FA9"),  # linguinha
    dict(d=star(78.5, 33.5, 5.5, 1.6), fill="#FFF6C8"),                  # brilhinhos
    dict(d=star(31, 74, 3.4, 1.0), fill="#FFF6C8"),
]


def to_vector(shapes):
    out = ['<?xml version="1.0" encoding="utf-8"?>',
           '<!-- Gerado por tools/gerar-icone.py. Não edite à mão. -->',
           '<vector xmlns:android="http://schemas.android.com/apk/res/android"',
           '    android:width="108dp" android:height="108dp"',
           '    android:viewportWidth="108" android:viewportHeight="108">']
    for s in shapes:
        attrs = [f'android:pathData="{s["d"]}"']
        if s.get("fill", "none") != "none":
            attrs.append(f'android:fillColor="{s["fill"]}"')
            if "alpha" in s:
                attrs.append(f'android:fillAlpha="{s["alpha"]}"')
        if "stroke" in s:
            attrs += [f'android:strokeColor="{s["stroke"]}"', f'android:strokeWidth="{s["sw"]}"', 'android:strokeLineCap="round"']
            if "alpha" in s and s.get("fill", "none") == "none":
                attrs.append(f'android:strokeAlpha="{s["alpha"]}"')
        out.append("    <path " + " ".join(attrs) + " />")
    out.append("</vector>")
    return "\n".join(out) + "\n"


def to_svg(shapes):
    parts = []
    for s in shapes:
        a = f'd="{s["d"]}" fill="{s.get("fill", "none")}"'
        if "alpha" in s:
            a += f' opacity="{s["alpha"]}"'
        if "stroke" in s:
            a += f' stroke="{s["stroke"]}" stroke-width="{s["sw"]}" stroke-linecap="round"'
        parts.append(f"  <path {a}/>")
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108">\n'
            + "\n".join(parts) + "\n</svg>\n")


RES.mkdir(parents=True, exist_ok=True)
(RES / "ic_launcher_background.xml").write_text(to_vector(background))
(RES / "ic_launcher_foreground.xml").write_text(to_vector(foreground))
(ROOT / "arte/icone.svg").write_text(to_svg(background + foreground))
(ROOT / "public/icone.svg").write_text(to_svg(background + foreground))
print("ícone gerado")
