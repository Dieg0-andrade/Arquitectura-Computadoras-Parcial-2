/**
 * pruebas/PruebasVistaBuses.gs
 * Pruebas del panel de buses y buffers tri-estado (tarea 1-7, hoja "Buses"):
 * secciones visibles, colores por estado del buffer y actualización de la
 * micro-palabra en cada micro-paso. Restaura RAM y CPU al terminar.
 */

function probarVistaBuses() {
  mostrarReporte_([suiteVistaBuses_()]);
}

function suiteVistaBuses_() {
  const t = crearSuite_('Vista de buses');
  const color = r => String(r.getBackground()).toLowerCase();
  const verde = COLORES_BUSES.CONDUCE.toLowerCase();
  const gris = COLORES_BUSES.HIGH_Z.toLowerCase();
  const ambar = COLORES_BUSES.CARGA.toLowerCase();
  const evento = (senales, paso) => {
    const palabra = MicroPalabra.crear(senales);
    const buses = Bus.estadoBuses(palabra);
    return { paso: paso || 1, fase: FASES.BUSQUEDA, descripcion: 'prueba', palabra: palabra,
      buses: buses, descripcionBuses: Bus.describirBuses(buses) };
  };
  const respaldoRam = Memoria.volcar();

  try {
    t.prueba('la hoja Buses existe con las secciones de los buses interno, externo, direcciones y control', () => {
      const hoja = SpreadsheetApp.getActive().getSheetByName(HOJAS.BUSES);
      t.igual(hoja !== null, true);
      const D = DISENO_BUSES;
      t.igual(/INTERNO/.test(hoja.getRange(D.INTERNO.titulo, D.COL_ETIQUETA).getValue()), true);
      t.igual(/EXTERNO/.test(hoja.getRange(D.EXTERNO.titulo, D.COL_ETIQUETA).getValue()), true);
      t.igual(/DIRECCIONES/.test(hoja.getRange(D.DIRECCIONES.titulo, D.COL_ETIQUETA).getValue()), true);
      t.igual(/CONTROL/.test(hoja.getRange(D.CONTROL.titulo, D.COL_ETIQUETA).getValue()), true);
    });
    t.prueba('cada buffer y cada señal de la micro-palabra tiene su celda', () => {
      BUFFERS_BUS.filter(c => c !== 'MAR').forEach(c => {
        const seccion = DISENO_BUSES.INTERNO.emisores.indexOf(c) >= 0 ? 'INTERNO' : 'EXTERNO';
        t.igual(VistaBuses.celda(seccion, 'nombres', c).getValue(), c);
      });
      t.igual(VistaBuses.celda('DIRECCIONES', 'nombres', 'MAR').getValue(), 'MAR');
      const hoja = SpreadsheetApp.getActive().getSheetByName(HOJAS.BUSES);
      const senales = hoja.getRange(DISENO_BUSES.PALABRA.senales, DISENO_BUSES.COL_INICIO, 1, 30).getValues()[0];
      t.igual(senales.join(','), COLUMNAS_MICROPALABRA.join(','));
    });
    t.prueba('en reposo todos los buffers están en HIGH-Z (gris) y los bits en 0', () => {
      VistaBuses.limpiar();
      t.igual(VistaBuses.celda('INTERNO', 'estados', 'PC').getValue(), HIGH_Z);
      t.igual(color(VistaBuses.celda('EXTERNO', 'estados', 'RAM')), gris);
      t.igual(color(VistaBuses.celdaLinea('INTERNO')), gris);
      t.igual(VistaBuses.celdaBit('En_PC').getValue(), '0');
    });
    t.prueba('MAR ← PC: PC conduce en verde, el resto en gris, MAR carga en ámbar', () => {
      VistaBuses.actualizar(evento(['En_PC', 'Ld_MAR']));
      t.igual(VistaBuses.celda('INTERNO', 'estados', 'PC').getValue(), CONDUCE);
      t.igual(color(VistaBuses.celda('INTERNO', 'estados', 'PC')), verde);
      t.igual(VistaBuses.celda('INTERNO', 'estados', 'MDR').getValue(), HIGH_Z);
      t.igual(color(VistaBuses.celda('INTERNO', 'estados', 'MDR')), gris);
      t.igual(color(VistaBuses.celda('INTERNO', 'receptores', 'MAR')), ambar);
      t.igual(color(VistaBuses.celda('INTERNO', 'receptores', 'IR')) === ambar, false);
      t.igual(color(VistaBuses.celdaLinea('INTERNO')), verde);
      t.igual(VistaBuses.celdaLinea('INTERNO').getValue(), 'PC → MAR');
      t.igual(color(VistaBuses.celdaLinea('EXTERNO')), gris);
    });
    t.prueba('MDR ← RAM: el bus externo y el de direcciones se activan, Read = 1', () => {
      VistaBuses.actualizar(evento(['Mem_R', 'En_RAM', 'Ld_MDR'], 2));
      t.igual(color(VistaBuses.celda('EXTERNO', 'estados', 'RAM')), verde);
      t.igual(color(VistaBuses.celda('INTERNO', 'estados', 'PC')), gris);
      t.igual(color(VistaBuses.celdaLinea('INTERNO')), gris);
      t.igual(VistaBuses.celdaLinea('EXTERNO').getValue(), 'RAM → MDR');
      t.igual(color(VistaBuses.celda('DIRECCIONES', 'estados', 'MAR')), verde);
      t.igual(/MEMORIA/.test(VistaBuses.celdaLinea('DIRECCIONES').getValue()), true);
      t.igual(VistaBuses.celda('CONTROL', 'valores', 'Read').getValue(), '1');
      t.igual(VistaBuses.celda('CONTROL', 'valores', 'Write').getValue(), '0');
    });
    t.prueba('el MDR conduce en el bus que corresponde: interno (MDR → IR) o externo (MDR → RAM)', () => {
      VistaBuses.actualizar(evento(['En_MDR', 'Ld_IR']));
      t.igual(color(VistaBuses.celda('INTERNO', 'estados', 'MDR')), verde);
      t.igual(color(VistaBuses.celda('EXTERNO', 'estados', 'MDR')), gris);
      VistaBuses.actualizar(evento(['En_MDR', 'Mem_W']));
      t.igual(color(VistaBuses.celda('INTERNO', 'estados', 'MDR')), gris);
      t.igual(color(VistaBuses.celda('EXTERNO', 'estados', 'MDR')), verde);
      t.igual(color(VistaBuses.celda('EXTERNO', 'receptores', 'RAM')), ambar);
    });
    t.prueba('los bits de la micro-palabra en 1 se resaltan', () => {
      VistaBuses.actualizar(evento(['Ld_FLAGS', 'ALU_op=ADD']));
      t.igual(VistaBuses.celdaBit('Ld_FLAGS').getValue(), '1');
      t.igual(color(VistaBuses.celdaBit('Ld_FLAGS')), COLORES_BUSES.BIT_1.toLowerCase());
      t.igual(VistaBuses.celdaBit('ALU_op0').getValue(), '1');
      t.igual(VistaBuses.celdaBit('ALU_op1').getValue(), '0');
      t.igual(color(VistaBuses.celdaBit('En_PC')), COLORES_BUSES.BIT_0.toLowerCase());
      t.igual(color(VistaBuses.celdaLinea('INTERNO')), gris);
    });
    t.prueba('la micro-palabra se actualiza en cada micro-paso de la simulación', () => {
      const r = Ensamblador.ensamblar(['MOV AX, 5', 'HLT']);
      Memoria.cargar(0, r.memoria);
      UnidadControl.reiniciar();
      VistaBuses.limpiar();
      const hoja = SpreadsheetApp.getActive().getSheetByName(HOJAS.BUSES);
      const activas = () => hoja.getRange(DISENO_BUSES.PALABRA.activas, DISENO_BUSES.COL_INICIO).getValue();
      const vistos = [];
      for (let i = 0; i < 4; i++) { Simulacion.paso(); vistos.push(activas()); }
      t.igual(vistos.join(' | '), 'En_PC · Ld_MAR | Mem_R · Ld_MDR · En_RAM | En_MDR · Ld_IR | Inc_PC');
      t.igual(/^\[Paso 04\]/.test(hoja.getRange(DISENO_BUSES.FILA_PASO, DISENO_BUSES.COL_INICIO).getValue()), true);
      t.igual(color(VistaBuses.celdaLinea('INTERNO')), gris);   // PC + 1 no usa el bus
    });
    t.prueba('reiniciar la simulación deja el panel en reposo', () => {
      Simulacion.reiniciar();
      t.igual(VistaBuses.celdaBit('Inc_PC').getValue(), '0');
      t.igual(VistaBuses.celda('INTERNO', 'estados', 'MDR').getValue(), HIGH_Z);
    });
    t.prueba('un evento sin micro-palabra no falla y deja el panel en reposo', () => {
      VistaBuses.actualizar({ detenido: true });
      VistaBuses.actualizar(null);
      t.igual(color(VistaBuses.celdaLinea('EXTERNO')), gris);
    });
  } finally {
    UtilMemoria.rangoMatriz().setValues(UtilMemoria.aMatriz(respaldoRam));
    UnidadControl.reiniciar();
    VistaBuses.limpiar();
  }

  return t;
}
