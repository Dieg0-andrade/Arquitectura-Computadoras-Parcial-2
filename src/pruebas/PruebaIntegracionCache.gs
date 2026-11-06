function probarIntegracionCache() {
  const tabla = TablaMarcos.rango_();
  const filas = tabla.getValues();
  const modoAnterior = MMU.estaActiva();
  const cacheAnterior = Cache.cargarEstado_();
  const byteAnterior = Memoria.leer(0x25);
  const panel = SpreadsheetApp.getActive().getSheetByName(HOJAS.CACHE_IO);

  if (!panel) {
    throw new Error('Falta la hoja Cache_IO. Prepará tu copia del libro.');
  }

  function verificar(obtenido, esperado, mensaje) {
    if (JSON.stringify(obtenido) !== JSON.stringify(esperado)) {
      throw new Error(
        mensaje + ': esperado ' + JSON.stringify(esperado) +
        ', obtenido ' + JSON.stringify(obtenido)
      );
    }
  }

  try {
    // VPN 8 → PFN 1. Así, la dirección virtual 105h se traduce a la física 25h.
    const mapa = filas.map((fila, vpn) => [vpn, 0, '', 0, 0]);
    mapa[8] = [8, 1, 1, 0, 0];
    mapa[15] = [15, 1, 7, 0, 0];

    tabla.setValues(mapa);
    MMU.activarMemoriaVirtual(true);
    Memoria.escribir(0x25, 0x31);
    Cache.reiniciar();

    const primero = AccesoMemoria.leer(0x105, 'D');
    verificar(
      [primero.valor, primero.info.dirFisica, primero.info.hitL1, primero.info.hitL2],
      [0x31, 0x25, false, false],
      'Traducción y lectura fría'
    );

    const segundo = AccesoMemoria.leer(0x105, 'D').info;
    verificar([segundo.hitL1, segundo.hitL2], [true, null], 'Hit en L1D');

    const instr = AccesoMemoria.leer(0x105, 'I').info;
    verificar([instr.hitL1, instr.hitL2], [false, true], 'Hit en L2 compartida');

    AccesoMemoria.escribir(0x105, 0xA7);
    verificar(Memoria.leer(0x25), 0xA7, 'Write-through');
    verificar(AccesoMemoria.leer(0x105, 'I').valor, 0xA7, 'Coherencia de L1I');
    verificar(TablaMarcos.obtener(8).dirty, 1, 'Dirty');

    const io = AccesoMemoria.leer(0x1F0, 'D').info;
    verificar([io.hitL1, io.hitL2], [null, null], 'E/S sin caché');

    let codigo = '';
    try {
      AccesoMemoria.leer(0x120, 'D');
    } catch (e) {
      codigo = e.codigo;
    }
    verificar(codigo, 'PAGE_FAULT', 'Página ausente');

    const c = Cache.contadores();
    const valores = [[1, 1], [2, 1], [1, 1]];

    verificar(
      [c.L1I, c.L1D, c.L2].map(n => [n.h, n.m]),
      valores,
      'Motor'
    );

    SpreadsheetApp.flush();
    verificar(panel.getRange('C24:D26').getValues(), valores, 'Panel Hit/Miss');
    Logger.log('Contadores L1I 1/1 | L1D 2/1 | L2 1/1');

    verificar(
      panel.getRange('E24:E26').getValues().map(f => Math.round(100 * f[0])),
      [50, 67, 50],
      'Hit Rate en la hoja'
    );

    Logger.log('PASS: integración MMU, caché y RAM');
  } finally {
    Memoria.escribir(0x25, byteAnterior);
    tabla.setValues(filas);
    MMU.activarMemoriaVirtual(modoAnterior);
    Cache.guardarEstado_(cacheAnterior);
    VistaCache.actualizarContadores(cacheAnterior.estadisticas);
  }
}