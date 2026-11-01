/**
 * Libro.gs
 * Construye la estructura completa del libro: hojas CPU, RAM, Código,
 * Compilador, Log e ISA, con rangos fijos y rangos con nombre para cada registro.
 * Volver a ejecutar prepararLibro() reconstruye todo desde cero.
 */

/** Rangos con nombre que usa el resto del código (celda de valor de cada registro). */
const NOMBRES = {
  PC: 'REG_PC', IR: 'REG_IR', MAR: 'REG_MAR', MDR: 'REG_MDR',
  AX: 'REG_AX', BX: 'REG_BX', REN1: 'REG_REN1', REN2: 'REG_REN2',
  OP_ALU: 'ALU_OPERACION', RESULTADO_ALU: 'ALU_RESULTADO',
  ZF: 'BANDERA_ZF', CF: 'BANDERA_CF', SF: 'BANDERA_SF',
  RELOJ: 'CPU_RELOJ', FASE: 'CPU_FASE', MICROPASO: 'CPU_MICROPASO',
  ESTADO: 'CPU_ESTADO', DECODIFICADO: 'CPU_DECODIFICADO', BUS_ULTIMO: 'BUS_ULTIMO',
  FASE_BUSQUEDA: 'FASE_BUSQUEDA', FASE_DECODIF: 'FASE_DECODIF',
  FASE_EJECUCION: 'FASE_EJECUCION', FASE_ALMACEN: 'FASE_ALMACEN',
  PANEL_LOG: 'CPU_PANEL_LOG',
  RETARDO: 'CPU_RETARDO', MENSAJE_CONTROL: 'CPU_MENSAJE_CONTROL'
};

function prepararLibro() {
  const ss = SpreadsheetApp.getActive();
  const ui = SpreadsheetApp.getUi();
  const existe = Object.values(HOJAS).some(n => ss.getSheetByName(n));
  if (existe) {
    const respuesta = ui.alert('Reconstruir libro',
      'Esto reconstruye todas las hojas del simulador y borra la RAM, los registros y el log. ¿Continuar?',
      ui.ButtonSet.YES_NO);
    if (respuesta !== ui.Button.YES) return;
  }

  const orden = [HOJAS.CPU, HOJAS.RAM, HOJAS.CODIGO, HOJAS.COMPILADOR, HOJAS.LOG, HOJAS.ISA];
  orden.forEach((nombre, i) => {
    let sh = ss.getSheetByName(nombre);
    if (!sh) sh = ss.insertSheet(nombre);
    ss.setActiveSheet(sh);
    ss.moveActiveSheet(i + 1);
  });
  eliminarHojasPorDefecto_(ss);

  ss.getNamedRanges().forEach(nr => nr.remove());

  VistaCpu.construir(ss.getSheetByName(HOJAS.CPU));
  VistaRam.construir(ss.getSheetByName(HOJAS.RAM));
  Diseno.construirCodigo(ss.getSheetByName(HOJAS.CODIGO));
  Diseno.construirCompilador(ss.getSheetByName(HOJAS.COMPILADOR));
  Diseno.construirLog(ss.getSheetByName(HOJAS.LOG));
  Diseno.construirIsa(ss.getSheetByName(HOJAS.ISA));
  ISA.escribirEnHoja();

  try {
    Controles.instalarActivador();
  } catch (e) {
    ss.toast('No se pudo crear el activador de los controles: ' + e.message, 'Simulador CPU', 8);
  }

  ss.setActiveSheet(ss.getSheetByName(HOJAS.CPU));
  ss.toast('Libro listo.', 'Simulador CPU', 3);
}

function eliminarHojasPorDefecto_(ss) {
  const nuestras = Object.values(HOJAS);
  ss.getSheets().forEach(sh => {
    if (nuestras.indexOf(sh.getName()) === -1 && sh.getLastRow() === 0 && ss.getSheets().length > 1) {
      ss.deleteSheet(sh);
    }
  });
}

/** Funciones de dibujo compartidas. */
const Diseno = {

  /** Limpia una hoja por completo: combinaciones, valores, formatos y validaciones. */
  reiniciar(hoja) {
    const all = hoja.getRange(1, 1, hoja.getMaxRows(), hoja.getMaxColumns());
    all.breakApart();
    all.clearDataValidations();
    hoja.clear();
    hoja.clearConditionalFormatRules();
  },

  titulo(hoja, a1, texto) {
    hoja.getRange(a1).setValue(texto).setFontSize(14).setFontWeight('bold')
      .setFontColor(COLORES.TITULO);
  },

  encabezado(rango) {
    rango.setBackground(COLORES.ENCABEZADO_FONDO).setFontColor(COLORES.ENCABEZADO_TEXTO)
      .setFontWeight('bold').setHorizontalAlignment('center');
  },

  /** Bloque de color (unidad) con barra de título. */
  bloque(hoja, a1, texto, color) {
    const r = hoja.getRange(a1);
    r.setBackground(color)
      .setBorder(true, true, true, true, null, null, COLORES.ENCABEZADO_FONDO, SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
    const barra = hoja.getRange(r.getRow(), r.getColumn(), 1, r.getNumColumns());
    barra.merge().setValue(texto);
    Diseno.encabezado(barra);
  },

  /**
   * Caja de registro: etiqueta arriba (2 celdas combinadas), valor hex y
   * binario abajo. El rango con nombre apunta a la celda del valor hex.
   */
  registro(hoja, fila, col, etiqueta, nombre) {
    const ss = hoja.getParent();
    hoja.getRange(fila, col, 1, 2).merge().setValue(etiqueta)
      .setFontWeight('bold').setHorizontalAlignment('center').setFontSize(9);
    const valor = hoja.getRange(fila + 1, col);
    valor.setNumberFormat('@').setValue('00')
      .setFontFamily('Roboto Mono').setFontSize(13).setFontWeight('bold')
      .setHorizontalAlignment('center').setBackground(COLORES.REGISTRO);
    const bin = hoja.getRange(fila + 1, col + 1);
    bin.setFormula('=IFERROR(HEX2BIN(' + valor.getA1Notation() + ',8),"--------")')
      .setFontFamily('Roboto Mono').setFontSize(9).setHorizontalAlignment('center')
      .setBackground(COLORES.REGISTRO).setFontColor('#546E7A');
    hoja.getRange(fila, col, 2, 2)
      .setBorder(true, true, true, true, null, null, COLORES.BORDE, SpreadsheetApp.BorderStyle.SOLID);
    ss.setNamedRange(nombre, valor);
  },

  /** Etiqueta + una celda de valor (texto) con nombre. */
  campo(hoja, fila, col, etiqueta, nombre, inicial, ancho) {
    const ss = hoja.getParent();
    hoja.getRange(fila, col, 1, ancho || 2).merge().setValue(etiqueta)
      .setFontWeight('bold').setFontSize(9).setHorizontalAlignment('center');
    const valor = hoja.getRange(fila + 1, col, 1, ancho || 2).merge();
    valor.setNumberFormat('@').setValue(inicial)
      .setFontFamily('Roboto Mono').setFontWeight('bold').setHorizontalAlignment('center')
      .setBackground(COLORES.REGISTRO);
    hoja.getRange(fila, col, 2, ancho || 2)
      .setBorder(true, true, true, true, null, null, COLORES.BORDE, SpreadsheetApp.BorderStyle.SOLID);
    ss.setNamedRange(nombre, valor);
  },

  construirCodigo(hoja) {
    Diseno.reiniciar(hoja);
    Diseno.titulo(hoja, 'A1', 'CÓDIGO FUENTE DEL PROGRAMA');
    hoja.getRange('A3:B3').setValues([['Línea', 'Código de alto nivel ✎']]);
    hoja.getRange('D3:E3').setValues([['Línea', 'Ensamblador (generado / manual) ✎']]);
    Diseno.encabezado(hoja.getRange('A3:B3'));
    Diseno.encabezado(hoja.getRange('D3:E3'));

    const lineas = [];
    for (let i = 1; i <= 100; i++) lineas.push([i]);
    hoja.getRange(4, 1, 100, 1).setValues(lineas).setFontColor('#90A4AE').setHorizontalAlignment('center');
    hoja.getRange(4, 4, 100, 1).setValues(lineas).setFontColor('#90A4AE').setHorizontalAlignment('center');
    hoja.getRange(4, 2, 100, 1).setNumberFormat('@').setBackground(COLORES.ENTRADA).setFontFamily('Roboto Mono');
    hoja.getRange(4, 5, 100, 1).setNumberFormat('@').setBackground(COLORES.ENTRADA).setFontFamily('Roboto Mono');

    hoja.setColumnWidth(1, 45); hoja.setColumnWidth(2, 340);
    hoja.setColumnWidth(3, 20);
    hoja.setColumnWidth(4, 45); hoja.setColumnWidth(5, 300);
    hoja.setFrozenRows(3);
  },

  construirCompilador(hoja) {
    Diseno.reiniciar(hoja);
    Diseno.titulo(hoja, 'A1', 'COMPILADOR — fuente → tokens → AST → ensamblador → símbolos → código máquina');
    const sections = [
      ['A3:C3', '1. TOKENS', 'A4:C4', ['Línea', 'Tipo', 'Valor']],
      ['E3:E3', '2. AST', 'E4:E4', ['Nodo']],
      ['G3:H3', '3. ENSAMBLADOR', 'G4:H4', ['Línea fuente', 'Instrucción']],
      ['J3:L3', '4. TABLA DE SÍMBOLOS', 'J4:L4', ['Nombre', 'Tipo', 'Dirección']],
      ['N3:Q3', '5. LISTADO DE CÓDIGO MÁQUINA', 'N4:Q4', ['Dirección', 'Bytes (hex)', 'Bytes (bin)', 'Fuente']]
    ];
    sections.forEach(s => {
      const barra = hoja.getRange(s[0]);
      if (barra.getNumColumns() > 1) barra.merge();
      barra.setValue(s[1]);
      Diseno.encabezado(barra);
      hoja.getRange(s[2]).setValues([s[3]]).setFontWeight('bold').setBackground(COLORES.REGISTRO);
    });
    hoja.getRange('A5:Q300').setFontFamily('Roboto Mono').setNumberFormat('@');
    [45, 90, 90, 12, 260, 12, 60, 180, 12, 90, 70, 70, 12, 70, 110, 190, 220]
      .forEach((w, i) => hoja.setColumnWidth(i + 1, w));
    hoja.setFrozenRows(4);
  },

  construirLog(hoja) {
    Diseno.reiniciar(hoja);
    Diseno.titulo(hoja, 'A1', 'LOG DE MICRO-OPERACIONES');
    hoja.getRange('A3:E3').setValues([['Paso', 'Instrucción', 'Fase', 'Micro-operación', 'Detalle']]);
    Diseno.encabezado(hoja.getRange('A3:E3'));
    hoja.getRange('A4:E1000').setFontFamily('Roboto Mono');
    [80, 200, 120, 170, 320].forEach((w, i) => hoja.setColumnWidth(i + 1, w));
    hoja.setFrozenRows(3);
  },

  construirIsa(hoja) {
    Diseno.reiniciar(hoja);
    Diseno.titulo(hoja, 'A1', 'CONJUNTO DE INSTRUCCIONES (ISA)');
    hoja.getRange('A2:F2').setValues([['Opcode (hex)', 'Mnemónico', 'Operandos', 'Bytes', 'Modo', 'Descripción']]);
    Diseno.encabezado(hoja.getRange('A2:F2'));
    hoja.getRange('A3:A200').setNumberFormat('@');
    hoja.getRange('A3:F200').setFontFamily('Roboto Mono');
    [90, 110, 120, 60, 110, 380].forEach((w, i) => hoja.setColumnWidth(i + 1, w));
    hoja.setFrozenRows(2);
  }
};

/** Hoja CPU: diagrama del procesador (Unidad de Control, ALU, interfaz de memoria, bus). */
const VistaCpu = {

  construir(hoja) {
    Diseno.reiniciar(hoja);
    Diseno.titulo(hoja, 'B1', 'ARQUITECTURA VON NEUMANN — CPU de 8 bits + memoria principal');
    hoja.getRange('B2').setValue('Programa almacenado: código y datos viven en la misma RAM y usan el mismo ' +
      'camino MAR/MDR y el mismo bus (cuello de botella de von Neumann).')
      .setFontSize(9).setFontStyle('italic').setFontColor('#546E7A');
    hoja.setColumnWidth(1, 16);
    hoja.setColumnWidths(2, 13, 92);
    hoja.setColumnWidth(8, 24);

    // ── Unidad de Control ──────────────────────────────────────────────
    Diseno.bloque(hoja, 'B3:G15', 'UNIDAD DE CONTROL', COLORES.UNIDAD_CONTROL);
    Diseno.registro(hoja, 5, 2, 'C.P. · PC', NOMBRES.PC);
    Diseno.registro(hoja, 5, 5, 'R.I. · IR', NOMBRES.IR);
    Diseno.campo(hoja, 8, 2, 'Reloj (ciclos)', NOMBRES.RELOJ, '0');
    Diseno.campo(hoja, 8, 5, 'Decodificador', NOMBRES.DECODIFICADO, '—', 2);
    Diseno.campo(hoja, 11, 2, 'Estado', NOMBRES.ESTADO, 'LISTO');
    Diseno.campo(hoja, 11, 5, 'Secuenciador (micro-paso)', NOMBRES.MICROPASO, '—', 2);

    const fases = [['BÚSQUEDA', NOMBRES.FASE_BUSQUEDA], ['DECODIF.', NOMBRES.FASE_DECODIF],
                    ['EJECUCIÓN', NOMBRES.FASE_EJECUCION], ['ALMACEN.', NOMBRES.FASE_ALMACEN]];
    hoja.getRange(14, 2).setValue('Fase').setFontWeight('bold').setFontSize(9);
    fases.forEach((p, i) => {
      const celda = hoja.getRange(14, 3 + i);
      celda.setValue(p[0]).setHorizontalAlignment('center').setFontWeight('bold').setFontSize(9)
        .setBackground(COLORES.REGISTRO)
        .setBorder(true, true, true, true, null, null, COLORES.BORDE, SpreadsheetApp.BorderStyle.SOLID);
      hoja.getParent().setNamedRange(p[1], celda);
    });
    const faseActual = hoja.getRange(15, 3, 1, 4).merge();
    faseActual.setValue('—').setHorizontalAlignment('center').setFontSize(9).setFontColor('#546E7A');
    hoja.getParent().setNamedRange(NOMBRES.FASE, faseActual);

    // ── ALU + registros generales ───────────────────────────────────
    Diseno.bloque(hoja, 'I3:N15', 'ALU Y REGISTROS · Unidad Aritmético-Lógica', COLORES.UNIDAD_ALU);
    Diseno.registro(hoja, 5, 9, 'Acumulador · AX', NOMBRES.AX);
    Diseno.registro(hoja, 5, 12, 'BX', NOMBRES.BX);
    Diseno.registro(hoja, 8, 9, 'REN1 · entrada A', NOMBRES.REN1);
    Diseno.registro(hoja, 8, 12, 'REN2 · entrada B', NOMBRES.REN2);
    Diseno.campo(hoja, 11, 9, 'C.OP · operación', NOMBRES.OP_ALU, '—');
    Diseno.registro(hoja, 11, 12, 'Resultado ALU', NOMBRES.RESULTADO_ALU);

    hoja.getRange(14, 9).setValue('R. Estado').setFontWeight('bold').setFontSize(9);
    [['ZF', NOMBRES.ZF], ['CF', NOMBRES.CF], ['SF', NOMBRES.SF]].forEach((f, i) => {
      const col = 10 + i;
      hoja.getRange(14, col).setValue(f[0]).setFontWeight('bold').setHorizontalAlignment('center').setFontSize(9);
      const v = hoja.getRange(15, col);
      v.setNumberFormat('@').setValue('0').setFontFamily('Roboto Mono').setFontWeight('bold')
        .setHorizontalAlignment('center').setBackground(COLORES.REGISTRO)
        .setBorder(true, true, true, true, null, null, COLORES.BORDE, SpreadsheetApp.BorderStyle.SOLID);
      hoja.getParent().setNamedRange(f[1], v);
    });

    // ── Interfaz de memoria ──────────────────────────────────────────
    Diseno.bloque(hoja, 'B17:G21', 'INTERFAZ DE MEMORIA', COLORES.UNIDAD_MEMORIA);
    Diseno.registro(hoja, 19, 2, 'RDM · MAR', NOMBRES.MAR);
    Diseno.registro(hoja, 19, 5, 'RIM · MDR', NOMBRES.MDR);

    // ── Bus del sistema (se amplía en el Parcial 2) ────────────────────
    Diseno.bloque(hoja, 'I17:N21', 'BUS DEL SISTEMA · único camino CPU ↔ memoria', COLORES.REGISTRO);
    Diseno.campo(hoja, 19, 9, 'Última transferencia', NOMBRES.BUS_ULTIMO, '—', 6);

    // ── Últimas micro-operaciones (la más reciente arriba) ─────────────
    VistaCpu.construirPanelLog(hoja);

    // ── Botones de control (casillas en la columna P) ──────────────────
    Controles.construir(hoja);

    hoja.setHiddenGridlines(true);
  },

  /**
   * Panel con las últimas micro-operaciones en la hoja CPU, para seguir la
   * ejecución sin cambiar de hoja. Filas 25–34; columnas combinadas:
   * B paso · C:D fase · E:G micro-operación · H:N detalle.
   */
  construirPanelLog(hoja) {
    Diseno.bloque(hoja, 'B23:N34', 'ÚLTIMAS MICRO-OPERACIONES · ámbar = destino · celeste = origen', COLORES.REGISTRO);
    const encabezado = hoja.getRange(24, 2, 1, 13);
    encabezado.setFontWeight('bold').setFontSize(9);
    hoja.getRange(24, 2).setValue('Paso');
    hoja.getRange(24, 3, 1, 2).merge().setValue('Fase');
    hoja.getRange(24, 5, 1, 3).merge().setValue('Micro-operación');
    hoja.getRange(24, 8, 1, 7).merge().setValue('Detalle');
    for (let f = 25; f <= 34; f++) {
      hoja.getRange(f, 3, 1, 2).merge();
      hoja.getRange(f, 5, 1, 3).merge();
      hoja.getRange(f, 8, 1, 7).merge();
    }
    const cuerpo = hoja.getRange(25, 2, 10, 13);
    cuerpo.setFontFamily('Roboto Mono').setFontSize(9).setBackground('#FFFFFF');
    hoja.getRange(25, 2, 1, 13).setFontWeight('bold');
    hoja.getParent().setNamedRange(NOMBRES.PANEL_LOG, cuerpo);
  }
};
