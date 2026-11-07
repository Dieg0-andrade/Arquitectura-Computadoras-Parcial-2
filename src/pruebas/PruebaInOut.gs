function probarInOut() {
  const programa = [
    '.code',
    'IN AX, [KBD]',
    'OUT [LCD], AX',
    'HLT'
  ];

  function igual(actual, esperado, detalle) {
    if (actual !== esperado) {
      throw new Error(detalle + ': esperado [' + esperado + '], obtenido [' + actual + ']');
    }
  }

  const resultado = Ensamblador.ensamblar(programa);
  if (!resultado.ok) throw new Error(JSON.stringify(resultado.errores));

  const modoAnterior = MMU.estaActiva();
  try {
    // Esta demo carga su programa en RAM fisica desde 00h.
    MMU.activarMemoriaVirtual(false);
    Memoria.cargar(0, resultado.memoria);
    UnidadControl.reiniciar();
    Perifericos.teclado.reiniciar();
    igual(Perifericos.teclado.encolar('A'), true, 'Ingreso de A al teclado');

    let lecturas = 0;
    let escrituras = 0;

    for (let paso = 0; paso < 50 && !UnidadControl.estaDetenido(); paso++) {
      const evento = UnidadControl.paso();
      if (!evento || !evento.bus) continue;

      const bus = evento.bus;
      const senales = evento.palabra.senales;

      if (bus.origen === 'KBD') {
        igual(bus.destino, 'MDR', 'Destino de IN');
        igual(bus.direccion, 0xF0, 'Puerto KBD en MAR');
        igual(bus.valor, 0x41, 'Byte recibido');
        igual(senales.IO, 1, 'IO durante IN');
        igual(senales.Mem_R, 1, 'Lectura durante IN');
        igual(senales.En_KBD, 1, 'Salida del teclado');
        igual(senales.Ld_MDR, 1, 'Carga del MDR');
        lecturas++;
        Logger.log('IN: KBD -> MDR | MAR=F0h | byte=41h | IO=1 | En_KBD=1');
      }

      if (bus.destino === 'LCD') {
        igual(bus.origen, 'MDR', 'Origen de OUT');
        igual(bus.direccion, 0xF8, 'Puerto LCD en MAR');
        igual(bus.valor, 0x41, 'Byte enviado');
        igual(senales.IO, 1, 'IO durante OUT');
        igual(senales.Mem_W, 1, 'Escritura durante OUT');
        igual(senales.Ld_LCD, 1, 'Carga del LCD');
        igual(senales.En_MDR, 1, 'Salida del MDR');
        escrituras++;
        Logger.log('OUT: MDR -> LCD | MAR=F8h | byte=41h | IO=1 | Ld_LCD=1');
      }
    }

    igual(UnidadControl.estaDetenido(), true, 'CPU detenida por HLT');
    igual(lecturas, 1, 'Lecturas del teclado');
    igual(escrituras, 1, 'Escrituras al LCD');
    igual(Registros.leer('AX'), 0x41, 'Registro AX');
    igual(Perifericos.teclado.estado().contenido.length, 0, 'Teclado vacio');
    igual(Memoria.leer(0xF8), 0x41, 'Buffer de video');

    const hoja = SpreadsheetApp.getActive().getSheetByName(HOJAS.CACHE_IO);
    igual(hoja.getRange('K31').getDisplayValue(), 'A', 'Primera posicion del LCD');
    Logger.log('PASS: IN y OUT ejecutados por la CPU; AX=41h, LCD=A, HLT');
  } finally {
    MMU.activarMemoriaVirtual(modoAnterior);
  }
}