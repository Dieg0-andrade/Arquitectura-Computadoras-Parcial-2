/**
 * ISA.gs
 * Conjunto de instrucciones (ISA) del simulador. Esta tabla es la única
 * fuente de verdad: la usan el ensamblador (mnemónico -> bytes), el
 * decodificador de la Unidad de Control (opcode -> instrucción) y la hoja ISA.
 *
 * Formato de instrucción (1 o 2 bytes):
 *   byte 1: opcode
 *   byte 2: operando (dato inmediato o dirección), solo si bytes = 2
 *
 * Modos de direccionamiento:
 *   implícito  -> sin operandos (HLT)
 *   registro   -> los operandos son registros (MOV AX, BX)
 *   inmediato  -> el byte 2 es el dato (MOV AX, 05h)
 *   directo    -> el byte 2 es una dirección de memoria (LOAD AX, [80h])
 *   absoluto   -> el byte 2 es la dirección de salto (JMP 06h)
 *
 * Organización de los opcodes por grupos (nibble alto):
 *   0x -> control   1x -> transferencia   2x -> aritmética
 *   3x -> lógica    4x -> saltos
 *
 * Campos de cada entrada:
 *   opcode, mnemonico, operandos (texto), bytes, modo, descripcion
 *   destino  -> registro destino ('AX' | 'BX' | 'MEM' | null)
 *   origen  -> origen: 'AX' | 'BX' | 'INM' | 'MEM' | 'DIR' | null
 *   alu  -> operación de ALU que usa (o null)
 */

const TABLA_ISA = [
  // ── Control ──
  { opcode: 0x00, mnemonico: 'HLT',   operandos: '',         bytes: 1, modo: 'implícito', destino: null,  origen: null,   alu: null,  descripcion: 'Detiene el reloj del CPU' },

  // ── Transferencia de datos ──
  { opcode: 0x10, mnemonico: 'MOV',   operandos: 'AX, inm',  bytes: 2, modo: 'inmediato', destino: 'AX',  origen: 'INM',  alu: null,  descripcion: 'AX ← dato inmediato' },
  { opcode: 0x11, mnemonico: 'MOV',   operandos: 'BX, inm',  bytes: 2, modo: 'inmediato', destino: 'BX',  origen: 'INM',  alu: null,  descripcion: 'BX ← dato inmediato' },
  { opcode: 0x12, mnemonico: 'MOV',   operandos: 'AX, BX',   bytes: 1, modo: 'registro',  destino: 'AX',  origen: 'BX',   alu: null,  descripcion: 'AX ← BX' },
  { opcode: 0x13, mnemonico: 'MOV',   operandos: 'BX, AX',   bytes: 1, modo: 'registro',  destino: 'BX',  origen: 'AX',   alu: null,  descripcion: 'BX ← AX' },
  { opcode: 0x14, mnemonico: 'LOAD',  operandos: 'AX, [dir]', bytes: 2, modo: 'directo',  destino: 'AX',  origen: 'MEM',  alu: null,  descripcion: 'AX ← RAM[dir]' },
  { opcode: 0x15, mnemonico: 'LOAD',  operandos: 'BX, [dir]', bytes: 2, modo: 'directo',  destino: 'BX',  origen: 'MEM',  alu: null,  descripcion: 'BX ← RAM[dir]' },
  { opcode: 0x16, mnemonico: 'STORE', operandos: '[dir], AX', bytes: 2, modo: 'directo',  destino: 'MEM', origen: 'AX',   alu: null,  descripcion: 'RAM[dir] ← AX' },
  { opcode: 0x17, mnemonico: 'STORE', operandos: '[dir], BX', bytes: 2, modo: 'directo',  destino: 'MEM', origen: 'BX',   alu: null,  descripcion: 'RAM[dir] ← BX' },

  // ── Aritmética ──
  { opcode: 0x20, mnemonico: 'ADD',   operandos: 'AX, inm',  bytes: 2, modo: 'inmediato', destino: 'AX',  origen: 'INM',  alu: 'ADD', descripcion: 'AX ← AX + inm' },
  { opcode: 0x21, mnemonico: 'ADD',   operandos: 'AX, BX',   bytes: 1, modo: 'registro',  destino: 'AX',  origen: 'BX',   alu: 'ADD', descripcion: 'AX ← AX + BX' },
  { opcode: 0x22, mnemonico: 'ADD',   operandos: 'BX, inm',  bytes: 2, modo: 'inmediato', destino: 'BX',  origen: 'INM',  alu: 'ADD', descripcion: 'BX ← BX + inm' },
  { opcode: 0x23, mnemonico: 'ADD',   operandos: 'BX, AX',   bytes: 1, modo: 'registro',  destino: 'BX',  origen: 'AX',   alu: 'ADD', descripcion: 'BX ← BX + AX' },
  { opcode: 0x24, mnemonico: 'SUB',   operandos: 'AX, inm',  bytes: 2, modo: 'inmediato', destino: 'AX',  origen: 'INM',  alu: 'SUB', descripcion: 'AX ← AX − inm' },
  { opcode: 0x25, mnemonico: 'SUB',   operandos: 'AX, BX',   bytes: 1, modo: 'registro',  destino: 'AX',  origen: 'BX',   alu: 'SUB', descripcion: 'AX ← AX − BX' },
  { opcode: 0x26, mnemonico: 'SUB',   operandos: 'BX, inm',  bytes: 2, modo: 'inmediato', destino: 'BX',  origen: 'INM',  alu: 'SUB', descripcion: 'BX ← BX − inm' },
  { opcode: 0x27, mnemonico: 'SUB',   operandos: 'BX, AX',   bytes: 1, modo: 'registro',  destino: 'BX',  origen: 'AX',   alu: 'SUB', descripcion: 'BX ← BX − AX' },
  { opcode: 0x28, mnemonico: 'INC',   operandos: 'AX',       bytes: 1, modo: 'registro',  destino: 'AX',  origen: null,   alu: 'INC', descripcion: 'AX ← AX + 1' },
  { opcode: 0x29, mnemonico: 'INC',   operandos: 'BX',       bytes: 1, modo: 'registro',  destino: 'BX',  origen: null,   alu: 'INC', descripcion: 'BX ← BX + 1' },
  { opcode: 0x2A, mnemonico: 'DEC',   operandos: 'AX',       bytes: 1, modo: 'registro',  destino: 'AX',  origen: null,   alu: 'DEC', descripcion: 'AX ← AX − 1' },
  { opcode: 0x2B, mnemonico: 'DEC',   operandos: 'BX',       bytes: 1, modo: 'registro',  destino: 'BX',  origen: null,   alu: 'DEC', descripcion: 'BX ← BX − 1' },
  { opcode: 0x2C, mnemonico: 'CMP',   operandos: 'AX, inm',  bytes: 2, modo: 'inmediato', destino: 'AX',  origen: 'INM',  alu: 'CMP', descripcion: 'Banderas de AX − inm (no guarda)' },
  { opcode: 0x2D, mnemonico: 'CMP',   operandos: 'AX, BX',   bytes: 1, modo: 'registro',  destino: 'AX',  origen: 'BX',   alu: 'CMP', descripcion: 'Banderas de AX − BX (no guarda)' },
  { opcode: 0x2E, mnemonico: 'CMP',   operandos: 'BX, inm',  bytes: 2, modo: 'inmediato', destino: 'BX',  origen: 'INM',  alu: 'CMP', descripcion: 'Banderas de BX − inm (no guarda)' },
  { opcode: 0x2F, mnemonico: 'CMP',   operandos: 'BX, AX',   bytes: 1, modo: 'registro',  destino: 'BX',  origen: 'AX',   alu: 'CMP', descripcion: 'Banderas de BX − AX (no guarda)' },

  // ── Lógica ──
  { opcode: 0x30, mnemonico: 'AND',   operandos: 'AX, inm',  bytes: 2, modo: 'inmediato', destino: 'AX',  origen: 'INM',  alu: 'AND', descripcion: 'AX ← AX AND inm' },
  { opcode: 0x31, mnemonico: 'AND',   operandos: 'AX, BX',   bytes: 1, modo: 'registro',  destino: 'AX',  origen: 'BX',   alu: 'AND', descripcion: 'AX ← AX AND BX' },
  { opcode: 0x32, mnemonico: 'OR',    operandos: 'AX, inm',  bytes: 2, modo: 'inmediato', destino: 'AX',  origen: 'INM',  alu: 'OR',  descripcion: 'AX ← AX OR inm' },
  { opcode: 0x33, mnemonico: 'OR',    operandos: 'AX, BX',   bytes: 1, modo: 'registro',  destino: 'AX',  origen: 'BX',   alu: 'OR',  descripcion: 'AX ← AX OR BX' },
  { opcode: 0x34, mnemonico: 'XOR',   operandos: 'AX, inm',  bytes: 2, modo: 'inmediato', destino: 'AX',  origen: 'INM',  alu: 'XOR', descripcion: 'AX ← AX XOR inm' },
  { opcode: 0x35, mnemonico: 'XOR',   operandos: 'AX, BX',   bytes: 1, modo: 'registro',  destino: 'AX',  origen: 'BX',   alu: 'XOR', descripcion: 'AX ← AX XOR BX' },
  { opcode: 0x36, mnemonico: 'NOT',   operandos: 'AX',       bytes: 1, modo: 'registro',  destino: 'AX',  origen: null,   alu: 'NOT', descripcion: 'AX ← NOT AX' },
  { opcode: 0x37, mnemonico: 'NOT',   operandos: 'BX',       bytes: 1, modo: 'registro',  destino: 'BX',  origen: null,   alu: 'NOT', descripcion: 'BX ← NOT BX' },

  // ── Control de flujo ──
  { opcode: 0x40, mnemonico: 'JMP',   operandos: 'dir',      bytes: 2, modo: 'absoluto',  destino: null,  origen: 'DIR', alu: null,  descripcion: 'PC ← dir (salto incondicional)' },
  { opcode: 0x41, mnemonico: 'JZ',    operandos: 'dir',      bytes: 2, modo: 'absoluto',  destino: null,  origen: 'DIR', alu: null,  descripcion: 'Si ZF = 1: PC ← dir' },
  { opcode: 0x42, mnemonico: 'JNZ',   operandos: 'dir',      bytes: 2, modo: 'absoluto',  destino: null,  origen: 'DIR', alu: null,  descripcion: 'Si ZF = 0: PC ← dir' }
];

const ISA = {

  /** Busca por opcode (número). Devuelve la entrada o null si no existe. */
  porOpcode(opcode) {
    return INDICE_ISA_.porOpcode()[opcode] || null;
  },

  /**
   * Busca por firma: mnemónico + tipos de operandos, p. ej.
   * ISA.porFirma('ADD', ['AX', 'INM']) -> entrada de 20h.
   * Tipos: 'AX', 'BX', 'INM', 'MEM' (dirección entre corchetes), 'DIR'.
   */
  porFirma(mnemonico, tiposOp) {
    const clave = ISA.claveFirma(mnemonico, tiposOp);
    return INDICE_ISA_.porFirma()[clave] || null;
  },

  claveFirma(mnemonico, tiposOp) {
    return String(mnemonico).toUpperCase() + ' ' + (tiposOp || []).join(',');
  },

  /** Tipos de operandos de una entrada, en el orden en que se escriben. */
  tiposOperandos(entrada) {
    if (entrada.bytes === 1 && !entrada.origen && !entrada.destino) return [];
    if (entrada.origen === 'DIR') return ['DIR'];
    if (entrada.destino === 'MEM') return ['MEM', entrada.origen];
    if (!entrada.origen) return [entrada.destino];
    return [entrada.destino, entrada.origen];
  },

  /** Texto legible de una instrucción ya decodificada: "ADD AX, 05h". */
  formatear(entrada, operando) {
    const hex = v => UtilMemoria.aHex(v) + 'h';
    const texto = entrada.operandos
      .replace('inm', operando !== undefined ? hex(operando) : 'inm')
      .replace('[dir]', operando !== undefined ? '[' + hex(operando) + ']' : '[dir]')
      .replace(/^dir$/, operando !== undefined ? hex(operando) : 'dir');
    return (entrada.mnemonico + ' ' + texto).trim();
  },

  /** Escribe la tabla en la hoja ISA (a partir de la fila 3). */
  escribirEnHoja() {
    const hoja = SpreadsheetApp.getActive().getSheetByName(HOJAS.ISA);
    const filas = TABLA_ISA.map(e => [
      UtilMemoria.aHex(e.opcode), e.mnemonico, e.operandos || '—', e.bytes, e.modo, e.descripcion
    ]);
    hoja.getRange(3, 1, 200, 6).clearContent();
    hoja.getRange(3, 1, filas.length, 6).setValues(filas);
  },

  /** Verifica que no haya opcodes ni firmas repetidas. Lanza error si las hay. */
  validar() {
    const vistosOp = {}, vistasFirma = {};
    TABLA_ISA.forEach(e => {
      if (vistosOp[e.opcode]) throw new Error('Opcode repetido: ' + UtilMemoria.aHex(e.opcode));
      vistosOp[e.opcode] = true;
      const clave = ISA.claveFirma(e.mnemonico, ISA.tiposOperandos(e));
      if (vistasFirma[clave]) throw new Error('Firma repetida: ' + clave);
      vistasFirma[clave] = true;
      if (e.bytes !== 1 && e.bytes !== 2) throw new Error('Tamaño inválido en ' + clave);
    });
    return true;
  }
};

/** Índices construidos una sola vez (búsqueda O(1)). */
const INDICE_ISA_ = {
  cacheOp_: null,
  cacheFirma_: null,
  porOpcode() {
    if (!this.cacheOp_) {
      this.cacheOp_ = {};
      TABLA_ISA.forEach(e => { this.cacheOp_[e.opcode] = e; });
    }
    return this.cacheOp_;
  },
  porFirma() {
    if (!this.cacheFirma_) {
      this.cacheFirma_ = {};
      TABLA_ISA.forEach(e => { this.cacheFirma_[ISA.claveFirma(e.mnemonico, ISA.tiposOperandos(e))] = e; });
    }
    return this.cacheFirma_;
  }
};
