/**
 * pruebas/PruebasBus.gs
 * Pruebas del bus: reproduce los pasos 1 a 3 de la fase de búsqueda del
 * diagrama de clase (PC → MAR, RAM[MAR] → MDR, MDR → IR).
 */

function probarBus() {
  mostrarReporte_([suiteBus_()]);
}

function suiteBus_() {
  const t = crearSuite_('Bus');
  const respaldoReg = Registros.instantanea();
  const respaldoRam = Memoria.volcar();

  try {
    t.prueba('búsqueda: PC → MAR, RAM[MAR] → MDR, MDR → IR', () => {
      Memoria.escribir(0x06, 0x23);
      Registros.escribir('PC', 0x06);
      Bus.transferir('PC', 'MAR');
      Bus.transferir('RAM', 'MDR');
      Bus.transferir('MDR', 'IR');
      t.igual(Registros.leer('MAR'), 0x06);
      t.igual(Registros.leer('MDR'), 0x23);
      t.igual(Registros.leer('IR'), 0x23);
    });
    t.prueba('escritura: MDR → RAM[MAR]', () => {
      Registros.escribir('MAR', 0x80);
      Registros.escribir('MDR', 0x0F);
      Bus.transferir('MDR', 'RAM');
      t.igual(Memoria.leer(0x80), 0x0F);
    });
    t.prueba('INM → REN2 carga una constante', () => {
      Bus.transferir('INM', 'REN2', 1);
      t.igual(Registros.leer('REN2'), 1);
    });
    t.prueba('guarda la última transferencia en la hoja CPU', () => {
      Registros.escribir('AX', 0x2A);
      Bus.transferir('AX', 'REN1');
      t.igual(Registros.leerTexto('BUS_ULTIMO'), 'AX → REN1 (2Ah)');
    });
    t.prueba('avisa a los suscriptores', () => {
      let visto = null;
      Bus.suscribir(e => { visto = e; });
      Bus.transferir('AX', 'BX');
      Bus.limpiarSuscriptores();
      t.igual(visto.origen, 'AX'); t.igual(visto.destino, 'BX'); t.igual(visto.valor, 0x2A);
    });
    t.prueba('rechaza orígenes/destinos inválidos', () => {
      t.lanzaError(() => Bus.transferir('AX', 'AX'));
      t.lanzaError(() => Bus.transferir('AX', 'INM'));
      t.lanzaError(() => Bus.transferir('EX', 'AX'));
    });
  } finally {
    Bus.limpiarSuscriptores();
    UtilMemoria.rangoMatriz().setValues(UtilMemoria.aMatriz(respaldoRam));
    LISTA_REGISTROS.forEach(r => Registros.escribir(r, respaldoReg[r]));
    Registros.escribirBanderas({ ZF: respaldoReg.ZF, CF: respaldoReg.CF, SF: respaldoReg.SF });
  }

  return t;
}
