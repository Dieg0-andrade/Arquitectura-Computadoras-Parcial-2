
/**
 * PruebasCargaVirtual.gs
 * Issue #23 - Ensamblador y cargador virtual.
 */

function probarCargaVirtual() {
  mostrarReporte_([suiteCargaVirtual_()]);
}

function suiteCargaVirtual_() {
  const t = crearSuite_('Carga virtual');

  const fuente = [
    '.data',
    'x DB 7',
    'y DB 8',
    '.code',
    'LOAD AX, [x]',
    'STORE [y], AX',
    'HLT'
  ];

  t.prueba('Conserva el ensamblador anterior', () => {
    const r = Ensamblador.ensamblar(fuente);

    t.igual(r.ok, true);
    t.igual(r.memoria.length, 256);
    t.igual(r.memoria[0x80], 7);
    t.igual(r.simbolos[0].direccion, 0x80);
  });

  t.prueba('Genera imagen virtual de 512 bytes', () => {
    const r = Ensamblador.ensamblar(
      fuente, { virtual: true }
    );

    t.igual(r.ok, true);
    t.igual(r.memoria.length, 512);
    t.igual(r.memoria[0x100], 7);
    t.igual(r.memoria[0x101], 8);
  });

  t.prueba('Datos desde 100h y operandos relativos', () => {
    const r = Ensamblador.ensamblar(
      fuente, { virtual: true }
    );

    t.igual(r.simbolos[0].direccion, 0x100);
    t.igual(r.simbolos[1].direccion, 0x101);
    t.igual(r.memoria[0], 0x14);
    t.igual(r.memoria[1], 0);
    t.igual(r.memoria[2], 0x16);
    t.igual(r.memoria[3], 1);
  });

  t.prueba('El codigo puede utilizar paginas 0 a 7', () => {
    const lineas = new Array(65).fill('MOV AX, 5');
    lineas.push('HLT');

    const r = Ensamblador.ensamblar(
      lineas, { virtual: true }
    );

    t.igual(r.ok, true);
    t.igual(r.memoria[0x80], 0x10);
    t.igual(r.memoria[0x81], 5);
  });

  t.prueba('Errores conservan numero de linea', () => {
    const r = Ensamblador.ensamblar(
      ['MOV AX, 1', 'FOO AX'],
      { virtual: true }
    );

    t.igual(r.ok, false);
    t.igual(r.errores[0].linea, 2);
  });

  
  t.prueba('Rechaza operandos mayores a 8 bits', () => {
    const r = Ensamblador.ensamblar([
      '.data',
      'x DB 7',
      '.code',
      'MOV AX, x',
      'HLT'
    ], { virtual: true });

    t.igual(r.ok, false);
    t.igual(r.errores[0].linea, 4);
    t.igual(
      r.errores[0].mensaje.includes('8 bits'),
      true
    );
  });

  t.prueba('Traza codigo virtual desde 80h', () => {
    const lineas = new Array(65).fill('MOV AX, 5');
    lineas.push('HLT');

    const r = Ensamblador.ensamblar(
      lineas, { virtual: true }
    );

    t.igual(r.ok, true);

    const propiedades =
      PropertiesService.getDocumentProperties();

    const mapaAnterior =
      propiedades.getProperty(CLAVE_MAPA_FUENTE);

    try {
      Traza.guardarMapaFuente(r.listado, true);

      t.igual(
        Traza.lineasDe(0x80).ensamblador,
        65
      );
    } finally {
      if (mapaAnterior === null) {
        propiedades.deleteProperty(CLAVE_MAPA_FUENTE);
      } else {
        propiedades.setProperty(
          CLAVE_MAPA_FUENTE,
          mapaAnterior
        );
      }

      Traza.cache_ = null;
    }
  });


  
  const ss = SpreadsheetApp.getActive();
  const tabla = TablaMarcos.rango_();
  const ram = UtilMemoria.rangoMatriz();
  const swap = Swap.asegurarHoja().getRange(4, 3, 32, 16);
  const hojaTabla = ss.getSheetByName(HOJAS.TABLA_MARCOS);

  const anteriorTabla = tabla.getValues();
  const anteriorRam = Memoria.volcar();
  const anteriorSwap = swap.getValues();

  const coloresRam = ram.getBackgrounds();
  const coloresTabla = hojaTabla.getRange('B4:E19')
    .getBackgrounds();
  const anteriorContadores = hojaTabla.getRange('H23:H25')
    .getValues();

  const politicaAnterior = ManejadorFallos.politica();
  const cacheAnterior = Cache.cargarEstado_();
  const estadoAnterior = PropertiesService
    .getDocumentProperties()
    .getProperty(ManejadorFallos.CLAVE_ESTADO);

  const modoAnterior = Ensamblador.modoVirtualActivo();
  const mmuAnterior = MMU.estaActiva();

  try {
    t.prueba('Precarga paginas sin generar Page Faults', () => {
      const r = Ensamblador.ensamblar(
        fuente, { virtual: true }
      );

      Ensamblador.cargarEnMemoria(r);

      t.igual(TablaMarcos.obtener(0).presente, 1);
      t.igual(TablaMarcos.obtener(8).presente, 1);
      t.igual(TablaMarcos.obtener(15).pfn, 7);

      t.igual(Memoria.leer(0), 0x14);
      t.igual(Memoria.leer(32), 7);

      t.igual(Swap.leerPagina(8)[0], 7);
      t.igual(ManejadorFallos.cargarEstado_().fallos, 0);
    });

    t.prueba('CPU accede al segmento virtual de datos', () => {
      const r = Ensamblador.ensamblar(
        fuente, { virtual: true }
      );

      Ensamblador.cargarEnMemoria(r);

      t.igual(AccesoMemoria.leer(0, 'D').valor, 7);
      t.igual(AccesoMemoria.leer(1, 'D').valor, 8);

      AccesoMemoria.escribir(1, 0x23);

      t.igual(AccesoMemoria.leer(1, 'D').valor, 0x23);
      t.igual(TablaMarcos.obtener(8).dirty, 1);
    });

  } finally {
    Ensamblador.activarModoVirtual(false);

    tabla.setValues(anteriorTabla);
    ram.setValues(UtilMemoria.aMatriz(anteriorRam));
    swap.setValues(anteriorSwap);

    ram.setBackgrounds(coloresRam);
    hojaTabla.getRange('B4:E19')
      .setBackgrounds(coloresTabla);

    hojaTabla.getRange('H23:H25')
      .setValues(anteriorContadores);

    Cache.guardarEstado_(cacheAnterior);
    ManejadorFallos.seleccionarPolitica(
      politicaAnterior
    );

    const propiedades = PropertiesService
      .getDocumentProperties();

    if (estadoAnterior === null) {
      propiedades.deleteProperty(
        ManejadorFallos.CLAVE_ESTADO
      );
    } else {
      propiedades.setProperty(
        ManejadorFallos.CLAVE_ESTADO,
        estadoAnterior
      );
    }

    Ensamblador.activarModoVirtual(modoAnterior);
    MMU.activarMemoriaVirtual(mmuAnterior);
  }

  return t;
}
