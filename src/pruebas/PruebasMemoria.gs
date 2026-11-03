/**
 * pruebas/PruebasMemoria.gs
 * Pruebas unitarias y de integración del módulo de memoria.
 * El contenido de la RAM se respalda antes y se restaura al final.
 */

function probarMemoria() {
  mostrarReporte_([suiteMemoria_()]);
}

function suiteMemoria_() {
  const t = crearSuite_('Memoria');

  // ── Funciones puras ──
  t.prueba('parsearByte acepta 1F / 1fh / 0x1F / 5', () => {
    t.igual(UtilMemoria.parsearByte('1F'), 31);
    t.igual(UtilMemoria.parsearByte('1fh'), 31);
    t.igual(UtilMemoria.parsearByte('0x1F'), 31);
    t.igual(UtilMemoria.parsearByte('5'), 5);
    t.igual(UtilMemoria.parsearByte(''), 0);
  });
  t.prueba('parsearByte rechaza texto inválido', () => {
    t.igual(UtilMemoria.parsearByte('G1'), null);
    t.igual(UtilMemoria.parsearByte('100'), null);
    t.igual(UtilMemoria.parsearByte('-1'), null);
  });
  t.prueba('aHex / aBin rellenan con ceros', () => {
    t.igual(UtilMemoria.aHex(5), '05');
    t.igual(UtilMemoria.aHex(255), 'FF');
    t.igual(UtilMemoria.aBin(5), '00000101');
  });
  t.prueba('dirección <-> posición en la matriz (ida y vuelta)', () => {
    [0x00, 0x0F, 0x10, 0x7F, 0x80, 0xFF].forEach(a => {
      const p = UtilMemoria.posicion(a);
      t.igual(UtilMemoria.direccionEn(p.fila, p.col), a);
    });
  });
  t.prueba('segmentos: 7Fh es CODIGO, 80h es DATOS', () => {
    t.igual(UtilMemoria.segmentoDe(0x7F), 'CODIGO');
    t.igual(UtilMemoria.segmentoDe(0x80), 'DATOS');
  });

  
  t.prueba('RAM muestra 8 marcos de 32 bytes', () => {
    const hoja = UtilMemoria.hoja();

    for (let marco = 0; marco < 8; marco++) {
      const inicio = marco * 32;
      const fin = inicio + 31;
      const fila = MATRIZ_RAM.PRIMERA_FILA + marco * 2;

      const etiqueta = hoja.getRange(fila, 1).getDisplayValue();

      t.igual(etiqueta.includes('MARCO ' + marco), true);
      t.igual(etiqueta.includes(UtilMemoria.aHex(inicio) + 'h'), true);
      t.igual(etiqueta.includes(UtilMemoria.aHex(fin) + 'h'), true);

      t.igual(UtilMemoria.posicion(inicio).fila, fila);
      t.igual(UtilMemoria.posicion(fin).fila, fila + 1);
    }
  });


  // ── Integración con la hoja RAM ──
  const respaldo = Memoria.volcar();
  try {
    t.prueba('escribir/leer en 00h, 7Fh, 80h y FFh', () => {
      [[0x00, 0xA5], [0x7F, 0x01], [0x80, 0xFF], [0xFF, 0x00]].forEach(([a, v]) => {
        Memoria.escribir(a, v);
        t.igual(Memoria.leer(a), v);
      });
    });
    t.prueba('escribir rechaza las direcciones 256 y -1', () => {
      t.lanzaError(() => Memoria.escribir(256, 1));
      t.lanzaError(() => Memoria.escribir(-1, 1));
    });
    t.prueba('escribir rechaza los valores 256 y 1.5', () => {
      t.lanzaError(() => Memoria.escribir(0, 256));
      t.lanzaError(() => Memoria.escribir(0, 1.5));
    });
    t.prueba('cargar escribe un bloque y volcar lo lee', () => {
      Memoria.cargar(0x10, [1, 2, 3]);
      const d = Memoria.volcar();
      t.igual(d[0x10], 1); t.igual(d[0x11], 2); t.igual(d[0x12], 3);
    });
    t.prueba('cargar rechaza un bloque que pasa de FFh', () => {
      t.lanzaError(() => Memoria.cargar(0xFE, [1, 2, 3]));
    });
  } finally {
    UtilMemoria.rangoMatriz().setValues(UtilMemoria.aMatriz(respaldo));
  }

  return t;
}
