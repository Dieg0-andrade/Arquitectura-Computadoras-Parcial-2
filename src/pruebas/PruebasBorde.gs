/**
 * pruebas/PruebasBorde.gs
 * Casos borde ejecutados en el CPU completo (no solo en la ALU): desbordamiento,
 * cero, negativo en complemento a 2, ambas ramas de cada salto, HLT y el
 * programa demo (en ensamblador y en alto nivel). Restaura la RAM y la hoja Código al terminar.
 */

function probarBorde() {
  mostrarReporte_([suiteBorde_()]);
}

function suiteBorde_() {
  const t = crearSuite_('Casos borde');
  const correr = lineas => {
    const r = Ensamblador.ensamblar(lineas);
    if (!r.ok) throw new Error('no ensambla: ' + r.errores[0].mensaje);
    Memoria.cargar(0, r.memoria);
    UnidadControl.reiniciar();
    UnidadControl.ejecutarHastaDetener();
    return Registros.leerBanderas();
  };
  const hojaCodigo = SpreadsheetApp.getActive().getSheetByName(HOJAS.CODIGO);
  const respaldoRam = Memoria.volcar();
  const respaldoCodigo = hojaCodigo.getRange(4, 5, 100, 1).getDisplayValues();
  const respaldoAlto = hojaCodigo.getRange(4, 2, 100, 1).getDisplayValues();

  try {
    t.prueba('FFh + 1 = 00h con CF = 1 y ZF = 1 (desbordamiento sin signo)', () => {
      const f = correr(['MOV AX, 0FFh', 'ADD AX, 1', 'HLT']);
      t.igual(Registros.leer('AX'), 0);
      t.igual(f.CF, 1); t.igual(f.ZF, 1); t.igual(f.SF, 0);
    });
    t.prueba('7Fh + 1 = 80h con SF = 1 (−128 en complemento a 2)', () => {
      const f = correr(['MOV AX, 7Fh', 'INC AX', 'HLT']);
      t.igual(Registros.leer('AX'), 0x80);
      t.igual(f.SF, 1); t.igual(f.CF, 0);
    });
    t.prueba('3 − 5 = FEh (−2) con préstamo: CF = 1 y SF = 1', () => {
      const f = correr(['MOV AX, 3', 'SUB AX, 5', 'HLT']);
      t.igual(Registros.leer('AX'), 0xFE);
      t.igual(f.CF, 1); t.igual(f.SF, 1);
    });
    t.prueba('DEC de 00h da FFh', () => {
      correr(['MOV BX, 0', 'DEC BX', 'HLT']);
      t.igual(Registros.leer('BX'), 0xFF);
    });
    t.prueba('JZ no salta cuando ZF = 0', () => {
      correr(['MOV AX, 1', 'CMP AX, 2', 'JZ otro', 'MOV BX, 1', 'HLT', 'otro: MOV BX, 2', 'HLT']);
      t.igual(Registros.leer('BX'), 1);
    });
    t.prueba('JNZ repite un bucle hasta que el contador llega a 0', () => {
      correr(['MOV BX, 3', 'MOV AX, 0', 'vuelta: INC AX', 'DEC BX', 'JNZ vuelta', 'HLT']);
      t.igual(Registros.leer('AX'), 3);
      t.igual(Registros.leer('BX'), 0);
    });
    t.prueba('HLT detiene aunque haya instrucciones después', () => {
      correr(['HLT', 'MOV AX, 9']);
      t.igual(Registros.leer('AX'), 0);
      t.igual(UnidadControl.estaDetenido(), true);
    });
    t.prueba('multiplicación que desborda: 130 × 2 = 260 → 04h en 8 bits', () => {
      correr(PROGRAMA_DEMO.map(l => l.replace('DB 5 ', 'DB 130 ').replace('DB 3 ', 'DB 2 ')));
      t.igual(Memoria.leer(0x82), 4);
    });
    t.prueba('programa demo: 5 × 3 = 15 en RAM[82h]', () => {
      correr(PROGRAMA_DEMO);
      t.igual(Memoria.leer(0x82), 15);
      t.igual(Memoria.leer(0x81), 0);
    });
    t.prueba('el demo se escribe en la hoja Código y se carga en RAM', () => {
      const r = ProgramasDemo.cargar();
      t.igual(r.ok, true);
      t.igual(hojaCodigo.getRange(4, 5).getDisplayValue(), PROGRAMA_DEMO[0]);
      t.igual(Memoria.leer(0x80), 5);
      t.igual(Memoria.leer(0x81), 3);
    });
    t.prueba('el demo de alto nivel se compila y da el mismo resultado (15)', () => {
      const r = ProgramasDemo.cargarAlto();
      t.igual(r.ok, true);
      UnidadControl.ejecutarHastaDetener();
      t.igual(Memoria.leer(0x82), 15);
    });
  } finally {
    hojaCodigo.getRange(4, 2, 100, 1).setValues(respaldoAlto);
    Traza.guardarMapaAlto(null);
    hojaCodigo.getRange(4, 5, 100, 1).setValues(respaldoCodigo);
    UtilMemoria.rangoMatriz().setValues(UtilMemoria.aMatriz(respaldoRam));
    Simulacion.reiniciar();
  }

  return t;
}
