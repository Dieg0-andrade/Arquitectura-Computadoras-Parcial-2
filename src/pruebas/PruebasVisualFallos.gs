
/**
 * PruebasVisualFallos.gs
 * Issue #17 - Visualizacion y contadores Page Fault.
 */

function probarVisualFallos() {
  mostrarReporte_([suiteVisualFallos_()]);
}

function suiteVisualFallos_() {
  const t = crearSuite_('Visualizacion Page Fault');

  const ss = SpreadsheetApp.getActive();
  const tabla = TablaMarcos.rango_();
  const hojaTabla = ss.getSheetByName(HOJAS.TABLA_MARCOS);
  const hojaRam = ss.getSheetByName(HOJAS.RAM);
  const hojaLog = ss.getSheetByName(HOJAS.LOG);

  const respaldoTabla = tabla.getValues();
  const respaldoRam = Memoria.volcar();

  const coloresTabla = hojaTabla.getRange('B4:E19');
  const respaldoColoresTabla = coloresTabla.getBackgrounds();
  const coloresRam = UtilMemoria.rangoMatriz();
  const respaldoColoresRam = coloresRam.getBackgrounds();

  const panel = hojaTabla.getRange('G16:H18');
  const respaldoPanel = panel.getValues();
  const contadores = hojaTabla.getRange('H23:H25');
  const respaldoContadores = contadores.getValues();
  const log = hojaLog.getRange('G16:J17');
  const respaldoLog = log.getValues();

  const politicaAnterior = ManejadorFallos.politica();
  const modoAnterior = MMU.estaActiva();
  const cacheAnterior = Cache.cargarEstado_();

  const props = PropertiesService.getDocumentProperties();
  const historialAnterior = props.getProperty(
    ManejadorFallos.CLAVE_ESTADO
  );

  function escenario() {
    MMU.activarMemoriaVirtual(false);

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
    ManejadorFallos.reiniciar();
    Cache.reiniciar();
  }

  try {
    t.prueba('Page Fault resalta VPN en rojo', () => {
      escenario();

      ManejadorFallos.resolver(3);

      t.igual(
        hojaTabla.getRange('B7').getBackground(),
        '#ffcdd2'
      );
    });

    t.prueba('Resalta el marco fisico de destino', () => {
      escenario();

      const r = ManejadorFallos.resolver(3);

      t.igual(r.pfnAsignado, 0);

      t.igual(
        hojaRam.getRange('C4').getBackground(),
        '#ffd54f'
      );

      t.igual(
        hojaTabla.getRange('H17').getValue(),
        'PFN 0'
      );
    });

    t.prueba('Cuenta fallos sin desalojos', () => {
      escenario();

      ManejadorFallos.resolver(2);
      ManejadorFallos.resolver(3);

      t.igual(hojaTabla.getRange('H23').getValue(), 2);
      t.igual(hojaTabla.getRange('H24').getValue(), 0);
    });

    t.prueba('Cuenta desalojos con RAM llena', () => {
      escenario();

      for (let vpn = 0; vpn < 7; vpn++) {
        ManejadorFallos.resolver(vpn);
      }

      const r = ManejadorFallos.resolver(8);

      t.igual(r.victima, 0);
      t.igual(hojaTabla.getRange('H23').getValue(), 8);
      t.igual(hojaTabla.getRange('H24').getValue(), 1);
      t.igual(TablaMarcos.obtener(15).pfn, 7);
    });

    t.prueba('Pagina presente no incrementa fallos', () => {
      escenario();

      ManejadorFallos.resolver(2);
      ManejadorFallos.resolver(2);

      t.igual(hojaTabla.getRange('H23').getValue(), 1);
      t.igual(hojaTabla.getRange('H24').getValue(), 0);
    });

    t.prueba('Reiniciar limpia los contadores', () => {
      escenario();

      ManejadorFallos.resolver(2);
      ManejadorFallos.reiniciar();

      t.igual(hojaTabla.getRange('H23').getValue(), 0);
      t.igual(hojaTabla.getRange('H24').getValue(), 0);
      t.igual(hojaTabla.getRange('H25').getValue(), '—');
    });

    t.prueba('Actualiza el ultimo resaltado', () => {
      escenario();

      ManejadorFallos.resolver(0);
      ManejadorFallos.resolver(1);

      t.igual(
        hojaTabla.getRange('B4').getBackground(),
        '#ffffff'
      );

      t.igual(
        hojaTabla.getRange('B5').getBackground(),
        '#ffcdd2'
      );

      t.igual(
        hojaRam.getRange('C4').getBackground(),
        '#e3f2fd'
      );

      t.igual(
        hojaRam.getRange('C6').getBackground(),
        '#ffd54f'
      );
    });

  } finally {
    MMU.activarMemoriaVirtual(false);

    tabla.setValues(respaldoTabla);
    UtilMemoria.rangoMatriz().setValues(
      UtilMemoria.aMatriz(respaldoRam)
    );

    coloresTabla.setBackgrounds(respaldoColoresTabla);
    coloresRam.setBackgrounds(respaldoColoresRam);

    panel.setValues(respaldoPanel);
    contadores.setValues(respaldoContadores);
    log.setValues(respaldoLog);

    Cache.guardarEstado_(cacheAnterior);

    ManejadorFallos.seleccionarPolitica(politicaAnterior);

    if (historialAnterior === null) {
      props.deleteProperty(ManejadorFallos.CLAVE_ESTADO);
    } else {
      props.setProperty(
        ManejadorFallos.CLAVE_ESTADO,
        historialAnterior
      );
    }

    MMU.activarMemoriaVirtual(modoAnterior);
  }

  return t;
}
