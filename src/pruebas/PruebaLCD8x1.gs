function probarLCD8x1() {
  const lcd = Perifericos.lcd;
  const hoja = SpreadsheetApp.getActive().getSheetByName(HOJAS.CACHE_IO);
  const panel = hoja.getRange('K31:R31');
  const anterior = Array.from({ length: 8 }, (_, i) => Memoria.leer(lcd.BASE + i));
  const mar = Registros.leer('MAR');
  const mdr = Registros.leer('MDR');
  const ultimoBus = Registros.leerTexto('BUS_ULTIMO');
  const modoVirtual = MMU.estaActiva();

  function igual(actual, esperado, detalle) {
    if (actual !== esperado) {
      throw new Error(detalle + ': esperado [' + esperado + '], obtenido [' + actual + ']');
    }
  }

  try {
    MMU.activarMemoriaVirtual(true);
    const mensaje = 'HOLA CPU';

    for (let i = 0; i < mensaje.length; i++) {
      const byte = mensaje.charCodeAt(i);
      Registros.escribir('MAR', lcd.BASE + i);
      Registros.escribir('MDR', byte);

      const evento = Bus.transferir('MDR', 'LCD');
      igual(evento.palabra.senales.Ld_LCD, 1, 'Ld_LCD');
      igual(evento.buses.control.Write, 1, 'Write');
      igual(evento.buses.control.IO, 1, 'IO');
      igual(evento.buses.datosExterno.emisor, 'MDR', 'Emisor');
      igual(evento.buses.datosExterno.receptores.join(','), 'LCD', 'Destino');

      const lectura = AccesoMemoria.leer(0x1F8 + i, 'D');
      igual(lectura.info.dirFisica, lcd.BASE + i, 'Direccion fisica');
      igual(lectura.valor, byte, 'Byte de video en posicion ' + i);
    }

    igual(lcd.texto(), mensaje, 'Contenido del buffer');
    igual(panel.getDisplayValues()[0].join(''), mensaje, 'Ocho caracteres en el panel');
    Logger.log('MDR -> LCD: HOLA CPU | 1F8h-1FFh | Ld_LCD=1');

    // Una escritura virtual directa tambien debe refrescar solo su posicion.
    AccesoMemoria.escribir(0x1FF, 0x21);
    igual(lcd.texto(), 'HOLA CP!', 'Escritura en el ultimo byte');
    igual(panel.getDisplayValues()[0].join(''), 'HOLA CP!', 'Panel tras escritura virtual');
  } finally {
    anterior.forEach((byte, i) => lcd.escribir(i, byte));
    Registros.escribir('MAR', mar);
    Registros.escribir('MDR', mdr);
    Registros.escribirTexto('BUS_ULTIMO', ultimoBus);
    MMU.activarMemoriaVirtual(modoVirtual);
  }

  Logger.log('PASS: LCD 8x1, buffer de video, panel ASCII y bus Ld_LCD');
}