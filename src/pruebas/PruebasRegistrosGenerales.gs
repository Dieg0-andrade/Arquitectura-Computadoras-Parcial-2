/**
 * pruebas/PruebasRegistrosGenerales.gs
 * Pruebas de los 4 registros de propósito general (AX, BX, CX, DX) ejecutadas
 * en el CPU completo: MOV, LOAD, STORE, ADD, SUB, INC, DEC y CMP con CX y DX,
 * aritmética de 8 bits, banderas y resaltado. Restaura RAM y registros al terminar.
 */

function probarRegistrosGenerales() {
  mostrarReporte_([suiteRegistrosGenerales_()]);
}

function suiteRegistrosGenerales_() {
  const t = crearSuite_('Registros CX y DX');
  const respaldoRam = Memoria.volcar();
  const respaldoReg = Registros.instantanea();
  const color = c => String(c).toLowerCase();
  const reg = n => Registros.leer(n);
  const correr = lineas => {
    const r = Ensamblador.ensamblar(lineas);
    if (!r.ok) throw new Error('no ensambla: ' + r.errores[0].mensaje);
    Memoria.cargar(0, r.memoria);
    UnidadControl.reiniciar();
    UnidadControl.ejecutarHastaDetener();
    return Registros.leerBanderas();
  };

  try {
    t.prueba('MOV con dato inmediato: CX y DX', () => {
      correr(['MOV CX, 0A5h', 'MOV DX, 17', 'HLT']);
      t.igual(reg('CX'), 0xA5); t.igual(reg('DX'), 17);
    });
    t.prueba('MOV entre los cuatro registros (12 combinaciones, cada una con su opcode)', () => {
      const regs = ['AX', 'BX', 'CX', 'DX'];
      regs.forEach(d => regs.filter(s => s !== d).forEach(s => {
        correr(['MOV ' + s + ', 0x5B', 'MOV ' + d + ', 0', 'MOV ' + d + ', ' + s, 'HLT']);
        t.igual(reg(d), 0x5B);
        t.igual(reg(s), 0x5B);
      }));
    });
    t.prueba('ADD CX, DX y ADD DX, inm', () => {
      correr(['MOV CX, 10', 'MOV DX, 20', 'ADD CX, DX', 'ADD DX, 5', 'HLT']);
      t.igual(reg('CX'), 30); t.igual(reg('DX'), 25);
    });
    t.prueba('SUB entre registros y con inmediato', () => {
      correr(['MOV CX, 50', 'MOV AX, 8', 'SUB CX, AX', 'SUB DX, 0', 'HLT']);
      t.igual(reg('CX'), 42); t.igual(reg('DX'), 0);
    });
    t.prueba('INC y DEC sobre CX y DX', () => {
      correr(['MOV CX, 4', 'INC CX', 'INC CX', 'DEC DX', 'HLT']);
      t.igual(reg('CX'), 6); t.igual(reg('DX'), 0xFF);
    });
    t.prueba('8 bits: CX = FFh + 1 = 00h con CF = 1 y ZF = 1', () => {
      const f = correr(['MOV CX, 0FFh', 'INC CX', 'HLT']);
      t.igual(reg('CX'), 0); t.igual(f.CF, 1); t.igual(f.ZF, 1); t.igual(f.SF, 0);
    });
    t.prueba('8 bits: DX = 3 − 5 = FEh con préstamo (CF = 1) y SF = 1', () => {
      const f = correr(['MOV DX, 3', 'SUB DX, 5', 'HLT']);
      t.igual(reg('DX'), 0xFE); t.igual(f.CF, 1); t.igual(f.SF, 1);
    });
    t.prueba('8 bits: CX = 7Fh + 1 = 80h con SF = 1 (−128)', () => {
      const f = correr(['MOV CX, 7Fh', 'ADD CX, 1', 'HLT']);
      t.igual(reg('CX'), 0x80); t.igual(f.SF, 1); t.igual(f.CF, 0);
    });
    t.prueba('CMP no modifica el registro y actualiza las banderas', () => {
      let f = correr(['MOV CX, 9', 'CMP CX, 9', 'HLT']);
      t.igual(reg('CX'), 9); t.igual(f.ZF, 1);
      f = correr(['MOV CX, 2', 'MOV DX, 5', 'CMP CX, DX', 'HLT']);
      t.igual(reg('CX'), 2); t.igual(reg('DX'), 5); t.igual(f.ZF, 0); t.igual(f.CF, 1);
    });
    t.prueba('LOAD y STORE con CX y DX', () => {
      correr(['.data', 'a DB 33', 'b DB 0', '.code', 'LOAD CX, [a]', 'LOAD DX, [a]', 'INC DX', 'STORE [b], DX', 'HLT']);
      t.igual(reg('CX'), 33);
      t.igual(Memoria.leer(0x81), 34);
    });
    t.prueba('bucle con CX como contador: suma 5+4+3+2+1 = 15 en DX', () => {
      correr(['MOV CX, 5', 'MOV DX, 0', 'bucle: ADD DX, CX', 'DEC CX', 'JNZ bucle', 'HLT']);
      t.igual(reg('DX'), 15); t.igual(reg('CX'), 0);
    });
    t.prueba('los cuatro registros trabajan juntos sin pisarse', () => {
      correr(['MOV AX, 1', 'MOV BX, 2', 'MOV CX, 3', 'MOV DX, 4', 'ADD AX, DX', 'ADD BX, CX', 'HLT']);
      t.igual(reg('AX'), 5); t.igual(reg('BX'), 5); t.igual(reg('CX'), 3); t.igual(reg('DX'), 4);
    });
    t.prueba('resaltado: CX es destino (ámbar) y DX origen (celeste) en MOV CX, DX', () => {
      Resaltado.aplicar({ microop: { tipo: 'bus', origen: 'DX', destino: 'CX' }, fase: FASES.ALMACENAMIENTO, bus: null });
      t.igual(color(Resaltado.colorDe('CX')), color(COLORES.ACTIVO));
      t.igual(color(Resaltado.colorDe('DX')), color(COLORES.ORIGEN));
      Resaltado.limpiar();
      t.igual(color(Resaltado.colorDe('CX')), color(COLORES.REGISTRO));
    });
    t.prueba('el resumen del panel incluye cx y dx', () => {
      Registros.escribir('CX', 0x1C); Registros.escribir('DX', 0x2D);
      const r = Simulacion.resumen_(null);
      t.igual(r.cx, '1Ch'); t.igual(r.dx, '2Dh');
    });
    t.prueba('la hoja CPU tiene los rangos REG_CX y REG_DX', () => {
      const ss = SpreadsheetApp.getActive();
      t.igual(ss.getRangeByName(NOMBRES.CX) !== null, true);
      t.igual(ss.getRangeByName(NOMBRES.DX) !== null, true);
    });
  } finally {
    Resaltado.limpiar();
    UnidadControl.reiniciar();
    UtilMemoria.rangoMatriz().setValues(UtilMemoria.aMatriz(respaldoRam));
    LISTA_REGISTROS.forEach(r => Registros.escribir(r, respaldoReg[r]));
    Registros.escribirBanderas({ ZF: respaldoReg.ZF, CF: respaldoReg.CF, SF: respaldoReg.SF });
  }

  return t;
}
