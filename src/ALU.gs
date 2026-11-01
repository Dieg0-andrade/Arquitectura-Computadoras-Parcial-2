/**
 * ALU.gs
 * Unidad Aritmético-Lógica de 8 bits.
 *
 * ALU.calcular(op, a, b) es una función pura: recibe la operación y los dos
 * operandos (REN1 = a, REN2 = b) y devuelve el resultado de 8 bits y las
 * banderas. No toca la hoja, por eso se puede probar de forma aislada.
 *
 * ALU.ciclo(op) es la versión "hardware": lee REN1 y REN2 de la hoja, pone
 * la operación en C.OP, calcula y escribe el resultado y el R. Estado.
 *
 * Reglas de banderas:
 *   ZF = 1 si el resultado (8 bits) es 0
 *   SF = bit 7 del resultado (1 = negativo en complemento a 2)
 *   CF = ADD/INC: 1 si la suma pasa de FFh (acarreo)
 *        SUB/DEC/CMP: 1 si a < b (préstamo)
 *        AND/OR/XOR/NOT: siempre 0
 *   Nota: a diferencia de x86, aquí INC/DEC y NOT sí actualizan CF. Se eligió
 *   así para que todas las operaciones sigan una regla simple y uniforme.
 *
 * CMP calcula a - b solo para las banderas: guardar = false indica que el
 * resultado no se guarda en el registro destino.
 */

const OPERACIONES_ALU = {
  ADD: { aridad: 2, guardar: true },
  SUB: { aridad: 2, guardar: true },
  INC: { aridad: 1, guardar: true },
  DEC: { aridad: 1, guardar: true },
  CMP: { aridad: 2, guardar: false },
  AND: { aridad: 2, guardar: true },
  OR:  { aridad: 2, guardar: true },
  XOR: { aridad: 2, guardar: true },
  NOT: { aridad: 1, guardar: true }
};

const ALU = {

  /** Función pura: (op, a, b) -> {resultado, ZF, CF, SF, guardar}. */
  calcular(op, a, b) {
    const especificacion = OPERACIONES_ALU[op];
    if (!especificacion) throw new Error('Operación de ALU desconocida: ' + op);
    UtilMemoria.validarByte(a);
    if (especificacion.aridad === 2) UtilMemoria.validarByte(b);

    let crudo, acarreo;
    switch (op) {
      case 'ADD': crudo = a + b; acarreo = crudo > 0xFF; break;
      case 'INC': crudo = a + 1; acarreo = crudo > 0xFF; break;
      case 'SUB':
      case 'CMP': crudo = a - b; acarreo = a < b; break;
      case 'DEC': crudo = a - 1; acarreo = a < 1; break;
      case 'AND': crudo = a & b; acarreo = false; break;
      case 'OR':  crudo = a | b; acarreo = false; break;
      case 'XOR': crudo = a ^ b; acarreo = false; break;
      case 'NOT': crudo = ~a; acarreo = false; break;
    }

    const resultado = crudo & 0xFF;   // se recorta a 8 bits (también convierte negativos a C2)
    return {
      resultado: resultado,
      ZF: resultado === 0 ? 1 : 0,
      CF: acarreo ? 1 : 0,
      SF: (resultado >> 7) & 1,
      guardar: especificacion.guardar
    };
  },

  /**
   * Ciclo de la ALU sobre la hoja: C.OP ← op, lee REN1/REN2, escribe el
   * resultado y el R. Estado. Devuelve el mismo objeto que compute().
   */
  ciclo(op) {
    const a = Registros.leer('REN1');
    const b = Registros.leer('REN2');
    const salida = ALU.calcular(op, a, b);
    Registros.escribirTexto('OP_ALU', op);
    Registros.escribir('RESULTADO_ALU', salida.resultado);
    Registros.escribirBanderas({ ZF: salida.ZF, CF: salida.CF, SF: salida.SF });
    return salida;
  },

  /** Interpreta un byte como entero con signo en complemento a 2 (-128..127). */
  conSigno(valor) {
    return valor > 127 ? valor - 256 : valor;
  }
};
