
/**
 * PruebasMMU.gs
 * Issue #12 - Traduccion de direcciones virtuales.
 */

function probarMMU() {
  mostrarReporte_([suiteMMU_()]);
}

function suiteMMU_() {
  const t = crearSuite_('MMU');
  const anterior = TablaMarcos.obtener(4);

  try {
    t.prueba('Calcula VPN y offset', () => {
      const r = MMU.traducir(0x01F);
      t.igual(r.vpn, 0);
      t.igual(r.offset, 31);
    });

    t.prueba('Reconoce paginas ausentes', () => {
      const r = MMU.traducir(0x085);
      t.igual(r.vpn, 4);
      t.igual(r.presente, false);
      t.igual(r.pfn, null);
      t.igual(r.dirFisica, null);
    });

    t.prueba('VPN 15 usa PFN 7', () => {
      const r = MMU.traducir(0x1F0);
      t.igual(r.vpn, 15);
      t.igual(r.offset, 16);
      t.igual(r.presente, true);
      t.igual(r.pfn, 7);
      t.igual(r.dirFisica, 0xF0);
    });

    t.prueba('Traduce VPN 4 hacia PFN 2', () => {
      TablaMarcos.actualizar(4, {
        presente: 1,
        pfn: 2
      });

      const r = MMU.traducir(0x085);
      t.igual(r.vpn, 4);
      t.igual(r.offset, 5);
      t.igual(r.pfn, 2);
      t.igual(r.dirFisica, 0x45);
    });

    t.prueba('Respeta el desplazamiento', () => {
      const r = MMU.traducir(0x09F);
      t.igual(r.offset, 31);
      t.igual(r.dirFisica, 0x5F);
    });

    t.prueba('Rechaza direcciones invalidas', () => {
      t.lanzaError(() => MMU.traducir(-1));
      t.lanzaError(() => MMU.traducir(512));
      t.lanzaError(() => MMU.traducir(1.5));
      t.lanzaError(() => MMU.traducir('085'));
    });

    t.prueba('Muestra traduccion en panel y log', () => {
      const r = MMU.mostrarTraduccion(0x1F0);

      const ss = SpreadsheetApp.getActive();
      const tabla = ss.getSheetByName(
        HOJAS.TABLA_MARCOS
      );
      const log = ss.getSheetByName(HOJAS.LOG);

      t.igual(r.dirFisica, 0xF0);
      t.igual(tabla.getRange('H14').getValue(), 'F0h');
      t.igual(log.getRange('G4').getValue(), '1F0h');
      t.igual(log.getRange('L4').getValue(), 'F0h');
    });

  } finally {
    // Restaurar el estado de la pagina usada.
    TablaMarcos.actualizar(4, {
      presente: anterior.presente,
      pfn: anterior.pfn,
      dirty: anterior.dirty,
      ref: anterior.ref
    });
  }

  return t;
}
