/**
 * Punto de acceso de la CPU a memoria.
 * La MMU traduce primero. La caché recibe la dirección física.
 * En hitL1/hitL2, null significa que ese nivel no se consultó.
 */
const AccesoMemoria = {
  leer(dirVirtual, tipo) {
    AccesoMemoria.validarTipo_(tipo);
    AccesoMemoria.validarDireccion_(dirVirtual);
    return AccesoMemoria.acceder_(dirVirtual, tipo, false);
  },

  escribir(dirVirtual, valor) {
    AccesoMemoria.validarDireccion_(dirVirtual);
    UtilMemoria.validarByte(valor);

    const acceso = AccesoMemoria.acceder_(dirVirtual, 'D', true, valor);
    return { info: acceso.info };
  },

  acceder_(dirVirtual, tipo, escritura, valor) {
    // Si falta la página, resolver_ lanza PAGE_FAULT antes de contar el acceso.
    const r = AccesoMemoria.resolver_(dirVirtual);

    const info = {
      vpn: r.vpn,
      pfn: r.pfn,
      dirFisica: r.dirFisica,
      fallo: false,
      hitL1: null,
      hitL2: null
    };

    // La página virtual 15 está reservada para E/S.
    if (r.vpn === 15) {
      if (escritura) {
        Memoria.escribir(r.dirFisica, valor);
      } else {
        valor = Memoria.leer(r.dirFisica);
      }
      return { valor: valor, info: info };
    }

    const acceso = Cache.acceder(tipo, r.dirFisica, escritura, valor);

    info.hitL1 = acceso.nivel === 'L1';
    if (!info.hitL1) {
      info.hitL2 = acceso.nivel === 'L2';
    }

    if (MMU.estaActiva()) {
      TablaMarcos.actualizar(
        r.vpn,
        escritura ? { ref: 1, dirty: 1 } : { ref: 1 }
      );
    }

    return { valor: acceso.valor, info: info };
  },

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
      const error = new Error('PAGE FAULT: VPN ' + r.vpn);
      error.codigo = 'PAGE_FAULT';
      error.vpn = r.vpn;
      throw error;
    }

    return r;
  },

  validarTipo_(tipo) {
    if (tipo !== 'I' && tipo !== 'D') {
      throw new Error(
        'Tipo de acceso inválido: "' + tipo + '" (usa I para instrucción o D para dato)'
      );
    }
  },

  validarDireccion_(dirVirtual) {
    const maximo = MMU.estaActiva() ? 0x1FF : MAPA_MEMORIA.DATOS_FIN;

    if (!Number.isInteger(dirVirtual) || dirVirtual < 0 || dirVirtual > maximo) {
      throw new Error('Direccion fuera de rango: ' + dirVirtual);
    }
  }
};