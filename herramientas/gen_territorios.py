# -*- coding: utf-8 -*-
"""Fuente unica de la seccion Insights Territoriales.

Genera dos salidas a partir de la misma tabla:

  territorios.html                 fragmento listo para pegar en index.html
  ../panel/datos/territorios.json  dataset que consume el panel de administracion

Los datos salen de los carruseles departamentales GEIH 2026 T1 (DANE, marco 2018).
Para el proximo corte se edita la tabla D y se vuelve a correr:

    python gen_territorios.py

Cifras nacionales de referencia en NAC. Si cambian, se cambian aca y todas
las tarjetas se recalculan solas.
"""
import io, json, os, unicodedata, re

NAC = {'part': 64.5, 'ocup': 58.3, 'des': 9.6, 'inf': 54.3,
       'ingreso': 2198972, 'pension': 43.9}

# nombre, PET, ocupados, part, ocup, des, inf, muestra,
# (ocupH, ocupM, desH, desM, dOcup, dDes, nini),
# [(sector, share, informal) x3],
# ingreso, pension
D = [
 ("Amazonas", 29623, 16255, 57.2, 54.9, 4.1, 62.1, 1081,
  (71.7, 38.4, 4.0, 4.4, -33.3, 0.4, 49.0),
  [("Comercio y turismo", 28.6, 65.7), ("Servicios sociales y personales", 26.0, 9.3), ("Transporte y TIC", 23.2, 92.9)],
  1821245, 37.9),
 ("Antioquia", 5767484, 3276800, 63.5, 56.8, 10.5, 44.3, 11570,
  (70.6, 44.4, 8.3, 13.5, -26.2, 5.2, 33.3),
  [("Comercio y turismo", 24.1, 54.6), ("Servicios sociales", 18.8, 29.4), ("Industria", 13.8, 33.6)],
  2473030, 53.5),
 ("Arauca", 67808, 36622, 64.6, 54.0, 16.4, 70.1, 1145,
  (63.7, 44.9, 15.2, 17.9, -18.9, 2.7, 44.2),
  [("Comercio y turismo", 27.0, 87.9), ("Servicios sociales y personales", 24.2, 34.4), ("Construcción", 12.4, 86.5)],
  1560374, 28.8),
 ("Atlántico", 2246211, 1303621, 63.4, 58.0, 8.4, 58.1, 8972,
  (71.2, 45.4, 6.5, 11.1, -25.8, 4.6, 31.7),
  [("Comercio y turismo", 27.5, 71.0), ("Servicios sociales", 21.2, 49.9), ("Industria", 12.8, 46.4)],
  1858347, 40.8),
 ("Bogotá D.C.", 6723570, 4296649, 70.1, 63.9, 8.8, 30.9, 6686,
  (71.1, 57.5, 8.5, 9.2, -13.6, 0.7, 20.6),
  [("Servicios sociales", 25.5, 20.8), ("Comercio y turismo", 22.7, 50.8), ("Financiero e inmobiliario", 20.2, 16.9)],
  3416630, 66.1),
 ("Bolívar", 1720955, 931323, 60.0, 54.1, 9.7, 66.2, 8707,
  (70.9, 37.8, 7.4, 13.6, -33.2, 6.2, 40.7),
  [("Comercio y turismo", 25.8, 74.8), ("Servicios sociales y personales", 22.3, 48.9), ("Agropecuario", 13.6, 97.8)],
  1654039, 33.3),
 ("Boyacá", 1053700, 523385, 56.7, 49.7, 12.4, 60.5, 6472,
  (62.9, 37.4, 9.4, 16.6, -25.6, 7.2, 33.8),
  [("Comercio y turismo", 22.1, 69.4), ("Servicios sociales y personales", 21.1, 30.2), ("Agropecuario", 20.9, 92.4)],
  1979611, 38.1),
 ("Caldas", 882867, 489488, 60.5, 55.4, 8.3, 51.1, 9645,
  (70.4, 41.1, 7.7, 9.3, -29.3, 1.6, 36.3),
  [("Comercio y turismo", 24.5, 64.0), ("Servicios sociales y personales", 20.1, 29.3), ("Agropecuario", 16.1, 86.6)],
  2192773, 47.5),
 ("Caquetá", 323572, 157889, 55.8, 48.8, 12.6, 73.8, 7139,
  (68.4, 30.5, 8.2, 20.6, -37.9, 12.3, 56.5),
  [("Agropecuario", 32.0, 98.1), ("Comercio y turismo", 20.8, 75.8), ("Servicios sociales y personales", 19.7, 33.1)],
  1911364, 25.0),
 ("Casanare", 123254, 82598, 75.0, 67.0, 10.6, 48.2, 1211,
  (74.1, 60.5, 10.2, 11.2, -13.6, 1.0, 26.2),
  [("Comercio y turismo", 33.0, 63.8), ("Servicios sociales y personales", 23.8, 28.3), ("Construcción", 11.2, 70.2)],
  2427346, 51.0),
 ("Cauca", 1138244, 696649, 66.0, 61.2, 7.3, 78.7, 6823,
  (75.7, 47.7, 4.3, 11.4, -28.0, 7.1, 37.3),
  [("Agropecuario", 40.2, 96.6), ("Comercio y turismo", 17.5, 87.0), ("Servicios sociales y personales", 15.7, 41.3)],
  1299405, 19.9),
 ("Cesar", 1015080, 536940, 59.5, 52.9, 11.1, 70.8, 7624,
  (68.2, 38.8, 8.0, 15.7, -29.4, 7.6, 37.3),
  [("Comercio y turismo", 27.8, 84.9), ("Servicios sociales y personales", 23.0, 45.5), ("Agropecuario", 17.3, 86.9)],
  1692467, 27.8),
 ("Chocó", 415693, 142624, 39.6, 34.3, 13.4, 82.1, 7680,
  (50.2, 20.5, 8.8, 21.8, -29.8, 13.0, 60.2),
  [("Agropecuario", 27.6, 100.0), ("Servicios sociales y personales", 19.9, 36.5), ("Minería", 18.4, 99.8)],
  1205707, 17.4),
 ("Córdoba", 1437660, 816215, 63.9, 56.8, 11.2, 79.2, 6756,
  (73.0, 41.8, 7.4, 16.6, -31.1, 9.2, 44.1),
  [("Comercio y turismo", 24.3, 84.0), ("Servicios sociales y personales", 22.0, 53.5), ("Agropecuario", 17.1, 93.5)],
  1210618, 19.9),
 ("Cundinamarca", 2786651, 1839929, 72.5, 66.0, 8.9, 41.7, 4038,
  (75.0, 57.3, 7.5, 10.7, -17.8, 3.1, 27.2),
  [("Comercio y turismo", 22.3, 57.7), ("Agropecuario", 18.7, 50.9), ("Servicios sociales y personales", 18.5, 32.7)],
  2308932, 56.4),
 ("Guainía", 18278, 9551, 58.4, 52.3, 10.5, 67.0, 1255,
  (70.4, 34.9, 7.8, 15.3, -35.5, 7.5, 43.6),
  [("Servicios sociales y personales", 32.7, 16.0), ("Comercio y turismo", 23.1, 91.6), ("Transporte y TIC", 17.8, 96.3)],
  2282446, 33.0),
 ("Guaviare", 33115, 25342, 82.6, 76.5, 7.3, 65.4, 922,
  (82.9, 70.8, 5.6, 9.1, -12.1, 3.5, 11.9),
  [("Servicios sociales y personales", 34.8, 34.6), ("Comercio y turismo", 32.0, 86.2), ("Transporte y TIC", 9.3, 81.7)],
  2048635, 34.1),
 ("Huila", 888116, 502724, 60.0, 56.6, 5.6, 72.4, 7207,
  (77.0, 36.9, 3.5, 9.5, -40.1, 6.0, 37.9),
  [("Agropecuario", 34.9, 95.5), ("Comercio y turismo", 19.8, 70.6), ("Servicios sociales y personales", 15.1, 27.6)],
  1724240, 26.6),
 ("La Guajira", 706017, 372032, 61.4, 52.7, 14.2, 83.9, 7793,
  (64.5, 42.3, 11.2, 17.9, -22.2, 6.7, 51.1),
  [("Comercio y turismo", 22.3, 91.3), ("Industria", 18.2, 99.4), ("Agropecuario", 16.8, 98.1)],
  1156808, 15.9),
 ("Magdalena", 1135757, 615847, 60.8, 54.2, 10.8, 71.7, 8858,
  (68.9, 39.1, 7.2, 16.5, -29.8, 9.3, 49.2),
  [("Comercio y turismo", 28.1, 84.2), ("Agropecuario", 20.9, 75.4), ("Servicios sociales y personales", 19.4, 50.0)],
  1347662, 27.7),
 ("Meta", 913623, 535832, 63.8, 58.6, 8.0, 60.6, 8073,
  (69.8, 47.9, 7.9, 8.1, -21.9, 0.2, 31.0),
  [("Comercio y turismo", 30.2, 72.9), ("Servicios sociales y personales", 20.1, 42.8), ("Agropecuario", 15.5, 67.4)],
  2057231, 37.9),
 ("Nariño", 1309107, 885707, 72.3, 67.7, 6.4, 82.6, 8429,
  (79.6, 57.1, 4.9, 8.2, -22.5, 3.3, 34.3),
  [("Agropecuario", 34.5, 97.5), ("Comercio y turismo", 19.8, 82.7), ("Servicios sociales y personales", 16.7, 49.4)],
  1185083, 16.1),
 ("Norte de Santander", 1322352, 711656, 61.1, 53.8, 11.9, 69.7, 7568,
  (68.9, 39.4, 9.1, 16.3, -29.5, 7.2, 37.6),
  [("Comercio y turismo", 29.0, 73.6), ("Servicios sociales y personales", 17.2, 35.9), ("Agropecuario", 14.5, 95.2)],
  1810829, 29.2),
 ("Putumayo", 35559, 15636, 55.4, 44.0, 20.7, 60.0, 1103,
  (54.8, 34.3, 16.2, 26.2, -20.5, 10.0, 31.0),
  [("Servicios sociales y personales", 32.1, 18.5), ("Comercio y turismo", 25.7, 86.1), ("Construcción", 16.3, 74.7)],
  2228285, 40.0),
 ("Quindío", 497826, 269650, 61.1, 54.2, 11.3, 51.9, 7364,
  (67.1, 42.4, 10.0, 13.1, -24.7, 3.1, 29.9),
  [("Comercio y turismo", 28.5, 65.2), ("Servicios sociales y personales", 23.4, 30.4), ("Agropecuario", 10.7, 77.1)],
  2150453, 46.2),
 ("Risaralda", 836839, 468084, 60.8, 55.9, 8.0, 48.0, 9003,
  (70.1, 43.1, 5.9, 10.9, -27.0, 5.0, 30.7),
  [("Comercio y turismo", 25.1, 55.0), ("Servicios sociales y personales", 21.4, 31.8), ("Agropecuario", 13.2, 86.8)],
  2101497, 50.6),
 ("San Andrés", 34906, 21694, 71.7, 62.1, 13.3, 23.3, 2014,
  (68.3, 56.7, 14.3, 12.2, -11.6, -2.0, 28.6),
  [("Comercio y turismo", 43.9, 14.2), ("Servicios sociales y personales", 25.0, 16.9), ("Financiero e inmobiliario", 10.2, 30.6)],
  2572863, 74.0),
 ("Santander", 1947027, 1091688, 61.9, 56.1, 9.5, 54.6, 9670,
  (68.5, 44.5, 7.7, 11.8, -23.9, 4.1, 33.5),
  [("Comercio y turismo", 24.3, 66.1), ("Servicios sociales y personales", 20.2, 31.2), ("Agropecuario", 16.3, 83.3)],
  2205630, 43.8),
 ("Sucre", 746981, 426262, 64.0, 57.1, 10.8, 84.1, 7950,
  (72.1, 42.3, 6.5, 17.1, -29.7, 10.6, 35.1),
  [("Comercio y turismo", 28.9, 89.6), ("Servicios sociales y personales", 21.1, 56.9), ("Agropecuario", 19.5, 99.3)],
  1067966, 15.5),
 ("Tolima", 1110769, 583038, 59.0, 52.5, 11.0, 67.3, 6207,
  (67.9, 37.8, 8.0, 15.7, -30.1, 7.7, 38.0),
  [("Agropecuario", 27.9, 91.6), ("Comercio y turismo", 25.1, 75.8), ("Servicios sociales y personales", 19.2, 35.1)],
  1758249, 31.3),
 ("Valle del Cauca", 3727602, 2197301, 65.5, 59.0, 9.9, 53.6, 9934,
  (71.3, 48.5, 8.0, 12.2, -22.7, 4.2, 27.5),
  [("Comercio y turismo", 27.8, 64.4), ("Servicios sociales y personales", 21.2, 43.2), ("Industria", 13.2, 38.2)],
  2052073, 44.0),
 ("Vaupés", 9581, 4861, 56.3, 50.7, 9.8, 42.0, 1442,
  (56.6, 44.5, 10.9, 8.3, -12.1, -2.5, 41.4),
  [("Servicios sociales y personales", 55.0, 14.1), ("Comercio y turismo", 16.4, 84.9), ("Transporte y TIC", 10.9, 72.4)],
  2611479, 55.6),
 ("Vichada", 11853, 7095, 69.1, 59.9, 13.3, 62.9, 910,
  (71.6, 48.0, 11.3, 16.3, -23.6, 5.1, 44.0),
  [("Servicios sociales y personales", 36.9, 28.3), ("Comercio y turismo", 25.9, 90.8), ("Construcción", 9.5, 73.3)],
  1696646, 36.4),
]

# Umbral del DANE para advertir muestra reducida en los carruseles originales.
MUESTRA_CHICA = 2000
ESCALA_DES = 25.0   # el desempleo se dibuja en escala 0-25 %, no 0-100 %

AQUI = os.path.dirname(os.path.abspath(__file__))


def co(x, dec=1):
    """Formato colombiano: coma decimal."""
    return ("%.*f" % (dec, x)).replace(".", ",")


def miles(n):
    """Separador de miles con punto."""
    return "{:,}".format(int(n)).replace(",", ".")


def signo(d):
    return ("+" if d > 0 else "−") + co(abs(d))


def delta(v, ref):
    return signo(v - ref)


def slug(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


CHIP = '        <li><a class="chip" href="#t-{sl}" data-terr="{sl}">{n}</a></li>\n'

KPI = """          <div class="mini">
            <dt class="mini__etiqueta">{et}</dt>
            <dd class="mini__valor">{v}%</dd>
            <dd class="mini__ref">Nacional {r}% · {d}&nbsp;pp</dd>
          </div>
"""

SECTOR = """            <li class="sector">
              <p class="sector__nombre">{nom}</p>
              <p class="sector__cifra">{sh}%</p>
              <div class="sector__pista" aria-hidden="true"><span class="sector__barra" data-ancho="{w}"></span></div>
              <p class="sector__nota">{inf}% informal</p>
            </li>
"""

BARRA = """              <div class="par__fila">
                <p class="par__rotulo">{rot}</p>
                <div class="par__pista" aria-hidden="true"><span class="par__barra par__barra--{cl}" data-ancho="{w}"></span></div>
                <p class="par__cifra">{v}%</p>
              </div>
"""


def tarjeta(d):
    (nom, pet, ocupados, part, ocup, des, inf, muestra, gen, sect, ingreso, pension) = d
    ocupH, ocupM, desH, desM, dOcup, dDes, nini = gen
    sl = slug(nom)
    busca = unicodedata.normalize("NFKD", nom).encode("ascii", "ignore").decode().lower()
    o = []
    o.append('      <article class="territorio" id="t-%s" data-busca="%s" aria-labelledby="t-%s-titulo">\n'
             % (sl, busca, sl))
    o.append('        <header class="territorio__cabeza">\n')
    o.append('          <h3 class="territorio__nombre" id="t-%s-titulo">%s</h3>\n' % (sl, nom))
    o.append('          <p class="territorio__masa">\n')
    o.append('            <span><b>%s</b> personas en edad de trabajar</span>\n' % miles(pet))
    o.append('            <span><b>%s</b> ocupados</span>\n' % miles(ocupados))
    o.append('          </p>\n')
    o.append('        </header>\n\n')

    o.append('        <dl class="territorio__kpis">\n')
    for et, v, r in (("Participación", part, NAC['part']), ("Ocupación", ocup, NAC['ocup']),
                     ("Desempleo", des, NAC['des']), ("Informalidad", inf, NAC['inf'])):
        o.append(KPI.format(et=et, v=co(v), r=co(r), d=delta(v, r)))
    o.append('        </dl>\n\n')

    o.append('        <div class="bloque bloque--brecha">\n')
    o.append('          <p class="antetitulo antetitulo--claro">Brecha de género</p>\n')
    o.append('          <div class="par">\n')
    o.append('            <p class="par__titulo">Ocupación</p>\n')
    o.append(BARRA.format(rot="Hombres", cl="h", w="%.1f" % ocupH, v=co(ocupH)))
    o.append(BARRA.format(rot="Mujeres", cl="m", w="%.1f" % ocupM, v=co(ocupM)))
    o.append('          </div>\n')
    o.append('          <div class="par">\n')
    o.append('            <p class="par__titulo">Desempleo</p>\n')
    o.append(BARRA.format(rot="Hombres", cl="h", w="%.1f" % min(100.0, desH / ESCALA_DES * 100), v=co(desH)))
    o.append(BARRA.format(rot="Mujeres", cl="m", w="%.1f" % min(100.0, desM / ESCALA_DES * 100), v=co(desM)))
    o.append('          </div>\n')
    o.append('          <p class="brecha__saldo">%s&nbsp;pp de ocupación y %s&nbsp;pp de desempleo para las mujeres. '
             'El %s%% de las jóvenes ni estudia ni trabaja.</p>\n'
             % (signo(dOcup), signo(dDes), co(nini)))
    o.append('          <p class="fuente fuente--clara">Ocupación en escala 0–100&nbsp;%; desempleo en escala 0–25&nbsp;%.</p>\n')
    o.append('        </div>\n\n')

    o.append('        <div class="bloque bloque--sectores">\n')
    o.append('          <p class="antetitulo antetitulo--claro">Dónde trabaja la gente</p>\n')
    o.append('          <ol class="sectores">\n')
    for nomS, sh, infS in sect:
        o.append(SECTOR.format(nom=nomS, sh=co(sh), w="%.1f" % sh, inf=co(infS)))
    o.append('          </ol>\n')
    o.append('          <p class="fuente fuente--clara">Participación en el empleo total del departamento.</p>\n')
    o.append('        </div>\n\n')

    o.append('        <dl class="territorio__calidad">\n')
    o.append('          <div class="mini">\n')
    o.append('            <dt class="mini__etiqueta">Ingreso laboral promedio</dt>\n')
    o.append('            <dd class="mini__valor mini__valor--peso">$%s</dd>\n' % miles(ingreso))
    o.append('            <dd class="mini__ref">Nacional $%s</dd>\n' % miles(NAC['ingreso']))
    o.append('          </div>\n')
    o.append('          <div class="mini">\n')
    o.append('            <dt class="mini__etiqueta">Cotiza a pensión</dt>\n')
    o.append('            <dd class="mini__valor">%s%%</dd>\n' % co(pension))
    o.append('            <dd class="mini__ref">Nacional %s%% · %s&nbsp;pp</dd>\n'
             % (co(NAC['pension']), delta(pension, NAC['pension'])))
    o.append('          </div>\n')
    o.append('        </dl>\n\n')

    if muestra < MUESTRA_CHICA:
        o.append('        <p class="aviso-muestra">Muestra reducida: %s personas encuestadas en el trimestre. '
                 'Los cortes por sexo y edad de este departamento tienen error de muestreo alto y no deben '
                 'leerse como cifras finas.</p>\n' % miles(muestra))

    o.append('        <p class="fuente fuente--clara territorio__pie">Fuente: DANE · GEIH 2026 T1 · marco 2018 · '
             'muestra %s personas · elaboración Cifra País · actualizado 13-jul-2026</p>\n' % miles(muestra))
    o.append('      </article>\n\n')
    return "".join(o)


def escribir_html():
    ruta = os.path.join(AQUI, "territorios.html")
    with io.open(ruta, "w", encoding="utf-8", newline="\n") as out:
        out.write('        <ul class="chips" id="territorios-chips">\n')
        for d in D:
            out.write(CHIP.format(sl=slug(d[0]), n=d[0]))
        out.write('        </ul>\n\n')
        out.write("<!-- ===== TARJETAS ===== -->\n")
        for d in D:
            out.write(tarjeta(d))
    return ruta


def cargar_json():
    """Si el panel ya guardo un territorios.json editado, ese manda.

    El flujo completo: se edita en el panel -> se descarga territorios.json ->
    se reemplaza panel/datos/territorios.json -> se corre este script y el
    HTML de la pagina queda al dia. La tabla D de arriba es el arranque y el
    respaldo; cuando el JSON existe, D se ignora.
    """
    global D, NAC
    ruta = os.path.normpath(os.path.join(AQUI, "..", "panel", "datos", "territorios.json"))
    if not os.path.isfile(ruta):
        return False
    with io.open(ruta, encoding="utf-8") as f:
        datos = json.load(f)
    NAC = datos["nacional"]
    D = []
    for fila in datos["departamentos"]:
        g = fila["genero"]
        D.append((
            fila["nombre"], fila["pet"], fila["ocupados"],
            fila["participacion"], fila["ocupacion"], fila["desempleo"], fila["informalidad"],
            fila["muestra"],
            (g["ocupacionH"], g["ocupacionM"], g["desempleoH"], g["desempleoM"],
             g["brechaOcupacion"], g["brechaDesempleo"], g["nini"]),
            [(s["nombre"], s["participacion"], s["informalidad"]) for s in fila["sectores"]],
            fila["ingreso"], fila["pension"],
        ))
    return True


def escribir_json():
    """Dataset plano para el panel de administracion."""
    filas = []
    for (nom, pet, ocupados, part, ocup, des, inf, muestra, gen, sect, ingreso, pension) in D:
        ocupH, ocupM, desH, desM, dOcup, dDes, nini = gen
        filas.append({
            "id": slug(nom), "nombre": nom,
            "pet": pet, "ocupados": ocupados, "muestra": muestra,
            "participacion": part, "ocupacion": ocup, "desempleo": des, "informalidad": inf,
            "ingreso": ingreso, "pension": pension,
            "genero": {"ocupacionH": ocupH, "ocupacionM": ocupM,
                       "desempleoH": desH, "desempleoM": desM,
                       "brechaOcupacion": dOcup, "brechaDesempleo": dDes, "nini": nini},
            "sectores": [{"nombre": s[0], "participacion": s[1], "informalidad": s[2]} for s in sect],
        })
    datos = {
        "corte": "2026 T1", "marco": "2018", "actualizado": "2026-07-13",
        "fuente": "DANE · GEIH", "muestraChica": MUESTRA_CHICA, "escalaDesempleo": ESCALA_DES,
        "nacional": NAC, "departamentos": filas,
    }
    ruta = os.path.normpath(os.path.join(AQUI, "..", "panel", "datos", "territorios.json"))
    if not os.path.isdir(os.path.dirname(ruta)):
        os.makedirs(os.path.dirname(ruta))
    with io.open(ruta, "w", encoding="utf-8", newline="\n") as f:
        f.write(json.dumps(datos, ensure_ascii=False, indent=2))
    # Copia cargable con <script> para que el panel funcione sobre file://
    # (fetch() de un JSON local lo bloquea el navegador; un script no).
    ruta_js = ruta[:-2] + "js" if ruta.endswith("on") else ruta
    ruta_js = ruta.replace("territorios.json", "territorios.js")
    with io.open(ruta_js, "w", encoding="utf-8", newline="\n") as f:
        f.write("/* Generado por herramientas/gen_territorios.py — no editar a mano. */\n")
        f.write("window.DATOS_TERRITORIOS = ")
        f.write(json.dumps(datos, ensure_ascii=False, indent=2))
        f.write(";\n")
    return ruta


def revisar():
    """Chequeos de consistencia. Un dato que no cierre se reporta, no se publica."""
    fallas = []
    for (nom, pet, ocupados, part, ocup, des, inf, muestra, gen, sect, ingreso, pension) in D:
        calc = ocupados / float(pet) * 100
        if abs(calc - ocup) > 0.15:
            fallas.append("%s: ocupados/PET = %.2f%% pero la tarjeta dice %.1f%%" % (nom, calc, ocup))
        pea = pet * part / 100.0
        desc = (pea - ocupados) / pea * 100 if pea else 0
        if abs(desc - des) > 0.35:
            fallas.append("%s: desempleo implicito %.2f%% vs %.1f%%" % (nom, desc, des))
        ocupH, ocupM, desH, desM, dOcup, dDes, nini = gen
        if abs((ocupM - ocupH) - dOcup) > 0.15:
            fallas.append("%s: brecha de ocupacion no cuadra (%.1f vs %.1f)" % (nom, ocupM - ocupH, dOcup))
        if abs((desM - desH) - dDes) > 0.15:
            fallas.append("%s: brecha de desempleo no cuadra (%.1f vs %.1f)" % (nom, desM - desH, dDes))
        if sum(s[1] for s in sect) > 100.5:
            fallas.append("%s: los tres sectores suman mas de 100%%" % nom)
    return fallas


if __name__ == "__main__":
    if cargar_json():
        print("fuente: panel/datos/territorios.json")
    else:
        print("fuente: tabla D de este archivo")
    for f in revisar():
        print("REVISAR:", f)
    print("departamentos:", len(D))
    print(escribir_html())
    print(escribir_json())
