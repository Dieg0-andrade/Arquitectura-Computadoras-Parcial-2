/**
 * AccesoMemoria.gs
 * Contrato ÚNICO de acceso a memoria del CPU (decisión D-9 del Parcial 2).
 * El CPU (Bus, Unidad de Control) NUNCA toca la RAM directamente: siempre llama
 * a AccesoMemoria.leer / AccesoMemoria.escribir.
 *
 * API pública (no cambiar sin avisar al equipo):
 *   AccesoMemoria.leer(dirVirtual, tipo)       -> { valor, info }
 *   AccesoMemoria.escribir(dirVirtual, valor)  -> { info }
 *
 *   tipo: 'I' = búsqueda de instrucción (u operando de la instrucción)
 *         'D' = acceso a dato (LOAD / STORE)
 *   info: { vpn, pfn, dirFisica, fallo, hitL1, hitL2 }
 *
 * ESTADO ACTUAL: STUB DIRECTO (tarea 1-2).
 *   Ahora la dirección virtual es igual a la física y el acceso va directo a
 *   Memoria (la RAM plana de 256 bytes) sin MMU ni caché. Por eso info trae:
 *     vpn / pfn  = dirección >> 5 (identidad, cada marco tiene 32 bytes)
 *     fallo      = false
 *     hitL1/L2   = null  ("no aplica": todavía no hay caché)
 *
 * QUIÉN LO REEMPLAZA (el contrato no cambia, solo el interior de estas dos funciones):
 *   - Integrante 2 (tarea 2-4): traducir con MMU.traducir() y atender el
 *     fallo de página (MMU.manejarFalloDePagina) antes de acceder a la RAM.
 *   - Integrante 3 (tarea 3-3): pasar por Cache.acceder() en lugar de Memoria.
 *   - Integrante 2 (tarea 2-8): el segmento de datos pasa a la dirección virtual
 *     100h + dir; ese desplazamiento se aplica aquí cuando tipo = 'D'.
 */

const AccesoMemoria = {


  /** Lee un byte, traduciendo si el modo virtual esta activo. */
  leer(dirVirtual, tipo) {
    AccesoMemoria.validarTipo_(tipo);
    AccesoMemoria.validarDireccion_(dirVirtual);

    const r = AccesoMemoria.resolver_(dirVirtual);
    const valor = Memoria.leer(r.dirFisica);

    return {
      valor: valor,
      info: {
        vpn: r.vpn,
        pfn: r.pfn,
        dirFisica: r.dirFisica,
        fallo: false,
        hitL1: null,
        hitL2: null
      }
    };
  },

  /** Escribe un byte en la direccion fisica traducida. */
  escribir(dirVirtual, valor) {
    AccesoMemoria.validarDireccion_(dirVirtual);
    UtilMemoria.validarByte(valor);

    const r = AccesoMemoria.resolver_(dirVirtual);
    Memoria.escribir(r.dirFisica, valor);

    return {
      info: {
        vpn: r.vpn,
        pfn: r.pfn,
        dirFisica: r.dirFisica,
        fallo: false,
        hitL1: null,
        hitL2: null
      }
    };
  },

  /** Lanza un fallo recuperable cuando P = 0. */
  resolver_(dirVirtual) {
    if (!MMU.estaActiva()) {
      return {
        vpn: dirVirtual >> 5,
        pfn: dirVirtual >> 5,
        dirFisica: dirVirtual,
        presente: true
      };
    }

    const r = MMU.traducir(dirVirtual);

    if (!r.presente) {
      const error = new Error(
        'PAGE FAULT: VPN ' + r.vpn
      );

      error.codigo = 'PAGE_FAULT';
      error.vpn = r.vpn;
      throw error;
    }

    return r;
  },

  // ── Internos ────────────────────────────────────────────────────

  /** Información de depuración del acceso (la completan la MMU y la caché más adelante). */
  info_(dirFisica) {
    const marco = dirFisica >> 5;
    return { vpn: marco, pfn: marco, dirFisica: dirFisica, fallo: false, hitL1: null, hitL2: null };
  },

  validarTipo_(tipo) {
    if (tipo !== 'I' && tipo !== 'D') {
      throw new Error('Tipo de acceso inválido: "' + tipo + '" (usa \'I\' para instrucción o \'D\' para dato)');
    }
  },


  validarDireccion_(dirVirtual) {
    const maximo = MMU.estaActiva()
      ? 0x1FF
      : MAPA_MEMORIA.DATOS_FIN;

    if (!Number.isInteger(dirVirtual) ||
        dirVirtual < 0 || dirVirtual > maximo) {
      throw new Error(
        'Direccion fuera de rango: ' + dirVirtual
      );
    }
  }

};
