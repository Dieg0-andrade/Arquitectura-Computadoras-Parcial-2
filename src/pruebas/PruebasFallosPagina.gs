
/**
 * PruebasFallosPagina.gs
 * Issue #13: Page Fault y reintento de microoperaciones.
 */

function probarFallosPagina() {
  mostrarReporte_([suiteFallosPagina_()]);
}

function suiteFallosPagina_() {
  const t = crearSuite_('Page Fault');

  const tabla = TablaMarcos.rango_();
  const respaldoTabla = tabla.getValues();
  const respaldoRam = Memoria.volcar();
  const respaldoSwap0 = Swap.leerPagina(0);
  const respaldoSwap2 = Swap.leerPagina(2);
  const modoAnterior = MMU.estaActiva();

  const ss = SpreadsheetApp.getActive();
  const hojaTabla = ss.getSheetByName(HOJAS.TABLA_MARCOS);
  const hojaLog = ss.getSheetByName(HOJAS.LOG);

  const respaldoPanel = hojaTabla.getRange('G16:H18').getValues();
  const respaldoLog = hojaLog.getRange('G16:J17').getValues();
  const rangoColores = hojaTabla.getRange(4, 2, 16, 4);
  const respaldoColores = rangoColores.getBackgrounds();

  function limpiarEscenario() {
    const filas = [];

    for (let vpn = 0; vpn < 16; vpn++) {
      filas.push([
        vpn,
        vpn === 15 ? 1 : 0,
        vpn === 15 ? 7 : '',
        0,
        0
      ]);
    }

    tabla.setValues(filas);
    MMU.activarMemoriaVirtual(false);
    Cache.reiniciar();
  }

  try {
    t.prueba('Detecta una pagina ausente', () => {
      limpiarEscenario();

      const r = MMU.traducir(0x45);
      t.igual(r.vpn, 2);
      t.igual(r.presente, false);
      t.igual(r.dirFisica, null);
    });

    t.prueba('Carga 32 bytes desde Swap a RAM', () => {
      limpiarEscenario();

      const bytes = Array.from(
        { length: 32 },
        (_, i) => (i * 7) & 255
      );

      Swap.escribirPagina(2, bytes);

      const r = MMU.manejarFalloDePagina(2);

      t.igual(r.pfnAsignado, 0);
      t.igual(Memoria.leer(0), bytes[0]);
      t.igual(Memoria.leer(31), bytes[31]);
      t.igual(TablaMarcos.obtener(2).presente, 1);
      t.igual(TablaMarcos.obtener(2).pfn, 0);
    });

    t.prueba('No vuelve a cargar una pagina presente', () => {
      limpiarEscenario();

      Swap.escribirPagina(2, new Array(32).fill(34));
      MMU.manejarFalloDePagina(2);

      Memoria.escribir(0, 0xAA);
      MMU.manejarFalloDePagina(2);

      t.igual(Memoria.leer(0), 0xAA);
    });

    t.prueba('Asigna marcos libres diferentes', () => {
      limpiarEscenario();

      const a = MMU.manejarFalloDePagina(1);
      const b = MMU.manejarFalloDePagina(2);

      t.igual(a.pfnAsignado, 0);
      t.igual(b.pfnAsignado, 1);
      t.igual(TablaMarcos.obtener(15).pfn, 7);
    });

    t.prueba('Rechaza cuando no hay marcos libres', () => {
      limpiarEscenario();

      for (let i = 0; i < 7; i++) {
        TablaMarcos.actualizar(i, {
          presente: 1,
          pfn: i
        });
      }

      t.lanzaError(() =>
        MMU.manejarFalloDePagina(10)
      );

      t.igual(TablaMarcos.obtener(10).presente, 0);
      t.igual(TablaMarcos.obtener(15).pfn, 7);
    });

    t.prueba('Registra y resalta el Page Fault', () => {
      limpiarEscenario();

      MMU.manejarFalloDePagina(2);

      t.igual(
        hojaLog.getRange('G17').getValue(),
        'PAGE FAULT'
      );

      t.igual(
        hojaLog.getRange('H17').getValue(),
        2
      );

      t.igual(
        hojaTabla.getRange('B6').getBackground(),
        '#fff59d'
      );
    });

    t.prueba('Reintenta sin avanzar el PC', () => {
      limpiarEscenario();

      const programa = Ensamblador.ensamblar([
        'MOV AX, 7',
        'HLT'
      ]);

      if (!programa.ok) {
        throw new Error('No se pudo ensamblar');
      }

      Swap.escribirPagina(
        0,
        programa.memoria.slice(0, 32)
      );

      MMU.activarMemoriaVirtual(true);
      UnidadControl.reiniciar();

      // Primer paso: MAR <- PC.
      UnidadControl.paso();
      const pcAntes = Registros.leer('PC');

      // Segundo paso: Page Fault al leer RAM.
      const fallo = UnidadControl.paso();

      t.igual(fallo.falloPagina, true);
      t.igual(Registros.leer('PC'), pcAntes);
      t.igual(TablaMarcos.obtener(0).presente, 1);

      // Tercer paso: reintento de la misma lectura.
      const reintento = UnidadControl.paso();

      t.igual(reintento.microop.origen, 'RAM');
      t.igual(Registros.leer('PC'), pcAntes);
      t.igual(
        Registros.leer('MDR'),
        programa.memoria[0]
      );

      // Continuar hasta ejecutar HLT.
      UnidadControl.ejecutarHastaDetener();

      t.igual(Registros.leer('AX'), 7);
      t.igual(UnidadControl.estaDetenido(), true);
    });

  } finally {
    MMU.activarMemoriaVirtual(false);

    tabla.setValues(respaldoTabla);
    UtilMemoria.rangoMatriz().setValues(
      UtilMemoria.aMatriz(respaldoRam)
    );

    Swap.escribirPagina(0, respaldoSwap0);
    Swap.escribirPagina(2, respaldoSwap2);

    hojaTabla.getRange('G16:H18')
      .setValues(respaldoPanel);

    hojaLog.getRange('G16:J17')
      .setValues(respaldoLog);

    rangoColores.setBackgrounds(respaldoColores);

    Cache.reiniciar();
    UnidadControl.reiniciar();

    MMU.activarMemoriaVirtual(modoAnterior);
  }

  return t;
}
