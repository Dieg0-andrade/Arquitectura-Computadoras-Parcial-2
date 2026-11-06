/**
 * Caché física: L1I de 8 B, L1D de 8 B y L2 compartida de 32 B.
 * L2 carga un bloque completo, representado como cuatro filas de 8 B.
 * Las escrituras actualizan RAM y todas las copias residentes.
 */
const Cache = {
  CLAVE_ESTADO: 'SIM_CPU_CACHE_V2',
  TAM_LINEA: 8,
  LINEAS_L2: 4,
  TAM_PAGINA: 32,

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

  cargarEstado_() {
    const texto = PropertiesService
      .getDocumentProperties()
      .getProperty(Cache.CLAVE_ESTADO);

    return texto ? JSON.parse(texto) : Cache.estadoInicial_();
  },

  guardarEstado_(estado) {
    PropertiesService
      .getDocumentProperties()
      .setProperty(Cache.CLAVE_ESTADO, JSON.stringify(estado));
  },

  reiniciar() {
    const estado = Cache.estadoInicial_();
    Cache.guardarEstado_(estado);
    VistaCache.actualizarContadores(estado.estadisticas);
  },

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
    const base = Math.floor(dirFisica / Cache.TAM_LINEA) * Cache.TAM_LINEA;
    const desplazamiento = dirFisica % Cache.TAM_LINEA;
    const indiceL2 = Math.floor(base / Cache.TAM_LINEA) % Cache.LINEAS_L2;
    const lineaL1 = estado[nivelL1];

    // Hit en L1. El acceso termina aquí y L2 no suma un hit ni un miss.
    if (lineaL1 && lineaL1.base === base) {
      estado.estadisticas[nivelL1].h++;

      if (esEscritura) {
        Cache.escribirCoherente_(estado, base, desplazamiento, indiceL2, valor);
      }

      const resultado = esEscritura ? valor : lineaL1.bytes[desplazamiento];

      Cache.guardarEstado_(estado);
      VistaCache.actualizarContadores(estado.estadisticas);

      return { hit: true, nivel: 'L1', valor: resultado };
    }

    // Miss en L1. Buscar la línea en el bloque compartido de L2.
    estado.estadisticas[nivelL1].m++;

    let linea = estado.L2[indiceL2];
    let nivel = 'L2';
    let hit = true;

    if (linea && linea.base === base) {
      estado.estadisticas.L2.h++;
    } else {
      // Miss en L2. Reemplazar el bloque completo de 32 bytes.
      estado.estadisticas.L2.m++;

      const ram = Memoria.volcar();
      const baseBloque = dirFisica - (dirFisica % Cache.TAM_PAGINA);

      for (let i = 0; i < Cache.LINEAS_L2; i++) {
        const inicio = baseBloque + i * Cache.TAM_LINEA;
        estado.L2[i] = {
          base: inicio,
          bytes: ram.slice(inicio, inicio + Cache.TAM_LINEA)
        };
      }

      linea = estado.L2[indiceL2];
      nivel = 'RAM';
      hit = false;
    }

    // Solo los 8 bytes solicitados pasan a L1.
    estado[nivelL1] = {
      base: base,
      bytes: linea.bytes.slice()
    };

    if (esEscritura) {
      Cache.escribirCoherente_(estado, base, desplazamiento, indiceL2, valor);
    }

    const resultado = esEscritura ? valor : estado[nivelL1].bytes[desplazamiento];

    Cache.guardarEstado_(estado);
    VistaCache.actualizarContadores(estado.estadisticas);

    return { hit: hit, nivel: nivel, valor: resultado };
  },

  escribirCoherente_(estado, base, offset, indiceL2, valor) {
    // Write-through: la escritura siempre llega a RAM.
    Memoria.escribirFisica_(base + offset, valor);

    ['L1I', 'L1D'].forEach(nombre => {
      const linea = estado[nombre];
      if (linea && linea.base === base) {
        linea.bytes[offset] = valor;
      }
    });

    const lineaL2 = estado.L2[indiceL2];
    if (lineaL2 && lineaL2.base === base) {
      lineaL2.bytes[offset] = valor;
    }
  },

  contadores() {
    const estado = Cache.cargarEstado_();
    return {
      L1I: { h: estado.estadisticas.L1I.h, m: estado.estadisticas.L1I.m },
      L1D: { h: estado.estadisticas.L1D.h, m: estado.estadisticas.L1D.m },
      L2: { h: estado.estadisticas.L2.h, m: estado.estadisticas.L2.m }
    };
  },

  invalidarTodo() {
    const estado = Cache.cargarEstado_();
    estado.L1I = null;
    estado.L1D = null;
    estado.L2 = [null, null, null, null];
    Cache.guardarEstado_(estado);
  },

  invalidarPagina(pfn) {
    if (!Number.isInteger(pfn) || pfn < 0 || pfn >= 8) {
      throw new Error('PFN inválido: ' + pfn);
    }

    const estado = Cache.cargarEstado_();
    const pertenece = linea =>
      linea !== null && Math.floor(linea.base / Cache.TAM_PAGINA) === pfn;

    if (pertenece(estado.L1I)) estado.L1I = null;
    if (pertenece(estado.L1D)) estado.L1D = null;

    estado.L2 = estado.L2.map(linea => pertenece(linea) ? null : linea);
    Cache.guardarEstado_(estado);
  }
};