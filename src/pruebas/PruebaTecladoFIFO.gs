function probarTecladoFIFO() {
  const k = Perifericos.teclado;
  const indicesAntes = k.indices_();
  const bytesAntes = Array.from({ length: 8 }, (_, i) => Memoria.leer(k.BASE + i));
  const mdrAntes = Registros.leer('MDR');
  const modoAntes = MMU.estaActiva();
  const cacheAntes = Cache.cargarEstado_();
  const hoja = SpreadsheetApp.getActive().getSheetByName(HOJAS.CACHE_IO);

  function igual(actual, esperado, mensaje) {
    if (JSON.stringify(actual) !== JSON.stringify(esperado)) {
      throw new Error(mensaje + ': esperado ' + JSON.stringify(esperado) +
        ', obtenido ' + JSON.stringify(actual));
    }
  }

  try {
    k.reiniciar();
    MMU.activarMemoriaVirtual(true);
    const contadoresAntes = Cache.contadores();

    for (const letra of 'ABCDEFGH') {
      igual(k.encolar(letra), true, 'Encolar ' + letra);
    }

    igual(k.encolar('X'), false, 'Rechazar el noveno carácter');
    igual(k.estado().longitud, 8, 'Longitud de la cola llena');

    // 1F0h virtual → F0h física. Inspeccionar RAM no consume la cola.
    const lectura = AccesoMemoria.leer(0x1F0, 'D');
    igual(lectura.valor, 65, 'ASCII de A en memoria mapeada');
    igual(lectura.info.dirFisica, 0xF0, 'Traducción del teclado');
    igual([lectura.info.hitL1, lectura.info.hitL2], [null, null], 'E/S sin caché');

    // Una transferencia del dispositivo sí consume el primer carácter.
    const evento = Bus.transferir('KBD', 'MDR');
    igual(evento.valor, 65, 'El bus transporta A');
    igual(Registros.leer('MDR'), 65, 'MDR recibe A');
    igual(evento.palabra.senales.En_KBD, 1, 'Señal En_KBD');
    igual(evento.buses.emisor, 'KBD', 'El teclado conduce el bus');
    igual(evento.buses.control.IO, 1, 'Señal IO');

    igual(k.encolar('I'), true, 'Reutilizar la posición liberada');
    igual(Memoria.leer(0xF0), 73, 'I ocupa físicamente el lugar de A');

    const esperado = Array.from('BCDEFGHI', letra => letra.charCodeAt(0));
    igual(k.estado().contenido, esperado, 'Orden lógico tras la vuelta circular');

    if (!hoja) throw new Error('Falta la hoja Cache_IO');
    igual(
      hoja.getRange('B31:I31').getDisplayValues()[0],
      esperado.map(UtilMemoria.aHex),
      'Panel FIFO'
    );

    const salida = [];
    for (let i = 0; i < 8; i++) salida.push(k.desencolar());
    igual(salida, esperado, 'Orden de salida');
    igual(k.desencolar(), 0, 'Lectura con cola vacía');
    igual(Cache.contadores(), contadoresAntes, 'Contadores de caché');

    Logger.log('FIFO: ABCDEFGH → sale A por KBD → entra I → sale BCDEFGHI');
    Logger.log('PASS: teclado FIFO de 8 bytes, RAM mapeada, panel y En_KBD');
  } finally {
    for (let i = 0; i < 8; i++) {
      Memoria.escribir(k.BASE + i, bytesAntes[i]);
    }
    k.guardar_(indicesAntes);
    k.mostrar_(indicesAntes);
    Registros.escribir('MDR', mdrAntes);
    MMU.activarMemoriaVirtual(modoAntes);
    Cache.guardarEstado_(cacheAntes);
    VistaCache.actualizarContadores(cacheAntes.estadisticas);
  }
}