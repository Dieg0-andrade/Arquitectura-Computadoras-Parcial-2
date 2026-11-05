
/**
 * PruebasTablaMarcos.gs
 * Issue #8: tabla de paginas virtuales.
 */

function probarTablaMarcos() {
  mostrarReporte_([suiteTablaMarcos_()]);
}

function suiteTablaMarcos_() {
  const t = crearSuite_('Tabla de marcos');
  const rango = TablaMarcos.rango_();
  const respaldo = rango.getValues();

  try {
    t.prueba('La tabla contiene 16 paginas', () => {
      const filas = rango.getValues();
      t.igual(filas.length, 16);

      for (let vpn = 0; vpn < 16; vpn++) {
        t.igual(TablaMarcos.obtener(vpn).vpn, vpn);
      }
    });

    t.prueba('Solo VPN 15 inicia presente', () => {
      for (let vpn = 0; vpn < 15; vpn++) {
        t.igual(TablaMarcos.obtener(vpn).presente, 0);
        t.igual(TablaMarcos.obtener(vpn).pfn, null);
      }

      const pagina15 = TablaMarcos.obtener(15);
      t.igual(pagina15.presente, 1);
      t.igual(pagina15.pfn, 7);
    });

    t.prueba('Actualiza P, PFN, Dirty y Ref', () => {
      TablaMarcos.actualizar(4, {
        presente: 1,
        pfn: 2,
        dirty: 1,
        ref: 1
      });

      const pagina = TablaMarcos.obtener(4);
      t.igual(pagina.presente, 1);
      t.igual(pagina.pfn, 2);
      t.igual(pagina.dirty, 1);
      t.igual(pagina.ref, 1);
    });

    t.prueba('Los cambios persisten en la hoja', () => {
      const pagina = TablaMarcos.obtener(4);
      t.igual(pagina.pfn, 2);
      t.igual(Number(rango.getCell(5, 3).getValue()), 2);
    });

    t.prueba('Puede liberar un marco', () => {
      TablaMarcos.actualizar(4, {
        presente: 0,
        pfn: null,
        dirty: 0,
        ref: 0
      });

      const pagina = TablaMarcos.obtener(4);
      t.igual(pagina.presente, 0);
      t.igual(pagina.pfn, null);
    });

    t.prueba('Rechaza direcciones y valores invalidos', () => {
      t.lanzaError(() => TablaMarcos.obtener(-1));
      t.lanzaError(() => TablaMarcos.obtener(16));
      t.lanzaError(() => TablaMarcos.obtener(1.5));
      t.lanzaError(() =>
        TablaMarcos.actualizar(2, { dirty: 3 })
      );
      t.lanzaError(() =>
        TablaMarcos.actualizar(2, { presente: 1, pfn: 7 })
      );
    });

    t.prueba('VPN 15 no puede desalojarse', () => {
      t.lanzaError(() =>
        TablaMarcos.actualizar(15, { presente: 0 })
      );

      t.lanzaError(() =>
        TablaMarcos.actualizar(15, { pfn: 6 })
      );

      t.igual(TablaMarcos.obtener(15).pfn, 7);
    });

  } finally {
    rango.setValues(respaldo);
  }

  return t;
}
