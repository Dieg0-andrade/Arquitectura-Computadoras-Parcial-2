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

  
  CLAVE_MODO_VIRTUAL: 'ENSAMBLADOR_DATOS_VIRTUALES',

  modoVirtualActivo() {
    return PropertiesService.getDocumentProperties()
      .getProperty(Ensamblador.CLAVE_MODO_VIRTUAL) === '1';
  },

  activarModoVirtual(activo) {
    PropertiesService.getDocumentProperties()
      .setProperty(
        Ensamblador.CLAVE_MODO_VIRTUAL,
        activo ? '1' : '0'
      );

    MMU.activarMemoriaVirtual(Boolean(activo));
  },


  ensamblar(lineas, opciones) {
  const virtual = Boolean(opciones && opciones.virtual);
    const res = {
      ok: false, errores: [], simbolos: [], listado: [], tokens: [],
      memoria: new Array(virtual ? 512 : MAPA_MEMORIA.TAMANO).fill(0),
      virtual: virtual
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
    let dirDatos = virtual ? 0x100 : MAPA_MEMORIA.DATOS_INICIO;

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
          if (dirDatos - 1 > (virtual ? 0x1DF : MAPA_MEMORIA.DATOS_FIN)) {
             error(s.linea, virtual
                   ? 'El segmento de datos supera 1DFh (VPN 15 reservada para E/S)'
                   : 'El segmento de datos pasa de FFh');
}
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
        if (dirCodigo - 1 > (virtual ? 0xFF : MAPA_MEMORIA.CODIGO_FIN)) {
            error(s.linea, virtual
                  ? 'El programa supera 0FFh (paginas de codigo llenas)'
                  : 'El programa pasa de 7Fh (segmento de código lleno)');
}
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
        if (valor === null) {
            bytes.push(0);
            } else if (virtual && op.tipo === 'MEM' && valor >= 0x100) {
               bytes.push(valor - 0x100);
            } else {
               bytes.push(valor);
            }
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

  
  /**
   * Carga el programa en memoria.
   * Los programas antiguos mantienen el modo RAM plana.
   */
  cargarEnMemoria(resultado) {
    if (!resultado.ok) {
      throw new Error('No se puede cargar un programa con errores');
    }

    if (!resultado.virtual) {
      Ensamblador.activarModoVirtual(false);
      Memoria.cargar(0, resultado.memoria);
      Cache.invalidarTodo();
      return;
    }

    return Ensamblador.cargarVirtual_(resultado);
  },

  /**
   * Guarda 512 bytes en Swap y precarga en RAM
   * las paginas mas utiles para iniciar el programa.
   */
  cargarVirtual_(resultado) {
    const imagen = resultado.memoria;

    if (!Array.isArray(imagen) || imagen.length !== 512) {
      throw new Error('La imagen virtual debe tener 512 bytes');
    }

    // Guardar las paginas 0 a 14 en Swap.
    // VPN 15 queda reservada para entrada/salida.
    for (let vpn = 0; vpn < 15; vpn++) {
      const inicio = vpn * 32;
      Swap.escribirPagina(
        vpn,
        imagen.slice(inicio, inicio + 32)
      );
    }

    // Invalidar cache y restablecer tabla de paginas.
    Cache.invalidarTodo();

    const filas = [];

    for (let vpn = 0; vpn < 16; vpn++) {
      filas.push([
        vpn,
        vpn === 15 ? 1 : 0,
        vpn === 15 ? 7 : '',
        0,
        0
      ]);
    }

    TablaMarcos.rango_().setValues(filas);
    ManejadorFallos.reiniciar();

    // Limpiar PFN 0 a 6 sin tocar el PFN 7 de E/S.
    Memoria.cargar(0, new Array(224).fill(0));

    // Identificar las paginas utilizadas por el programa.
    const usadas = new Set([0]);

    resultado.listado.forEach(entrada => {
      for (let i = 0; i < entrada.bytes.length; i++) {
        const vpn = Math.floor(
          (entrada.direccion + i) / 32
        );

        if (vpn >= 0 && vpn < 15) {
          usadas.add(vpn);
        }
      }
    });

    // Priorizar el inicio del codigo y los datos.
    const prioridad = vpn => {
      if (vpn === 0) return -1;
      if (vpn >= 8) return vpn - 8;
      return vpn + 20;
    };

    const paginas = Array.from(usadas)
      .sort((a, b) => prioridad(a) - prioridad(b));

    let marco = 0;

    paginas.forEach(vpn => {
      if (marco >= 7) return;

      const inicio = vpn * 32;
      const bytes = imagen.slice(inicio, inicio + 32);

      Memoria.cargar(marco * 32, bytes);

      TablaMarcos.actualizar(vpn, {
        presente: 1,
        pfn: marco,
        dirty: 0,
        ref: 0
      });

      // Registrar carga inicial sin generar Page Fault.
      ManejadorFallos.registrarCarga(vpn);

      marco++;
    });

    Ensamblador.activarModoVirtual(true);

    return {
      paginasPrecargadas: paginas.slice(0, marco),
      marcosUtilizados: marco
    };
  }
};
