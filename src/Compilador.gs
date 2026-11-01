/**
 * Compilador.gs
 * Compilador de un lenguaje de alto nivel sencillo a ensamblador del simulador.
 *
 *   fuente (hoja Código, col. B) → tokens → AST → ensamblador → (Ensamblador.gs) → RAM
 *
 * Gramática (una sentencia por línea; comentarios con //):
 *   programa    := sentencia*
 *   sentencia   := 'var' ID '=' NUM                      declaración (segmento de datos)
 *                | ID '=' expresion                      asignación
 *                | 'mientras' condicion '{' sentencia* '}'
 *                | 'si' condicion '{' sentencia* '}'
 *   expresion   := termino (('+' | '-') termino)*
 *   condicion   := expresion ('==' | '!=') termino
 *   termino     := NUM | ID
 *
 * Por qué solo == y !=: la ISA tiene JZ y JNZ, que dependen únicamente de ZF.
 *
 * Generación de código (AX = acumulador, BX = temporal):
 *   número  → MOV AX, n          variable  → LOAD AX, [v]
 *   a + n   → ADD AX, n          a + v     → LOAD BX, [v] · ADD AX, BX
 *   x = e   → (e en AX) · STORE [x], AX
 *   mientras c { … } → _mN: (c) · JZ/JNZ _fN · … · JMP _mN · _fN:
 *   si c { … }       → (c) · JZ/JNZ _sN · … · _sN:
 */

const PALABRAS_CLAVE = ['var', 'mientras', 'si'];

const Compilador = {

  /**
   * lineas: texto fuente (una entrada por línea).
   * Devuelve { ok, errores[{linea, mensaje}], tokens[], ast, astTexto[],
   *            ensamblador[{texto, lineaAlto}] }.
   */
  compilar(lineas) {
    const res = { ok: false, errores: [], tokens: [], ast: null, astTexto: [], ensamblador: [] };
    try {
      res.tokens = LexerAlto.tokenizar(lineas);
      res.ast = ParserAlto.analizar(res.tokens);
      res.astTexto = Compilador.astATexto(res.ast);
      res.ensamblador = GeneradorCodigo.generar(res.ast);
      res.ok = true;
    } catch (e) {
      res.errores.push({ linea: e.linea || 0, mensaje: e.message });
    }
    return res;
  },

  /** Árbol sintáctico como líneas de texto indentadas (para la hoja Compilador). */
  astATexto(nodo, nivel, salida) {
    nivel = nivel || 0;
    salida = salida || [];
    const sangria = '  '.repeat(nivel);
    const lin = n => (n.linea ? '  (L' + n.linea + ')' : '');
    switch (nodo.tipo) {
      case 'Programa':
        salida.push(sangria + 'Programa');
        nodo.cuerpo.forEach(s => Compilador.astATexto(s, nivel + 1, salida));
        break;
      case 'Declaracion':
        salida.push(sangria + 'Declaración ' + nodo.nombre + ' = ' + nodo.valor + lin(nodo));
        break;
      case 'Asignacion':
        salida.push(sangria + 'Asignación ' + nodo.nombre + lin(nodo));
        Compilador.astATexto(nodo.expresion, nivel + 1, salida);
        break;
      case 'Mientras':
      case 'Si':
        salida.push(sangria + (nodo.tipo === 'Si' ? 'Si' : 'Mientras') + lin(nodo));
        Compilador.astATexto(nodo.condicion, nivel + 1, salida);
        salida.push(sangria + '  Cuerpo');
        nodo.cuerpo.forEach(s => Compilador.astATexto(s, nivel + 2, salida));
        break;
      case 'Comparacion':
      case 'Binaria':
        salida.push(sangria + (nodo.tipo === 'Comparacion' ? 'Comparación ' : 'Operación ') + nodo.op);
        Compilador.astATexto(nodo.izq, nivel + 1, salida);
        Compilador.astATexto(nodo.der, nivel + 1, salida);
        break;
      case 'Numero':
        salida.push(sangria + 'Número ' + nodo.valor);
        break;
      case 'Variable':
        salida.push(sangria + 'Variable ' + nodo.nombre);
        break;
    }
    return salida;
  },

  /** Lee el programa de alto nivel de la hoja Código (columna B). */
  leerFuente() {
    const hoja = SpreadsheetApp.getActive().getSheetByName(HOJAS.CODIGO);
    return hoja.getRange(4, 2, 100, 1).getDisplayValues().map(f => f[0]);
  }
};

/** Error con número de línea. */
function errorCompilacion_(mensaje, linea) {
  const e = new Error('Línea ' + linea + ': ' + mensaje);
  e.linea = linea;
  return e;
}

// ── Análisis léxico ─────────────────────────────────────────────────

const LexerAlto = {

  tokenizar(lineas) {
    const tokens = [];
    const patron = /\s*(?:([0-9]+)(?![A-Za-z_])|([A-Za-z_][A-Za-z0-9_]*)|(==|!=|[=+\-{}])|(\S))/y;
    lineas.forEach((texto, i) => {
      const linea = i + 1;
      const codigo = String(texto === undefined || texto === null ? '' : texto).split('//')[0];
      patron.lastIndex = 0;
      let m;
      while (patron.lastIndex < codigo.length && (m = patron.exec(codigo)) !== null) {
        if (m[0].trim() === '') break;
        if (m[1] !== undefined) {
          const valor = parseInt(m[1], 10);
          if (valor > 255) throw errorCompilacion_('el número ' + valor + ' no cabe en 8 bits (máximo 255)', linea);
          tokens.push({ tipo: 'NUM', texto: m[1], valor: valor, linea: linea });
        } else if (m[2] !== undefined) {
          const palabra = m[2];
          tokens.push({ tipo: PALABRAS_CLAVE.indexOf(palabra) !== -1 ? 'CLAVE' : 'ID', texto: palabra, linea: linea });
        } else if (m[3] !== undefined) {
          tokens.push({ tipo: 'SIMBOLO', texto: m[3], linea: linea });
        } else {
          throw errorCompilacion_('carácter no reconocido "' + m[4] + '"', linea);
        }
      }
    });
    return tokens;
  }
};

// ── Análisis sintáctico (descenso recursivo) ────────────────────────

const ParserAlto = {

  analizar(tokens) {
    const p = { tokens: tokens, i: 0 };
    const cuerpo = [];
    while (p.i < tokens.length) cuerpo.push(ParserAlto.sentencia_(p));
    return { tipo: 'Programa', cuerpo: cuerpo };
  },

  actual_(p) { return p.tokens[p.i]; },

  ultimaLinea_(p) {
    const t = p.tokens[p.i] || p.tokens[p.tokens.length - 1];
    return t ? t.linea : 1;
  },

  esperar_(p, tipo, texto, descripcion) {
    const t = p.tokens[p.i];
    if (!t || t.tipo !== tipo || (texto && t.texto !== texto)) {
      const hallado = t ? '"' + t.texto + '"' : 'el final del programa';
      throw errorCompilacion_('se esperaba ' + descripcion + ' y se encontró ' + hallado, ParserAlto.ultimaLinea_(p));
    }
    p.i++;
    return t;
  },

  sentencia_(p) {
    const t = ParserAlto.actual_(p);
    if (t.tipo === 'CLAVE' && t.texto === 'var') {
      p.i++;
      const nombre = ParserAlto.esperar_(p, 'ID', null, 'un nombre de variable');
      ParserAlto.esperar_(p, 'SIMBOLO', '=', '"="');
      const valor = ParserAlto.esperar_(p, 'NUM', null, 'un número (valor inicial)');
      return { tipo: 'Declaracion', nombre: nombre.texto, valor: valor.valor, linea: t.linea };
    }
    if (t.tipo === 'CLAVE' && (t.texto === 'mientras' || t.texto === 'si')) {
      p.i++;
      const condicion = ParserAlto.condicion_(p);
      ParserAlto.esperar_(p, 'SIMBOLO', '{', '"{"');
      const cuerpo = [];
      while (ParserAlto.actual_(p) && !(ParserAlto.actual_(p).tipo === 'SIMBOLO' && ParserAlto.actual_(p).texto === '}')) {
        cuerpo.push(ParserAlto.sentencia_(p));
      }
      ParserAlto.esperar_(p, 'SIMBOLO', '}', '"}" para cerrar el bloque de la línea ' + t.linea);
      return { tipo: t.texto === 'si' ? 'Si' : 'Mientras', condicion: condicion, cuerpo: cuerpo, linea: t.linea };
    }
    if (t.tipo === 'ID') {
      p.i++;
      ParserAlto.esperar_(p, 'SIMBOLO', '=', '"=" después de ' + t.texto);
      return { tipo: 'Asignacion', nombre: t.texto, expresion: ParserAlto.expresion_(p), linea: t.linea };
    }
    throw errorCompilacion_('sentencia no válida: "' + t.texto + '"', t.linea);
  },

  expresion_(p) {
    let nodo = ParserAlto.termino_(p);
    let t = ParserAlto.actual_(p);
    while (t && t.tipo === 'SIMBOLO' && (t.texto === '+' || t.texto === '-')) {
      p.i++;
      nodo = { tipo: 'Binaria', op: t.texto, izq: nodo, der: ParserAlto.termino_(p) };
      t = ParserAlto.actual_(p);
    }
    return nodo;
  },

  condicion_(p) {
    const izq = ParserAlto.expresion_(p);
    const t = ParserAlto.actual_(p);
    if (!t || t.tipo !== 'SIMBOLO' || (t.texto !== '==' && t.texto !== '!=')) {
      throw errorCompilacion_('se esperaba "==" o "!=" en la condición', ParserAlto.ultimaLinea_(p));
    }
    p.i++;
    return { tipo: 'Comparacion', op: t.texto, izq: izq, der: ParserAlto.termino_(p) };
  },

  termino_(p) {
    const t = ParserAlto.actual_(p);
    if (t && t.tipo === 'NUM') { p.i++; return { tipo: 'Numero', valor: t.valor }; }
    if (t && t.tipo === 'ID') { p.i++; return { tipo: 'Variable', nombre: t.texto, linea: t.linea }; }
    const hallado = t ? '"' + t.texto + '"' : 'el final del programa';
    throw errorCompilacion_('se esperaba un número o una variable y se encontró ' + hallado, ParserAlto.ultimaLinea_(p));
  }
};

// ── Generación de código ────────────────────────────────────────────

const GeneradorCodigo = {

  /** AST → [{texto, lineaAlto}] con secciones .data y .code, terminando en HLT. */
  generar(ast) {
    const g = { salida: [], variables: {}, contador: 0 };
    const reservadas = GeneradorCodigo.reservadas_();

    // Declaraciones: se recorren primero para permitir usar variables en cualquier orden
    const declarar = sentencias => sentencias.forEach(s => {
      if (s.tipo === 'Declaracion') {
        if (reservadas[s.nombre.toUpperCase()] || s.nombre.charAt(0) === '_') {
          throw errorCompilacion_('"' + s.nombre + '" es un nombre reservado', s.linea);
        }
        if (g.variables[s.nombre]) throw errorCompilacion_('la variable ' + s.nombre + ' ya fue declarada', s.linea);
        g.variables[s.nombre] = s;
      }
      if (s.cuerpo) declarar(s.cuerpo);
    });
    declarar(ast.cuerpo);

    const emitir = (texto, lineaAlto) => g.salida.push({ texto: texto, lineaAlto: lineaAlto || null });
    emitir('.data');
    Object.keys(g.variables).forEach(n => emitir(n + ' DB ' + g.variables[n].valor, g.variables[n].linea));
    emitir('.code');
    GeneradorCodigo.bloque_(ast.cuerpo, g, emitir);
    emitir('HLT');
    return g.salida;
  },

  bloque_(sentencias, g, emitir) {
    sentencias.forEach(s => GeneradorCodigo.sentencia_(s, g, emitir));
  },

  sentencia_(s, g, emitir) {
    const L = s.linea;
    switch (s.tipo) {
      case 'Declaracion':
        return; // ya está en .data
      case 'Asignacion':
        GeneradorCodigo.variable_(s.nombre, g, L);
        GeneradorCodigo.expresion_(s.expresion, g, emitir, L);
        emitir('STORE [' + s.nombre + '], AX', L);
        return;
      case 'Mientras': {
        const n = ++g.contador;
        const inicio = g.salida.length;
        GeneradorCodigo.condicion_(s.condicion, g, emitir, L);
        g.salida[inicio].texto = '_m' + n + ': ' + g.salida[inicio].texto;
        emitir(GeneradorCodigo.saltoSalida_(s.condicion) + ' _f' + n, L);
        GeneradorCodigo.bloque_(s.cuerpo, g, emitir);
        emitir('JMP _m' + n, L);
        GeneradorCodigo.pegarEtiqueta_(g, emitir, '_f' + n);
        return;
      }
      case 'Si': {
        const n = ++g.contador;
        GeneradorCodigo.condicion_(s.condicion, g, emitir, L);
        emitir(GeneradorCodigo.saltoSalida_(s.condicion) + ' _s' + n, L);
        GeneradorCodigo.bloque_(s.cuerpo, g, emitir);
        GeneradorCodigo.pegarEtiqueta_(g, emitir, '_s' + n);
        return;
      }
    }
  },

  /** Salto que abandona el bloque cuando la condición es FALSA. */
  saltoSalida_(condicion) {
    return condicion.op === '!=' ? 'JZ' : 'JNZ';
  },

  /**
   * Coloca una etiqueta en la siguiente instrucción que se emita. Se usa
   * una línea propia "etiqueta:" (el ensamblador la asigna a la dirección
   * de la instrucción siguiente, que puede ser otra sentencia o el HLT final).
   */
  pegarEtiqueta_(g, emitir, etiqueta) {
    emitir(etiqueta + ':', null);
  },

  expresion_(e, g, emitir, L) {
    if (e.tipo === 'Numero') return emitir('MOV AX, ' + e.valor, L);
    if (e.tipo === 'Variable') {
      GeneradorCodigo.variable_(e.nombre, g, L);
      return emitir('LOAD AX, [' + e.nombre + ']', L);
    }
    // Binaria (asociativa a la izquierda: der siempre es un término)
    GeneradorCodigo.expresion_(e.izq, g, emitir, L);
    const op = e.op === '+' ? 'ADD' : 'SUB';
    GeneradorCodigo.operarConTermino_(op, e.der, g, emitir, L);
  },

  condicion_(c, g, emitir, L) {
    GeneradorCodigo.expresion_(c.izq, g, emitir, L);
    GeneradorCodigo.operarConTermino_('CMP', c.der, g, emitir, L);
  },

  operarConTermino_(op, t, g, emitir, L) {
    if (t.tipo === 'Numero') return emitir(op + ' AX, ' + t.valor, L);
    GeneradorCodigo.variable_(t.nombre, g, L);
    emitir('LOAD BX, [' + t.nombre + ']', L);
    emitir(op + ' AX, BX', L);
  },

  variable_(nombre, g, L) {
    if (!g.variables[nombre]) throw errorCompilacion_('la variable ' + nombre + ' no está declarada (usa: var ' + nombre + ' = 0)', L);
  },

  reservadas_() {
    const r = { AX: true, BX: true, DB: true, VAR: true, MIENTRAS: true, SI: true };
    TABLA_ISA.forEach(e => { r[e.mnemonico] = true; });
    return r;
  }
};
