/**
 * Ensamblador.gs
 * Ensamblador de dos pasadas: texto en ensamblador -> bytes en memoria.
 *
 *   Primera pasada: recorre las líneas, calcula la dirección de cada
 *     instrucción (código desde 00h) y de cada variable (datos desde 80h)
 *     y arma la tabla de símbolos. Hace falta porque un salto puede usar
 *     una etiqueta que se define más abajo (JNZ bucle antes de "bucle:").
 *   Segunda pasada: con todas las direcciones conocidas, genera los bytes
 *     (opcode + operando) usando la tabla ISA.
 *
 * Ensamblador.ensamblar(lineas) devuelve:
 *   { ok, errores[{linea, mensaje}], simbolos[{nombre, tipo, direccion}],
 *     listado[{direccion, bytes[], fuente, linea}], memoria: number[256],
 *     tokens[{linea, tipo, texto}] }
 * No toca la hoja: es una función pura y se puede probar de forma aislada.
 */

const SALTOS = ['JMP', 'JZ', 'JNZ'];

const Ensamblador = {

  ensamblar(lineas) {
    const res = {
      ok: false, errores: [], simbolos: [], listado: [], tokens: [],
      memoria: new Array(MAPA_MEMORIA.TAMANO).fill(0)
    };
    const error = (linea, mensaje) => res.errores.push({ linea: linea, mensaje: mensaje });

    // ── Análisis de cada línea ─────────────────────────────────────
    const sentencias = [];
    lineas.forEach((texto, i) => {
      const linea = i + 1;
      try {
        const tokens = LexerEnsamblador.tokenizar(texto, linea);
        tokens.forEach(t => res.tokens.push({ linea: linea, tipo: t.tipo, texto: t.texto }));
        const s = Ensamblador.analizarLinea_(tokens, linea);
        if (s) { s.fuente = String(texto).split(';')[0].trim(); sentencias.push(s); }
      } catch (e) {
        error(linea, e.message);
      }
    });

    // ── Primera pasada: direcciones y tabla de símbolos ────────────
    const tabla = {};
    let seccion = 'code';
    let dirCodigo = MAPA_MEMORIA.CODIGO_INICIO;
    let dirDatos = MAPA_MEMORIA.DATOS_INICIO;

    const definir = (nombre, tipo, direccion, linea) => {
      if (tabla[nombre]) return error(linea, 'Símbolo duplicado: ' + nombre);
      tabla[nombre] = { nombre: nombre, tipo: tipo, direccion: direccion };
    };

    sentencias.forEach(s => {
      if (s.directiva) { seccion = s.directiva === '.data' ? 'data' : 'code'; return; }

      if (seccion === 'data') {
        if (s.mnemonico) return error(s.linea, 'Instrucción dentro de .data: ' + s.mnemonico);
        if (s.etiqueta && !s.dato) return error(s.linea, 'En .data se esperaba "nombre DB valor"');
        if (s.dato) {
          definir(s.dato.nombre, 'variable', dirDatos, s.linea);
          s.direccion = dirDatos;
          dirDatos += s.dato.valores.length;
          if (dirDatos - 1 > MAPA_MEMORIA.DATOS_FIN) error(s.linea, 'El segmento de datos pasa de FFh');
        }
        return;
      }

      if (s.dato) return error(s.linea, 'DB solo se permite dentro de .data');
      if (s.etiqueta) definir(s.etiqueta, 'etiqueta', dirCodigo, s.linea);
      if (s.mnemonico) {
        s.entrada = ISA.porFirma(s.mnemonico, s.operandos.map(o => o.tipo));
        if (!s.entrada) {
          const firma = s.operandos.map(o => o.tipo).join(', ');
          return error(s.linea, 'Operandos no válidos para ' + s.mnemonico + (firma ? ' (' + firma + ')' : ' (sin operandos)'));
        }
        s.direccion = dirCodigo;
        dirCodigo += s.entrada.bytes;
        if (dirCodigo - 1 > MAPA_MEMORIA.CODIGO_FIN) error(s.linea, 'El programa pasa de 7Fh (segmento de código lleno)');
      }
    });

    res.simbolos = Object.keys(tabla).map(k => tabla[k]);

    // ── Segunda pasada: generación de bytes ────────────────────────
    sentencias.forEach(s => {
      if (s.dato && s.direccion !== undefined) {
        s.dato.valores.forEach((v, i) => { res.memoria[s.direccion + i] = v; });
        res.listado.push({ direccion: s.direccion, bytes: s.dato.valores.slice(), fuente: s.fuente, linea: s.linea });
        return;
      }
      if (!s.entrada) return;
      const bytes = [s.entrada.opcode];
      if (s.entrada.bytes === 2) {
        const op = s.operandos.find(o => o.tipo === 'INM' || o.tipo === 'MEM' || o.tipo === 'DIR' || o.tipo === 'KBD' || o.tipo === 'LCD');
        const valor = Ensamblador.resolver_(op, tabla, s.linea, error);
        bytes.push(valor === null ? 0 : valor);
      }
      bytes.forEach((b, i) => { res.memoria[s.direccion + i] = b; });
      res.listado.push({ direccion: s.direccion, bytes: bytes, fuente: s.fuente, linea: s.linea });
    });

    res.listado.sort((a, b) => a.direccion - b.direccion);
    res.errores.sort((a, b) => a.linea - b.linea);
    res.ok = res.errores.length === 0;
    return res;
  },

  /**
   * Una línea de tokens -> sentencia:
   *   {linea, directiva?, etiqueta?, mnemonico?, operandos[], dato?{nombre, valores[]}}
   * Devuelve null si la línea está vacía.
   */
  analizarLinea_(tokens, linea) {
    if (tokens.length === 0) return null;
    const s = { linea: linea, operandos: [] };
    let i = 0;

    if (tokens[0].tipo === TIPO_TOKEN.DIRECTIVA) {
      if (tokens[0].texto !== '.data' && tokens[0].texto !== '.code') {
        throw new Error('Directiva desconocida: ' + tokens[0].texto + ' (usa .data o .code)');
      }
      if (tokens.length > 1) throw new Error('Texto sobrante después de ' + tokens[0].texto);
      s.directiva = tokens[0].texto;
      return s;
    }

    // nombre DB v1, v2 ...   ó   nombre: DB v1
    const esDato = (tokens[0].tipo === TIPO_TOKEN.IDENTIFICADOR || tokens[0].tipo === TIPO_TOKEN.ETIQUETA) &&
      tokens[1] && tokens[1].tipo === TIPO_TOKEN.DB;
    if (esDato) {
      const valores = [];
      let j = 2;
      while (j < tokens.length) {
        if (tokens[j].tipo !== TIPO_TOKEN.NUMERO) throw new Error('DB espera números, se encontró "' + tokens[j].texto + '"');
        valores.push(tokens[j].valor);
        j++;
        if (j < tokens.length) {
          if (tokens[j].tipo !== TIPO_TOKEN.COMA) throw new Error('Se esperaba una coma entre valores de DB');
          j++;
        }
      }
      if (valores.length === 0) throw new Error('DB sin valor');
      s.dato = { nombre: tokens[0].texto, valores: valores };
      return s;
    }

    if (tokens[i].tipo === TIPO_TOKEN.ETIQUETA) { s.etiqueta = tokens[i].texto; i++; }
    if (i >= tokens.length) return s;

    if (tokens[i].tipo !== TIPO_TOKEN.MNEMONICO) {
      throw new Error('Instrucción desconocida: "' + tokens[i].texto + '"');
    }
    s.mnemonico = tokens[i].texto;
    i++;

    // Operandos separados por coma
    while (i < tokens.length) {
      const inicio = i;
      let operando;
      const t = tokens[i];
      if (t.tipo === TIPO_TOKEN.REGISTRO) {
        operando = { tipo: t.texto };
        i++;
      } else if (t.tipo === TIPO_TOKEN.CORCHETE_ABRE) {
        const dentro = tokens[i + 1];
        if (!dentro || (dentro.tipo !== TIPO_TOKEN.NUMERO && dentro.tipo !== TIPO_TOKEN.IDENTIFICADOR)) {
          throw new Error('Se esperaba una dirección o variable dentro de [ ]');
        }
        if (!tokens[i + 2] || tokens[i + 2].tipo !== TIPO_TOKEN.CORCHETE_CIERRA) throw new Error('Falta "]"');
        const puerto = dentro.texto.toUpperCase();
        const esPuerto = (s.mnemonico === 'IN' && puerto === 'KBD') ||
          (s.mnemonico === 'OUT' && puerto === 'LCD');
        operando = { tipo: esPuerto ? puerto : 'MEM', token: dentro };
        i += 3;
      } else if (t.tipo === TIPO_TOKEN.NUMERO || t.tipo === TIPO_TOKEN.IDENTIFICADOR) {
        operando = { tipo: SALTOS.indexOf(s.mnemonico) !== -1 ? 'DIR' : 'INM', token: t };
        i++;
      } else {
        throw new Error('Operando no válido: "' + t.texto + '"');
      }
      s.operandos.push(operando);
      if (i < tokens.length) {
        if (tokens[i].tipo !== TIPO_TOKEN.COMA) throw new Error('Se esperaba una coma después de "' + tokens[inicio].texto + '"');
        i++;
        if (i >= tokens.length) throw new Error('Falta un operando después de la coma');
      }
    }
    return s;
  },

  /** Valor numérico de un operando: número literal o dirección de un símbolo. */
  resolver_(operando, tabla, linea, error) {
    if (operando.tipo === 'KBD') return Perifericos.teclado.BASE;
    if (operando.tipo === 'LCD') return Perifericos.lcd.BASE;
    const t = operando.token;
    if (t.tipo === TIPO_TOKEN.NUMERO) return t.valor;
    const simbolo = tabla[t.texto];
    if (!simbolo) { error(linea, 'Símbolo no definido: ' + t.texto); return null; }
    return simbolo.direccion;
  },

  // ── Integración con la hoja ─────────────────────────────────────

  /** Lee el programa en ensamblador de la hoja Código (columna E). */
  leerFuente() {
    const hoja = SpreadsheetApp.getActive().getSheetByName(HOJAS.CODIGO);
    return hoja.getRange(4, 5, 100, 1).getDisplayValues().map(f => f[0]);
  },

  /** Carga en RAM los 256 bytes del resultado (código y datos). */
  cargarEnMemoria(resultado) {
    if (!resultado.ok) throw new Error('No se puede cargar un programa con errores');
    Memoria.cargar(0, resultado.memoria);
  }
};
