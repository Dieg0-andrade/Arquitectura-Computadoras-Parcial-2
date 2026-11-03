
/**
 * Cache.gs — Issue #9
 * Motor de caché L1I (8B), L1D (8B) y L2 (32B).
 *
 * Política:
 * - Mapeo directo.
 * - Líneas de 8 bytes.
 * - Write-through hacia RAM.
 * - Direcciones físicas.
 *
 * Contrato público:
 * Cache.acceder(tipo, dirFisica, esEscritura, valor)
 * Cache.contadores()
 * Cache.invalidarPagina(pfn)
 *
 * Funciones adicionales:
 * Cache.reiniciar()
 * Cache.invalidarTodo()
 */

const Cache = {

  CLAVE_ESTADO: 'SIM_CPU_CACHE_V1',
  TAM_LINEA: 8,
  LINEAS_L2: 4,
  TAM_PAGINA: 32,

  /** Crea el estado inicial de la jerarquía. */
  estadoInicial_() {
    return {
      L1I: null,
      L1D: null,
      L2: [null, null, null, null],
      estadisticas: {
        L1I: { h: 0, m: 0 },
        L1D: { h: 0, m: 0 },
        L2: { h: 0, m: 0 }
      }
    };
  },

  /** Recupera el estado persistente de Apps Script. */
  cargarEstado_() {
    const texto = PropertiesService
      .getDocumentProperties()
      .getProperty(Cache.CLAVE_ESTADO);

    return texto
      ? JSON.parse(texto)
      : Cache.estadoInicial_();
  },

  /** Guarda el estado entre ejecuciones. */
  guardarEstado_(estado) {
    PropertiesService
      .getDocumentProperties()
      .setProperty(
        Cache.CLAVE_ESTADO,
        JSON.stringify(estado)
      );
  },

  /** Reinicia las líneas y los contadores. */
  reiniciar() {
    Cache.guardarEstado_(Cache.estadoInicial_());
  },

  /**
   * Accede a la jerarquía de caché.
   *
   * tipo: 'I' (instrucciones) o 'D' (datos).
   * dirFisica: dirección física de RAM.
   * esEscritura: true para escribir, false para leer.
   * valor: byte que se escribirá (0..255).
   *
   * Devuelve:
   * { hit: boolean, nivel: 'L1'|'L2'|'RAM', valor: number }
   */
  acceder(tipo, dirFisica, esEscritura, valor) {
    if (tipo !== 'I' && tipo !== 'D') {
      throw new Error('Tipo de acceso inválido: ' + tipo);
    }

    UtilMemoria.validarDireccion(dirFisica);

    if (esEscritura) {
      UtilMemoria.validarByte(valor);
    }

    const estado = Cache.cargarEstado_();
    const nivelL1 = tipo === 'I' ? 'L1I' : 'L1D';

    const base = Math.floor(dirFisica / Cache.TAM_LINEA)
      * Cache.TAM_LINEA;

    const desplazamiento = dirFisica % Cache.TAM_LINEA;

    const indiceL2 = Math.floor(base / Cache.TAM_LINEA)
      % Cache.LINEAS_L2;

    const lineaL1 = estado[nivelL1];

    // ── HIT EN L1 ──────────────────────────────
    if (lineaL1 && lineaL1.base === base) {
      estado.estadisticas[nivelL1].h++;

      if (esEscritura) {
        Cache.escribirCoherente_(
          estado,
          base,
          desplazamiento,
          indiceL2,
          valor
        );
      }

      const resultado = esEscritura
        ? valor
        : lineaL1.bytes[desplazamiento];

      Cache.guardarEstado_(estado);

      return {
        hit: true,
        nivel: 'L1',
        valor: resultado
      };
    }

    // ── MISS EN L1 ─────────────────────────────
    estado.estadisticas[nivelL1].m++;

    let linea = estado.L2[indiceL2];
    let nivel = 'L2';
    let hit = true;

    // ── HIT EN L2 ──────────────────────────────
    if (linea && linea.base === base) {
      estado.estadisticas.L2.h++;
    } else {
      // ── MISS EN L2: CARGAR DESDE RAM ────────
      estado.estadisticas.L2.m++;

      const ram = Memoria.volcar();

      const bytes = ram.slice(
        base,
        base + Cache.TAM_LINEA
      );

      linea = {
        base: base,
        bytes: bytes
      };

      estado.L2[indiceL2] = {
        base: base,
        bytes: bytes.slice()
      };

      nivel = 'RAM';
      hit = false;
    }

    // Copiar el bloque encontrado hacia L1.
    estado[nivelL1] = {
      base: base,
      bytes: linea.bytes.slice()
    };

    if (esEscritura) {
      Cache.escribirCoherente_(
        estado,
        base,
        desplazamiento,
        indiceL2,
        valor
      );
    }

    const resultado = esEscritura
      ? valor
      : estado[nivelL1].bytes[desplazamiento];

    Cache.guardarEstado_(estado);

    return {
      hit: hit,
      nivel: nivel,
      valor: resultado
    };
  },

  /**
   * Política write-through.
   *
   * Actualiza la RAM y todas las copias
   * residentes de la dirección modificada.
   */
  escribirCoherente_(estado, base, offset, indiceL2, valor) {
    const direccion = base + offset;

    // Escribir siempre en RAM.
    Memoria.escribir(direccion, valor);

    // Mantener coherencia entre L1I y L1D.
    ['L1I', 'L1D'].forEach(nombre => {
      const linea = estado[nombre];

      if (linea && linea.base === base) {
        linea.bytes[offset] = valor;
      }
    });

    // Actualizar L2 si contiene el bloque.
    const lineaL2 = estado.L2[indiceL2];

    if (lineaL2 && lineaL2.base === base) {
      lineaL2.bytes[offset] = valor;
    }
  },

  /**
   * Devuelve los contadores de hits y misses.
   */
  contadores() {
    const estado = Cache.cargarEstado_();

    return {
      L1I: {
        h: estado.estadisticas.L1I.h,
        m: estado.estadisticas.L1I.m
      },
      L1D: {
        h: estado.estadisticas.L1D.h,
        m: estado.estadisticas.L1D.m
      },
      L2: {
        h: estado.estadisticas.L2.h,
        m: estado.estadisticas.L2.m
      }
    };
  },

  /**
   * Invalida todas las líneas de caché.
   *
   * No reinicia los contadores.
   * Se utilizará cuando otros módulos
   * carguen o limpien la RAM.
   */
  invalidarTodo() {
    const estado = Cache.cargarEstado_();

    estado.L1I = null;
    estado.L1D = null;
    estado.L2 = [null, null, null, null];

    Cache.guardarEstado_(estado);
  },

  /**
   * Invalida las líneas pertenecientes
   * a un marco físico de 32 bytes.
   *
   * La MMU llamará esta función al
   * desalojar un marco.
   */
  invalidarPagina(pfn) {
    if (!Number.isInteger(pfn) ||
        pfn < 0 ||
        pfn >= 8) {
      throw new Error('PFN inválido: ' + pfn);
    }

    const estado = Cache.cargarEstado_();

    const pertenece = linea =>
      linea !== null &&
      Math.floor(linea.base / Cache.TAM_PAGINA) === pfn;

    // Invalidar L1I.
    if (pertenece(estado.L1I)) {
      estado.L1I = null;
    }

    // Invalidar L1D.
    if (pertenece(estado.L1D)) {
      estado.L1D = null;
    }

    // Invalidar líneas correspondientes de L2.
    estado.L2 = estado.L2.map(linea =>
      pertenece(linea) ? null : linea
    );

    Cache.guardarEstado_(estado);
  }
};
