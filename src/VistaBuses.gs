/**
 * VistaBuses.gs
 * Panel de buses y buffers tri-estado (tarea 1-7), en la hoja "Buses".
 *
 * En cada micro-paso muestra:
 *   - Bus de datos INTERNO (registros y ALU) y EXTERNO (MDR, RAM, teclado, LCD):
 *     emisores con su buffer en verde (CONDUCE) o gris (HIGH-Z), la línea del bus
 *     y los receptores que cargan el dato (Ld_*) en ámbar.
 *   - Bus de DIRECCIONES (buffer del MAR) y bus de CONTROL (Read, Write, IO, Clock).
 *   - La MICRO-PALABRA: los 30 bits con los que valen 1 resaltados.
 *
 * Se alimenta del evento que emite la Unidad de Control en cada paso
 * (evento.palabra y evento.buses, tarea 1-6). Simulacion llama a
 * VistaBuses.actualizar(evento) después de cada acción y VistaBuses.limpiar()
 * al reiniciar. Si el libro no tiene la hoja Buses, no hace nada.
 */

const COLORES_BUSES = {
  CONDUCE: '#A5D6A7',   // verde -> buffer conduciendo / bus activo
  HIGH_Z: '#CFD8DC',    // gris  -> buffer en alta impedancia / bus en reposo
  CARGA: '#FFD54F',     // ámbar -> receptor que carga el dato (Ld_*)
  BIT_1: '#FFD54F',     // ámbar -> bit de la micro-palabra en 1
  BIT_0: '#ECEFF1',     // gris claro -> bit en 0
  NOMBRE: '#ECEFF1'
};

/** Posiciones del panel. Cada componente ocupa un grupo de 3 columnas desde la C. */
const DISENO_BUSES = {
  COL_ETIQUETA: 2,
  COL_INICIO: 3,
  ANCHO_GRUPO: 3,
  COLUMNAS: 30,           // C..AF: también son las 30 columnas de la micro-palabra
  FILA_PASO: 4,
  FILA_RESUMEN: 5,
  INTERNO: {
    titulo: 7, nombres: 8, estados: 9, bus: 10, receptores: 11,
    texto: 'BUS DE DATOS INTERNO · registros y ALU',
    emisores: ['PC', 'IR', 'MDR', 'AX', 'BX', 'CX', 'DX', 'ALU'],
    cargan: ['PC', 'IR', 'MAR', 'MDR', 'REN1', 'REN2', 'AX', 'BX', 'CX', 'DX']
  },
  EXTERNO: {
    titulo: 13, nombres: 14, estados: 15, bus: 16, receptores: 17,
    texto: 'BUS DE DATOS EXTERNO · MDR ↔ RAM / teclado / LCD',
    emisores: ['MDR', 'RAM', 'KBD'],
    cargan: ['MDR', 'RAM', 'LCD']
  },
  DIRECCIONES: {
    titulo: 19, nombres: 20, estados: 21, bus: 22,
    texto: 'BUS DE DIRECCIONES · MAR → MMU / memoria o E/S',
    emisores: ['MAR']
  },
  CONTROL: {
    titulo: 24, nombres: 25, valores: 26,
    texto: 'BUS DE CONTROL · Unidad de Control → memoria y E/S',
    lineas: ['Read', 'Write', 'IO', 'Clock']
  },
  PALABRA: {
    titulo: 28, senales: 29, bits: 30, binario: 31, activas: 32,
    texto: 'MICRO-PALABRA · 30 bits (ámbar = 1)'
  }
};

const VistaBuses = {

  // ── Construcción de la hoja ─────────────────────────────────────

  construir(hoja) {
    Diseno.reiniciar(hoja);
    const D = DISENO_BUSES;
    const ultimaCol = D.COL_INICIO + D.COLUMNAS - 1;
    if (hoja.getMaxColumns() < ultimaCol) hoja.insertColumnsAfter(hoja.getMaxColumns(), ultimaCol - hoja.getMaxColumns());

    Diseno.titulo(hoja, 'B1', 'BUSES Y BUFFERS TRI-ESTADO');
    hoja.getRange('B2').setValue('Verde = el buffer CONDUCE · Gris = HIGH-Z (desconectado) · Ámbar = el componente carga el dato (Ld_*) o el bit vale 1')
      .setFontSize(9).setFontColor('#546E7A');

    hoja.setColumnWidth(1, 12);
    hoja.setColumnWidth(D.COL_ETIQUETA, 150);
    for (let c = 0; c < D.COLUMNAS; c++) hoja.setColumnWidth(D.COL_INICIO + c, 34);

    VistaBuses.etiqueta_(hoja, D.FILA_PASO, 'Micro-paso');
    VistaBuses.franja_(hoja, D.FILA_PASO).setFontWeight('bold');
    VistaBuses.etiqueta_(hoja, D.FILA_RESUMEN, 'Estado de los buses');
    VistaBuses.franja_(hoja, D.FILA_RESUMEN);

    [['INTERNO', 'Emisores (En_*)'], ['EXTERNO', 'Emisores (En_*)'], ['DIRECCIONES', 'Buffer de salida']].forEach(p => {
      const s = D[p[0]];
      VistaBuses.barra_(hoja, s.titulo, s.texto);
      VistaBuses.etiqueta_(hoja, s.nombres, p[1]);
      VistaBuses.grupos_(hoja, s.nombres, s.emisores, COLORES_BUSES.NOMBRE).setFontWeight('bold');
      VistaBuses.etiqueta_(hoja, s.estados, 'Buffer tri-estado');
      VistaBuses.grupos_(hoja, s.estados, s.emisores, COLORES_BUSES.HIGH_Z);
      VistaBuses.etiqueta_(hoja, s.bus, 'Línea del bus');
      VistaBuses.franja_(hoja, s.bus).setHorizontalAlignment('center').setFontWeight('bold');
      if (s.cargan) {
        VistaBuses.etiqueta_(hoja, s.receptores, 'Receptores (Ld_*)');
        VistaBuses.grupos_(hoja, s.receptores, s.cargan, COLORES_BUSES.NOMBRE);
      }
    });

    const C = D.CONTROL;
    VistaBuses.barra_(hoja, C.titulo, C.texto);
    VistaBuses.etiqueta_(hoja, C.nombres, 'Línea');
    VistaBuses.grupos_(hoja, C.nombres, C.lineas, COLORES_BUSES.NOMBRE).setFontWeight('bold');
    VistaBuses.etiqueta_(hoja, C.valores, 'Valor');
    VistaBuses.grupos_(hoja, C.valores, C.lineas, COLORES_BUSES.BIT_0);
    hoja.getRange(C.valores, D.COL_INICIO, 1, C.lineas.length * D.ANCHO_GRUPO).setNumberFormat('@');

    const P = D.PALABRA;
    VistaBuses.barra_(hoja, P.titulo, P.texto);
    VistaBuses.etiqueta_(hoja, P.senales, 'Señal');
    hoja.getRange(P.senales, D.COL_INICIO, 1, D.COLUMNAS).setValues([COLUMNAS_MICROPALABRA])
      .setTextRotation(90).setFontSize(8).setFontWeight('bold').setHorizontalAlignment('center')
      .setBackground(COLORES_BUSES.NOMBRE);
    hoja.setRowHeight(P.senales, 70);
    VistaBuses.etiqueta_(hoja, P.bits, 'Bit');
    hoja.getRange(P.bits, D.COL_INICIO, 1, D.COLUMNAS).setNumberFormat('@').setHorizontalAlignment('center')
      .setFontFamily('Roboto Mono').setFontWeight('bold');
    VistaBuses.etiqueta_(hoja, P.binario, 'Binario');
    VistaBuses.franja_(hoja, P.binario);
    VistaBuses.etiqueta_(hoja, P.activas, 'Señales activas');
    VistaBuses.franja_(hoja, P.activas);

    hoja.getRange(D.FILA_PASO, D.COL_ETIQUETA, P.activas - D.FILA_PASO + 1, D.COLUMNAS + 1)
      .setFontFamily('Roboto Mono').setFontSize(9).setVerticalAlignment('middle');
    hoja.setFrozenRows(2);
    hoja.setHiddenGridlines(true);
    VistaBuses.limpiar();
  },

  // ── Actualización por micro-paso ────────────────────────────────

  /**
   * Pinta el estado de los buses del evento de la Unidad de Control.
   * Un evento sin micro-palabra (CPU detenido) deja el panel en reposo.
   */
  actualizar(evento) {
    const hoja = VistaBuses.hoja_();
    if (!hoja) return;
    if (!evento || !evento.palabra || !evento.buses) {
      VistaBuses.limpiar();
      return;
    }
    const D = DISENO_BUSES;
    const buses = evento.buses;
    const palabra = evento.palabra;

    const encabezado = '[Paso ' + String(evento.paso).padStart(2, '0') + '] ' + evento.fase + ' · ' + evento.descripcion +
      (evento.instruccion ? '   (' + evento.instruccion + ')' : '');
    hoja.getRange(D.FILA_PASO, D.COL_INICIO).setValue(encabezado);
    hoja.getRange(D.FILA_RESUMEN, D.COL_INICIO).setValue(evento.descripcionBuses || Bus.describirBuses(buses));

    VistaBuses.pintarBusDatos_(hoja, D.INTERNO, buses.datosInterno);
    VistaBuses.pintarBusDatos_(hoja, D.EXTERNO, buses.datosExterno);

    const dir = buses.direcciones;
    const conduceMar = buses.buffers.MAR === CONDUCE;
    VistaBuses.pintarEstados_(hoja, D.DIRECCIONES, conduceMar ? 'MAR' : null);
    VistaBuses.pintarLinea_(hoja, D.DIRECCIONES.bus, dir.activo,
      dir.activo ? 'MAR (' + UtilMemoria.aHex(Registros.leer('MAR')) + 'h) → ' + dir.destino : 'HIGH-Z');

    VistaBuses.pintarControl_(hoja, buses.control);
    VistaBuses.pintarPalabra_(hoja, palabra);
  },

  /** Deja todo en reposo: buffers en HIGH-Z, buses grises y bits en 0. */
  limpiar() {
    const hoja = VistaBuses.hoja_();
    if (!hoja) return;
    const D = DISENO_BUSES;
    hoja.getRange(D.FILA_PASO, D.COL_INICIO).setValue('—');
    hoja.getRange(D.FILA_RESUMEN, D.COL_INICIO).setValue('CPU en reposo: todos los buffers en HIGH-Z');
    const reposo = { activo: false, emisor: null, receptores: [] };
    VistaBuses.pintarBusDatos_(hoja, D.INTERNO, reposo);
    VistaBuses.pintarBusDatos_(hoja, D.EXTERNO, reposo);
    VistaBuses.pintarEstados_(hoja, D.DIRECCIONES, null);
    VistaBuses.pintarLinea_(hoja, D.DIRECCIONES.bus, false, 'HIGH-Z');
    VistaBuses.pintarControl_(hoja, { Read: 0, Write: 0, IO: 0, Clock: 0 });
    VistaBuses.pintarPalabra_(hoja, MicroPalabra.vacia());
  },

  /**
   * Celda (primera del grupo) de un componente en una fila del panel, para
   * leer su valor o su color: VistaBuses.celda('INTERNO', 'estados', 'PC').
   */
  celda(seccion, fila, nombre) {
    const s = DISENO_BUSES[seccion];
    const lista = fila === 'receptores' ? s.cargan : (s.emisores || s.lineas);
    const i = lista.indexOf(nombre);
    if (i < 0) throw new Error(nombre + ' no está en la fila ' + fila + ' de ' + seccion);
    return VistaBuses.hoja_().getRange(s[fila], DISENO_BUSES.COL_INICIO + i * DISENO_BUSES.ANCHO_GRUPO);
  },

  /** Celda del bit de una señal de la micro-palabra ('En_PC', 'ALU_op0', ...). */
  celdaBit(senal) {
    const i = COLUMNAS_MICROPALABRA.indexOf(senal);
    if (i < 0) throw new Error('Señal desconocida: ' + senal);
    return VistaBuses.hoja_().getRange(DISENO_BUSES.PALABRA.bits, DISENO_BUSES.COL_INICIO + i);
  },

  /** Celda (inicio de la franja) de la línea de un bus: 'INTERNO', 'EXTERNO' o 'DIRECCIONES'. */
  celdaLinea(seccion) {
    return VistaBuses.hoja_().getRange(DISENO_BUSES[seccion].bus, DISENO_BUSES.COL_INICIO);
  },

  // ── Internos ────────────────────────────────────────────────────

  hoja_() {
    return SpreadsheetApp.getActive().getSheetByName(HOJAS.BUSES);
  },

  pintarBusDatos_(hoja, s, bus) {
    VistaBuses.pintarEstados_(hoja, s, bus.emisor);
    VistaBuses.pintarLinea_(hoja, s.bus, bus.activo,
      bus.activo ? bus.emisor + ' → ' + bus.receptores.join(', ') : 'HIGH-Z');
    const fondos = s.cargan.map(n => bus.receptores.indexOf(n) >= 0 ? COLORES_BUSES.CARGA : COLORES_BUSES.NOMBRE);
    VistaBuses.pintarGrupos_(hoja, s.receptores, s.cargan.map(n => n), fondos);
  },

  /** Fila de estados: el emisor en verde con CONDUCE, el resto en gris con HIGH-Z. */
  pintarEstados_(hoja, s, emisor) {
    const textos = s.emisores.map(n => n === emisor ? CONDUCE : HIGH_Z);
    const fondos = s.emisores.map(n => n === emisor ? COLORES_BUSES.CONDUCE : COLORES_BUSES.HIGH_Z);
    VistaBuses.pintarGrupos_(hoja, s.estados, textos, fondos);
    // El nombre del emisor también se pinta, para que se vea de lejos.
    VistaBuses.pintarGrupos_(hoja, s.nombres, s.emisores.slice(),
      s.emisores.map(n => n === emisor ? COLORES_BUSES.CONDUCE : COLORES_BUSES.NOMBRE));
  },

  pintarLinea_(hoja, fila, activa, texto) {
    const D = DISENO_BUSES;
    hoja.getRange(fila, D.COL_INICIO, 1, D.COLUMNAS)
      .setBackground(activa ? COLORES_BUSES.CONDUCE : COLORES_BUSES.HIGH_Z);
    hoja.getRange(fila, D.COL_INICIO).setValue(texto);
  },

  pintarControl_(hoja, control) {
    const C = DISENO_BUSES.CONTROL;
    const valores = C.lineas.map(l => String(control[l] || 0));
    const fondos = C.lineas.map(l => control[l] ? COLORES_BUSES.BIT_1 : COLORES_BUSES.BIT_0);
    VistaBuses.pintarGrupos_(hoja, C.valores, valores, fondos);
  },

  pintarPalabra_(hoja, palabra) {
    const D = DISENO_BUSES, P = D.PALABRA;
    const bits = MicroPalabra.aBits(palabra);
    hoja.getRange(P.bits, D.COL_INICIO, 1, D.COLUMNAS)
      .setValues([bits.map(String)])
      .setBackgrounds([bits.map(b => b ? COLORES_BUSES.BIT_1 : COLORES_BUSES.BIT_0)]);
    hoja.getRange(P.binario, D.COL_INICIO).setValue(MicroPalabra.aBinario(palabra));
    hoja.getRange(P.activas, D.COL_INICIO).setValue(MicroPalabra.describir(palabra));
  },

  /**
   * Escribe una fila de grupos (3 columnas por componente): el texto va en
   * la primera celda de cada grupo y el color en las 3. Una sola escritura
   * de valores y una de colores por fila.
   */
  pintarGrupos_(hoja, fila, textos, fondos) {
    const D = DISENO_BUSES;
    const ancho = textos.length * D.ANCHO_GRUPO;
    const valores = [], colores = [];
    textos.forEach((t, i) => {
      for (let k = 0; k < D.ANCHO_GRUPO; k++) {
        valores.push(k === 0 ? t : '');
        colores.push(fondos[i]);
      }
    });
    hoja.getRange(fila, D.COL_INICIO, 1, ancho).setValues([valores]).setBackgrounds([colores]);
  },

  /** Construye una fila de grupos combinados con los nombres dados. */
  grupos_(hoja, fila, nombres, fondo) {
    const D = DISENO_BUSES;
    nombres.forEach((n, i) => {
      hoja.getRange(fila, D.COL_INICIO + i * D.ANCHO_GRUPO, 1, D.ANCHO_GRUPO).merge()
        .setBorder(true, true, true, true, null, null, COLORES.BORDE, SpreadsheetApp.BorderStyle.SOLID);
    });
    const rango = hoja.getRange(fila, D.COL_INICIO, 1, nombres.length * D.ANCHO_GRUPO);
    rango.setHorizontalAlignment('center').setBackground(fondo);
    VistaBuses.pintarGrupos_(hoja, fila, nombres, nombres.map(() => fondo));
    return rango;
  },

  etiqueta_(hoja, fila, texto) {
    hoja.getRange(fila, DISENO_BUSES.COL_ETIQUETA).setValue(texto).setFontWeight('bold').setFontSize(9);
  },

  franja_(hoja, fila) {
    const D = DISENO_BUSES;
    return hoja.getRange(fila, D.COL_INICIO, 1, D.COLUMNAS).merge()
      .setBorder(true, true, true, true, null, null, COLORES.BORDE, SpreadsheetApp.BorderStyle.SOLID);
  },

  barra_(hoja, fila, texto) {
    const D = DISENO_BUSES;
    const barra = hoja.getRange(fila, D.COL_ETIQUETA, 1, D.COLUMNAS + 1).merge().setValue(texto);
    Diseno.encabezado(barra);
  }
};
