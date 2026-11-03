
/**
 * Swap.gs
 * Almacenamiento virtual de 512 bytes.
 * 16 paginas de 32 bytes cada una.
 * Los datos persisten en la hoja Swap.
 */
const Swap = {
  TOTAL_PAGINAS: 16,
  TAMANO_PAGINA: 32,
  PRIMERA_FILA: 4,

  validarPagina_(vpn) {
    if (!Number.isInteger(vpn) || vpn < 0 || vpn >= 16) {
      throw new Error('VPN invalida: ' + vpn);
    }
  },

  construir(hoja) {
    Diseno.reiniciar(hoja);

    hoja.getRange('B1')
      .setValue('SWAP - 512 BYTES / 16 PAGINAS DE 32 B')
      .setFontSize(14)
      .setFontWeight('bold');

    const encabezados = ['Pagina', 'Dir. virtual'];
    for (let i = 0; i < 16; i++) {
      encabezados.push('+' + i.toString(16).toUpperCase());
    }

    hoja.getRange(3, 1, 1, 18).setValues([encabezados]);
    Diseno.encabezado(hoja.getRange(3, 1, 1, 18));

    const direcciones = [];
    const datos = [];

    for (let fila = 0; fila < 32; fila++) {
      const direccion = fila * 16;
      direcciones.push([
        ('000' + direccion.toString(16).toUpperCase())
          .slice(-3) + 'h'
      ]);
      datos.push(new Array(16).fill('00'));
    }

    hoja.getRange(4, 2, 32, 1).setValues(direcciones);
    hoja.getRange(4, 3, 32, 16)
      .setNumberFormat('@')
      .setValues(datos);

    for (let vpn = 0; vpn < 16; vpn++) {
      const fila = this.PRIMERA_FILA + vpn * 2;
      const color = vpn % 2 === 0 ? '#E3F2FD' : '#E8F5E9';

      hoja.getRange(fila, 1, 2, 1)
        .merge()
        .setValue('VPN ' + vpn)
        .setVerticalAlignment('middle')
        .setHorizontalAlignment('center')
        .setFontWeight('bold');

      hoja.getRange(fila, 1, 2, 18).setBackground(color);
    }

    hoja.setColumnWidth(1, 85);
    hoja.setColumnWidth(2, 85);
    hoja.setColumnWidths(3, 16, 36);
    hoja.setFrozenRows(3);
  },

  asegurarHoja() {
    const ss = SpreadsheetApp.getActive();
    let hoja = ss.getSheetByName('Swap');

    if (!hoja) {
      hoja = ss.insertSheet('Swap');
      Swap.construir(hoja);
    }

    return hoja;
  },

  rangoPagina_(vpn) {
    Swap.validarPagina_(vpn);
    return Swap.asegurarHoja().getRange(
      Swap.PRIMERA_FILA + vpn * 2, 3, 2, 16
    );
  },

  leerPagina(vpn) {
    const matriz = Swap.rangoPagina_(vpn).getDisplayValues();
    const bytes = [];

    matriz.forEach(fila => {
      fila.forEach(texto => {
        const valor = UtilMemoria.parsearByte(texto);
        if (valor === null) {
          throw new Error('Byte invalido en Swap: ' + texto);
        }
        bytes.push(valor);
      });
    });

    return bytes;
  },

  escribirPagina(vpn, bytes) {
    Swap.validarPagina_(vpn);

    if (!Array.isArray(bytes) || bytes.length !== 32) {
      throw new Error('Una pagina debe contener 32 bytes');
    }

    bytes.forEach(valor => UtilMemoria.validarByte(valor));

    const valores = [
      bytes.slice(0, 16).map(UtilMemoria.aHex),
      bytes.slice(16, 32).map(UtilMemoria.aHex)
    ];

    Swap.rangoPagina_(vpn).setValues(valores);
  }
};
