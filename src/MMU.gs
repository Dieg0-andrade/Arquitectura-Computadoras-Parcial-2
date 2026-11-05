
/**
 * MMU.gs
 * Traduccion de direcciones virtuales de 9 bits.
 *
 * VPN = dirVirtual >> 5
 * offset = dirVirtual & 31
 * dirFisica = PFN * 32 + offset
 *
 * La traduccion consulta TablaMarcos.
 * El Page Fault se resolvera en otra tarea.
 */

const MMU = {

  /** Traduce una direccion virtual usando la tabla. */
  traducir(dirVirtual) {
    if (!Number.isInteger(dirVirtual) ||
        dirVirtual < 0 || dirVirtual > 0x1FF) {
      throw new Error(
        'Direccion virtual fuera de rango: ' + dirVirtual
      );
    }

    const vpn = dirVirtual >> 5;
    const offset = dirVirtual & 31;

    const pagina = TablaMarcos.obtener(vpn);
    const presente = pagina.presente === 1;

    // Una pagina ausente no tiene direccion fisica.
    const pfn = presente ? pagina.pfn : null;
    const dirFisica = presente
      ? pfn * 32 + offset
      : null;

    return {
      vpn: vpn,
      offset: offset,
      presente: presente,
      pfn: pfn,
      dirFisica: dirFisica
    };
  },

  /** Representa una direccion virtual en hex. */
  hexVirtual_(valor) {
    return valor.toString(16)
      .toUpperCase()
      .padStart(3, '0') + 'h';
  },

  /** Representa una direccion fisica en hex. */
  hexFisica_(valor) {
    return valor.toString(16)
      .toUpperCase()
      .padStart(2, '0') + 'h';
  },

  /**
   * Muestra una traduccion en TablaMarcos
   * y deja una traza en la hoja Log.
   *
   * Esta funcion es de diagnostico; traducir()
   * conserva su contrato para la CPU.
   */
  mostrarTraduccion(dirVirtual) {
    const r = MMU.traducir(dirVirtual);
    const ss = SpreadsheetApp.getActive();

    const hojaTabla = ss.getSheetByName(
      HOJAS.TABLA_MARCOS
    );

    const virtualHex = MMU.hexVirtual_(dirVirtual);
    const offsetHex = MMU.hexFisica_(r.offset);

    const fisicaHex = r.presente
      ? MMU.hexFisica_(r.dirFisica)
      : 'PAGE FAULT';

    // Panel de ultima traduccion.
    hojaTabla.getRange('G8:H8').setValues([[
      'MMU', 'ULTIMA TRADUCCION'
    ]]);

    Diseno.encabezado(
      hojaTabla.getRange('G8:H8')
    );

    hojaTabla.getRange('G9:H14').setValues([
      ['Dir. virtual', virtualHex],
      ['VPN', r.vpn],
      ['Offset', offsetHex],
      ['Present', r.presente ? 1 : 0],
      ['PFN', r.presente ? r.pfn : '—'],
      ['Dir. fisica', fisicaHex]
    ]);

    hojaTabla.getRange('H14').setBackground(
      r.presente ? '#E8F5E9' : '#FFCDD2'
    );

    // Log separado del registro de micro-operaciones
    // de CPU, que ocupa las columnas A:E.
    const hojaLog = ss.getSheetByName(HOJAS.LOG);

    hojaLog.getRange('G3:L3').setValues([[
      'Virtual', 'VPN', 'Offset',
      'P', 'PFN', 'Fisica'
    ]]);

    Diseno.encabezado(hojaLog.getRange('G3:L3'));

    const rangoLog = hojaLog.getRange('G4:L13');
    const historial = rangoLog.getValues();

    // Conserva las diez traducciones mas recientes.
    historial.pop();
    historial.unshift([
      virtualHex,
      r.vpn,
      offsetHex,
      r.presente ? 1 : 0,
      r.presente ? r.pfn : '—',
      fisicaHex
    ]);

    rangoLog.setValues(historial);

    Logger.log(
      'MMU: ' + virtualHex +
      ' VPN=' + r.vpn +
      ' offset=' + offsetHex +
      ' PFN=' + (r.presente ? r.pfn : '—') +
      ' fisica=' + fisicaHex
    );

    return r;
  },

  /**
   * Pendiente: manejador real de Page Fault.
   * Se implementara en la tarea siguiente.
   */
  manejarFalloDePagina(vpn) {
    throw new Error(
      'Page Fault aun no implementado. VPN=' + vpn
    );
  }
};
