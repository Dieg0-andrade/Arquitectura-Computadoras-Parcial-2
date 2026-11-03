
/**
 * PruebasSwap.gs
 * Pruebas de las 16 paginas virtuales.
 */

function probarSwap() {
  mostrarReporte_([suiteSwap_()]);
}

function suiteSwap_() {
  const t = crearSuite_('Swap');
  const hoja = Swap.asegurarHoja();
  const rango = hoja.getRange(4, 3, 32, 16);
  const respaldo = rango.getDisplayValues();

  try {
    t.prueba('Swap contiene 16 paginas de 32 bytes', () => {
      for (let vpn = 0; vpn < 16; vpn++) {
        t.igual(Swap.leerPagina(vpn).length, 32);
      }
    });

    t.prueba('Escribir y leer pagina 0', () => {
      const bytes = Array.from({length: 32}, (_, i) => i);
      Swap.escribirPagina(0, bytes);

      const leidos = Swap.leerPagina(0);
      t.igual(leidos[0], 0);
      t.igual(leidos[31], 31);
    });

    t.prueba('Escribir y leer ultima pagina', () => {
      Swap.escribirPagina(15, new Array(32).fill(255));
      t.igual(Swap.leerPagina(15)[31], 255);
    });

    t.prueba('Las paginas son independientes', () => {
      Swap.escribirPagina(1, new Array(32).fill(10));
      Swap.escribirPagina(2, new Array(32).fill(20));

      t.igual(Swap.leerPagina(1)[0], 10);
      t.igual(Swap.leerPagina(2)[0], 20);
    });

    t.prueba('Los datos persisten al reabrir la hoja', () => {
      Swap.escribirPagina(3, new Array(32).fill(77));
      Swap.asegurarHoja();
      t.igual(Swap.leerPagina(3)[0], 77);
    });

    t.prueba('Rechaza paginas y bytes invalidos', () => {
      t.lanzaError(() => Swap.leerPagina(-1));
      t.lanzaError(() => Swap.leerPagina(16));
      t.lanzaError(() => Swap.leerPagina(1.5));
      t.lanzaError(() => Swap.escribirPagina(0, [1, 2]));
      t.lanzaError(() =>
        Swap.escribirPagina(0, new Array(32).fill(300))
      );
    });
  } finally {
    rango.setValues(respaldo);
  }

  return t;
}
