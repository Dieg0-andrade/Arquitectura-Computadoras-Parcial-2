/**
 * pruebas/PruebasISA.gs
 * Pruebas de la tabla de instrucciones: unicidad, búsquedas y formato.
 */

function probarISA() {
  mostrarReporte_([suiteISA_()]);
}

function suiteISA_() {
  const t = crearSuite_('ISA');

  t.prueba('no hay opcodes ni firmas repetidas', () => t.igual(ISA.validar(), true));
  t.prueba('incluye todas las instrucciones mínimas del enunciado', () => {
    ['MOV', 'LOAD', 'STORE', 'ADD', 'SUB', 'INC', 'DEC', 'CMP', 'JMP', 'JZ', 'JNZ', 'HLT'].forEach(m => {
      if (!TABLA_ISA.some(e => e.mnemonico === m)) throw new Error('falta ' + m);
    });
  });
  t.prueba('porOpcode(20h) es ADD AX, inm de 2 bytes', () => {
    const e = ISA.porOpcode(0x20);
    t.igual(e.mnemonico, 'ADD'); t.igual(e.operandos, 'AX, inm'); t.igual(e.bytes, 2);
  });
  t.prueba('porOpcode de un código inexistente devuelve null', () => t.igual(ISA.porOpcode(0xFF), null));
  t.prueba('porFirma encuentra cada modo', () => {
    t.igual(ISA.porFirma('MOV', ['AX', 'BX']).opcode, 0x12);
    t.igual(ISA.porFirma('LOAD', ['AX', 'MEM']).opcode, 0x14);
    t.igual(ISA.porFirma('STORE', ['MEM', 'BX']).opcode, 0x17);
    t.igual(ISA.porFirma('INC', ['BX']).opcode, 0x29);
    t.igual(ISA.porFirma('JNZ', ['DIR']).opcode, 0x42);
    t.igual(ISA.porFirma('HLT', []).opcode, 0x00);
  });
  t.prueba('formatear arma el texto con el operando', () => {
    t.igual(ISA.formatear(ISA.porOpcode(0x20), 5), 'ADD AX, 05h');
    t.igual(ISA.formatear(ISA.porOpcode(0x16), 0x80), 'STORE [80h], AX');
    t.igual(ISA.formatear(ISA.porOpcode(0x40), 0x06), 'JMP 06h');
    t.igual(ISA.formatear(ISA.porOpcode(0x00)), 'HLT');
  });
  t.prueba('toda operación de ALU usada en la ISA existe en la ALU', () => {
    TABLA_ISA.filter(e => e.alu).forEach(e => {
      if (!OPERACIONES_ALU[e.alu]) throw new Error(e.alu + ' no existe en ALU_OPS');
    });
  });

  return t;
}
