/**
 * VistaRam.gs
 * Construye la hoja RAM: matriz 16x16 (00h–FFh) con segmentación de código y
 * datos, el inspector de celdas y la leyenda de colores. También normaliza las
 * ediciones manuales para que cada celda tenga siempre un byte hex de 2 dígitos.
 */

const VistaRam = {

  construir(hoja) {
    Diseno.reiniciar(hoja);

    hoja.getRange('B1').setValue('RAM FÍSICA — 256 bytes · 8 marcos de 32 bytes')
      .setFontSize(14).setFontWeight('bold').setFontColor(COLORES.TITULO);

    VistaRam.construirMatriz(hoja);
    VistaRam.construirInspector(hoja);
    VistaRam.construirLeyenda(hoja);
    hoja.setFrozenRows(0);
  },

  construirMatriz(hoja) {
    const tamano = MATRIZ_RAM.TAMANO;

    // Esquina + encabezados de columna (+0 .. +F = nibble bajo)
    const encabezadosCol = [];
    for (let c = 0; c < tamano; c++) encabezadosCol.push('+' + c.toString(16).toUpperCase());
    hoja.getRange(MATRIZ_RAM.FILA_ENCABEZADO, MATRIZ_RAM.COL_ENCABEZADO).setValue('Dir');
    hoja.getRange(MATRIZ_RAM.FILA_ENCABEZADO, MATRIZ_RAM.PRIMERA_COL, 1, tamano).setValues([encabezadosCol]);

    // Encabezados de fila (00h .. F0h = dirección base de cada fila)
    const encabezadosFila = [];
    for (let r = 0; r < tamano; r++) encabezadosFila.push([UtilMemoria.aHex(r * 16) + 'h']);
    hoja.getRange(MATRIZ_RAM.PRIMERA_FILA, MATRIZ_RAM.COL_ENCABEZADO, tamano, 1).setValues(encabezadosFila);

    hoja.getRange(MATRIZ_RAM.FILA_ENCABEZADO, MATRIZ_RAM.COL_ENCABEZADO, 1, tamano + 1)
      .setBackground(COLORES.ENCABEZADO_FONDO).setFontColor(COLORES.ENCABEZADO_TEXTO).setFontWeight('bold')
      .setHorizontalAlignment('center');
    hoja.getRange(MATRIZ_RAM.PRIMERA_FILA, MATRIZ_RAM.COL_ENCABEZADO, tamano, 1)
      .setBackground(COLORES.ENCABEZADO_FONDO).setFontColor(COLORES.ENCABEZADO_TEXTO).setFontWeight('bold')
      .setHorizontalAlignment('center');

    // Celdas de datos: texto plano para que "05" conserve el cero inicial
    const matriz = UtilMemoria.rangoMatriz();
    matriz.setNumberFormat('@')
      .setFontFamily('Roboto Mono').setHorizontalAlignment('center')
      .setBorder(true, true, true, true, true, true, COLORES.BORDE, SpreadsheetApp.BorderStyle.SOLID);
    Memoria.limpiar();
    VistaRam.pintarSegmentos();


    // Cada marco contiene 32 bytes: 2 filas de 16.
    // Conservamos la matriz física original de 16x16.
    for (let marco = 0; marco < 8; marco++) {
      const fila = MATRIZ_RAM.PRIMERA_FILA + marco * 2;
      const inicio = marco * 32;
      const fin = inicio + 31;

      const color = marco % 2 === 0
        ? COLORES.SEG_CODIGO
        : COLORES.SEG_DATOS;

      // Etiqueta del marco físico.
      hoja.getRange(fila, 1, 2, 1)
        .merge()
        .setValue(
          'MARCO ' + marco + '\n' +
          UtilMemoria.aHex(inicio) + 'h–' +
          UtilMemoria.aHex(fin) + 'h'
        )
        .setBackground(color)
        .setVerticalAlignment('middle')
        .setHorizontalAlignment('center')
        .setFontWeight('bold')
        .setWrap(true);

      // Separador entre marcos.
      if (marco > 0) {
        hoja.getRange(
          fila,
          MATRIZ_RAM.COL_ENCABEZADO,
          1,
          tamano + 1
        ).setBorder(
          true, null, null, null, null, null,
          COLORES.ENCABEZADO_FONDO,
          SpreadsheetApp.BorderStyle.SOLID_THICK
        );
      }
    }

    hoja.setColumnWidth(1, 95);

    hoja.setColumnWidths(MATRIZ_RAM.PRIMERA_COL, tamano, 34);
  },

 
  /** Colorea los 8 marcos físicos sin modificar sus bytes. */
  pintarSegmentos() {
    const hoja = UtilMemoria.hoja();

    for (let marco = 0; marco < 8; marco++) {
      const color = marco % 2 === 0
        ? COLORES.SEG_CODIGO
        : COLORES.SEG_DATOS;

      hoja.getRange(
        MATRIZ_RAM.PRIMERA_FILA + marco * 2,
        MATRIZ_RAM.PRIMERA_COL,
        2,
        MATRIZ_RAM.TAMANO
      ).setBackground(color);
    }
  },


  /**
   * Inspector hecho con fórmulas de la hoja, así se actualiza solo cuando
   * cambia la dirección o la celda de memoria. El mnemónico se busca en la
   * hoja ISA (se llena en la tarea 9).
   */
  construirInspector(hoja) {
    const L = INSPECTOR.COL_ETIQUETA, V = INSPECTOR.COL_VALOR;
    const matrizA1 = UtilMemoria.rangoMatriz().getA1Notation().replace(/([A-Z]+)(\d+)/g, '$$$1$$$2');
    const dir = '$U$4';

    hoja.getRange(3, L, 1, 2).merge().setValue('INSPECTOR DE MEMORIA')
      .setBackground(COLORES.ENCABEZADO_FONDO).setFontColor(COLORES.ENCABEZADO_TEXTO)
      .setFontWeight('bold').setHorizontalAlignment('center');

    const filas = [
      ['Dirección (hex) ✎', null],
      ['Dirección (dec)', '=IFERROR(HEX2DEC(' + dir + '),"inválida")'],
      ['Valor (hex)', '=IFERROR(INDEX(' + matrizA1 + ',INT(HEX2DEC(' + dir + ')/16)+1,MOD(HEX2DEC(' + dir + '),16)+1),"—")'],
      ['Valor (binario)', '=IFERROR(HEX2BIN(U6,8),"—")'],
      ['Valor (dec, sin signo)', '=IFERROR(HEX2DEC(U6),"—")'],
      ['Valor (dec, con signo C2)', '=IFERROR(IF(U8>127,U8-256,U8),"—")'],
      ['Segmento', '=IFERROR(IF(HEX2DEC(' + dir + ')<=' + MAPA_MEMORIA.CODIGO_FIN + ',"CÓDIGO","DATOS"),"—")'],
      ['Mnemónico (si es opcode)', '=IFERROR(IF(U10="CÓDIGO",IFERROR(VLOOKUP(U6,' + HOJAS.ISA + '!$A$3:$B,2,FALSE),"— no es opcode"),"— byte de datos"),"—")']
    ];
    filas.forEach((fila, i) => {
      hoja.getRange(4 + i, L).setValue(fila[0]).setFontWeight('bold');
      if (fila[1]) hoja.getRange(4 + i, V).setFormula(fila[1]);
    });

    const campoEntrada = hoja.getRange(INSPECTOR.ENTRADA);
    // La dirección se valida en alEditar (no con una regla de validación de datos:
    // esas fórmulas dependen de la configuración regional de la hoja).
    campoEntrada.setNumberFormat('@').setValue('00').setBackground(COLORES.ENTRADA)
      .setNote('Escribe una dirección en hex: 00 a FF');

    hoja.getRange(4, L, filas.length, 2)
      .setBorder(true, true, true, true, true, true, COLORES.BORDE, SpreadsheetApp.BorderStyle.SOLID);
    hoja.getRange(4, V, filas.length, 1).setFontFamily('Roboto Mono').setHorizontalAlignment('center');
    hoja.setColumnWidth(L, 170);
    hoja.setColumnWidth(V, 140);
  },

  construirLeyenda(hoja) {
    const L = INSPECTOR.COL_ETIQUETA;
    hoja.getRange(14, L, 1, 2).merge().setValue('LEYENDA')
      .setBackground(COLORES.ENCABEZADO_FONDO).setFontColor(COLORES.ENCABEZADO_TEXTO)
      .setFontWeight('bold').setHorizontalAlignment('center');
    const elementos = [
      ['Marco físico par', COLORES.SEG_CODIGO],
      ['Marco físico impar', COLORES.SEG_DATOS],
      ['Celda activa (acceso actual)', COLORES.ACTIVO],
      ['Campo editable', COLORES.ENTRADA]
    ];
    elementos.forEach((it, i) => {
      hoja.getRange(15 + i, L).setValue(it[0]);
      hoja.getRange(15 + i, L + 1).setBackground(it[1]);
    });
  },

  /**
   * Se llama desde onEdit. Normaliza cualquier valor escrito en la matriz a
   * un byte hex de 2 dígitos en mayúsculas ("5" -> "05", "0x1f" -> "1F",
   * "ffh" -> "FF"). Los valores inválidos se revierten (una celda) o quedan
   * en 00 (al pegar un bloque).
   */
  alEditar(e) {
    const rango = e.range;
    if (rango.getSheet().getName() !== HOJAS.RAM) return;
    if (rango.getA1Notation() === INSPECTOR.ENTRADA) return VistaRam.validarDireccionInspector_(rango, e.oldValue);

    const r0 = rango.getRow(), c0 = rango.getColumn();
    const valores = rango.getDisplayValues();
    const invalidos = [];
    let cambio = false;

    for (let i = 0; i < valores.length; i++) {
      for (let j = 0; j < valores[i].length; j++) {
        const direccion = UtilMemoria.direccionEn(r0 + i, c0 + j);
        if (direccion < 0) continue;
        const parseado = UtilMemoria.parsearByte(valores[i][j]);
        let normalizado;
        if (parseado === null) {
          invalidos.push(UtilMemoria.aHex(direccion) + 'h');
          const anterior = valores.length === 1 && valores[0].length === 1
            ? UtilMemoria.parsearByte(e.oldValue) : null;
          normalizado = UtilMemoria.aHex(anterior === null ? 0 : anterior);
        } else {
          normalizado = UtilMemoria.aHex(parseado);
        }
        if (normalizado !== valores[i][j]) {
          rango.getCell(i + 1, j + 1).setNumberFormat('@').setValue(normalizado);
          cambio = true;
        }
      }
    }

    if (invalidos.length) {
      SpreadsheetApp.getActive().toast('Byte inválido en ' + invalidos.join(', ') +
        '. Usa hex 00–FF.', 'RAM', 5);
    } else if (cambio) {
      SpreadsheetApp.getActive().toast('Valor normalizado a hex.', 'RAM', 2);
    }
  },

  /** Normaliza la dirección del inspector a 2 dígitos hex, o restaura la anterior si no es válida. */
  validarDireccionInspector_(celda, anterior) {
    const valor = UtilMemoria.parsearByte(celda.getDisplayValue());
    if (valor === null) {
      const previo = UtilMemoria.parsearByte(anterior);
      celda.setValue(UtilMemoria.aHex(previo === null ? 0 : previo));
      SpreadsheetApp.getActive().toast('Dirección inválida. Usa hex de 00 a FF.', 'Inspector', 4);
      return;
    }
    const normal = UtilMemoria.aHex(valor);
    if (normal !== celda.getDisplayValue()) celda.setValue(normal);
  }
};
