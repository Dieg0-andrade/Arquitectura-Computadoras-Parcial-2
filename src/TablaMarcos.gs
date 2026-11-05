
/**
 * TablaMarcos.gs
 * Tabla de paginas virtuales del simulador.
 *
 * 16 paginas virtuales, 8 marcos fisicos.
 * VPN 15 permanece fija en PFN 7 (E/S).
 */

const TablaMarcos = {
  TOTAL_PAGINAS: 16,
  TOTAL_MARCOS: 8,
  NOMBRE_RANGO: 'TABLA_MARCOS_DATOS',

  validarVPN_(vpn) {
    if (!Number.isInteger(vpn) || vpn < 0 || vpn >= 16) {
      throw new Error('VPN invalida: ' + vpn);
    }
  },

  validarBit_(valor, nombre) {
    if (valor === true) return 1;
    if (valor === false) return 0;

    if (valor !== 0 && valor !== 1) {
      throw new Error('Bit invalido en ' + nombre);
    }

    return valor;
  },

  /** Construye la tabla visible en Google Sheets. */
  construir(hoja) {
    Diseno.reiniciar(hoja);

    hoja.getRange('A1')
      .setValue('TABLA DE PAGINAS - MEMORIA VIRTUAL')
      .setFontSize(14)
      .setFontWeight('bold')
      .setFontColor(COLORES.TITULO);

    const encabezados = [
      'VPN', 'Present (P)', 'PFN', 'Dirty', 'Ref'
    ];

    hoja.getRange(3, 1, 1, 5)
      .setValues([encabezados]);

    Diseno.encabezado(hoja.getRange(3, 1, 1, 5));

    const filas = [];

    for (let vpn = 0; vpn < 16; vpn++) {
      const esIO = vpn === 15;

      filas.push([
        vpn,
        esIO ? 1 : 0,
        esIO ? 7 : '',
        0,
        0
      ]);
    }

    const rango = hoja.getRange(4, 1, 16, 5);

    rango.setValues(filas)
      .setHorizontalAlignment('center')
      .setFontFamily('Roboto Mono')
      .setBorder(
        true, true, true, true, true, true,
        COLORES.BORDE,
        SpreadsheetApp.BorderStyle.SOLID
      );

    // La pagina 15 esta reservada para E/S.
    hoja.getRange(19, 1, 1, 5)
      .setBackground('#FFF3E0')
      .setFontWeight('bold');

    hoja.getRange('G3')
      .setValue('VPN 15: E/S - fija en PFN 7')
      .setFontWeight('bold');

    hoja.getRange('G4')
      .setValue('P = 1: pagina cargada en RAM');
    hoja.getRange('G5')
      .setValue('Dirty = 1: pagina modificada');
    hoja.getRange('G6')
      .setValue('Ref = 1: pagina utilizada');

    hoja.setColumnWidths(1, 5, 110);
    hoja.setColumnWidth(7, 260);
    hoja.setFrozenRows(3);

    // Rango con nombre para acceso desde la MMU.
    hoja.getParent().setNamedRange(
      TablaMarcos.NOMBRE_RANGO,
      rango
    );
  },

  /** Obtiene las 16 entradas mediante un rango con nombre. */
  rango_() {
    const rango = SpreadsheetApp.getActive()
      .getRangeByName(TablaMarcos.NOMBRE_RANGO);

    if (!rango) {
      throw new Error('Primero ejecuta Preparar libro');
    }

    return rango;
  },

  /** Lee el estado actual de una pagina virtual. */
  obtener(vpn) {
    TablaMarcos.validarVPN_(vpn);

    const fila = TablaMarcos.rango_()
      .offset(vpn, 0, 1, 5)
      .getValues()[0];

    return {
      vpn: vpn,
      presente: Number(fila[1]),
      pfn: fila[2] === '' || fila[2] === null
        ? null : Number(fila[2]),
      dirty: Number(fila[3]),
      ref: Number(fila[4])
    };
  },

  /**
   * Actualiza los bits y el marco asignado.
   * No permite usar PFN 7 fuera de E/S.
   */
  actualizar(vpn, cambios) {
    TablaMarcos.validarVPN_(vpn);

    if (!cambios || typeof cambios !== 'object' ||
        Array.isArray(cambios)) {
      throw new Error('Cambios invalidos');
    }

    const permitidos = ['presente', 'pfn', 'dirty', 'ref'];

    Object.keys(cambios).forEach(campo => {
      if (!permitidos.includes(campo)) {
        throw new Error('Campo no permitido: ' + campo);
      }
    });

    const actual = TablaMarcos.obtener(vpn);
    const nuevo = Object.assign({}, actual, cambios);

    nuevo.presente = TablaMarcos.validarBit_(
      nuevo.presente, 'Present'
    );

    nuevo.dirty = TablaMarcos.validarBit_(
      nuevo.dirty, 'Dirty'
    );

    nuevo.ref = TablaMarcos.validarBit_(
      nuevo.ref, 'Ref'
    );

    if (nuevo.pfn === '' || nuevo.pfn === undefined) {
      nuevo.pfn = null;
    }

    if (nuevo.pfn !== null &&
        (!Number.isInteger(nuevo.pfn) ||
         nuevo.pfn < 0 || nuevo.pfn >= 8)) {
      throw new Error('PFN invalido');
    }

    if (vpn === 15) {
      if (nuevo.presente !== 1 || nuevo.pfn !== 7) {
        throw new Error('VPN 15 debe permanecer en PFN 7');
      }
    } else if (nuevo.pfn === 7) {
      throw new Error('PFN 7 esta reservado para E/S');
    }

    if (nuevo.presente === 1 && nuevo.pfn === null) {
      throw new Error('Pagina presente requiere PFN');
    }

    if (nuevo.presente === 0 && nuevo.pfn !== null) {
      throw new Error('Pagina ausente no debe tener PFN');
    }

    // No se permite asignar un marco a dos paginas.
    if (nuevo.presente === 1) {
      const filas = TablaMarcos.rango_().getValues();

      for (let i = 0; i < filas.length; i++) {
        if (i !== vpn && Number(filas[i][1]) === 1 &&
            Number(filas[i][2]) === nuevo.pfn) {
          throw new Error('PFN ocupado por VPN ' + i);
        }
      }
    }

    TablaMarcos.rango_()
      .offset(vpn, 1, 1, 4)
      .setValues([[
        nuevo.presente,
        nuevo.pfn === null ? '' : nuevo.pfn,
        nuevo.dirty,
        nuevo.ref
      ]]);

    return TablaMarcos.obtener(vpn);
  }
};
