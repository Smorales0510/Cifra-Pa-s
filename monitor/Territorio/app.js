/* ===========================================================================
   CIFRA PAÍS · Tablero territorial de Antioquia
   Sin dependencias: el mapa y las gráficas se dibujan en SVG a mano.

   Contenido
     0. Utilidades
     1. Carga de datos (índice al arranque; cada tema, bajo demanda)
     2. Estado y controles
     3. Mapa coroplético
     4. Ranking y tabla
     5. Comparador
     6. Subregiones
     7. Dispersión
     8. Contexto (población, PIB per cápita, ICM)
     9. Ficha municipal
    10. Explorador de indicadores
    11. Resumen y metodología
    12. Arranque

   Los datos van partidos por tema: son ~642.000 observaciones y en un solo
   archivo el navegador se queda sin responder mientras lo parsea. El arranque
   solo paga el catálogo (92 KB); cada tema se trae la primera vez que se abre
   y queda en memoria.
   =========================================================================== */
(function () {
  'use strict';

  /* ═══ 0 · UTILIDADES ════════════════════════════════════════════════════ */

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  function crear(etiqueta, clase, texto) {
    var e = document.createElement(etiqueta);
    if (clase) e.className = clase;
    if (texto != null) e.textContent = texto;
    return e;
  }

  /* Los indicadores de la ECV vienen en proporción (0–1) o en tasa (0–100)
     según el bloque. Se decide por el rango observado y no por el nombre:
     el nombre miente más seguido que los datos. */
  function formato(v, esProporcion) {
    if (v == null || isNaN(v)) return '—';
    if (esProporcion) return (v * 100).toFixed(1).replace('.', ',') + ' %';
    if (Math.abs(v) >= 1e6) return miles(Math.round(v));
    if (Math.abs(v) >= 1000) return miles(Math.round(v));
    return v.toFixed(v % 1 === 0 ? 0 : 2).replace('.', ',');
  }

  function miles(n) {
    return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  function pesos(n) {
    if (n == null) return '—';
    return '$' + miles(n);
  }

  function plano(t) {
    return (t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  }

  /* Escala de color: azul de marca → amarillo cifra, pasando por un morado
     neutro. Es divergente en luminosidad, así que sigue leyéndose en escala de
     grises y para quien no distingue rojo de verde. */
  var RAMPA = ['#0C2A45', '#1F4E79', '#3E6E96', '#7C8BA8', '#B98E76', '#DFA243', '#E8A317'];

  function color(t) {
    if (t == null || isNaN(t)) return '#E4EAF0';
    t = Math.max(0, Math.min(1, t));
    var i = t * (RAMPA.length - 1);
    var a = RAMPA[Math.floor(i)], b = RAMPA[Math.ceil(i)], f = i - Math.floor(i);
    function c(h, k) { return parseInt(h.substr(1 + k * 2, 2), 16); }
    var r = Math.round(c(a, 0) + (c(b, 0) - c(a, 0)) * f);
    var g = Math.round(c(a, 1) + (c(b, 1) - c(a, 1)) * f);
    var z = Math.round(c(a, 2) + (c(b, 2) - c(a, 2)) * f);
    return 'rgb(' + r + ',' + g + ',' + z + ')';
  }

  var COLOR_SUB = {
    'Valle de Aburrá': '#E8A317', 'Oriente': '#1F4E79', 'Occidente': '#3E9C7A',
    'Suroeste': '#B4472E', 'Norte': '#7C5BA8', 'Nordeste': '#2E8BB4',
    'Urabá': '#C77D2E', 'Bajo Cauca': '#5A6B7C', 'Magdalena Medio': '#8AAE3E'
  };

  /* ═══ 1 · CARGA DE DATOS ════════════════════════════════════════════════ */

  var D = {};              // índice
  var GEO = null;          // geometría
  var CTX = null;          // contexto (población, per cápita, ICM)
  var TEMAS_CARGADOS = {}; // tema_id -> índice de filas
  var pidiendo = {};

  function traer(ruta) {
    return fetch(ruta).then(function (r) {
      if (!r.ok) throw new Error(ruta + ' → ' + r.status);
      return r.json();
    });
  }

  /* Devuelve una promesa con el índice del tema: mapa de
     ind_id → { terr_id → { 'anio|zona': [valor, cv] } } */
  function cargando(si) {
    var b = $('#cargando');
    if (b) b.hidden = !si;
  }

  function tema(id) {
    if (TEMAS_CARGADOS[id]) return Promise.resolve(TEMAS_CARGADOS[id]);
    if (pidiendo[id]) return pidiendo[id];
    cargando(true);
    pidiendo[id] = traer('datos/tema-' + id + '.json').then(function (j) {
      var idx = {};
      j.filas.forEach(function (f) {
        // f = [ind, terr, anio, zona, valor, cv?]
        var porInd = idx[f[0]] || (idx[f[0]] = {});
        var porTerr = porInd[f[1]] || (porInd[f[1]] = {});
        porTerr[f[2] + '|' + f[3]] = [f[4], f.length > 5 ? f[5] : null];
      });
      TEMAS_CARGADOS[id] = idx;
      delete pidiendo[id];
      cargando(false);
      return idx;
    }).catch(function (e) {
      delete pidiendo[id];
      cargando(false);
      throw e;
    });
    return pidiendo[id];
  }

  /* ═══ 2 · ESTADO Y CONTROLES ════════════════════════════════════════════ */

  var E = {
    ind: 0,        // indicador activo
    anio: 1,       // índice en D.anios
    zona: 0,       // índice en D.zonas
    sub: '',       // subregión filtrada ('' = todas)
    vista: 'resumen',
    comparar: [],  // territorios fijados
    indY: null,    // segundo indicador (dispersión)
    ficha: 0
  };

  var VISTAS = [
    ['resumen', 'Resumen'], ['mapa', 'Mapa'], ['ranking', 'Ranking'],
    ['comparar', 'Comparar'], ['subregiones', 'Subregiones'],
    ['dispersion', 'Dispersión'], ['contexto', 'Contexto'],
    ['ficha', 'Ficha'], ['explorar', 'Explorar'], ['metodo', 'Metodología']
  ];

  function esMunicipio(t) { return t < 125; }
  function idDepartamento() { return D.territorios.length - 1; }

  function indicadorActivo() { return D.indicadores[E.ind]; }

  /* Un indicador puede existir solo en una de las dos ondas. El bit 1 es 2021
     y el bit 2 es 2023 (ver construir.py). */
  function tieneAnio(ind, i) { return (D.indicadores[ind][2] & (1 << i)) !== 0; }

  /* Lee el valor de un territorio para el estado actual. */
  function valor(idx, terr, anio, zona) {
    var porInd = idx[E.ind];
    if (!porInd) return null;
    var porTerr = porInd[terr];
    if (!porTerr) return null;
    return porTerr[(anio == null ? E.anio : anio) + '|' + (zona == null ? E.zona : zona)] || null;
  }

  /* Serie municipal completa del indicador activo, ya filtrada por subregión. */
  function serieMunicipal(idx) {
    var out = [];
    for (var t = 0; t < 125; t++) {
      if (E.sub && D.territorios[t][2] !== E.sub) continue;
      var v = valor(idx, t);
      out.push({ t: t, nom: D.territorios[t][1], sub: D.territorios[t][2],
                 v: v ? v[0] : null, cv: v ? v[1] : null });
    }
    return out;
  }

  /* ¿El indicador está en proporción 0–1? Se decide por el máximo observado. */
  function esProporcion(serie) {
    var max = 0, hay = false;
    serie.forEach(function (d) { if (d.v != null) { hay = true; if (Math.abs(d.v) > max) max = Math.abs(d.v); } });
    return hay && max <= 1.0000001;
  }

  function pintarSelectores() {
    var st = $('#c-tema');
    st.innerHTML = '';
    st.appendChild(new Option('Todos los temas', ''));
    D.temas.forEach(function (t, i) { st.appendChild(new Option(t, i)); });

    var sz = $('#c-zona');
    sz.innerHTML = '';
    D.zonas.forEach(function (z, i) { sz.appendChild(new Option(z, i)); });

    var ss = $('#c-sub');
    ss.innerHTML = '';
    ss.appendChild(new Option('Todas', ''));
    D.subregiones.forEach(function (s) { ss.appendChild(new Option(s, s)); });

    pintarIndicadores();
    pintarAnios();

    var sa = $('#c-agregar'), sf = $('#c-ficha');
    sa.innerHTML = ''; sf.innerHTML = '';
    sa.appendChild(new Option('Elegir…', ''));
    D.territorios.forEach(function (t, i) {
      var etiqueta = t[2] ? t[1] + ' · ' + t[2] : t[1];
      sa.appendChild(new Option(etiqueta, i));
      if (i < 125) sf.appendChild(new Option(t[1] + ' · ' + t[2], i));
    });
    sf.value = E.ficha;
  }

  /* Con 1.252 indicadores, una lista desplegable sola es inservible: nadie
     recorre esa cantidad de opciones. El campo de texto de arriba la recorta
     en vivo. Se conserva un <select> de verdad —y no un componente propio—
     para no romper el teclado ni los lectores de pantalla. */
  function pintarIndicadores() {
    var t = $('#c-tema').value;
    var q = plano(($('#c-filtro') || {}).value || '');
    var si = $('#c-indicador');
    si.innerHTML = '';

    var n = 0;
    D.indicadores.forEach(function (ind, i) {
      if (t !== '' && String(ind[0]) !== t) return;
      if (q && plano(ind[1]).indexOf(q) === -1 && plano(D.temas[ind[0]]).indexOf(q) === -1) return;
      var marca = ind[2] === 3 ? '' : (ind[2] === 1 ? ' [solo 2021]' : ' [solo 2023]');
      si.appendChild(new Option(ind[1] + marca, i));
      n++;
    });

    var cuenta = $('#c-cuenta');
    if (cuenta) cuenta.textContent = n === D.indicadores.length ? '' : '· ' + n + ' de ' + D.indicadores.length;
    si.setAttribute('data-vacio', n ? '0' : '1');

    /* Si el indicador activo se cayó del filtro NO se cambia: se perdería lo
       que el usuario está mirando por escribir una letra. Solo se reemplaza
       cuando el filtro deja algo y el activo ya no está en ninguna parte. */
    if (!si.querySelector('option[value="' + E.ind + '"]')) {
      if (n) { E.ind = parseInt(si.options[0].value, 10); }
      else { si.appendChild(new Option(D.indicadores[E.ind][1] + ' (fuera del filtro)', E.ind)); }
    }
    si.value = E.ind;

    var sy = $('#c-eje-y');
    sy.innerHTML = si.innerHTML;
    sy.value = E.indY != null ? E.indY : E.ind;
  }

  function pintarAnios() {
    var sa = $('#c-anio');
    sa.innerHTML = '';
    D.anios.forEach(function (a, i) {
      var o = new Option(a + (tieneAnio(E.ind, i) ? '' : ' · sin dato'), i);
      o.disabled = !tieneAnio(E.ind, i);
      sa.appendChild(o);
    });
    if (!tieneAnio(E.ind, E.anio)) {
      E.anio = tieneAnio(E.ind, 1) ? 1 : 0;
    }
    sa.value = E.anio;
  }

  /* ═══ 3 · MAPA COROPLÉTICO ══════════════════════════════════════════════ */

  var proyeccion = null;

  function prepararProyeccion(ancho, alto) {
    var x0 = 180, y0 = 90, x1 = -180, y1 = -90;
    GEO.features.forEach(function (f) {
      recorrer(f.geometry, function (p) {
        if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0];
        if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1];
      });
    });
    // Equirrectangular corregida por la latitud media: a 7° N el factor es
    // casi 1, pero sin él Antioquia sale estirada en horizontal.
    var k = Math.cos((y0 + y1) / 2 * Math.PI / 180);
    var w = (x1 - x0) * k, h = (y1 - y0);
    var s = Math.min(ancho / w, alto / h) * 0.96;
    var dx = (ancho - w * s) / 2, dy = (alto - h * s) / 2;
    proyeccion = function (p) {
      return [((p[0] - x0) * k) * s + dx, (y1 - p[1]) * s + dy];
    };
  }

  function recorrer(geom, fn) {
    var c = geom.coordinates;
    if (geom.type === 'Polygon') c.forEach(function (a) { a.forEach(fn); });
    else if (geom.type === 'MultiPolygon') c.forEach(function (p) { p.forEach(function (a) { a.forEach(fn); }); });
  }

  function ruta(geom) {
    var d = [];
    function anillo(a) {
      a.forEach(function (p, i) {
        var q = proyeccion(p);
        d.push((i ? 'L' : 'M') + q[0].toFixed(1) + ' ' + q[1].toFixed(1));
      });
      d.push('Z');
    }
    if (geom.type === 'Polygon') geom.coordinates.forEach(anillo);
    else if (geom.type === 'MultiPolygon') geom.coordinates.forEach(function (p) { p.forEach(anillo); });
    return d.join('');
  }

  function dibujarMapa(idx) {
    var caja = $('#mapa-lienzo');
    caja.innerHTML = '';
    var ancho = 640, alto = 720;
    prepararProyeccion(ancho, alto);

    var serie = serieMunicipal(idx);
    var prop = esProporcion(serie);
    var vals = serie.filter(function (d) { return d.v != null; }).map(function (d) { return d.v; });
    var min = Math.min.apply(null, vals), max = Math.max.apply(null, vals);
    var porCod = {};
    serie.forEach(function (d) { porCod[D.territorios[d.t][0]] = d; });

    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 ' + ancho + ' ' + alto);
    svg.setAttribute('class', 'mapa');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'Mapa de Antioquia por municipio: ' + indicadorActivo()[1]);

    GEO.features.forEach(function (f) {
      var p = f.properties;
      var d = porCod[p.cod];
      var camino = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      camino.setAttribute('d', ruta(f.geometry));
      camino.setAttribute('class', 'mapa__mun' + (d && d.v != null ? '' : ' mapa__mun--nulo'));
      if (d && d.v != null) {
        camino.setAttribute('fill', color(max > min ? (d.v - min) / (max - min) : 0.5));
      }
      camino.setAttribute('tabindex', '0');
      camino.setAttribute('data-cod', p.cod);
      if (E.comparar.indexOf(codATerr(p.cod)) !== -1) camino.setAttribute('data-sel', '1');

      var titulo = document.createElementNS('http://www.w3.org/2000/svg', 'title');
      titulo.textContent = p.nom + ' · ' + p.sub + ' · ' +
        (d && d.v != null ? formato(d.v, prop) : 'sin dato');
      camino.appendChild(titulo);

      camino.addEventListener('mousemove', function (e) { globo(e, p, d, prop); });
      camino.addEventListener('mouseleave', ocultarGlobo);
      camino.addEventListener('focus', function () { globoFijo(p, d, prop, camino); });
      camino.addEventListener('blur', ocultarGlobo);
      camino.addEventListener('click', function () { alternarComparar(codATerr(p.cod)); });
      camino.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); alternarComparar(codATerr(p.cod)); }
      });
      svg.appendChild(camino);
    });

    caja.appendChild(svg);

    $('#escala-min').textContent = formato(min, prop);
    $('#escala-max').textContent = formato(max, prop);
    var barra = $('#escala-barra');
    barra.innerHTML = '';
    for (var i = 0; i < 40; i++) {
      var r = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      r.setAttribute('x', i * 2.5); r.setAttribute('y', 0);
      r.setAttribute('width', 2.6); r.setAttribute('height', 10);
      r.setAttribute('fill', color(i / 39));
      barra.appendChild(r);
    }
    $('#mapa-titulo').textContent = indicadorActivo()[1];
    $('#mapa-fuente').textContent = pieFuente(serie);
    tablaRanking($('#mapa-ranking'), serie, prop, true);
  }

  function codATerr(cod) {
    for (var i = 0; i < 125; i++) if (D.territorios[i][0] === cod) return i;
    return -1;
  }

  function globo(e, p, d, prop) {
    var g = $('#globo');
    g.hidden = false;
    g.innerHTML = '';
    g.appendChild(crear('div', 'globo__nom', p.nom));
    g.appendChild(crear('div', 'globo__val', d && d.v != null ? formato(d.v, prop) : 'sin dato'));
    g.appendChild(crear('div', 'globo__sub', p.sub + (d && d.cv != null ? ' · CV ' + d.cv.toFixed(1) + ' %' : '')));
    var x = Math.min(e.clientX + 14, window.innerWidth - 260);
    g.style.left = x + 'px';
    g.style.top = Math.max(8, e.clientY - 60) + 'px';
  }

  function globoFijo(p, d, prop, el) {
    var r = el.getBoundingClientRect();
    globo({ clientX: r.left + r.width / 2, clientY: r.top }, p, d, prop);
  }

  function ocultarGlobo() { $('#globo').hidden = true; }

  /* ═══ 4 · RANKING Y TABLA ═══════════════════════════════════════════════ */

  var orden = { col: 'v', desc: true };

  function tablaRanking(caja, serie, prop, compacta) {
    var datos = serie.filter(function (d) { return d.v != null; });
    datos.sort(function (a, b) {
      var x = orden.col === 'nom' ? a.nom.localeCompare(b.nom, 'es') : (a[orden.col] || 0) - (b[orden.col] || 0);
      return orden.desc ? -x : x;
    });

    caja.innerHTML = '';
    if (!datos.length) {
      caja.appendChild(crear('p', 'vacio', 'Este indicador no tiene datos para el año y la zona elegidos.'));
      return;
    }

    var dep = null;
    var idx = TEMAS_CARGADOS[indicadorActivo()[0]];
    if (idx) { var vd = valor(idx, idDepartamento()); dep = vd ? vd[0] : null; }

    var t = crear('table', 'tabla');
    var thead = crear('thead'), tr = crear('tr');
    var cols = compacta
      ? [['pos', '#', ''], ['nom', 'Municipio', ''], ['v', 'Valor', 'num']]
      : [['pos', '#', ''], ['nom', 'Municipio', ''], ['sub', 'Subregión', ''],
         ['v', 'Valor', 'num'], ['delta', 'Δ dep.', 'num'], ['cv', 'CV', 'num']];
    cols.forEach(function (c) {
      var th = crear('th', c[2], c[1]);
      if (c[0] !== 'pos') {
        th.addEventListener('click', function () {
          orden.desc = orden.col === c[0] ? !orden.desc : true;
          orden.col = c[0];
          refrescar();
        });
        if (orden.col === c[0]) th.setAttribute('aria-sort', orden.desc ? 'descending' : 'ascending');
      }
      tr.appendChild(th);
    });
    thead.appendChild(tr); t.appendChild(thead);

    var tb = crear('tbody');
    datos.forEach(function (d, i) {
      var f = crear('tr');
      if (E.comparar.indexOf(d.t) !== -1) f.setAttribute('data-sel', '1');
      f.appendChild(crear('td', 'pos', String(i + 1)));
      f.appendChild(crear('td', null, d.nom));
      if (!compacta) f.appendChild(crear('td', null, d.sub));
      f.appendChild(crear('td', 'num', formato(d.v, prop)));
      if (!compacta) {
        f.appendChild(crear('td', 'num', dep != null
          ? (d.v - dep >= 0 ? '+' : '−') + formato(Math.abs(d.v - dep), prop) : '—'));
        var td = crear('td', 'num' + (d.cv != null && d.cv > 15 ? ' cv-alto' : ''),
          d.cv != null ? d.cv.toFixed(1) + ' %' : '—');
        f.appendChild(td);
      }
      f.addEventListener('click', function () { alternarComparar(d.t); });
      f.style.cursor = 'pointer';
      tb.appendChild(f);
    });
    t.appendChild(tb);
    caja.appendChild(t);
  }

  /* Descarga la serie municipal visible tal como está: con su CV, su
     subregión, el año y la zona. Se arma con Blob y no con un endpoint,
     porque el sitio es estático y no hay servidor que pueda generarlo. */
  function descargarCSV(serie, prop) {
    var ind = indicadorActivo();
    var cab = ['codigo', 'municipio', 'subregion', 'indicador', 'tema',
               'anio', 'zona', 'valor', 'unidad', 'cv_pct'];
    var filas = [cab.join(',')];
    serie.forEach(function (d) {
      filas.push([
        D.territorios[d.t][0],
        '"' + d.nom.replace(/"/g, '""') + '"',
        '"' + d.sub + '"',
        '"' + ind[1].replace(/"/g, '""') + '"',
        '"' + D.temas[ind[0]] + '"',
        D.anios[E.anio],
        D.zonas[E.zona],
        d.v == null ? '' : d.v,
        prop ? 'proporcion_0_1' : 'valor_original',
        d.cv == null ? '' : d.cv
      ].join(','));
    });
    filas.push('');
    filas.push('# Fuente: ' + D.fuentes.ecv);
    filas.push('# Elaboracion: Cifra Pais Analitica S.A.S. · cifrapais.com');
    filas.push('# CV = coeficiente de variacion. Por encima de 15 % la cifra no admite lectura fina.');

    // El BOM hace que Excel en Windows abra las tildes bien.
    var blob = new Blob(['\ufeff' + filas.join('\n')], { type: 'text/csv;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'cifrapais-' + plano(ind[1]).replace(/[^a-z0-9]+/g, '-').slice(0, 50) +
                 '-' + D.anios[E.anio] + '.csv';
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function botonCSV(serie, prop) {
    var b = crear('button', 'boton boton--claro', 'Descargar CSV');
    b.type = 'button';
    b.style.marginTop = '1rem';
    b.addEventListener('click', function () { descargarCSV(serie, prop); });
    return b;
  }

  function pieFuente(serie) {
    var n = serie.filter(function (d) { return d.v != null; }).length;
    var altos = serie.filter(function (d) { return d.cv != null && d.cv > 15; }).length;
    return 'Fuente: ' + D.fuentes.ecv + ' · elaboración Cifra País · ' +
      n + ' de ' + serie.length + ' municipios con dato' +
      (altos ? ' · ' + altos + ' con coeficiente de variación sobre 15 %' : '') +
      ' · ' + D.anios[E.anio] + ' · zona ' + D.zonas[E.zona].toLowerCase();
  }

  /* ═══ 5 · COMPARADOR ════════════════════════════════════════════════════ */

  function alternarComparar(t) {
    if (t < 0) return;
    var i = E.comparar.indexOf(t);
    if (i === -1) { if (E.comparar.length < 8) E.comparar.push(t); }
    else E.comparar.splice(i, 1);
    refrescar();
  }

  function dibujarComparar(idx) {
    var caja = $('#comparar-pastillas');
    caja.innerHTML = '';
    E.comparar.forEach(function (t) {
      var p = crear('span', 'pastilla', D.territorios[t][1]);
      var b = crear('button', null, '×');
      b.type = 'button';
      b.setAttribute('aria-label', 'Quitar ' + D.territorios[t][1]);
      b.addEventListener('click', function () { alternarComparar(t); });
      p.appendChild(b);
      caja.appendChild(p);
    });

    var lienzo = $('#comparar-lienzo');
    lienzo.innerHTML = '';
    if (!E.comparar.length) {
      lienzo.appendChild(crear('p', 'vacio',
        'Todavía no hay territorios elegidos. Agregá uno arriba, o hacé clic en el mapa o en el ranking.'));
      return;
    }

    var filas = E.comparar.map(function (t) {
      var r = { t: t, nom: D.territorios[t][1], sub: D.territorios[t][2] };
      D.anios.forEach(function (a, i) {
        var v = valor(idx, t, i);
        r['a' + i] = v ? v[0] : null;
        r['cv' + i] = v ? v[1] : null;
      });
      return r;
    });
    var todos = [];
    filas.forEach(function (f) { D.anios.forEach(function (a, i) { if (f['a' + i] != null) todos.push({ v: f['a' + i] }); }); });
    var prop = esProporcion(todos);

    var t = crear('table', 'tabla');
    var tr = crear('tr');
    ['Territorio', 'Subregión'].forEach(function (h) { tr.appendChild(crear('th', null, h)); });
    D.anios.forEach(function (a) { tr.appendChild(crear('th', 'num', String(a))); });
    tr.appendChild(crear('th', 'num', 'Cambio'));
    var th = crear('thead'); th.appendChild(tr); t.appendChild(th);

    var tb = crear('tbody');
    filas.forEach(function (f) {
      var fila = crear('tr');
      fila.appendChild(crear('td', null, f.nom));
      fila.appendChild(crear('td', null, f.sub || '—'));
      D.anios.forEach(function (a, i) {
        var td = crear('td', 'num', formato(f['a' + i], prop));
        if (f['cv' + i] != null && f['cv' + i] > 15) td.className = 'num cv-alto';
        fila.appendChild(td);
      });
      var cambio = (f.a0 != null && f.a1 != null) ? f.a1 - f.a0 : null;
      fila.appendChild(crear('td', 'num', cambio == null ? '—'
        : (cambio >= 0 ? '+' : '−') + formato(Math.abs(cambio), prop)));
      tb.appendChild(fila);
    });
    t.appendChild(tb);
    lienzo.appendChild(t);

    lienzo.appendChild(barras(filas.map(function (f) {
      return { nom: f.nom, v: f['a' + E.anio], color: COLOR_SUB[f.sub] || '#1F4E79' };
    }), prop));

    $('#comparar-fuente').textContent = 'Fuente: ' + D.fuentes.ecv +
      ' · elaboración Cifra País · «Cambio» solo aparece cuando el indicador existe en las dos ondas.';
  }

  /* Barras horizontales en SVG. */
  function barras(datos, prop) {
    var validos = datos.filter(function (d) { return d.v != null; });
    if (!validos.length) return crear('p', 'vacio', 'Sin dato para el año y la zona elegidos.');
    var max = Math.max.apply(null, validos.map(function (d) { return Math.abs(d.v); }));
    var alto = datos.length * 30 + 16, ancho = 700, izq = 190;
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 ' + ancho + ' ' + alto);
    svg.setAttribute('width', '100%');
    svg.setAttribute('style', 'margin-top:1rem;height:auto');
    datos.forEach(function (d, i) {
      var y = i * 30 + 8;
      var et = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      et.setAttribute('x', izq - 8); et.setAttribute('y', y + 15);
      et.setAttribute('text-anchor', 'end');
      et.setAttribute('font-size', '12'); et.setAttribute('fill', '#1B2733');
      et.textContent = d.nom.length > 26 ? d.nom.slice(0, 25) + '…' : d.nom;
      svg.appendChild(et);
      if (d.v == null) return;
      var w = Math.abs(d.v) / max * (ancho - izq - 70);
      var r = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      r.setAttribute('x', izq); r.setAttribute('y', y + 4);
      r.setAttribute('width', Math.max(1, w)); r.setAttribute('height', 18);
      r.setAttribute('fill', d.color || '#1F4E79');
      svg.appendChild(r);
      var vt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      vt.setAttribute('x', izq + w + 6); vt.setAttribute('y', y + 17);
      vt.setAttribute('font-size', '12'); vt.setAttribute('fill', '#5A6B7C');
      vt.setAttribute('font-family', 'Courier Prime, monospace');
      vt.textContent = formato(d.v, prop);
      svg.appendChild(vt);
    });
    return svg;
  }

  /* ═══ 6 · SUBREGIONES ═══════════════════════════════════════════════════ */

  function dibujarSubregiones(idx) {
    var datos = D.subregiones.map(function (s, i) {
      var v = valor(idx, 125 + i);
      return { nom: s, v: v ? v[0] : null, cv: v ? v[1] : null, color: COLOR_SUB[s] };
    });
    var prop = esProporcion(datos);
    datos.sort(function (a, b) { return (b.v || 0) - (a.v || 0); });

    var l = $('#sub-lienzo'); l.innerHTML = '';
    l.appendChild(barras(datos, prop));

    var vd = valor(idx, idDepartamento());
    var caja = $('#sub-tabla'); caja.innerHTML = '';
    var t = crear('table', 'tabla');
    var tr = crear('tr');
    ['Subregión', 'Municipios', 'Valor', 'Δ dep.', 'CV'].forEach(function (h, i) {
      tr.appendChild(crear('th', i > 0 ? 'num' : '', h));
    });
    var th = crear('thead'); th.appendChild(tr); t.appendChild(th);
    var tb = crear('tbody');
    datos.forEach(function (d) {
      var n = 0;
      for (var i = 0; i < 125; i++) if (D.territorios[i][2] === d.nom) n++;
      var f = crear('tr');
      f.appendChild(crear('td', null, d.nom));
      f.appendChild(crear('td', 'num', String(n)));
      f.appendChild(crear('td', 'num', formato(d.v, prop)));
      f.appendChild(crear('td', 'num', (vd && d.v != null)
        ? (d.v - vd[0] >= 0 ? '+' : '−') + formato(Math.abs(d.v - vd[0]), prop) : '—'));
      f.appendChild(crear('td', 'num' + (d.cv != null && d.cv > 15 ? ' cv-alto' : ''),
        d.cv != null ? d.cv.toFixed(1) + ' %' : '—'));
      tb.appendChild(f);
    });
    if (vd) {
      var fd = crear('tr');
      fd.appendChild(crear('td', null, 'Antioquia (total)'));
      fd.appendChild(crear('td', 'num', '125'));
      fd.appendChild(crear('td', 'num', formato(vd[0], prop)));
      fd.appendChild(crear('td', 'num', '—'));
      fd.appendChild(crear('td', 'num', vd[1] != null ? vd[1].toFixed(1) + ' %' : '—'));
      tb.appendChild(fd);
    }
    t.appendChild(tb); caja.appendChild(t);
    $('#sub-fuente').textContent = 'Fuente: ' + D.fuentes.ecv + ' · elaboración Cifra País · ' +
      D.anios[E.anio] + ' · zona ' + D.zonas[E.zona].toLowerCase();
  }

  /* ═══ 7 · DISPERSIÓN ════════════════════════════════════════════════════ */

  function dibujarDispersion(idxX) {
    var indY = E.indY != null ? E.indY : E.ind;
    tema(D.indicadores[indY][0]).then(function (idxY) {
      var puntos = [];
      for (var t = 0; t < 125; t++) {
        if (E.sub && D.territorios[t][2] !== E.sub) continue;
        var vx = (idxX[E.ind] && idxX[E.ind][t]) ? idxX[E.ind][t][E.anio + '|' + E.zona] : null;
        var vy = (idxY[indY] && idxY[indY][t]) ? idxY[indY][t][E.anio + '|' + E.zona] : null;
        if (!vx || !vy) continue;
        puntos.push({ x: vx[0], y: vy[0], nom: D.territorios[t][1], sub: D.territorios[t][2] });
      }
      var l = $('#disp-lienzo'); l.innerHTML = '';
      if (puntos.length < 3) {
        l.appendChild(crear('p', 'vacio', 'Hacen falta al menos tres municipios con dato en los dos indicadores.'));
        $('#disp-fuente').textContent = '';
        return;
      }
      var propX = esProporcion(puntos.map(function (p) { return { v: p.x }; }));
      var propY = esProporcion(puntos.map(function (p) { return { v: p.y }; }));

      var W = 700, H = 480, m = { t: 16, r: 16, b: 52, l: 76 };
      var xs = puntos.map(function (p) { return p.x; }), ys = puntos.map(function (p) { return p.y; });
      var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs);
      var y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
      var px = function (v) { return m.l + (x1 > x0 ? (v - x0) / (x1 - x0) : 0.5) * (W - m.l - m.r); };
      var py = function (v) { return H - m.b - (y1 > y0 ? (v - y0) / (y1 - y0) : 0.5) * (H - m.t - m.b); };

      var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
      svg.setAttribute('width', '100%');
      svg.setAttribute('style', 'height:auto');
      svg.setAttribute('role', 'img');
      svg.setAttribute('aria-label', 'Dispersión de ' + D.indicadores[indY][1] + ' frente a ' + indicadorActivo()[1]);

      [0, 0.25, 0.5, 0.75, 1].forEach(function (f) {
        var y = H - m.b - f * (H - m.t - m.b);
        var ln = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        ln.setAttribute('x1', m.l); ln.setAttribute('x2', W - m.r);
        ln.setAttribute('y1', y); ln.setAttribute('y2', y);
        ln.setAttribute('stroke', '#DDE5EC');
        svg.appendChild(ln);
        var tx = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tx.setAttribute('x', m.l - 8); tx.setAttribute('y', y + 4);
        tx.setAttribute('text-anchor', 'end'); tx.setAttribute('font-size', '11');
        tx.setAttribute('fill', '#5A6B7C'); tx.setAttribute('font-family', 'Courier Prime, monospace');
        tx.textContent = formato(y0 + f * (y1 - y0), propY);
        svg.appendChild(tx);
      });

      puntos.forEach(function (p) {
        var c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        c.setAttribute('cx', px(p.x)); c.setAttribute('cy', py(p.y));
        c.setAttribute('r', 5);
        c.setAttribute('fill', COLOR_SUB[p.sub] || '#1F4E79');
        c.setAttribute('fill-opacity', '0.8');
        var ti = document.createElementNS('http://www.w3.org/2000/svg', 'title');
        ti.textContent = p.nom + ' · ' + formato(p.x, propX) + ' / ' + formato(p.y, propY);
        c.appendChild(ti);
        svg.appendChild(c);
      });

      [[indicadorActivo()[1], W / 2, H - 14, 'middle'],
       [D.indicadores[indY][1], 14, H / 2, 'middle']].forEach(function (e, i) {
        var tx = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tx.setAttribute('x', e[1]); tx.setAttribute('y', e[2]);
        tx.setAttribute('text-anchor', e[3]); tx.setAttribute('font-size', '12');
        tx.setAttribute('fill', '#1B2733');
        if (i) tx.setAttribute('transform', 'rotate(-90 14 ' + (H / 2) + ')');
        tx.textContent = e[0].length > 60 ? e[0].slice(0, 59) + '…' : e[0];
        svg.appendChild(tx);
      });
      l.appendChild(svg);

      /* Leyenda: sin ella los nueve colores del gráfico son decoración. */
      var leyenda = crear('div', 'leyenda');
      D.subregiones.forEach(function (s) {
        var e = crear('span', 'leyenda__item');
        var p = crear('span', 'leyenda__punto');
        p.style.background = COLOR_SUB[s];
        e.appendChild(p);
        e.appendChild(document.createTextNode(s));
        leyenda.appendChild(e);
      });
      l.appendChild(leyenda);

      // Correlación de Pearson, con su advertencia al lado.
      var n = puntos.length;
      var mx = xs.reduce(function (a, b) { return a + b; }, 0) / n;
      var my = ys.reduce(function (a, b) { return a + b; }, 0) / n;
      var num = 0, dx = 0, dy = 0;
      puntos.forEach(function (p) {
        num += (p.x - mx) * (p.y - my); dx += Math.pow(p.x - mx, 2); dy += Math.pow(p.y - my, 2);
      });
      var r = (dx && dy) ? num / Math.sqrt(dx * dy) : 0;
      $('#disp-fuente').textContent = 'Correlación de Pearson r = ' + r.toFixed(3).replace('.', ',') +
        ' sobre ' + n + ' municipios. Es una medida de asociación lineal, no de causa. ' +
        'Fuente: ' + D.fuentes.ecv + ' · elaboración Cifra País.';
    });
  }

  /* ═══ 8 · CONTEXTO ══════════════════════════════════════════════════════ */

  function dibujarContexto() {
    var campo = $('#c-serie').value;
    var esPesos = campo === 'pc';
    var anios = CTX.anios;
    var ultimo = null;
    anios.forEach(function (a) {
      for (var t = 0; t < 125; t++) {
        var s = CTX.series[t];
        if (s && s[a] && s[a][campo] != null) { ultimo = a; break; }
      }
    });

    var datos = [];
    for (var t = 0; t < 125; t++) {
      if (E.sub && D.territorios[t][2] !== E.sub) continue;
      var s = CTX.series[t];
      var v = (s && s[ultimo]) ? s[ultimo][campo] : null;
      if (v == null) continue;
      datos.push({ t: t, nom: D.territorios[t][1], sub: D.territorios[t][2], v: v });
    }
    datos.sort(function (a, b) { return b.v - a.v; });

    var l = $('#ctx-lienzo'); l.innerHTML = '';
    l.appendChild(barras(datos.slice(0, 20).map(function (d) {
      return { nom: d.nom, v: d.v, color: COLOR_SUB[d.sub] };
    }), false));

    var caja = $('#ctx-tabla'); caja.innerHTML = '';
    var t2 = crear('table', 'tabla');
    var tr = crear('tr');
    ['#', 'Municipio', 'Subregión', 'Valor'].forEach(function (h, i) {
      tr.appendChild(crear('th', i === 3 ? 'num' : '', h));
    });
    var th = crear('thead'); th.appendChild(tr); t2.appendChild(th);
    var tb = crear('tbody');
    datos.forEach(function (d, i) {
      var f = crear('tr');
      f.appendChild(crear('td', 'pos', String(i + 1)));
      f.appendChild(crear('td', null, d.nom));
      f.appendChild(crear('td', null, d.sub));
      f.appendChild(crear('td', 'num', esPesos ? pesos(d.v)
        : (campo === 'pob' ? miles(d.v) : d.v.toFixed(2).replace('.', ','))));
      tb.appendChild(f);
    });
    t2.appendChild(tb); caja.appendChild(t2);

    var fuente = campo === 'pc'
      ? D.fuentes.vam + ' cruzado con la población del ' + D.fuentes.icm
      : (campo === 'pob' ? D.fuentes.icm : D.fuentes.icm);
    $('#ctx-fuente').textContent = 'Año ' + ultimo + ' · ' + datos.length +
      ' municipios · Fuente: ' + fuente + ' · elaboración Cifra País.' +
      (esPesos ? ' Pesos corrientes: no descontar inflación al comparar años.' : '');
  }

  /* ═══ 9 · FICHA MUNICIPAL ═══════════════════════════════════════════════ */

  function dibujarFicha(idx) {
    var t = E.ficha;
    var l = $('#ficha-lienzo'); l.innerHTML = '';
    var info = D.territorios[t];
    var s = CTX.series[t] || {};
    var ultimo = CTX.anios.filter(function (a) { return s[a]; }).pop();
    var d = ultimo ? s[ultimo] : {};

    var cab = crear('div');
    cab.appendChild(crear('h2', 'tarjeta__titulo', info[1]));
    cab.appendChild(crear('p', 'tarjeta__nota',
      'Subregión ' + info[2] + ' · código Divipola ' + info[0]));
    l.appendChild(cab);

    var reja = crear('div', 'reja3');
    [['Población', d.pob != null ? miles(d.pob) : '—', ultimo ? String(ultimo) : ''],
     ['PIB per cápita', d.pc != null ? pesos(d.pc) : '—', 'COP corrientes ' + (ultimo || '')],
     ['ICM', d.icm != null ? d.icm.toFixed(1).replace('.', ',') : '—', '0–100 · ' + (ultimo || '')]
    ].forEach(function (k, i) {
      var c = crear('div', 'kpi' + (i === 2 ? ' kpi--acento' : ''));
      c.appendChild(crear('p', 'kpi__rotulo', k[0]));
      c.appendChild(crear('p', 'kpi__valor' + (i === 2 ? ' kpi__valor--acento' : ''), k[1]));
      c.appendChild(crear('p', 'kpi__nota', k[2]));
      reja.appendChild(c);
    });
    l.appendChild(reja);

    var tit = crear('h3', 'tarjeta__titulo', 'Este indicador, en contexto');
    tit.style.marginTop = '1.5rem';
    l.appendChild(tit);

    var serie = serieMunicipal(idx);
    var prop = esProporcion(serie);
    var mio = null, pos = 0;
    var validos = serie.filter(function (x) { return x.v != null; })
                       .sort(function (a, b) { return b.v - a.v; });
    validos.forEach(function (x, i) { if (x.t === t) { mio = x; pos = i + 1; } });

    if (!mio) {
      l.appendChild(crear('p', 'vacio', 'Este municipio no tiene dato para el indicador, año y zona elegidos.'));
    } else {
      var vd = valor(idx, idDepartamento());
      var p = crear('p');
      p.innerHTML = '<b>' + indicadorActivo()[1] + '</b>: ' + formato(mio.v, prop) +
        ' en ' + D.anios[E.anio] + '. Puesto ' + pos + ' de ' + validos.length +
        (vd ? '. Antioquia: ' + formato(vd[0], prop) : '') +
        (mio.cv != null ? '. Coeficiente de variación ' + mio.cv.toFixed(1) + ' %.' : '');
      l.appendChild(p);
      if (mio.cv != null && mio.cv > 15) {
        l.appendChild(crear('p', 'aviso aviso--riesgo',
          'El coeficiente de variación supera el 15 %: esta cifra sirve para ver el orden de magnitud, no para comparar diferencias pequeñas con otro municipio.'));
      }
      var mismos = serie.filter(function (x) { return x.sub === info[2] && x.v != null; })
                        .sort(function (a, b) { return b.v - a.v; });
      l.appendChild(barras(mismos.map(function (x) {
        return { nom: x.nom, v: x.v, color: x.t === t ? '#E8A317' : '#7C8BA8' };
      }), prop));
      l.appendChild(crear('p', 'fuente',
        'Comparación con los demás municipios de ' + info[2] + '. Fuente: ' + D.fuentes.ecv + '.'));
    }
  }

  /* ═══ 10 · EXPLORADOR ═══════════════════════════════════════════════════ */

  function dibujarExplorar() {
    var q = plano($('#c-buscar').value);
    var caja = $('#explorar-tabla');
    caja.innerHTML = '';
    var lista = [];
    D.indicadores.forEach(function (ind, i) {
      if (q && plano(ind[1]).indexOf(q) === -1 && plano(D.temas[ind[0]]).indexOf(q) === -1) return;
      lista.push([i, ind]);
    });
    $('#explorar-titulo').textContent = lista.length === D.indicadores.length
      ? 'Los ' + D.indicadores.length + ' indicadores'
      : lista.length + ' de ' + D.indicadores.length + ' indicadores';

    if (!lista.length) {
      caja.appendChild(crear('p', 'vacio', 'Ningún indicador coincide con esa búsqueda.'));
      return;
    }
    var t = crear('table', 'tabla');
    var tr = crear('tr');
    ['Indicador', 'Tema', 'Años', ''].forEach(function (h) { tr.appendChild(crear('th', null, h)); });
    var th = crear('thead'); th.appendChild(tr); t.appendChild(th);
    var tb = crear('tbody');
    lista.slice(0, 400).forEach(function (par) {
      var i = par[0], ind = par[1];
      var f = crear('tr');
      var td = crear('td', null, ind[1]);
      td.style.whiteSpace = 'normal';
      f.appendChild(td);
      f.appendChild(crear('td', null, D.temas[ind[0]]));
      f.appendChild(crear('td', null,
        ind[2] === 3 ? '2021 y 2023' : (ind[2] === 1 ? 'solo 2021' : 'solo 2023')));
      var b = crear('button', 'boton boton--claro', 'Ver en el mapa');
      b.type = 'button';
      b.addEventListener('click', function () {
        E.ind = i;
        $('#c-tema').value = '';
        pintarIndicadores(); pintarAnios();
        irA('mapa');
      });
      var tdb = crear('td'); tdb.appendChild(b); f.appendChild(tdb);
      tb.appendChild(f);
    });
    t.appendChild(tb);
    caja.appendChild(t);
    if (lista.length > 400) {
      caja.appendChild(crear('p', 'fuente',
        'Se muestran los primeros 400. Afiná la búsqueda para ver el resto.'));
    }
  }

  /* ═══ 11 · RESUMEN Y METODOLOGÍA ════════════════════════════════════════ */

  function dibujarResumen(idx) {
    var serie = serieMunicipal(idx);
    var prop = esProporcion(serie);
    var validos = serie.filter(function (d) { return d.v != null; })
                       .sort(function (a, b) { return b.v - a.v; });

    var totPob = 0, totVa = 0, nIcm = 0, sIcm = 0;
    var ultimo = CTX.anios[CTX.anios.length - 1];
    for (var t = 0; t < 125; t++) {
      if (E.sub && D.territorios[t][2] !== E.sub) continue;
      var s = CTX.series[t]; if (!s) continue;
      var a = s[ultimo] || s[CTX.anios.filter(function (x) { return s[x]; }).pop()];
      if (!a) continue;
      if (a.pob) totPob += a.pob;
      if (a.va) totVa += a.va;
      if (a.icm != null) { sIcm += a.icm; nIcm++; }
    }

    var k = $('#resumen-kpis'); k.innerHTML = '';
    [['Municipios', E.sub ? String(serie.length) : '125', E.sub || 'Antioquia'],
     ['Población', miles(totPob), 'proyección ' + ultimo],
     ['PIB per cápita', totPob ? pesos(Math.round(totVa * 1e9 / totPob)) : '—', 'COP corrientes'],
     ['ICM promedio', nIcm ? (sIcm / nIcm).toFixed(1).replace('.', ',') : '—', 'promedio simple · 0–100']
    ].forEach(function (x, i) {
      var c = crear('div', 'kpi' + (i === 3 ? ' kpi--acento' : ''));
      c.appendChild(crear('p', 'kpi__rotulo', x[0]));
      c.appendChild(crear('p', 'kpi__valor' + (i === 3 ? ' kpi__valor--acento' : ''), x[1]));
      c.appendChild(crear('p', 'kpi__nota', x[2]));
      k.appendChild(c);
    });

    $('#resumen-titulo').textContent = indicadorActivo()[1];
    $('#resumen-nota').textContent = D.temas[indicadorActivo()[0]] + ' · ' +
      D.anios[E.anio] + ' · zona ' + D.zonas[E.zona].toLowerCase() +
      (E.sub ? ' · ' + E.sub : ' · todo el departamento');

    var e = $('#resumen-extremos'); e.innerHTML = '';
    if (!validos.length) {
      e.appendChild(crear('p', 'vacio', 'Sin datos para esta combinación.'));
    } else {
      var vd = valor(idx, idDepartamento());
      [['Más alto', validos[0].nom, formato(validos[0].v, prop)],
       ['Más bajo', validos[validos.length - 1].nom, formato(validos[validos.length - 1].v, prop)],
       ['Antioquia', 'total departamental', vd ? formato(vd[0], prop) : '—'],
       ['Brecha', validos[0].nom + ' vs ' + validos[validos.length - 1].nom,
        formato(validos[0].v - validos[validos.length - 1].v, prop)]
      ].forEach(function (x) {
        var c = crear('div', 'kpi');
        c.appendChild(crear('p', 'kpi__rotulo', x[0]));
        c.appendChild(crear('p', 'kpi__valor', x[2]));
        c.appendChild(crear('p', 'kpi__nota', x[1]));
        e.appendChild(c);
      });
    }
    $('#resumen-fuente').textContent = pieFuente(serie);
  }

  function dibujarMetodo() {
    var c = $('#metodo-fuentes');
    c.innerHTML = '';
    var ul = crear('ul');
    [['Encuesta de Calidad de Vida', D.fuentes.ecv],
     ['Índice de Ciudades Modernas', D.fuentes.icm],
     ['Valor agregado municipal', D.fuentes.vam],
     ['Geometría del mapa', D.fuentes.geo],
     ['División por subregiones', D.fuentes.sub]
    ].forEach(function (f) {
      var li = crear('li');
      li.innerHTML = '<b>' + f[0] + ':</b> ' + f[1];
      ul.appendChild(li);
    });
    c.appendChild(ul);
    var n = D.indicadores.filter(function (i) { return i[2] === 3; }).length;
    $('#metodo-comunes').textContent = String(n);
  }

  /* ═══ 12 · ARRANQUE ═════════════════════════════════════════════════════ */

  /* El estado entero se serializa en el hash. Así un enlace copiado de la
     barra de direcciones reabre exactamente la misma vista: mismo indicador,
     mismo año, misma zona, misma subregión y los mismos territorios en la
     comparación. */
  function guardarEstado() {
    var p = ['tab=' + E.vista, 'ind=' + E.ind, 'anio=' + E.anio, 'zona=' + E.zona];
    if (E.sub) p.push('sub=' + encodeURIComponent(E.sub));
    if (E.comparar.length) p.push('cmp=' + E.comparar.join('.'));
    if (E.indY != null && E.indY !== E.ind) p.push('y=' + E.indY);
    if (E.ficha) p.push('mun=' + E.ficha);
    var nuevo = '#' + p.join('&');
    if (location.hash !== nuevo) history.replaceState(null, '', nuevo);
  }

  function leerEstado() {
    var h = location.hash.slice(1);
    if (!h) return null;
    // Compatibilidad con los enlaces viejos, que solo llevaban el nombre.
    if (h.indexOf('=') === -1) return VISTAS.some(function (x) { return x[0] === h; }) ? { tab: h } : null;
    var o = {};
    h.split('&').forEach(function (par) {
      var k = par.split('='); o[k[0]] = decodeURIComponent(k.slice(1).join('='));
    });
    return o;
  }

  function aplicarEstado(o) {
    if (!o) return;
    function num(k, max) {
      var v = parseInt(o[k], 10);
      return (!isNaN(v) && v >= 0 && v < max) ? v : null;
    }
    var i = num('ind', D.indicadores.length); if (i !== null) E.ind = i;
    var a = num('anio', D.anios.length); if (a !== null) E.anio = a;
    var z = num('zona', D.zonas.length); if (z !== null) E.zona = z;
    var m = num('mun', 125); if (m !== null) E.ficha = m;
    var y = num('y', D.indicadores.length); if (y !== null) E.indY = y;
    if (o.sub && D.subregiones.indexOf(o.sub) !== -1) E.sub = o.sub;
    if (o.cmp) {
      E.comparar = o.cmp.split('.').map(Number).filter(function (t) {
        return !isNaN(t) && t >= 0 && t < D.territorios.length;
      }).slice(0, 8);
    }
    if (o.tab && VISTAS.some(function (x) { return x[0] === o.tab; })) E.vista = o.tab;
  }

  function irA(v) {
    E.vista = v;
    $$('.pestana').forEach(function (b) {
      b.setAttribute('aria-selected', String(b.dataset.v === v));
      b.tabIndex = b.dataset.v === v ? 0 : -1;
    });
    VISTAS.forEach(function (x) { $('#p-' + x[0]).hidden = x[0] !== v; });
    guardarEstado();
    refrescar();
  }

  var refrescando = false;
  function refrescar() {
    if (refrescando) return;
    refrescando = true;
    var t = indicadorActivo()[0];
    tema(t).then(function (idx) {
      refrescando = false;
      guardarEstado();
      switch (E.vista) {
        case 'resumen': dibujarResumen(idx); break;
        case 'mapa': dibujarMapa(idx); break;
        case 'ranking':
          var s = serieMunicipal(idx), p = esProporcion(s);
          tablaRanking($('#tabla-ranking'), s, p, false);
          var pie = $('#ranking-fuente');
          pie.textContent = pieFuente(s);
          var previo = $('#ranking-csv');
          if (previo) previo.remove();
          var bt = botonCSV(s, p);
          bt.id = 'ranking-csv';
          pie.parentNode.insertBefore(bt, pie);
          break;
        case 'comparar': dibujarComparar(idx); break;
        case 'subregiones': dibujarSubregiones(idx); break;
        case 'dispersion': dibujarDispersion(idx); break;
        case 'contexto': dibujarContexto(); break;
        case 'ficha': dibujarFicha(idx); break;
        case 'explorar': dibujarExplorar(); break;
        case 'metodo': dibujarMetodo(); break;
      }
    }).catch(function (err) {
      refrescando = false;
      var p = $('#p-' + E.vista);
      p.innerHTML = '<div class="tarjeta"><p class="aviso aviso--riesgo">No se pudo cargar este tema: ' +
        err.message + '</p></div>';
    });
  }

  function conectar() {
    var lista = $('#pestanas');
    VISTAS.forEach(function (v) {
      var li = crear('li');
      var b = crear('button', 'pestana', v[1]);
      b.type = 'button'; b.id = 't-' + v[0]; b.dataset.v = v[0];
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', 'false');
      b.addEventListener('click', function () { irA(v[0]); });
      /* Un tablist se recorre con flechas, no con Tab: así lo espera quien
         navega por teclado y así lo exige el patrón ARIA. */
      b.addEventListener('keydown', function (e) {
        var i = VISTAS.findIndex(function (x) { return x[0] === E.vista; });
        var d = e.key === 'ArrowRight' ? 1 : (e.key === 'ArrowLeft' ? -1 : 0);
        if (e.key === 'Home') { e.preventDefault(); irA(VISTAS[0][0]); $('#t-' + VISTAS[0][0]).focus(); return; }
        if (e.key === 'End') { e.preventDefault(); irA(VISTAS[VISTAS.length-1][0]); $('#t-' + VISTAS[VISTAS.length-1][0]).focus(); return; }
        if (!d) return;
        e.preventDefault();
        var n = (i + d + VISTAS.length) % VISTAS.length;
        irA(VISTAS[n][0]); $('#t-' + VISTAS[n][0]).focus();
      });
      li.appendChild(b); lista.appendChild(li);
    });

    $('#c-tema').addEventListener('change', function () { pintarIndicadores(); pintarAnios(); refrescar(); });
    $('#c-indicador').addEventListener('change', function (e) {
      E.ind = parseInt(e.target.value, 10); pintarAnios(); refrescar();
    });
    $('#c-anio').addEventListener('change', function (e) { E.anio = parseInt(e.target.value, 10); refrescar(); });
    $('#c-zona').addEventListener('change', function (e) { E.zona = parseInt(e.target.value, 10); refrescar(); });
    $('#c-sub').addEventListener('change', function (e) { E.sub = e.target.value; refrescar(); });
    $('#c-eje-y').addEventListener('change', function (e) { E.indY = parseInt(e.target.value, 10); refrescar(); });
    $('#c-serie').addEventListener('change', refrescar);
    $('#c-ficha').addEventListener('change', function (e) { E.ficha = parseInt(e.target.value, 10); refrescar(); });
    $('#c-agregar').addEventListener('change', function (e) {
      if (e.target.value !== '') { alternarComparar(parseInt(e.target.value, 10)); e.target.value = ''; }
    });

    var reloj = null;
    $('#c-buscar').addEventListener('input', function () {
      clearTimeout(reloj); reloj = setTimeout(dibujarExplorar, 120);
    });

    /* El filtro reordena hasta 1.252 opciones: se espera a que deje de
       escribir en vez de rehacer la lista en cada tecla. */
    var relojFiltro = null;
    $('#c-filtro').addEventListener('input', function () {
      clearTimeout(relojFiltro);
      relojFiltro = setTimeout(function () { pintarIndicadores(); pintarAnios(); }, 140);
    });
    $('#c-filtro').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        var si = $('#c-indicador');
        if (si.options.length) { E.ind = parseInt(si.options[0].value, 10); si.value = E.ind; pintarAnios(); refrescar(); }
      }
      if (e.key === 'Escape' && e.target.value) {
        e.target.value = ''; pintarIndicadores(); pintarAnios();
      }
    });

    $('#c-limpiar').addEventListener('click', function () {
      E.sub = ''; E.zona = 0; E.comparar = []; E.indY = null;
      $('#c-filtro').value = ''; $('#c-tema').value = '';
      $('#c-sub').value = ''; $('#c-zona').value = '0';
      pintarIndicadores(); pintarAnios(); refrescar();
      $('#c-filtro').focus();
    });

    /* En táctil no hay «mouseleave»: el globo se quedaría pegado. Se cierra
       al tocar cualquier otro punto y al hacer scroll. */
    document.addEventListener('touchstart', function (e) {
      if (!e.target.closest || !e.target.closest('.mapa__mun')) ocultarGlobo();
    }, { passive: true });
    window.addEventListener('scroll', ocultarGlobo, { passive: true });

    /* Botón atrás del navegador: se relee el estado entero, no solo la
       pestaña. */
    window.addEventListener('hashchange', function () {
      var o = leerEstado();
      if (!o) return;
      aplicarEstado(o);
      pintarIndicadores(); pintarAnios();
      $('#c-zona').value = E.zona; $('#c-sub').value = E.sub;
      irA(E.vista);
    });
  }

  Promise.all([
    traer('datos/indice.json'),
    traer('geo/antioquia.json'),
    traer('datos/contexto.json')
  ]).then(function (r) {
    D = r[0]; GEO = r[1]; CTX = r[2];
    $('#corte').textContent = D.corte;

    // Arranca en un indicador que exista en las dos ondas: es el que mejor
    // muestra de qué es capaz el tablero.
    var i0 = D.indicadores.findIndex(function (i) { return i[2] === 3; });
    E.ind = i0 >= 0 ? i0 : 0;

    aplicarEstado(leerEstado());

    pintarSelectores();
    $('#c-zona').value = E.zona;
    $('#c-sub').value = E.sub;
    conectar();
    irA(E.vista);
  }).catch(function (err) {
    document.querySelector('main').innerHTML =
      '<div class="tarjeta"><p class="aviso aviso--riesgo">No se pudieron cargar los datos: ' +
      err.message + '. El tablero necesita abrirse desde un servidor, no con doble clic sobre el archivo.</p></div>';
  });

}());
