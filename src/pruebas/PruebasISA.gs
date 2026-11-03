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
  t.prueba('la ISA tiene 92 instrucciones: 36 del Parcial 1 + 56 con CX y DX', () => {
    t.igual(TABLA_ISA_PARCIAL1_.length, 36);
    t.igual(TABLA_ISA.length, 92);
  });
  t.prueba('los opcodes del Parcial 1 no cambiaron', () => {
    TABLA_ISA_PARCIAL1_.forEach(e => t.igual(ISA.porOpcode(e.opcode), e));
    t.igual(ISA.porFirma('MOV', ['AX', 'BX']).opcode, 0x12);
    t.igual(ISA.porFirma('ADD', ['AX', 'BX']).opcode, 0x21);
    t.igual(ISA.porFirma('CMP', ['BX', 'AX']).opcode, 0x2F);
  });
  t.prueba('CX y DX tienen MOV, ADD, SUB, CMP, INC y DEC', () => {
    ['CX', 'DX'].forEach(r => {
      ['MOV', 'ADD', 'SUB', 'CMP'].forEach(m => {
        if (!ISA.porFirma(m, [r, 'INM'])) throw new Error('falta ' + m + ' ' + r + ', inm');
        ['AX', 'BX', 'CX', 'DX'].filter(o => o !== r).forEach(o => {
          if (!ISA.porFirma(m, [r, o])) throw new Error('falta ' + m + ' ' + r + ', ' + o);
          if (!ISA.porFirma(m, [o, r])) throw new Error('falta ' + m + ' ' + o + ', ' + r);
        });
      });
      ['INC', 'DEC'].forEach(m => { if (!ISA.porFirma(m, [r])) throw new Error('falta ' + m + ' ' + r); });
      if (!ISA.porFirma('LOAD', [r, 'MEM'])) throw new Error('falta LOAD ' + r);
      if (!ISA.porFirma('STORE', ['MEM', r])) throw new Error('falta STORE ' + r);
    });
  });
  t.prueba('opcodes nuevos: MOV CX,inm=18h · INC DX=61h · MOV CX,AX=78h · ADD DX,CX=8Eh · CMP AX,DX=A3h', () => {
    t.igual(ISA.porFirma('MOV', ['CX', 'INM']).opcode, 0x18);
    t.igual(ISA.porFirma('INC', ['DX']).opcode, 0x61);
    t.igual(ISA.porFirma('MOV', ['CX', 'AX']).opcode, 0x70 + 4 * 2 + 0);
    t.igual(ISA.porFirma('ADD', ['DX', 'CX']).opcode, 0x80 + 4 * 3 + 2);
    t.igual(ISA.porFirma('CMP', ['AX', 'DX']).opcode, 0xA0 + 4 * 0 + 3);
  });
  t.prueba('el rango 50h–5Fh queda reservado para E/S (ninguna instrucción lo usa)', () => {
    TABLA_ISA.forEach(e => { if (e.opcode >= 0x50 && e.opcode <= 0x5F) throw new Error('usa ' + UtilMemoria.aHex(e.opcode)); });
  });
  t.prueba('formatear con CX y DX', () => {
    t.igual(ISA.formatear(ISA.porFirma('MOV', ['CX', 'INM']), 5), 'MOV CX, 05h');
    t.igual(ISA.formatear(ISA.porFirma('STORE', ['MEM', 'DX']), 0x80), 'STORE [80h], DX');
    t.igual(ISA.formatear(ISA.porFirma('ADD', ['DX', 'CX'])), 'ADD DX, CX');
  });
  t.prueba('la tabla se escribe completa y ordenada por opcode en la hoja ISA', () => {
    ISA.escribirEnHoja();
    const hoja = SpreadsheetApp.getActive().getSheetByName(HOJAS.ISA);
    t.igual(hoja.getRange(3, 1).getDisplayValue(), '00');
    t.igual(hoja.getRange(2 + TABLA_ISA.length, 1).getDisplayValue(), UtilMemoria.aHex(TABLA_ISA[TABLA_ISA.length - 1].opcode));
    t.igual(hoja.getRange(3 + TABLA_ISA.length, 1).getDisplayValue(), '');
    for (let i = 1; i < TABLA_ISA.length; i++) if (TABLA_ISA[i].opcode <= TABLA_ISA[i - 1].opcode) throw new Error('desordenada en ' + i);
  });
  t.prueba('toda operación de ALU usada en la ISA existe en la ALU', () => {
    TABLA_ISA.filter(e => e.alu).forEach(e => {
      if (!OPERACIONES_ALU[e.alu]) throw new Error(e.alu + ' no existe en ALU_OPS');
    });
  });

  return t;
}
