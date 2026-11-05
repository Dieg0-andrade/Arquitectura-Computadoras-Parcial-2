
/**
 * ManejadorFallos.gs
 * Issue #13: cargar paginas ausentes desde Swap.
 * Usa solamente marcos libres; no reemplaza paginas.
 */
const ManejadorFallos = {

  resolver(vpn) {
    TablaMarcos.validarVPN_(vpn);

    const pagina = TablaMarcos.obtener(vpn);

    // Si ya esta en RAM, no hay que cargarla otra vez.
    if (pagina.presente === 1) {
      return {
        pfnAsignado: pagina.pfn,
        victima: null,
        escribioSwap: false
      };
    }

    // Consultar todos los marcos ocupados.
    const filas = TablaMarcos.rango_().getValues();
    const ocupados = new Set();

    filas.forEach(fila => {
      if (Number(fila[1]) === 1) {
        ocupados.add(Number(fila[2]));
      }
    });

    // PFN 7 esta reservado para entrada/salida.
    let libre = null;
    for (let pfn = 0; pfn < 7; pfn++) {
      if (!ocupados.has(pfn)) {
        libre = pfn;
        break;
      }
    }

    if (libre === null) {
      throw new Error(
        'PAGE FAULT: sin marcos libres para VPN ' + vpn
      );
    }

    // Leer primero la pagina completa desde Swap.
    const bytes = Swap.leerPagina(vpn);

    if (bytes.length !== 32) {
      throw new Error('Pagina Swap incompleta');
    }

    // Evitar datos antiguos en la cache.
    Cache.invalidarPagina(libre);

    // Cargar los 32 bytes en el marco seleccionado.
    Memoria.cargar(libre * 32, bytes);

    // Registrar la nueva asignacion.
    TablaMarcos.actualizar(vpn, {
      presente: 1,
      pfn: libre,
      dirty: 0,
      ref: 0
    });

    // Resaltar la pagina que produjo el fallo.
    const ss = SpreadsheetApp.getActive();
    const tabla = ss.getSheetByName(HOJAS.TABLA_MARCOS);

    tabla.getRange(4 + vpn, 2, 1, 4)
      .setBackground('#FFF59D');

    tabla.getRange('G16:H18').setValues([
      ['PAGE FAULT', 'VPN ' + vpn],
      ['Marco cargado', 'PFN ' + libre],
      ['Origen', 'Swap -> RAM']
    ]);

    // Registrar el fallo fuera del log de CPU (A:E).
    const log = ss.getSheetByName(HOJAS.LOG);

    log.getRange('G16:J16').setValues([[
      'Evento', 'VPN', 'PFN', 'Resultado'
    ]]);

    log.getRange('G17:J17').setValues([[
      'PAGE FAULT', vpn, libre, 'CARGADA'
    ]]);

    Logger.log(
      'PAGE FAULT VPN=' + vpn +
      ' -> PFN=' + libre +
      ' (32 bytes desde Swap)'
    );

    return {
      pfnAsignado: libre,
      victima: null,
      escribioSwap: false
    };
  }
};
