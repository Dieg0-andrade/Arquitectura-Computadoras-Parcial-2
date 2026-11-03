
/**
 * VistaCache.gs
 * Panel visual de caché y periféricos.
 *
 * Issue #4: Design cache and I/O panels layout.
 * Solo construye la interfaz; no implementa la lógica.
 */

const VistaCache = {

  construir(hoja) {
    Diseno.reiniciar(hoja);

    hoja.setHiddenGridlines(true);
    hoja.setFrozenRows(2);
    hoja.setColumnWidths(1, 16, 85);
    hoja.setColumnWidth(1, 20);

    Diseno.titulo(
      hoja, 'B1',
      'JERARQUÍA DE CACHÉ Y PERIFÉRICOS'
    );

    hoja.getRange('B2').setValue(
      'CPU de 8 bits | L1I + L1D + L2 | Keyboard FIFO | LCD 8x1'
    ).setFontColor('#546E7A').setFontSize(9);

    // ── L1I: caché de instrucciones ──
    VistaCache.panelCache_(
      hoja, 'B4:I4', 'L1I · INSTRUCCIONES',
      5, 2, 'CACHE_L1I'
    );

    // ── L1D: caché de datos ──
    VistaCache.panelCache_(
      hoja, 'K4:R4', 'L1D · DATOS',
      5, 11, 'CACHE_L1D'
    );

    // ── L2: 32 bytes en cuatro bloques de 8 ──
    Diseno.bloque(
      hoja, 'B10:R10',
      'L2 · CACHÉ COMPARTIDA · 32 BYTES',
      COLORES.UNIDAD_MEMORIA
    );

    const etiquetasL2 = [
      ['Línea 0', '00–07'],
      ['Línea 1', '08–0F'],
      ['Línea 2', '10–17'],
      ['Línea 3', '18–1F']
    ];

    etiquetasL2.forEach((item, i) => {
      const fila = 12 + i * 2;

      hoja.getRange(fila, 2)
        .setValue(item[0])
        .setFontWeight('bold');

      hoja.getRange(fila, 3)
        .setValue(item[1])
        .setFontColor('#546E7A');

      const datos = hoja.getRange(fila, 5, 1, 8);
      datos.setValues([Array(8).fill('00')]);
      VistaCache.formatoBytes_(datos);

      hoja.getParent().setNamedRange(
        'CACHE_L2_LINEA_' + i, datos
      );
    });

    // ── Estadísticas de caché ──
    Diseno.bloque(
      hoja, 'B21:R21',
      'ESTADÍSTICAS · HIT / MISS',
      COLORES.UNIDAD_CONTROL
    );

    hoja.getRange('B23:E23').setValues([[
      'Nivel', 'Hits', 'Misses', 'Hit Rate'
    ]]);

    Diseno.encabezado(hoja.getRange('B23:E23'));

    const niveles = ['L1I', 'L1D', 'L2'];

    niveles.forEach((nivel, i) => {
      const fila = 24 + i;

      hoja.getRange(fila, 2).setValue(nivel);
      hoja.getRange(fila, 3, 1, 2)
        .setValues([[0, 0]]);

      hoja.getRange(fila, 5)
        .setFormula(
          '=IFERROR(C' + fila +
          '/(C' + fila + '+D' + fila + '),0)'
        )
        .setNumberFormat('0.0%');

      hoja.getParent().setNamedRange(
        'CACHE_' + nivel + '_HITS',
        hoja.getRange(fila, 3)
      );

      hoja.getParent().setNamedRange(
        'CACHE_' + nivel + '_MISSES',
        hoja.getRange(fila, 4)
      );
    });

    // ── Teclado FIFO ──
    Diseno.bloque(
      hoja, 'B29:I29',
      'KEYBOARD · FIFO 8 BYTES',
      COLORES.UNIDAD_ALU
    );

    const teclado = hoja.getRange('B31:I31');
    teclado.setValues([Array(8).fill('00')]);
    VistaCache.formatoBytes_(teclado);

    hoja.getRange('B33').setValue('Entrada:');
    hoja.getRange('C33:I33').merge()
      .setBackground(COLORES.ENTRADA)
      .setNumberFormat('@');

    hoja.getParent().setNamedRange(
      'TECLADO_FIFO', teclado
    );

    hoja.getParent().setNamedRange(
      'TECLADO_ENTRADA', hoja.getRange('C33')
    );

    // ── LCD 8x1 ──
    Diseno.bloque(
      hoja, 'K29:R29',
      'LCD · DISPLAY 8x1',
      COLORES.UNIDAD_CONTROL
    );

    const lcd = hoja.getRange('K31:R31');
    lcd.setValues([Array(8).fill(' ')]);
    lcd.setBackground('#263238')
      .setFontColor('#80FF80')
      .setFontFamily('Roboto Mono')
      .setFontWeight('bold')
      .setFontSize(14)
      .setHorizontalAlignment('center');

    hoja.getParent().setNamedRange(
      'LCD_DISPLAY', lcd
    );

    hoja.getRange('B36').setValue(
      'Estado inicial · esperando ejecución del simulador'
    ).setFontColor('#607D8B');

    hoja.getParent().setNamedRange(
      'CACHE_IO_ESTADO', hoja.getRange('B36')
    );
  },

  panelCache_(hoja, cabecera, titulo, fila, col, nombre) {
    Diseno.bloque(
      hoja, cabecera, titulo,
      COLORES.UNIDAD_CONTROL
    );

    const datos = hoja.getRange(fila + 1, col, 1, 8);
    datos.setValues([Array(8).fill('00')]);
    VistaCache.formatoBytes_(datos);

    hoja.getRange(fila, col, 1, 8)
      .setValues([['0','1','2','3','4','5','6','7']])
      .setHorizontalAlignment('center')
      .setFontWeight('bold');

    hoja.getParent().setNamedRange(nombre, datos);
  },

  formatoBytes_(rango) {
    rango.setNumberFormat('@')
      .setFontFamily('Roboto Mono')
      .setFontWeight('bold')
      .setHorizontalAlignment('center')
      .setBackground(COLORES.REGISTRO)
      .setBorder(
        true, true, true, true, true, true,
        COLORES.BORDE,
        SpreadsheetApp.BorderStyle.SOLID
      );
  }
};
