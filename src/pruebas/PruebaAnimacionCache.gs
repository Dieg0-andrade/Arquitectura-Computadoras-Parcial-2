function probarAnimacionCache() {
  const hoja = SpreadsheetApp.getActive().getSheetByName(HOJAS.CACHE_IO);
  const log = SpreadsheetApp.getActive().getSheetByName(HOJAS.LOG);

  if (!hoja || !log) {
    throw new Error('Faltan Cache_IO o Log en esta copia del simulador.');
  }

  const cacheAntes = Cache.cargarEstado_();
  const modoAntes = MMU.estaActiva();
  const rangoLog = log.getRange(FILA_INICIO_LOG, 1, 3, COLUMNAS_LOG);
  const logAntes = rangoLog.getValues();
  const pendientesAntes = LogMicroops.pendientes_;
  const baseAntes = VistaCacheActividad.anteriores_;
  const marAntes = Registros.leer('MAR');
  const mdrAntes = Registros.leer('MDR');

  const rangos = ['B6:I6', 'K6:R6', 'E12:L12', 'E14:L14',
    'E16:L16', 'E18:L18', 'B36'];

  const panelAntes = rangos.map(nombre => {
    const rango = hoja.getRange(nombre);
    return {
      rango: rango,
      valores: rango.getValues(),
      colores: rango.getBackgrounds()
    };
  });

  function igual(actual, esperado, mensaje) {
    if (actual !== esperado) {
      throw new Error(mensaje + ': esperado ' + esperado + ', obtenido ' + actual);
    }
  }

  function color(celda, esperado) {
    igual(
      hoja.getRange(celda).getBackground().toUpperCase(),
      esperado.toUpperCase(),
      'Color de ' + celda
    );
  }

  function lectura(paso, tipo) {
    const bus = Bus.transferir('RAM', 'MDR', undefined, tipo);

    LogMicroops.agregar({
      paso: paso,
      numeroInstruccion: 1,
      fase: 'PRUEBA',
      descripcion: 'RAM → MDR',
      detalle: Bus.describir(bus),
      bus: bus
    });

    LogMicroops.volcar();
    SpreadsheetApp.flush();

    const mensaje = hoja.getRange('B36').getDisplayValue();
    const detalle = LogMicroops.leerFila(paso)[4];
    if (!mensaje || !detalle.endsWith(mensaje)) {
      throw new Error('Panel y Log difieren en el paso ' + paso);
    }
    return mensaje;
  }

  try {
    LogMicroops.pendientes_ = [];
    MMU.activarMemoriaVirtual(false);
    Cache.reiniciar();
    Registros.escribir('MAR', 0);
    VistaCacheActividad.iniciar();

    const primero = lectura(1, 'I');
    igual(primero.includes('L1I MISS'), true, 'Primer acceso en L1I');
    igual(primero.includes('L2 MISS'), true, 'Primer acceso en L2');
    color('B6', VistaCacheActividad.MISS);
    color('E12', VistaCacheActividad.MISS);
    color('E18', VistaCacheActividad.MISS);

    const segundo = lectura(2, 'I');
    igual(segundo.includes('L1I HIT'), true, 'Segunda lectura en L1I');
    color('B6', VistaCacheActividad.HIT);
    color('E12', VistaCacheActividad.NEUTRO);

    const tercero = lectura(3, 'D');
    igual(tercero.includes('L1D MISS'), true, 'Primera lectura en L1D');
    igual(tercero.includes('L2 HIT'), true, 'Acierto en L2 compartida');
    color('K6', VistaCacheActividad.MISS);
    color('E12', VistaCacheActividad.HIT);
    color('E14', VistaCacheActividad.NEUTRO);

    const contadores = hoja.getRange('C24:D26').getValues();
    igual(JSON.stringify(contadores), '[[1,1],[0,1],[1,1]]', 'Contadores');

    Logger.log(primero);
    Logger.log(segundo);
    Logger.log(tercero);
    Logger.log('PASS: colores, líneas, contadores y Log sincronizados');
  } finally {
    LogMicroops.pendientes_ = pendientesAntes;
    VistaCacheActividad.anteriores_ = baseAntes;
    Cache.guardarEstado_(cacheAntes);
    VistaCache.actualizarContadores(cacheAntes.estadisticas);
    MMU.activarMemoriaVirtual(modoAntes);
    Registros.escribir('MAR', marAntes);
    Registros.escribir('MDR', mdrAntes);
    rangoLog.setValues(logAntes);

    panelAntes.forEach(item => {
      item.rango.setValues(item.valores);
      item.rango.setBackgrounds(item.colores);
    });
  }
}