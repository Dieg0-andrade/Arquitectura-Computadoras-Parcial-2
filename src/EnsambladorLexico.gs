/**
 * EnsambladorLexico.gs
 * Analizador léxico del ensamblador: convierte una línea de texto en tokens.
 *
 * Sintaxis aceptada (una instrucción por línea):
 *   .data / .code                  directivas de sección
 *   nombre DB 5                    variable en el segmento de datos
 *   bucle:                         definición de etiqueta
 *   MOV AX, 05h                    mnemónico + operandos separados por coma
 *   LOAD BX, [nombre]              corchetes = dirección de memoria
 *   ; comentario                   todo lo que sigue a ';' se ignora
 *
 * Números: decimal (15), hexadecimal con prefijo 0x (0x0F) o con sufijo h
 * empezando por dígito (0Fh, 0FFh). Se admiten negativos (-1 = FFh).
 */

const TIPO_TOKEN = {
  DIRECTIVA: 'DIRECTIVA',     // .data .code
  ETIQUETA: 'ETIQUETA',       // bucle:
  MNEMONICO: 'MNEMONICO',     // MOV ADD JZ ...
  REGISTRO: 'REGISTRO',       // AX BX
  DB: 'DB',                   // declaración de dato
  NUMERO: 'NUMERO',           // 15 0x0F 0Fh
  IDENTIFICADOR: 'IDENT',     // nombres de variables o etiquetas usadas
  CORCHETE_ABRE: '[',
  CORCHETE_CIERRA: ']',
  COMA: ','
};

const REGISTROS_ENSAMBLADOR = ['AX', 'BX'];

const LexerEnsamblador = {

  /**
   * Devuelve la lista de tokens de una línea: [{tipo, texto, valor?, linea}].
   * Lanza un error si encuentra un carácter que no reconoce.
   */
  tokenizar(texto, linea) {
    const codigo = String(texto === undefined || texto === null ? '' : texto).split(';')[0];
    const patron = /\s*(?:(\.[A-Za-z]+)|([A-Za-z_][A-Za-z0-9_]*):|(\[)|(\])|(,)|(-?0[xX][0-9A-Fa-f]+|-?[0-9][0-9A-Fa-f]*[hH]|-?[0-9]+)(?![A-Za-z0-9_])|([A-Za-z_][A-Za-z0-9_]*)|(\S))/y;
    const tokens = [];
    let m;
    while (patron.lastIndex < codigo.length && (m = patron.exec(codigo)) !== null) {
      if (m[0].trim() === '') break;
      if (m[1]) tokens.push({ tipo: TIPO_TOKEN.DIRECTIVA, texto: m[1].toLowerCase(), linea: linea });
      else if (m[2]) tokens.push({ tipo: TIPO_TOKEN.ETIQUETA, texto: m[2], linea: linea });
      else if (m[3]) tokens.push({ tipo: TIPO_TOKEN.CORCHETE_ABRE, texto: '[', linea: linea });
      else if (m[4]) tokens.push({ tipo: TIPO_TOKEN.CORCHETE_CIERRA, texto: ']', linea: linea });
      else if (m[5]) tokens.push({ tipo: TIPO_TOKEN.COMA, texto: ',', linea: linea });
      else if (m[6]) {
        const valor = LexerEnsamblador.parsearNumero(m[6]);
        if (valor === null) throw new Error('Número fuera de 8 bits: ' + m[6]);
        tokens.push({ tipo: TIPO_TOKEN.NUMERO, texto: m[6], valor: valor, linea: linea });
      }
      else if (m[7]) tokens.push(LexerEnsamblador.clasificarPalabra_(m[7], linea));
      else throw new Error('Carácter no reconocido: "' + m[8] + '"');
    }
    return tokens;
  },

  /** "15" -> 15, "0x0F" -> 15, "0Fh" -> 15, "-1" -> 255. Fuera de -128..255 -> null. */
  parsearNumero(texto) {
    let s = String(texto).trim().toUpperCase();
    let negativo = false;
    if (s.startsWith('-')) { negativo = true; s = s.slice(1); }
    let valor;
    if (s.startsWith('0X')) valor = parseInt(s.slice(2), 16);
    else if (s.endsWith('H')) valor = parseInt(s.slice(0, -1), 16);
    else valor = parseInt(s, 10);
    if (isNaN(valor)) return null;
    if (negativo) valor = -valor;
    if (valor < -128 || valor > 255) return null;
    return valor & 0xFF;
  },

  /** Conjunto de mnemónicos válidos, tomado de la tabla ISA. */
  mnemonicos() {
    const conjunto = {};
    TABLA_ISA.forEach(e => { conjunto[e.mnemonico] = true; });
    return conjunto;
  },

  clasificarPalabra_(palabra, linea) {
    const mayus = palabra.toUpperCase();
    if (REGISTROS_ENSAMBLADOR.indexOf(mayus) !== -1) return { tipo: TIPO_TOKEN.REGISTRO, texto: mayus, linea: linea };
    if (mayus === 'DB') return { tipo: TIPO_TOKEN.DB, texto: 'DB', linea: linea };
    if (LexerEnsamblador.mnemonicos()[mayus]) return { tipo: TIPO_TOKEN.MNEMONICO, texto: mayus, linea: linea };
    return { tipo: TIPO_TOKEN.IDENTIFICADOR, texto: palabra, linea: linea };
  }
};
