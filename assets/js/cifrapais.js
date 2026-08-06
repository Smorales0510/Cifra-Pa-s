/* ===========================================================================
   CIFRA PAÍS · Interactividad del sitio
   Sin dependencias. Se ejecuta con `defer`, así que el DOM ya existe.

   Contenido:
     0. Tipografía — activa la hoja de Courier Prime, que se descarga sin
        bloquear el render.
     1. TABLEROS — catálogo del Monitor. Es el único bloque que hay que editar
        para agregar, quitar o reapuntar un tablero.
     2. Monitor  — rail de categorías, pestañas de vista, carga diferida.
     3. Barra    — menú en móvil y sección activa.
     4. Cifras   — conteo de los KPI al entrar en pantalla.
     5. Territorios — buscador, orden y barras de la radiografía regional.
     6. Formulario — validación, estado de envío y trampa antispam.

   La CSP del sitio no admite 'unsafe-inline' ni en script-src ni en
   style-src. En la práctica eso significa dos cosas para este archivo:
     · lo que antes era un onload= en el HTML vive ahora en el bloque 0;
     · los anchos de barra se aplican por CSSOM (el.style.width), que la CSP
       sí permite, en vez de por atributo style= en el marcado.
   =========================================================================== */
(function () {
  'use strict';

  /* ═════════════════════════════════════════════════════════════════════════
     0 · TIPOGRAFÍA
     La hoja llega con media="print" para que el navegador la descargue sin
     bloquear el primer pintado. Acá se le devuelve el media real.
     ═════════════════════════════════════════════════════════════════════ */
  (function () {
    var hoja = document.getElementById('fuente-mono');
    if (hoja && hoja.media === 'print') hoja.media = 'all';
  }());

  /* ═════════════════════════════════════════════════════════════════════════
     1 · CATÁLOGO DE TABLEROS
     Para publicar un tablero nuevo, agregá un objeto a este arreglo.

       id      identificador estable, se usa en el hash de la URL
       nombre  etiqueta del rail de categorías
       nota    segunda línea del rail, en Courier Prime
       titulo  encabezado del panel
       corte   fecha de corte, obligatoria (manual §09)
       fuente  pie de fuente, obligatorio en cada página del tablero
       kpis    máximo cuatro; el quinto ya no se lee (manual §09).
               `destacado:true` pinta el valor en Amarillo Cifra: se usa
               en uno solo, y solo si es el valor que hay que mirar.
       vistas  pestañas internas. `url` de cada vista; si el tablero no
               distingue vistas, dejá una sola con la URL base.

     Sirve igual para Power BI («Publicar en web» o «Insertar informe»),
     Looker Studio, Tableau Public o un tablero HTML propio: lo único que
     necesita es una URL que se pueda incrustar en un iframe.
     ═════════════════════════════════════════════════════════════════════ */
  var TABLEROS = [
    {
      id: 'laboral',
      nombre: 'Mercado laboral',
      nota: 'GEIH · 2008–2026',
      titulo: 'Mercado laboral territorial',
      corte: 'Corte 30-jun-2026 · actualización trimestral',
      fuente: 'Fuente: DANE · GEIH · elaboración Cifra País · corte 30-jun-2026',
      kpis: [
        { etiqueta: 'Desempleo', valor: '9,8', sufijo: '%', nota: 'meta 9,0' },
        { etiqueta: 'Ocupación', valor: '58,4', sufijo: '%', nota: '± 0,31' },
        { etiqueta: 'Informalidad', valor: '61,2', sufijo: '%', nota: '± 0,55' },
        { etiqueta: 'Empleo formal', valor: '2,8', sufijo: '%', nota: '± 0,3 · var. anual', destacado: true }
      ],
      vistas: [
        { id: 'general', nombre: 'Panorama', url: 'https://cifrapais.com/monitor/laboral/' },
        { id: 'informalidad', nombre: 'Informalidad', url: 'https://cifrapais.com/monitor/laboral/#informalidad' },
        { id: 'cuidado', nombre: 'Economía del cuidado', url: 'https://cifrapais.com/monitor/laboral/#cuidado' },
        { id: 'poblaciones', nombre: 'Grupos poblacionales', url: 'https://cifrapais.com/monitor/laboral/#poblaciones' }
      ]
    },
    {
      id: 'tiempo',
      nombre: 'Uso del tiempo',
      nota: 'ENUT · 2012–2025',
      titulo: 'Uso del tiempo y trabajo no remunerado',
      corte: 'Corte 2025 · serie armonizada 2012–2025',
      fuente: 'Fuente: DANE · ENUT · elaboración Cifra País · corte 2025',
      kpis: [
        { etiqueta: 'Trabajo no remunerado', valor: '7,3', sufijo: ' h', nota: 'mujeres · día promedio', destacado: true },
        { etiqueta: 'Trabajo no remunerado', valor: '3,1', sufijo: ' h', nota: 'hombres · día promedio' },
        { etiqueta: 'Brecha de cuidado', valor: '4,2', sufijo: ' h', nota: '± 0,18' },
        { etiqueta: 'Participación', valor: '89,4', sufijo: '%', nota: 'mujeres · ± 0,42' }
      ],
      vistas: [
        { id: 'general', nombre: 'Panorama', url: 'https://cifrapais.com/monitor/ENUT/' }
      ]
    },
    {
      id: 'productividad',
      nombre: 'Productividad',
      nota: 'Panel departamental',
      titulo: 'Productividad laboral por departamento',
      corte: 'Corte 2025 · serie anual 2015–2025',
      fuente: 'Fuente: DANE · cuentas departamentales y GEIH · elaboración Cifra País · corte 2025',
      kpis: [
        { etiqueta: 'Productividad', valor: '0,847', nota: '± 0,02 · índice' },
        { etiqueta: 'Crecimiento PIB', valor: '3,41', sufijo: '%', nota: '± 0,28' },
        { etiqueta: 'Capital humano', valor: '0,412', nota: 'coef. · e.e. 0,032', destacado: true },
        { etiqueta: 'Formalización', valor: '0,287', nota: 'coef. · e.e. 0,041' }
      ],
      vistas: [
        { id: 'general', nombre: 'Panorama', url: '' }
      ]
    },
    {
      id: 'finanzas',
      nombre: 'Finanzas territoriales',
      nota: 'FUT · 2012–2025',
      titulo: 'Ingresos, gasto e inversión territorial',
      corte: 'Corte dic-2025 · vigencia cerrada',
      fuente: 'Fuente: DNP · FUT · elaboración Cifra País · corte dic-2025',
      kpis: [
        { etiqueta: 'Inversión per cápita', valor: '1,24', sufijo: ' M', nota: 'COP · ± 0,06' },
        { etiqueta: 'Ejecución', valor: '78,6', sufijo: '%', nota: 'meta 85,0' },
        { etiqueta: 'Dependencia SGP', valor: '54,3', sufijo: '%', nota: '± 0,71', destacado: true },
        { etiqueta: 'Efecto en empleo', valor: '0,094', nota: 'coef. · e.e. 0,028' }
      ],
      vistas: [
        { id: 'general', nombre: 'Panorama', url: '' }
      ]
    },
    {
      /* Los cuatro KPI son cifras departamentales de la ECV 2023 y del cruce
         valor agregado DANE / población, verificadas contra la fuente cruda.
         Ninguna se escribe de memoria: salen del mismo archivo que alimenta
         el tablero. */
      id: 'territorial',
      nombre: 'Territorial',
      nota: 'ECV Antioquia · 125 municipios',
      titulo: 'Calidad de vida en Antioquia',
      corte: 'ECV 2021 y 2023 · ICM 2010–2024 · valor agregado DANE 2011–2024p',
      fuente: 'Fuente: Gobernación de Antioquia · ECV 2021 y 2023 · DANE · DNP · elaboración Cifra País',
      kpis: [
        { etiqueta: 'Pobreza IPM', valor: '10,1', sufijo: '%', nota: 'personas · 2023', destacado: true },
        { etiqueta: 'Pobreza NBI', valor: '11,4', sufijo: '%', nota: 'personas · 2023' },
        { etiqueta: 'Población', valor: '6,88', sufijo: ' M', nota: 'proyección 2024' },
        { etiqueta: 'PIB per cápita', valor: '33,4', sufijo: ' M', nota: 'COP corrientes · 2024' }
      ],
      vistas: [
        { id: 'general', nombre: 'Panorama', url: 'https://cifrapais.com/monitor/Territorio/' },
        { id: 'mapa', nombre: 'Mapa', url: 'https://cifrapais.com/monitor/Territorio/#mapa' },
        { id: 'comparar', nombre: 'Comparar', url: 'https://cifrapais.com/monitor/Territorio/#comparar' },
        { id: 'explorar', nombre: 'Explorar', url: 'https://cifrapais.com/monitor/Territorio/#explorar' }
      ]
    }
  ];

  /* Utilidades ------------------------------------------------------------ */
  var $ = function (sel, raiz) { return (raiz || document).querySelector(sel); };
  var sinMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ═════════════════════════════════════════════════════════════════════════
     2 · MONITOR DE DATOS
     ═════════════════════════════════════════════════════════════════════ */
  var monitor = (function () {
    var rail       = $('#rail-tableros');
    if (!rail) return null;

    var elTitulo   = $('#tablero-titulo');
    var elCorte    = $('#tablero-corte');
    var elKpis     = $('#tablero-kpis');
    var elVistas   = $('#tablero-vistas');
    var elFuente   = $('#tablero-fuente');
    var elLienzo   = $('#tablero-lienzo');
    var elMarco    = $('#tablero-marco');
    var elEspera   = $('#tablero-espera');
    var btnPantalla = $('#btn-pantalla-completa');
    var btnPestana  = $('#btn-nueva-pestana');
    var btnCargar   = $('#btn-cargar-tablero');
    var elMensaje   = $('.lienzo__mensaje .antetitulo', elLienzo);
    var elNota      = $('.lienzo__nota', elLienzo);

    var activo = null;   // tablero
    var vista  = null;   // vista dentro del tablero

    /* El tablero NO se descarga solo, en ningún tamaño de pantalla.
       Cada tablero pesa entre 700 KB y 1,4 MB de HTML con los datos adentro, y
       al incrustarlo la pestaña se queda sin responder varios segundos: medido
       en cifrapais.com, la página quedaba congelada mientras el iframe parseaba.
       Quien entra al Monitor primero lee la fila de KPI, que es la respuesta
       rápida; el tablero completo se abre cuando lo pide.
       De paso, quien nunca baja hasta acá no descarga un mega y medio. */
    var esPantallaChica = window.matchMedia('(max-width: 760px) and (orientation: portrait)');

    function mostrarEspera(rotulo, nota, conBoton) {
      elEspera.hidden = false;
      elMensaje.textContent = rotulo;
      elNota.textContent = nota;
      btnCargar.hidden = !conBoton;
      elMarco.style.visibility = 'hidden';
    }

    /* Rail de categorías ------------------------------------------------- */
    TABLEROS.forEach(function (tab, i) {
      var li = document.createElement('li');
      var boton = document.createElement('button');
      boton.type = 'button';
      boton.className = 'rail__boton';
      boton.id = 'rail-' + tab.id;
      // El rail filtra la categoría; no son pestañas sobre un mismo panel.
      // `aria-current` dice exactamente eso: cuál se está viendo.
      if (i === 0) boton.setAttribute('aria-current', 'true');
      boton.innerHTML = tab.nombre + '<span class="rail__nota">' + tab.nota + '</span>';
      boton.addEventListener('click', function () { abrir(tab.id); });
      li.appendChild(boton);
      rail.appendChild(li);
    });

    /* Fila de KPI --------------------------------------------------------- */
    function pintarKpis(tab) {
      elKpis.textContent = '';
      tab.kpis.slice(0, 4).forEach(function (k) {
        var caja = document.createElement('div');
        caja.className = 'kpi' + (k.destacado ? ' kpi--destacado' : '');

        var dt = document.createElement('dt');
        dt.className = 'kpi__etiqueta';
        dt.textContent = k.etiqueta;

        var dd = document.createElement('dd');
        dd.className = 'kpi__valor';
        dd.textContent = k.valor + (k.sufijo || '');

        var nota = document.createElement('dd');
        nota.className = 'kpi__nota';
        nota.textContent = k.nota || '';

        caja.appendChild(dt);
        caja.appendChild(dd);
        caja.appendChild(nota);
        elKpis.appendChild(caja);
      });
    }

    /* Pestañas de vista --------------------------------------------------- */
    function pintarVistas(tab) {
      elVistas.textContent = '';
      // Con una sola vista la pestaña no informa nada: se oculta.
      elVistas.hidden = tab.vistas.length < 2;

      // El lienzo solo es un tabpanel si hay pestañas que lo controlen.
      if (elVistas.hidden) {
        elLienzo.removeAttribute('role');
        elLienzo.removeAttribute('aria-labelledby');
        return;
      }
      elLienzo.setAttribute('role', 'tabpanel');

      tab.vistas.forEach(function (v, i) {
        var boton = document.createElement('button');
        boton.type = 'button';
        boton.className = 'vista__boton';
        boton.id = 'vista-' + tab.id + '-' + v.id;
        boton.setAttribute('role', 'tab');
        boton.setAttribute('aria-controls', 'tablero-lienzo');
        boton.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
        boton.textContent = v.nombre;
        boton.addEventListener('click', function () { verVista(v.id); });
        elVistas.appendChild(boton);
      });
    }

    /* Carga del iframe ---------------------------------------------------- */
    function incrustar(url) {
      mostrarEspera('Cargando tablero…',
        'Si no aparece en unos segundos, abrilo en pestaña nueva.', false);

      elMarco.onload = function () {
        elEspera.hidden = true;
        elMarco.style.visibility = 'visible';
      };
      elMarco.src = url;
    }

    function cargar(url) {
      elMarco.onload = null;

      if (!url) {
        // Tablero declarado pero todavía sin URL publicada: se dice, no se
        // disimula con una imagen de relleno.
        elMarco.removeAttribute('src');
        mostrarEspera('Tablero en preparación',
          'Esta vista se publica con el próximo corte. Escribinos si la necesitás antes.',
          false);
        btnPestana.setAttribute('aria-disabled', 'true');
        btnPestana.removeAttribute('href');
        return;
      }

      btnPestana.removeAttribute('aria-disabled');
      btnPestana.href = url;

      elMarco.removeAttribute('src');
      mostrarEspera('Tablero listo para abrir',
        esPantallaChica.matches
          ? 'Pesa varios megas y se lee mejor en horizontal. Los indicadores de arriba ya están al día.'
          : 'Pesa varios megas: se abre cuando lo pidas, para no trabar la página. Los indicadores de arriba ya están al día.',
        true);
    }

    if (btnCargar) {
      btnCargar.addEventListener('click', function () {
        if (vista && vista.url) incrustar(vista.url);
      });
    }

    function verVista(idVista, sinHistorial) {
      if (!activo) return;
      vista = activo.vistas.filter(function (v) { return v.id === idVista; })[0] || activo.vistas[0];

      var idBoton = 'vista-' + activo.id + '-' + vista.id;
      Array.prototype.forEach.call(elVistas.children, function (b) {
        b.setAttribute('aria-selected', b.id === idBoton ? 'true' : 'false');
      });
      if (!elVistas.hidden) elLienzo.setAttribute('aria-labelledby', idBoton);

      elMarco.title = activo.titulo + ' · ' + vista.nombre;
      cargar(vista.url);
      if (!sinHistorial) escribirHash();
    }

    /* El hash guarda tablero y vista: #monitor/laboral/informalidad. Así el
       enlace que alguien pega en un correo abre exactamente lo que estaba
       viendo, que es lo que hace citable un tablero. */
    function escribirHash() {
      if (!history.replaceState || !activo || !vista) return;
      var ruta = '#monitor/' + activo.id;
      if (activo.vistas.length > 1) ruta += '/' + vista.id;
      history.replaceState(null, '', ruta);
    }

    function abrir(idTablero, idVista, sinHistorial) {
      var tab = TABLEROS.filter(function (t) { return t.id === idTablero; })[0];
      if (!tab || (activo && activo.id === tab.id)) return;
      activo = tab;

      Array.prototype.forEach.call(rail.querySelectorAll('.rail__boton'), function (b) {
        if (b.id === 'rail-' + tab.id) { b.setAttribute('aria-current', 'true'); }
        else { b.removeAttribute('aria-current'); }
      });

      elTitulo.textContent = tab.titulo;
      elCorte.textContent  = tab.corte;
      elFuente.textContent = tab.fuente;
      pintarKpis(tab);
      pintarVistas(tab);
      verVista(idVista || tab.vistas[0].id, true);
      if (!sinHistorial) escribirHash();

      // Los KPI viven en una región aria-live, pero el cambio de tablero
      // completo hay que decirlo: sin esto, quien navega con lector de
      // pantalla oye cuatro cifras nuevas sin saber de qué son.
      anunciar('Tablero: ' + tab.titulo + '. ' + tab.corte + '.');
    }

    /* Región de anuncio para el lector de pantalla. Va aparte de los KPI para
       no interrumpir su lectura a mitad de camino. */
    var elAnuncio = document.createElement('p');
    elAnuncio.className = 'visualmente-oculto';
    elAnuncio.setAttribute('role', 'status');
    elLienzo.parentNode.insertBefore(elAnuncio, elLienzo);

    function anunciar(texto) { elAnuncio.textContent = texto; }

    /* Pantalla completa --------------------------------------------------- */
    if (btnPantalla) {
      btnPantalla.addEventListener('click', function () {
        if (document.fullscreenElement) {
          document.exitFullscreen();
        } else if (elLienzo.requestFullscreen) {
          elLienzo.requestFullscreen().catch(function () {
            // Si el navegador la bloquea, la pestaña nueva cumple lo mismo.
            if (btnPestana.href) window.open(btnPestana.href, '_blank', 'noopener');
          });
        }
      });
      document.addEventListener('fullscreenchange', function () {
        btnPantalla.textContent = document.fullscreenElement ? 'Salir' : 'Pantalla completa';
      });
    }

    /* Apertura inicial: respeta #monitor/<tablero>[/<vista>] si viene en la
       URL, sin reescribir el historial. */
    var ruta = location.hash.match(/^#monitor\/([^/]+)(?:\/([^/]+))?$/) || [];
    abrir(ruta[1] || TABLEROS[0].id, ruta[2], true);

    return { abrir: abrir };
  }());

  /* ═════════════════════════════════════════════════════════════════════════
     3 · BARRA SUPERIOR
     ═════════════════════════════════════════════════════════════════════ */
  (function () {
    var btn = $('#btn-menu');
    var nav = $('#nav-principal');
    if (!btn || !nav) return;

    function cerrar() {
      nav.removeAttribute('data-abierto');
      btn.setAttribute('aria-expanded', 'false');
      $('.visualmente-oculto', btn).textContent = 'Abrir el menú';
    }

    btn.addEventListener('click', function () {
      var abierto = nav.getAttribute('data-abierto') === 'true';
      if (abierto) { cerrar(); return; }
      nav.setAttribute('data-abierto', 'true');
      btn.setAttribute('aria-expanded', 'true');
      $('.visualmente-oculto', btn).textContent = 'Cerrar el menú';
    });

    nav.addEventListener('click', function (e) {
      if (e.target.closest('a')) cerrar();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') cerrar();
    });

    /* Sección activa en la navegación ------------------------------------ */
    var enlaces = Array.prototype.slice.call(nav.querySelectorAll('.nav__enlace'));
    var secciones = enlaces
      .map(function (a) { return document.querySelector(a.getAttribute('href')); })
      .filter(Boolean);

    if (!('IntersectionObserver' in window) || !secciones.length) return;

    var vigia = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (entrada) {
        if (!entrada.isIntersecting) return;
        enlaces.forEach(function (a) {
          var esta = a.getAttribute('href') === '#' + entrada.target.id;
          if (esta) { a.setAttribute('aria-current', 'true'); }
          else { a.removeAttribute('aria-current'); }
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });

    secciones.forEach(function (s) { vigia.observe(s); });
  }());

  /* ═════════════════════════════════════════════════════════════════════════
     4 · CIFRAS Y APARICIONES
     El KPI cuenta una sola vez, al entrar en pantalla. Se conserva el formato
     colombiano: coma decimal y la misma cantidad de decimales del original.
     ═════════════════════════════════════════════════════════════════════ */
  (function () {
    if (!('IntersectionObserver' in window)) return;

    function contar(el) {
      var crudo = el.getAttribute('data-contar');
      var sufijo = el.getAttribute('data-sufijo') || '';
      var destino = parseFloat(crudo.replace(',', '.'));
      if (isNaN(destino)) return;

      var decimales = (crudo.split(',')[1] || '').length;
      var inicio = performance.now();
      var duracion = 900;

      function paso(ahora) {
        var t = Math.min((ahora - inicio) / duracion, 1);
        var suave = 1 - Math.pow(1 - t, 3);
        var valor = (destino * suave).toFixed(decimales).replace('.', ',');
        el.textContent = valor + sufijo;
        if (t < 1) requestAnimationFrame(paso);
      }
      requestAnimationFrame(paso);
    }

    var vigia = new IntersectionObserver(function (entradas, obs) {
      entradas.forEach(function (entrada) {
        if (!entrada.isIntersecting) return;
        obs.unobserve(entrada.target);
        entrada.target.setAttribute('data-visible', 'true');
        if (!sinMovimiento && entrada.target.hasAttribute('data-contar')) {
          contar(entrada.target);
        }
      });
    }, { threshold: 0.35 });

    document.querySelectorAll('[data-contar]').forEach(function (el) { vigia.observe(el); });

    if (!sinMovimiento) {
      document.querySelectorAll('.tarjeta, .paper, .metodo__columna').forEach(function (el) {
        el.classList.add('aparece');
        vigia.observe(el);
      });
    }
  }());

  /* ═════════════════════════════════════════════════════════════════════════
     5 · INSIGHTS TERRITORIALES
     Las cifras están escritas en el HTML; acá se agrega lo que no puede estar
     escrito: el ancho de las barras, el buscador y el orden de la rejilla.

     Antes esto era un carrusel con un índice de 33 chips. Se cambió porque
     comparar dos departamentos obligaba a recordar el que ya había pasado, y
     porque encontrar uno exigía recorrer una lista alfabética entera. La
     rejilla los muestra a todos; el buscador y el orden la vuelven consultable.

     Todo es progresivo: la barra de control nace oculta en el HTML y solo se
     enciende acá. Sin JavaScript quedan las 33 fichas en orden alfabético, con
     sus cifras escritas, que es exactamente lo que ve un buscador.
     ═════════════════════════════════════════════════════════════════════ */
  (function () {
    var rejilla = $('#territorios-pista');
    if (!rejilla) return;

    var fichas  = Array.prototype.slice.call(rejilla.querySelectorAll('.territorio'));
    var control = $('#terr-control');
    var campo   = $('#terr-busca');
    var orden   = $('#terr-orden');
    var cuenta  = $('#terr-cuenta');
    var vacio   = $('#terr-vacio');

    /* Barras -------------------------------------------------------------- */
    /* El ancho se aplica por CSSOM y no por atributo style= en el marcado:
       la CSP prohíbe los estilos en línea del HTML, pero no la manipulación
       del objeto style desde el script. El dato en sí ya está escrito al lado
       de cada barra, así que sin JavaScript no se pierde información: se
       pierde el gráfico. */
    function dibujar(raiz) {
      Array.prototype.forEach.call(raiz.querySelectorAll('[data-ancho]'), function (barra) {
        var v = parseFloat(barra.getAttribute('data-ancho'));
        if (isNaN(v)) return;
        barra.style.width = Math.max(0, Math.min(100, v)) + '%';
      });
    }

    if ('IntersectionObserver' in window && !sinMovimiento) {
      /* Se dibujan al entrar en pantalla: el crecimiento es lo que hace
         comparables dos barras que están una debajo de la otra.
         Se observa la ficha y no cada barra: la barra arranca con ancho 0 y
         un elemento sin área nunca alcanza un umbral mayor que cero, así que
         el observador no dispararía jamás. */
      var vigiaBarras = new IntersectionObserver(function (entradas, obs) {
        entradas.forEach(function (e) {
          if (!e.isIntersecting) return;
          obs.unobserve(e.target);
          dibujar(e.target);
        });
      }, { threshold: 0 });
      fichas.forEach(function (t) { vigiaBarras.observe(t); });
    } else {
      dibujar(rejilla);
    }

    /* Sin los controles no hay nada más que hacer: las fichas ya están. */
    if (!control || !campo || !orden) return;
    control.hidden = false;

    /* Búsqueda ------------------------------------------------------------ */
    /* Se compara sin tildes: quien escribe «choco» espera encontrar Chocó, y
       quien escribe «Nariño» también. normalize('NFD') separa la letra de su
       acento y el rango \u0300-\u036f borra el acento suelto. */
    function plano(t) {
      return (t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    }

    fichas.forEach(function (f) {
      var nombre = f.querySelector('.territorio__nombre');
      f._busca = plano((nombre ? nombre.textContent : '') + ' ' + (f.getAttribute('data-busca') || ''));
    });

    /* Orden --------------------------------------------------------------- */
    /* Alfabético con localeCompare para que Á vaya con A y Ñ después de N.
       El resto son indicadores: de mayor a menor, porque quien ordena por
       desempleo quiere ver primero dónde está el problema. */
    var CRITERIOS = {
      nombre: function (a, b) {
        return a.querySelector('.territorio__nombre').textContent
          .localeCompare(b.querySelector('.territorio__nombre').textContent, 'es');
      }
    };
    ['desempleo', 'informalidad', 'ocupacion', 'brecha', 'ingreso'].forEach(function (clave) {
      CRITERIOS[clave] = function (a, b) {
        return parseFloat(b.getAttribute('data-' + clave)) - parseFloat(a.getAttribute('data-' + clave));
      };
    });

    function aplicar() {
      var q = plano(campo.value);
      var visibles = 0;

      fichas.forEach(function (f) {
        var pasa = !q || f._busca.indexOf(q) !== -1;
        if (pasa) { f.removeAttribute('data-oculta'); visibles++; }
        else { f.setAttribute('data-oculta', ''); }
      });

      var criterio = CRITERIOS[orden.value] || CRITERIOS.nombre;
      /* Reordenar el DOM con appendChild sobre una copia ordenada: el
         navegador mueve los nodos existentes, no los vuelve a crear, así que
         no se pierde el estado de las barras ya dibujadas. */
      fichas.slice().sort(criterio).forEach(function (f) { rejilla.appendChild(f); });

      if (vacio) vacio.hidden = visibles > 0;
      if (cuenta) {
        cuenta.textContent = visibles === fichas.length
          ? fichas.length + ' departamentos'
          : visibles + ' de ' + fichas.length + (visibles === 1 ? ' departamento' : ' departamentos');
      }
    }

    /* Se espera a que deje de escribir: filtrar en cada tecla reordena el DOM
       33 veces mientras alguien teclea «Cundinamarca». */
    var reloj = null;
    campo.addEventListener('input', function () {
      window.clearTimeout(reloj);
      reloj = window.setTimeout(aplicar, 120);
    });
    /* Escape limpia la búsqueda: es lo que hace todo campo de tipo search. */
    campo.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && campo.value) { campo.value = ''; aplicar(); }
    });
    orden.addEventListener('change', aplicar);

    aplicar();
  }());

  /* ═════════════════════════════════════════════════════════════════════════
     6 · FORMULARIO
     Validación en el cliente. No sustituye la del servidor: solo evita que
     alguien pierda un viaje de ida y vuelta por un campo en blanco.
     ═════════════════════════════════════════════════════════════════════ */
  (function () {
    var form = $('#formulario-contacto');
    if (!form) return;

    var aviso = $('#formulario-aviso');

    var REGLAS = {
      nombre:  { min: 3,  falta: 'Escribí tu nombre y apellido.' },
      entidad: { min: 2,  falta: 'Indicá la entidad u organización.' },
      correo:  { patron: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, falta: 'Escribí un correo válido, por ejemplo nombre@entidad.gov.co.' },
      asunto:  { falta: 'Elegí qué necesitás.' },
      mensaje: { min: 20, falta: 'Contanos el territorio, el indicador y la fecha de corte que necesitás (mínimo 20 caracteres).' },
      datos:   { falta: 'Necesitamos la autorización para responderte.' }
    };

    function marcar(campo, mensaje) {
      var error = document.getElementById('e-' + campo.name);
      if (mensaje) {
        campo.setAttribute('aria-invalid', 'true');
        campo.setAttribute('aria-describedby', 'e-' + campo.name);
        if (error) { error.textContent = mensaje; error.hidden = false; }
      } else {
        campo.removeAttribute('aria-invalid');
        campo.removeAttribute('aria-describedby');
        if (error) { error.textContent = ''; error.hidden = true; }
      }
      return !mensaje;
    }

    function validar(campo) {
      var regla = REGLAS[campo.name];
      if (!regla) return true;

      if (campo.type === 'checkbox') {
        return marcar(campo, campo.checked ? '' : regla.falta);
      }
      var valor = campo.value.trim();
      if (!valor) return marcar(campo, regla.falta);
      if (regla.min && valor.length < regla.min) return marcar(campo, regla.falta);
      if (regla.patron && !regla.patron.test(valor)) return marcar(campo, regla.falta);
      return marcar(campo, '');
    }

    // Se valida al salir del campo, no mientras se escribe: corregir a alguien
    // en la tercera letra de su nombre es hostil.
    Object.keys(REGLAS).forEach(function (nombre) {
      var campo = form.elements[nombre];
      if (!campo) return;
      campo.addEventListener('blur', function () { validar(campo); });
      campo.addEventListener('change', function () {
        if (campo.hasAttribute('aria-invalid') || campo.type === 'checkbox') validar(campo);
      });
    });

    /* Aviso de cambios sin guardar. El navegador muestra su propio diálogo;
       el texto no se puede personalizar desde 2016. Se desarma en cuanto el
       envío sale, para no interrumpir la salida hacia el cliente de correo. */
    var hayBorrador = false;
    var enviando = false;

    form.addEventListener('input', function () { hayBorrador = true; });

    window.addEventListener('beforeunload', function (e) {
      if (!hayBorrador || enviando) return;
      e.preventDefault();
      e.returnValue = '';        // exigido por Chrome y Safari
    });

    /* Estado del botón de envío. El texto se guarda al arrancar para poder
       devolverlo tal cual: escribirlo dos veces en el código es la forma más
       fácil de que un día digan cosas distintas. */
    var btnEnviar = form.querySelector('button[type="submit"]');
    var textoBoton = btnEnviar ? btnEnviar.textContent : '';

    function ocupado(si) {
      if (!btnEnviar) return;
      btnEnviar.disabled = si;
      btnEnviar.setAttribute('aria-busy', si ? 'true' : 'false');
      btnEnviar.textContent = si ? 'Procesando solicitud…' : textoBoton;
    }

    function acusarRecibo() {
      aviso.hidden = false;
      aviso.removeAttribute('data-estado');
      aviso.textContent = 'Solicitud recibida. Te respondemos en un día hábil.';
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      /* Trampa antispam. El campo está fuera de pantalla y con tabindex="-1":
         una persona no puede llenarlo, un bot que rellena todo lo que
         encuentra, sí. Cuando viene con algo, el envío se corta acá y se
         responde con el mismo acuse que vería alguien real: si el bot leyera
         un error, su autor corregiría el guion y volvería mañana. No se
         valida, no se envía nada y no se registra. */
      if (form.elements.sitio && form.elements.sitio.value) {
        ocupado(true);
        window.setTimeout(function () {
          ocupado(false);
          acusarRecibo();
          form.reset();
        }, 600);
        return;
      }

      var primerError = null;
      Object.keys(REGLAS).forEach(function (nombre) {
        var campo = form.elements[nombre];
        if (campo && !validar(campo) && !primerError) primerError = campo;
      });

      if (primerError) {
        aviso.hidden = false;
        aviso.setAttribute('data-estado', 'error');
        aviso.textContent = 'Revisá los campos marcados y volvé a enviar.';
        primerError.focus();
        return;
      }

      /* Conectá aquí tu endpoint. Con `action` y `method` ya puestos en el
         HTML, basta con `form.submit()`; con una API, usá fetch:

           fetch(form.action, { method:'POST', body:new FormData(form) })
             .then(...)

         Mientras no haya endpoint, se abre el correo, que es la vía que el
         manual pone primero. */
      var cuerpo = [
        'Nombre: '  + form.elements.nombre.value,
        'Entidad: ' + form.elements.entidad.value,
        'Correo: '  + form.elements.correo.value,
        'Asunto: '  + form.elements.asunto.options[form.elements.asunto.selectedIndex].text,
        '',
        form.elements.mensaje.value
      ].join('\n');

      enviando = true;
      ocupado(true);

      window.location.href = 'mailto:cifrapais@gmail.com'
        + '?subject=' + encodeURIComponent('Solicitud desde cifrapais.com · ' + form.elements.entidad.value)
        + '&body=' + encodeURIComponent(cuerpo);

      aviso.hidden = false;
      aviso.removeAttribute('data-estado');
      aviso.textContent = 'Se abrió tu cliente de correo con la solicitud lista. '
        + 'Si no se abrió, escribinos a cifrapais@gmail.com.';

      // El botón vuelve a la vida: abrir el cliente de correo no navega fuera
      // de la página, así que dejarlo bloqueado impediría un segundo intento.
      // Con un endpoint real, esto va en el .then() y en el .catch() del fetch.
      window.setTimeout(function () { ocupado(false); }, 1200);
    });
  }());

}());
