/**
 * Identidad.gs
 * Identidad del equipo "Los Tigris" y leyenda de colores (tarea 1-8).
 *
 *   - Hoja "Inicio" (portada): logo, nombre del equipo, integrantes, cómo usar
 *     los controles y la leyenda de colores del simulador.
 *   - Hoja CPU: nombre del equipo en el encabezado y una leyenda compacta
 *     debajo de los controles (Identidad.agregarAHojaCpu).
 *
 * El logo va embebido en base64 (JPEG de 220 px) porque Apps Script no puede
 * leer archivos del repositorio; la versión grande para el README y la
 * presentación está en assets/logo-los-tigris.jpg.
 */

const EQUIPO = {
  NOMBRE: 'Los Tigris',
  INTEGRANTES: ['Adrian Rada', 'Diego Andrade', 'Daniel Roca'],
  MATERIA: 'Arquitectura de Computadoras (SIS-131) · UCB "San Pablo", Santa Cruz',
  PROYECTO: 'Simulador de CPU de 8 bits · Parcial 2'
};

/**
 * Leyenda de colores usada en todas las hojas: [color, nombre, significado].
 * Los valores coinciden con COLORES (Configuracion.gs), COLORES_BUSES
 * (VistaBuses.gs) y los paneles de caché y memoria virtual.
 */
const LEYENDA_COLORES = [
  ['#FFD54F', 'Ámbar', 'Destino de la transferencia · componente que carga (Ld_*) · bit en 1'],
  ['#B3E5FC', 'Celeste', 'Origen de la transferencia'],
  ['#A5D6A7', 'Verde', 'Buffer tri-estado que CONDUCE · bus activo'],
  ['#CFD8DC', 'Gris', 'Buffer en HIGH-Z · bus o componente en reposo'],
  ['#C8E6C9', 'Verde claro', 'Hit de caché'],
  ['#FFCDD2', 'Rojo claro', 'Miss de caché · Page Fault'],
  ['#E3F2FD', 'Azul claro', 'Segmento de código en RAM'],
  ['#E8F5E9', 'Verde menta', 'Segmento de datos en RAM'],
  ['#FFF8E1', 'Crema', 'Celda editable (entrada del usuario)']
];

/** Controles del simulador que se explican en la portada. */
const GUIA_CONTROLES = [
  ['▶| PASO', 'Ejecuta una micro-operación'],
  ['⏭ INSTRUCCIÓN', 'Termina la instrucción actual'],
  ['▶ EJECUTAR', 'Corre instrucción por instrucción hasta HLT (usa el retardo en ms)'],
  ['❚❚ PAUSA', 'Detiene EJECUTAR al terminar la instrucción en curso'],
  ['↺ REINICIAR', 'Registros, log, colores y buses desde cero (la RAM se conserva)']
];

const LOGO_BASE64 = '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';

const Identidad = {

  /** Construye la portada (hoja Inicio). */
  construirPortada(hoja) {
    Diseno.reiniciar(hoja);
    hoja.setHiddenGridlines(true);
    hoja.setColumnWidth(1, 16);
    hoja.setColumnWidths(2, 3, 80);      // B:D -> logo
    hoja.setColumnWidth(5, 24);
    hoja.setColumnWidths(6, 1, 150);     // F   -> color / control
    hoja.setColumnWidths(7, 1, 460);     // G   -> descripción

    Identidad.insertarLogo_(hoja, 2, 2, 220);

    hoja.getRange('F2').setValue(EQUIPO.NOMBRE.toUpperCase())
      .setFontSize(28).setFontWeight('bold').setFontColor(COLORES.TITULO);
    hoja.getRange('F3').setValue(EQUIPO.PROYECTO).setFontSize(13).setFontWeight('bold');
    hoja.getRange('F4').setValue(EQUIPO.MATERIA).setFontSize(10).setFontColor('#546E7A');
    hoja.getRange('F6').setValue('Integrantes').setFontWeight('bold');
    hoja.getRange(7, 6, EQUIPO.INTEGRANTES.length, 1)
      .setValues(EQUIPO.INTEGRANTES.map(n => ['• ' + n]));

    // Controles
    const filaControles = 12;
    const encabezadoControles = hoja.getRange(filaControles, 6, 1, 2);
    encabezadoControles.setValues([['Control (hoja CPU, columna P)', 'Qué hace']]);
    Diseno.encabezado(encabezadoControles);
    hoja.getRange(filaControles + 1, 6, GUIA_CONTROLES.length, 2).setValues(GUIA_CONTROLES)
      .setBorder(true, true, true, true, true, true, COLORES.BORDE, SpreadsheetApp.BorderStyle.SOLID);
    hoja.getRange(filaControles + 1, 6, GUIA_CONTROLES.length, 1).setFontWeight('bold');
    hoja.getRange(filaControles + GUIA_CONTROLES.length + 1, 6)
      .setValue('También desde el menú Simulador CPU y el panel lateral.').setFontSize(9).setFontColor('#546E7A');

    // Leyenda
    const filaLeyenda = filaControles + GUIA_CONTROLES.length + 3;
    Identidad.escribirLeyenda_(hoja, filaLeyenda, 6, 'Leyenda de colores', 'Significado');

    hoja.getRange('B2:G40').setVerticalAlignment('middle');
    return hoja;
  },

  /**
   * Agrega a la hoja CPU el nombre del equipo (encima de los controles) y
   * una leyenda compacta debajo de ellos (columnas P:R).
   */
  agregarAHojaCpu(hoja) {
    hoja.getRange('P1:R1').merge().setValue('🐯 ' + EQUIPO.NOMBRE.toUpperCase())
      .setFontSize(14).setFontWeight('bold').setHorizontalAlignment('center')
      .setFontColor(COLORES.TITULO);
    hoja.getRange('P2:R2').merge().setValue(EQUIPO.INTEGRANTES.join(' · '))
      .setFontSize(8).setHorizontalAlignment('center').setFontColor('#546E7A');

    const fila = FILA_PRIMER_CONTROL + CONTROLES.length + 7;     // debajo del bloque CONTROLES
    const n = LEYENDA_COLORES.length;
    Diseno.bloque(hoja, 'P' + fila + ':R' + (fila + n), 'LEYENDA DE COLORES', COLORES.REGISTRO);
    LEYENDA_COLORES.forEach((l, i) => {
      hoja.getRange(fila + 1 + i, COL_CONTROLES).setBackground(l[0])
        .setBorder(true, true, true, true, null, null, COLORES.BORDE, SpreadsheetApp.BorderStyle.SOLID);
      hoja.getRange(fila + 1 + i, COL_CONTROLES + 1, 1, 2).merge().setValue(l[2])
        .setFontSize(8).setWrap(true).setBackground('#FFFFFF');
    });
    return fila;
  },

  // ── Internos ────────────────────────────────────────────────────

  escribirLeyenda_(hoja, fila, col, titulo, subtitulo) {
    const encabezado = hoja.getRange(fila, col, 1, 2);
    encabezado.setValues([[titulo, subtitulo]]);
    Diseno.encabezado(encabezado);
    const cuerpo = hoja.getRange(fila + 1, col, LEYENDA_COLORES.length, 2);
    cuerpo.setValues(LEYENDA_COLORES.map(l => [l[1], l[2]]))
      .setBorder(true, true, true, true, true, true, COLORES.BORDE, SpreadsheetApp.BorderStyle.SOLID);
    hoja.getRange(fila + 1, col, LEYENDA_COLORES.length, 1)
      .setBackgrounds(LEYENDA_COLORES.map(l => [l[0]])).setFontWeight('bold');
  },

  /** Inserta el logo flotante sobre la celda (fila, col) con el ancho dado en px. */
  insertarLogo_(hoja, fila, col, ancho) {
    try {
      const blob = Utilities.newBlob(Utilities.base64Decode(LOGO_BASE64), 'image/jpeg', 'logo-los-tigris.jpg');
      const imagen = hoja.insertImage(blob, col, fila);
      if (imagen && imagen.setWidth) {
        const alto = Math.round(ancho * 1177 / 1337);
        imagen.setWidth(ancho).setHeight(alto);
      }
    } catch (e) {
      // Sin logo la portada sigue funcionando: se deja el nombre en texto.
      hoja.getRange(fila, col).setValue('🐯 ' + EQUIPO.NOMBRE);
    }
  }
};
