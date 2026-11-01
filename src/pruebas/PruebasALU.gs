/**
 * pruebas/PruebasALU.gs
 * Pruebas de la ALU. Casi todos usan ALU.calcular (función pura), así que no
 * dependen de la hoja. El último prueba ALU.ciclo sobre los registros.
 */

function probarALU() {
  mostrarReporte_([suiteALU_()]);
}

function suiteALU_() {
  const t = crearSuite_('ALU');
  const verificar = (salida, resultado, ZF, CF, SF) => {
    t.igual(salida.resultado, resultado); t.igual(salida.ZF, ZF); t.igual(salida.CF, CF); t.igual(salida.SF, SF);
  };

  // ── Aritmética ──
  t.prueba('ADD 5 + 3 = 8, sin banderas', () => verificar(ALU.calcular('ADD', 5, 3), 8, 0, 0, 0));
  t.prueba('ADD 200 + 100 = 44 con acarreo (CF=1)', () => verificar(ALU.calcular('ADD', 200, 100), 44, 0, 1, 0));
  t.prueba('ADD FFh + 01h = 00h (ZF=1, CF=1)', () => verificar(ALU.calcular('ADD', 0xFF, 1), 0, 1, 1, 0));
  t.prueba('ADD 7Fh + 01h = 80h (SF=1)', () => verificar(ALU.calcular('ADD', 0x7F, 1), 0x80, 0, 0, 1));
  t.prueba('SUB 5 − 5 = 0 (ZF=1)', () => verificar(ALU.calcular('SUB', 5, 5), 0, 1, 0, 0));
  t.prueba('SUB 3 − 5 = FEh (−2), SF=1 y CF=1 por préstamo', () => verificar(ALU.calcular('SUB', 3, 5), 0xFE, 0, 1, 1));
  t.prueba('INC FFh = 00h (ZF=1, CF=1)', () => verificar(ALU.calcular('INC', 0xFF), 0, 1, 1, 0));
  t.prueba('DEC 01h = 00h (ZF=1)', () => verificar(ALU.calcular('DEC', 1), 0, 1, 0, 0));
  t.prueba('DEC 00h = FFh (SF=1, CF=1)', () => verificar(ALU.calcular('DEC', 0), 0xFF, 0, 1, 1));
  t.prueba('conSigno: FEh = −2, 7Fh = 127', () => { t.igual(ALU.conSigno(0xFE), -2); t.igual(ALU.conSigno(0x7F), 127); });

  // ── Lógica y comparación ──
  t.prueba('AND F0h, 3Ch = 30h', () => verificar(ALU.calcular('AND', 0xF0, 0x3C), 0x30, 0, 0, 0));
  t.prueba('OR 0Fh, F0h = FFh (SF=1)', () => verificar(ALU.calcular('OR', 0x0F, 0xF0), 0xFF, 0, 0, 1));
  t.prueba('XOR AAh, AAh = 00h (ZF=1)', () => verificar(ALU.calcular('XOR', 0xAA, 0xAA), 0, 1, 0, 0));
  t.prueba('NOT 0Fh = F0h (SF=1)', () => verificar(ALU.calcular('NOT', 0x0F), 0xF0, 0, 0, 1));
  t.prueba('CMP 7, 7 → ZF=1 y no guarda el resultado', () => {
    const salida = ALU.calcular('CMP', 7, 7);
    t.igual(salida.ZF, 1); t.igual(salida.guardar, false);
  });
  t.prueba('CMP 2, 9 → CF=1 (2 < 9)', () => t.igual(ALU.calcular('CMP', 2, 9).CF, 1));

  // ── Errores ──
  t.prueba('rechaza operación desconocida y operandos fuera de 8 bits', () => {
    t.lanzaError(() => ALU.calcular('MUL', 1, 2));
    t.lanzaError(() => ALU.calcular('ADD', 256, 1));
  });

  // ── Integración con la hoja ──
  const respaldo = Registros.instantanea();
  try {
    t.prueba('ciclo: REN1=FFh, REN2=01h, ADD → resultado 00h y banderas en la hoja', () => {
      Registros.escribir('REN1', 0xFF);
      Registros.escribir('REN2', 0x01);
      ALU.ciclo('ADD');
      t.igual(Registros.leer('RESULTADO_ALU'), 0);
      t.igual(Registros.leerTexto('OP_ALU'), 'ADD');
      const f = Registros.leerBanderas();
      t.igual(f.ZF, 1); t.igual(f.CF, 1); t.igual(f.SF, 0);
    });
  } finally {
    LISTA_REGISTROS.forEach(r => Registros.escribir(r, respaldo[r]));
    Registros.escribirBanderas({ ZF: respaldo.ZF, CF: respaldo.CF, SF: respaldo.SF });
  }

  return t;
}
