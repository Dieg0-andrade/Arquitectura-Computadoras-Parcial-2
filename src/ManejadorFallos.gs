
/**
 * ManejadorFallos.gs
 * Issue #16: reemplazo FIFO / LRU con Dirty Write-Back.
 *
 * FIFO: desaloja la pagina cargada mas antigua.
 * LRU: desaloja la pagina menos recientemente utilizada.
 * Nunca se desaloja VPN 15 / PFN 7 (entrada/salida).
 */

const ManejadorFallos = {
  CLAVE_ESTADO: 'SIM_REEMPLAZO_PAGINAS_V1',

  estadoInicial_() {
    return {
      reloj: 0,
      cargas: {},
      accesos: {}
    };
  },

  cargarEstado_() {
    const texto = PropertiesService.getDocumentProperties()
      .getProperty(ManejadorFallos.CLAVE_ESTADO);

    if (!texto) return ManejadorFallos.estadoInicial_();

    try {
      const estado = JSON.parse(texto);
      if (!estado.cargas || !estado.accesos ||
          !Number.isInteger(estado.reloj)) {
        return ManejadorFallos.estadoInicial_();
      }
      return estado;
    } catch (e) {
      return ManejadorFallos.estadoInicial_();
    }
  },

  guardarEstado_(estado) {
    PropertiesService.getDocumentProperties()
      .setProperty(
        ManejadorFallos.CLAVE_ESTADO,
        JSON.stringify(estado)
      );
  },

  /** Limpia el historial y vuelve a FIFO. */
  reiniciar() {
    ManejadorFallos.guardarEstado_(
      ManejadorFallos.estadoInicial_()
    );

    const hoja = SpreadsheetApp.getActive()
      .getSheetByName(HOJAS.TABLA_MARCOS);

    if (hoja) hoja.getRange('H20').setValue('FIFO');
  },

  /** Lee la politica seleccionada en la hoja. */
  politica() {
    const hoja = SpreadsheetApp.getActive()
      .getSheetByName(HOJAS.TABLA_MARCOS);

    if (!hoja) return 'FIFO';

    const valor = String(
      hoja.getRange('H20').getValue()
    ).trim().toUpperCase();

    return valor === 'LRU' ? 'LRU' : 'FIFO';
  },

  /** Permite seleccionar FIFO o LRU. */
  seleccionarPolitica(politica) {
    if (politica !== 'FIFO' && politica !== 'LRU') {
      throw new Error('Politica invalida: ' + politica);
    }

    const hoja = SpreadsheetApp.getActive()
      .getSheetByName(HOJAS.TABLA_MARCOS);

    if (!hoja) {
      throw new Error('Primero ejecuta Preparar libro');
    }

    hoja.getRange('H20').setValue(politica);
    return politica;
  },

  /** Registra el momento en que se cargo una pagina. */
  registrarCarga(vpn) {
    TablaMarcos.validarVPN_(vpn);

    if (TablaMarcos.obtener(vpn).presente !== 1) {
      throw new Error('No se puede registrar pagina ausente');
    }

    const estado = ManejadorFallos.cargarEstado_();
    estado.reloj++;

    estado.cargas[vpn] = estado.reloj;
    estado.accesos[vpn] = estado.reloj;

    ManejadorFallos.guardarEstado_(estado);
  },

  /**
   * Registra un acceso real.
   * Lectura: Ref = 1.
   * Escritura: Ref = 1 y Dirty = 1.
   */
  registrarAcceso(vpn, escritura) {
    TablaMarcos.validarVPN_(vpn);

    const pagina = TablaMarcos.obtener(vpn);

    if (pagina.presente !== 1) {
      throw new Error('Acceso a pagina ausente');
    }

    TablaMarcos.actualizar(vpn, {
      ref: 1,
      dirty: escritura ? 1 : pagina.dirty
    });

    const estado = ManejadorFallos.cargarEstado_();
    estado.reloj++;

    if (estado.cargas[vpn] === undefined) {
      estado.cargas[vpn] = 0;
    }

    estado.accesos[vpn] = estado.reloj;
    ManejadorFallos.guardarEstado_(estado);
  },

  /** Elige una pagina residente y reemplazable. */
  elegirVictima_(filas, estado) {
    const candidatas = [];

    filas.forEach((fila, vpn) => {
      const presente = Number(fila[1]) === 1;
      const pfn = Number(fila[2]);

      if (vpn !== 15 && presente &&
          Number.isInteger(pfn) &&
          pfn >= 0 && pfn < 7) {
        candidatas.push({ vpn, pfn });
      }
    });

    if (candidatas.length === 0) {
      throw new Error('No hay paginas reemplazables');
    }

    const usarLRU = ManejadorFallos.politica() === 'LRU';

    // Sin historial: se considera una pagina antigua.
    const antiguedad = (registro, vpn) =>
      registro[vpn] === undefined ? -1 : registro[vpn];

    candidatas.sort((a, b) => {
      const marcaA = usarLRU
        ? antiguedad(
            estado.accesos, a.vpn
          )
        : antiguedad(
            estado.cargas, a.vpn
          );

      const marcaB = usarLRU
        ? antiguedad(
            estado.accesos, b.vpn
          )
        : antiguedad(
            estado.cargas, b.vpn
          );

      return marcaA - marcaB || a.vpn - b.vpn;
    });

    return candidatas[0];
  },

  /** Resuelve un Page Fault y reemplaza si es necesario. */
  resolver(vpn) {
    TablaMarcos.validarVPN_(vpn);

    const pagina = TablaMarcos.obtener(vpn);

    if (pagina.presente === 1) {
      return {
        pfnAsignado: pagina.pfn,
        victima: null,
        escribioSwap: false
      };
    }

    // Leer la pagina solicitada antes de desalojar.
    const bytes = Swap.leerPagina(vpn);

    if (bytes.length !== 32) {
      throw new Error('Pagina Swap incompleta');
    }

    const filas = TablaMarcos.rango_().getValues();
    const ocupados = new Set();

    filas.forEach(fila => {
      if (Number(fila[1]) === 1) {
        ocupados.add(Number(fila[2]));
      }
    });

    let marco = null;

    for (let pfn = 0; pfn < 7; pfn++) {
      if (!ocupados.has(pfn)) {
        marco = pfn;
        break;
      }
    }

    let victima = null;
    let escribioSwap = false;

    // RAM llena: buscar victima con FIFO o LRU.
    if (marco === null) {
      const estado = ManejadorFallos.cargarEstado_();
      const elegida = ManejadorFallos.elegirVictima_(
        filas, estado
      );

      marco = elegida.pfn;
      victima = elegida.vpn;

      const paginaVictima = TablaMarcos.obtener(victima);

      // Dirty Write-Back: conservar los cambios.
      if (paginaVictima.dirty === 1) {
        const ram = Memoria.volcar();

        const contenido = ram.slice(
          marco * 32,
          marco * 32 + 32
        );

        Swap.escribirPagina(victima, contenido);
        escribioSwap = true;
      }

      // Invalidar la cache antes de reutilizar el marco.
      Cache.invalidarPagina(marco);

      TablaMarcos.actualizar(victima, {
        presente: 0,
        pfn: null,
        dirty: 0,
        ref: 0
      });

      delete estado.cargas[victima];
      delete estado.accesos[victima];

      ManejadorFallos.guardarEstado_(estado);
    } else {
      // Un marco libre tambien podria tener cache antigua.
      Cache.invalidarPagina(marco);
    }

    // Cargar los 32 bytes de la nueva pagina.
    Memoria.cargar(marco * 32, bytes);

    TablaMarcos.actualizar(vpn, {
      presente: 1,
      pfn: marco,
      dirty: 0,
      ref: 0
    });

    ManejadorFallos.registrarCarga(vpn);

    // Panel visual del Page Fault.
    const ss = SpreadsheetApp.getActive();
    const tabla = ss.getSheetByName(HOJAS.TABLA_MARCOS);

    tabla.getRange(4 + vpn, 2, 1, 4)
      .setBackground('#FFF59D');

    if (victima !== null) {
      tabla.getRange(4 + victima, 2, 1, 4)
        .setBackground('#FFCDD2');
    }

    tabla.getRange('G16:H18').setValues([
      ['PAGE FAULT', 'VPN ' + vpn],
      ['Marco asignado', 'PFN ' + marco],
      ['Victima', victima === null
        ? 'Ninguna'
        : 'VPN ' + victima]
    ]);

    // Registro del reemplazo.
    const log = ss.getSheetByName(HOJAS.LOG);

    log.getRange('G16:J16').setValues([[
      'Evento', 'VPN', 'PFN', 'Resultado'
    ]]);

    log.getRange('G17:J17').setValues([[
      'PAGE FAULT',
      vpn,
      marco,
      victima === null
        ? 'CARGADA'
        : 'REEMPLAZA VPN ' + victima
    ]]);

    Logger.log(
      'PAGE FAULT VPN=' + vpn +
      ' -> PFN=' + marco +
      ' | politica=' + ManejadorFallos.politica() +
      ' | victima=' + victima +
      ' | write-back=' + escribioSwap
    );

    return {
      pfnAsignado: marco,
      victima: victima,
      escribioSwap: escribioSwap
    };
  }
};
