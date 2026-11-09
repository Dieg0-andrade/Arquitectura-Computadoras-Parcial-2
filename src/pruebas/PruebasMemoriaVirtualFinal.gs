/**
 * PruebasMemoriaVirtualFinal.gs
 * Issue #27 / tarea 26: accesos dispersos, FIFO, LRU y Dirty Write-Back.
 * Conserva los datos y el estado previo de la hoja al finalizar.
 */
function probarMemoriaVirtualFinal() {
  mostrarReporte_([suiteMemoriaVirtualFinal_()]);
}

function suiteMemoriaVirtualFinal_() {
  const t = crearSuite_('Memoria virtual - verificacion final');
  const ss = SpreadsheetApp.getActive();
  const hojaTabla = ss.getSheetByName(HOJAS.TABLA_MARCOS);
  const hojaLog = ss.getSheetByName(HOJAS.LOG);
  const tabla = TablaMarcos.rango_();
  const ram = UtilMemoria.rangoMatriz();
  const swap = Swap.asegurarHoja().getRange(4, 3, 32, 16);
  const coloresTabla = hojaTabla.getRange('B4:E19');
  const panel = hojaTabla.getRange('G16:H18');
  const contadores = hojaTabla.getRange('H23:H25');
  const log = hojaLog.getRange('G16:J17');

  const respaldo = {
    tabla: tabla.getValues(),
    ram: Memoria.volcar(),
    swap: swap.getValues(),
    coloresRam: ram.getBackgrounds(),
    coloresTabla: coloresTabla.getBackgrounds(),
    panel: panel.getValues(),
    contadores: contadores.getValues(),
    log: log.getValues(),
    politica: ManejadorFallos.politica(),
    cache: Cache.cargarEstado_(),
    mmu: MMU.estaActiva(),
    ensambladorVirtual: Ensamblador.modoVirtualActivo()
  };
  const propiedades = PropertiesService.getDocumentProperties();
  respaldo.historial = propiedades.getProperty(ManejadorFallos.CLAVE_ESTADO);
  respaldo.modoEnsamblador = propiedades.getProperty(Ensamblador.CLAVE_MODO_VIRTUAL);

  // Deja siete marcos libres y mantiene VPN 15 fijada al PFN 7.
  function prepararEscenario() {
    Ensamblador.activarModoVirtual(false);
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
    tabla.setValues(filas);
    ManejadorFallos.reiniciar();
    Cache.reiniciar();
    MMU.activarMemoriaVirtual(true);
  }

  // Simula un acceso de CPU: detecta PAGE_FAULT, carga la pagina y reintenta.
  function leerConFallo(direccion) {
    try {
      return AccesoMemoria.leer(direccion, 'D').valor;
    } catch (error) {
      if (error.codigo !== 'PAGE_FAULT') throw error;
      MMU.manejarFalloDePagina(error.vpn);
      return AccesoMemoria.leer(direccion, 'D').valor;
    }
  }

  try {
    t.prueba('Accesos dispersos provocan 8 fallos y 1 desalojo', () => {
      prepararEscenario();
      const paginas = [0, 2, 4, 6, 8, 10, 12, 14];
      paginas.forEach(vpn => {
        const valor = leerConFallo(vpn * 32);
        t.igual(Number.isInteger(valor), true);
        t.igual(TablaMarcos.obtener(vpn).ref, 1);
      });
      const estado = ManejadorFallos.cargarEstado_();
      t.igual(estado.fallos, 8);
      t.igual(estado.desalojos, 1);
      t.igual(TablaMarcos.obtener(15).pfn, 7);
      t.igual(TablaMarcos.obtener(0).presente, 0);
    });

    t.prueba('FIFO desaloja la primera pagina cargada', () => {
      prepararEscenario();
      for (let vpn = 0; vpn < 7; vpn++) {
        ManejadorFallos.resolver(vpn);
      }
      // La pagina 0 sigue siendo la mas antigua aunque se vuelva a leer.
      AccesoMemoria.leer(0, 'D');
      const resultado = ManejadorFallos.resolver(8);
      t.igual(ManejadorFallos.politica(), 'FIFO');
      t.igual(resultado.victima, 0);
      t.igual(resultado.pfnAsignado, 0);
      t.igual(ManejadorFallos.cargarEstado_().desalojos, 1);
    });

    t.prueba('LRU conserva la pagina usada mas recientemente', () => {
      prepararEscenario();
      for (let vpn = 0; vpn < 7; vpn++) {
        ManejadorFallos.resolver(vpn);
      }
      ManejadorFallos.seleccionarPolitica('LRU');
      AccesoMemoria.leer(0, 'D');
      const resultado = ManejadorFallos.resolver(8);
      t.igual(resultado.victima, 1);
      t.igual(TablaMarcos.obtener(0).presente, 1);
      t.igual(TablaMarcos.obtener(0).ref, 1);
    });

    t.prueba('Dirty Write-Back persiste datos y permite recuperarlos', () => {
      prepararEscenario();
      Swap.escribirPagina(0, new Array(32).fill(0x11));
      for (let vpn = 0; vpn < 7; vpn++) {
        ManejadorFallos.resolver(vpn);
      }
      AccesoMemoria.escribir(3, 0xAB);
      t.igual(TablaMarcos.obtener(0).dirty, 1);
      const desalojo = ManejadorFallos.resolver(8);
      t.igual(desalojo.victima, 0);
      t.igual(desalojo.escribioSwap, true);
      t.igual(Swap.leerPagina(0)[3], 0xAB);
      // La pagina vuelve a cargarse desde su copia persistida.
      t.igual(leerConFallo(3), 0xAB);
      t.igual(TablaMarcos.obtener(0).presente, 1);
    });

    t.prueba('Pagina limpia no sobrescribe su contenido en Swap', () => {
      prepararEscenario();
      Swap.escribirPagina(0, new Array(32).fill(0x44));
      for (let vpn = 0; vpn < 7; vpn++) {
        ManejadorFallos.resolver(vpn);
      }
      // Cambio directo en RAM, sin marcar Dirty: NO debe guardarse.
      Memoria.escribir(3, 0x77);
      const resultado = ManejadorFallos.resolver(8);
      t.igual(resultado.victima, 0);
      t.igual(resultado.escribioSwap, false);
      t.igual(Swap.leerPagina(0)[3], 0x44);
    });

    t.prueba('Pagina residente no cuenta doble y VPN 15 permanece fija', () => {
      prepararEscenario();
      ManejadorFallos.resolver(2);
      ManejadorFallos.resolver(2);
      t.igual(ManejadorFallos.cargarEstado_().fallos, 1);
      t.igual(ManejadorFallos.cargarEstado_().desalojos, 0);
      t.igual(TablaMarcos.obtener(15).presente, 1);
      t.igual(TablaMarcos.obtener(15).pfn, 7);
      const io = MMU.traducir(0x1F0);
      t.igual(io.dirFisica, 0xF0);
    });
  } finally {
    // Restaurar incluso si alguna prueba falla.
    MMU.activarMemoriaVirtual(false);
    tabla.setValues(respaldo.tabla);
    ram.setValues(UtilMemoria.aMatriz(respaldo.ram));
    swap.setValues(respaldo.swap);
    coloresTabla.setBackgrounds(respaldo.coloresTabla);
    ram.setBackgrounds(respaldo.coloresRam);
    panel.setValues(respaldo.panel);
    contadores.setValues(respaldo.contadores);
    log.setValues(respaldo.log);
    
    Cache.guardarEstado_(respaldo.cache);
    VistaCache.actualizarContadores(respaldo.cache.estadisticas);


    if (respaldo.historial === null) {
      propiedades.deleteProperty(ManejadorFallos.CLAVE_ESTADO);
    } else {
      propiedades.setProperty(
        ManejadorFallos.CLAVE_ESTADO,
        respaldo.historial
      );
    }
    ManejadorFallos.seleccionarPolitica(respaldo.politica);

    if (respaldo.modoEnsamblador === null) {
      propiedades.deleteProperty(Ensamblador.CLAVE_MODO_VIRTUAL);
    } else {
      propiedades.setProperty(
        Ensamblador.CLAVE_MODO_VIRTUAL,
        respaldo.modoEnsamblador
      );
    }
    MMU.activarMemoriaVirtual(respaldo.mmu);
  }

  return t;
}
