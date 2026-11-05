/**
 * pruebas/PruebasBus.gs
 * Pruebas del bus: reproduce los pasos 1 a 3 de la fase de búsqueda del
 * diagrama de clase (PC → MAR, RAM[MAR] → MDR, MDR → IR), y los buses
 * con buffers tri-estado de la tarea 1-5 (CONDUCE / HIGH-Z por micro-paso).
 */

function probarBus() {
  mostrarReporte_([suiteBus_()]);
}

function suiteBus_() {
  const t = crearSuite_('Bus');
  const respaldoReg = Registros.instantanea();
  const respaldoRam = Memoria.volcar();

  try {
    t.prueba('búsqueda: PC → MAR, RAM[MAR] → MDR, MDR → IR', () => {
      Memoria.escribir(0x06, 0x23);
      Registros.escribir('PC', 0x06);
      Bus.transferir('PC', 'MAR');
      Bus.transferir('RAM', 'MDR');
      Bus.transferir('MDR', 'IR');
      t.igual(Registros.leer('MAR'), 0x06);
      t.igual(Registros.leer('MDR'), 0x23);
      t.igual(Registros.leer('IR'), 0x23);
    });
    t.prueba('escritura: MDR → RAM[MAR]', () => {
      Registros.escribir('MAR', 0x80);
      Registros.escribir('MDR', 0x0F);
      Bus.transferir('MDR', 'RAM');
      t.igual(Memoria.leer(0x80), 0x0F);
    });
    t.prueba('INM → REN2 carga una constante', () => {
      Bus.transferir('INM', 'REN2', 1);
      t.igual(Registros.leer('REN2'), 1);
    });
    t.prueba('guarda la última transferencia en la hoja CPU', () => {
      Registros.escribir('AX', 0x2A);
      Bus.transferir('AX', 'REN1');
      t.igual(Registros.leerTexto('BUS_ULTIMO'), 'AX → REN1 (2Ah)');
    });
    t.prueba('avisa a los suscriptores', () => {
      let visto = null;
      Bus.suscribir(e => { visto = e; });
      Bus.transferir('AX', 'BX');
      Bus.limpiarSuscriptores();
      t.igual(visto.origen, 'AX'); t.igual(visto.destino, 'BX'); t.igual(visto.valor, 0x2A);
    });
    t.prueba('rechaza orígenes/destinos inválidos', () => {
      t.lanzaError(() => Bus.transferir('AX', 'AX'));
      t.lanzaError(() => Bus.transferir('AX', 'INM'));
      t.lanzaError(() => Bus.transferir('EX', 'AX'));
    });

    // ── Buffers tri-estado (tarea 1-5) ──
    const palabra = senales => MicroPalabra.crear(senales);
    const conducen = buffers => BUFFERS_BUS.filter(c => buffers[c] === CONDUCE).join(',');

    t.prueba('buses representados: datos interno, datos externo, direcciones y control', () => {
      const e = Bus.estadoBuses(palabra(['En_PC', 'Ld_MAR']));
      ['datosInterno', 'datosExterno', 'direcciones', 'control'].forEach(b => t.igual(b in e, true));
      ['Read', 'Write', 'IO', 'Clock'].forEach(l => t.igual(l in e.control, true));
    });
    t.prueba('cada componente pertenece a un segmento; el MDR es el puente entre los dos', () => {
      t.igual(CONEXIONES_BUS.AX, SEGMENTO_INTERNO);
      t.igual(CONEXIONES_BUS.RAM, SEGMENTO_EXTERNO);
      t.igual(CONEXIONES_BUS.KBD, SEGMENTO_EXTERNO);
      t.igual(CONEXIONES_BUS.MDR, 'AMBOS');
    });
    t.prueba('MAR ← PC: solo PC conduce, bus interno, direcciones en reposo', () => {
      const e = Bus.estadoBuses(palabra(['En_PC', 'Ld_MAR']));
      t.igual(conducen(e.buffers), 'PC');
      t.igual(e.buffers.MDR, HIGH_Z); t.igual(e.buffers.RAM, HIGH_Z);
      t.igual(e.datosInterno.activo, true); t.igual(e.datosExterno.activo, false);
      t.igual(e.datosInterno.receptores.join(','), 'MAR');
      t.igual(e.direcciones.activo, false);
      t.igual(e.control.Read, 0); t.igual(e.control.Clock, 1);
    });
    t.prueba('MDR ← RAM[MAR]: conducen RAM (datos externo) y MAR (direcciones), Read = 1', () => {
      const e = Bus.estadoBuses(palabra(['Mem_R', 'En_RAM', 'Ld_MDR']));
      t.igual(conducen(e.buffers), 'RAM,MAR');
      t.igual(e.segmento, SEGMENTO_EXTERNO);
      t.igual(e.datosExterno.emisor, 'RAM');
      t.igual(e.datosExterno.receptores.join(','), 'MDR');
      t.igual(e.direcciones.origen, 'MAR'); t.igual(e.direcciones.destino, 'MEMORIA');
      t.igual(e.control.Read, 1); t.igual(e.control.Write, 0);
    });
    t.prueba('RAM[MAR] ← MDR: MDR conduce hacia el bus externo, Write = 1', () => {
      const e = Bus.estadoBuses(palabra(['En_MDR', 'Mem_W']));
      t.igual(conducen(e.buffers), 'MDR,MAR');
      t.igual(e.segmento, SEGMENTO_EXTERNO);
      t.igual(e.datosExterno.receptores.join(','), 'RAM');
      t.igual(e.control.Write, 1);
    });
    t.prueba('un emisor puede tener varios receptores (Ld_* múltiples)', () => {
      const e = Bus.estadoBuses(palabra(['En_MDR', 'Ld_IR', 'Ld_REN2']));
      t.igual(conducen(e.buffers), 'MDR');
      t.igual(e.receptores.join(','), 'IR,REN2');
    });
    t.prueba('paso sin emisor: todos los buffers en HIGH-Z', () => {
      const e = Bus.estadoBuses(palabra(['Inc_PC']));
      t.igual(conducen(e.buffers), '');
      t.igual(e.emisor, null);
      t.igual(e.datosInterno.activo, false); t.igual(e.datosExterno.activo, false);
    });
    t.prueba('estadoBuffers devuelve CONDUCE / HIGH-Z para cada componente', () => {
      const b = Bus.estadoBuffers(palabra(['En_ALU', 'Ld_CX']));
      t.igual(Object.keys(b).length, BUFFERS_BUS.length);
      t.igual(b.ALU, CONDUCE);
      t.igual(BUFFERS_BUS.every(c => b[c] === CONDUCE || b[c] === HIGH_Z), true);
    });
    t.prueba('E/S: MDR ← KBD y LCD ← MDR van por el bus externo con IO = 1', () => {
      const entrada = Bus.estadoBuses(palabra(['IO', 'Mem_R', 'En_KBD', 'Ld_MDR']));
      t.igual(conducen(entrada.buffers), 'KBD,MAR');
      t.igual(entrada.direcciones.destino, 'E/S');
      const salida = Bus.estadoBuses(palabra(['IO', 'Mem_W', 'En_MDR', 'Ld_LCD']));
      t.igual(salida.datosExterno.receptores.join(','), 'LCD');
      t.igual(salida.control.IO, 1);
    });
    t.prueba('error claro con dos emisores simultáneos', () => {
      let mensaje = '';
      try { Bus.estadoBuffers(palabra(['En_PC', 'En_AX', 'Ld_MAR'])); } catch (e) { mensaje = e.message; }
      t.igual(/En_PC, En_AX/.test(mensaje), true);
      t.igual(/D-8/.test(mensaje), true);
      t.lanzaError(() => Bus.estadoBuffers(palabra(['En_RAM', 'Mem_R', 'En_MDR', 'Ld_IR'])));
    });
    t.prueba('rechaza conexiones imposibles entre segmentos (hay que pasar por el MDR)', () => {
      t.lanzaError(() => Bus.estadoBuses(palabra(['Mem_R', 'En_RAM', 'Ld_AX'])));
      t.lanzaError(() => Bus.estadoBuses(palabra(['IO', 'Mem_R', 'En_KBD', 'Ld_AX'])));
      t.lanzaError(() => Bus.estadoBuses(palabra(['IO', 'Mem_W', 'En_DX', 'Ld_LCD'])));
    });
    t.prueba('rechaza señales de control incoherentes', () => {
      t.lanzaError(() => Bus.estadoBuses(palabra(['En_RAM', 'Ld_MDR'])));          // falta Mem_R
      t.lanzaError(() => Bus.estadoBuses(palabra(['Mem_R', 'Ld_MDR'])));           // nadie conduce
      t.lanzaError(() => Bus.estadoBuses(palabra(['Ld_AX'])));                     // carga de un bus en HIGH-Z
      t.lanzaError(() => Bus.estadoBuses(palabra(['En_AX'])));                     // nadie recibe
      t.lanzaError(() => Bus.estadoBuses(palabra(['IO', 'Mem_W', 'En_MDR'])));     // E/S sin destino
    });
    t.prueba('todas las micro-operaciones de las 92 instrucciones tienen un estado de buses válido', () => {
      let pasos = 0;
      TABLA_ISA.forEach(entrada => {
        MicroOperaciones.busqueda().concat(MicroOperaciones.planificar(entrada)).forEach(op => {
          try { Bus.estadoBuses(MicroPalabra.paraMicroOperacion(op)); }
          catch (e) { throw new Error(entrada.mnemonico + ' ' + entrada.operandos + ': ' + e.message); }
          pasos++;
        });
      });
      t.igual(pasos > TABLA_ISA.length * 5, true);
    });
    t.prueba('transferir calcula la micro-palabra y los buffers de cada paso', () => {
      Registros.escribir('PC', 0x10);
      const ev = Bus.transferir('PC', 'MAR');
      t.igual(MicroPalabra.describir(ev.palabra), 'En_PC · Ld_MAR');
      t.igual(ev.buses.buffers.PC, CONDUCE);
      t.igual(ev.buses.buffers.AX, HIGH_Z);
      t.igual(Bus.transferir('INM', 'REN2', 3).buses, null);
    });
    t.prueba('describirBuses da un texto para el log', () => {
      const texto = Bus.describirBuses(Bus.estadoBuses(palabra(['Mem_R', 'En_RAM', 'Ld_MDR'])));
      t.igual(texto, 'Bus externo: RAM → MDR · Direcciones: MAR → MEMORIA · Conducen: RAM, MAR · resto HIGH-Z');
    });
  } finally {
    Bus.limpiarSuscriptores();
    UtilMemoria.rangoMatriz().setValues(UtilMemoria.aMatriz(respaldoRam));
    LISTA_REGISTROS.forEach(r => Registros.escribir(r, respaldoReg[r]));
    Registros.escribirBanderas({ ZF: respaldoReg.ZF, CF: respaldoReg.CF, SF: respaldoReg.SF });
  }

  return t;
}
