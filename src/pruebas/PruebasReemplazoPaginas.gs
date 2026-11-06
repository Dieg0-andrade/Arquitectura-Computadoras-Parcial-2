
/**
 * PruebasReemplazoPaginas.gs
 * Issue #16: FIFO, LRU, Dirty y cache.
 */

function probarReemplazoPaginas() {
  mostrarReporte_([suiteReemplazoPaginas_()]);
}

function suiteReemplazoPaginas_() {
  const t = crearSuite_('Reemplazo FIFO/LRU');

  const ss = SpreadsheetApp.getActive();
  const tabla = TablaMarcos.rango_();
  const respaldoTabla = tabla.getValues();
  const respaldoRam = Memoria.volcar();

  const rangoSwap = Swap.asegurarHoja()
    .getRange(4, 3, 32, 16);
  const respaldoSwap = rangoSwap.getValues();

  const hojaTabla = ss.getSheetByName(HOJAS.TABLA_MARCOS);
  const hojaLog = ss.getSheetByName(HOJAS.LOG);

  const panel = hojaTabla.getRange('G16:H18');
  const respaldoPanel = panel.getValues();
  const log = hojaLog.getRange('G16:J17');
  const respaldoLog = log.getValues();

  const colores = hojaTabla.getRange(4, 2, 16, 4);
  const respaldoColores = colores.getBackgrounds();

    const contadores = hojaTabla.getRange('H23:H25');
  const respaldoContadores = contadores.getValues();

  const coloresRam = UtilMemoria.rangoMatriz();
  const respaldoColoresRam = coloresRam.getBackgrounds();

  const politicaAnterior = ManejadorFallos.politica();
  const cacheAnterior = Cache.cargarEstado_();
  const modoAnterior = MMU.estaActiva();

  const props = PropertiesService.getDocumentProperties();
  const estadoAnterior = props.getProperty(
    ManejadorFallos.CLAVE_ESTADO
  );

  // Prepara siete marcos ocupados (VPN 0-6).
  function escenarioLleno() {
    MMU.activarMemoriaVirtual(false);

    const filas = [];

    for (let vpn = 0; vpn < 16; vpn++) {
      filas.push([
        vpn,
        vpn < 7 || vpn === 15 ? 1 : 0,
        vpn < 7 ? vpn : (vpn === 15 ? 7 : ''),
        0,
        0
      ]);
    }

    tabla.setValues(filas);
    ManejadorFallos.reiniciar();

    for (let vpn = 0; vpn < 7; vpn++) {
      ManejadorFallos.registrarCarga(vpn);
    }

    Cache.reiniciar();
  }

  try {
    t.prueba('FIFO es la politica predeterminada', () => {
      escenarioLleno();

      t.igual(ManejadorFallos.politica(), 'FIFO');

      const r = ManejadorFallos.resolver(8);

      t.igual(r.victima, 0);
      t.igual(r.pfnAsignado, 0);
      t.igual(r.escribioSwap, false);
      t.igual(TablaMarcos.obtener(0).presente, 0);
      t.igual(TablaMarcos.obtener(8).pfn, 0);
    });

    t.prueba('LRU conserva la pagina mas reciente', () => {
      escenarioLleno();

      ManejadorFallos.seleccionarPolitica('LRU');
      MMU.activarMemoriaVirtual(true);

      // VPN 0 era la mas antigua, pero la usamos.
      AccesoMemoria.leer(0, 'D');

      const r = ManejadorFallos.resolver(8);

      t.igual(r.victima, 1);
      t.igual(r.pfnAsignado, 1);
      t.igual(TablaMarcos.obtener(0).presente, 1);
      t.igual(TablaMarcos.obtener(0).ref, 1);
    });

    t.prueba('Dirty Write-Back guarda cambios en Swap', () => {
      escenarioLleno();

      MMU.activarMemoriaVirtual(true);

      // Modificar VPN 0 en el desplazamiento 3.
      AccesoMemoria.escribir(3, 0xAB);

      t.igual(TablaMarcos.obtener(0).dirty, 1);

      const r = ManejadorFallos.resolver(8);

      t.igual(r.victima, 0);
      t.igual(r.escribioSwap, true);
      t.igual(Swap.leerPagina(0)[3], 0xAB);

      const antigua = TablaMarcos.obtener(0);
      const nueva = TablaMarcos.obtener(8);

      t.igual(antigua.presente, 0);
      t.igual(antigua.dirty, 0);
      t.igual(antigua.ref, 0);
      t.igual(nueva.dirty, 0);
      t.igual(nueva.ref, 0);
    });

    t.prueba('Pagina limpia no se escribe en Swap', () => {
      escenarioLleno();

      Swap.escribirPagina(
        0, new Array(32).fill(0x44)
      );

      Memoria.escribir(2, 0x77);

      const r = ManejadorFallos.resolver(8);

      t.igual(r.escribioSwap, false);
      t.igual(Swap.leerPagina(0)[2], 0x44);
    });

    t.prueba('Invalida cache al reemplazar marco', () => {
      escenarioLleno();

      Cache.acceder('I', 0, false);
      Cache.acceder('D', 0, false);

      const antes = Cache.cargarEstado_();

      t.igual(antes.L1I !== null, true);
      t.igual(antes.L1D !== null, true);

      ManejadorFallos.resolver(8);

      const despues = Cache.cargarEstado_();

      t.igual(despues.L1I, null);
      t.igual(despues.L1D, null);

      t.igual(
        despues.L2.every(linea =>
          linea === null || linea.base >= 32
        ),
        true
      );
    });

    t.prueba('Lectura y escritura actualizan Ref y Dirty', () => {
      escenarioLleno();

      MMU.activarMemoriaVirtual(true);

      AccesoMemoria.leer(0x22, 'D');

      t.igual(TablaMarcos.obtener(1).ref, 1);
      t.igual(TablaMarcos.obtener(1).dirty, 0);

      AccesoMemoria.escribir(0x23, 0x66);

      t.igual(TablaMarcos.obtener(1).ref, 1);
      t.igual(TablaMarcos.obtener(1).dirty, 1);
    });

    t.prueba('Protege PFN 7 y valida las politicas', () => {
      escenarioLleno();

      t.lanzaError(() =>
        ManejadorFallos.seleccionarPolitica('RANDOM')
      );

      ManejadorFallos.seleccionarPolitica('LRU');
      t.igual(ManejadorFallos.politica(), 'LRU');

      const r = ManejadorFallos.resolver(8);

      t.igual(r.victima !== 15, true);
      t.igual(TablaMarcos.obtener(15).presente, 1);
      t.igual(TablaMarcos.obtener(15).pfn, 7);
    });

  } finally {
    MMU.activarMemoriaVirtual(false);

    tabla.setValues(respaldoTabla);

    UtilMemoria.rangoMatriz().setValues(
      UtilMemoria.aMatriz(respaldoRam)
    );

    rangoSwap.setValues(respaldoSwap);

    panel.setValues(respaldoPanel);
    log.setValues(respaldoLog);
    colores.setBackgrounds(respaldoColores);

    contadores.setValues(respaldoContadores);
    coloresRam.setBackgrounds(respaldoColoresRam);

    Cache.guardarEstado_(cacheAnterior);

    if (estadoAnterior === null) {
      props.deleteProperty(ManejadorFallos.CLAVE_ESTADO);
    } else {
      props.setProperty(
        ManejadorFallos.CLAVE_ESTADO,
        estadoAnterior
      );
    }

    ManejadorFallos.seleccionarPolitica(
      politicaAnterior
    );

    MMU.activarMemoriaVirtual(modoAnterior);
  }

  return t;
}
