/**
 * pruebas/PruebasAccesoMemoria.gs
 * Pruebas del contrato AccesoMemoria (tarea 1-2) y de los módulos stub
 * MMU, Cache y Perifericos. Restaura la RAM y los registros al terminar.
 */

function probarAccesoMemoria() {
  mostrarReporte_([suiteAccesoMemoria_()]);
}

function suiteAccesoMemoria_() {
  const t = crearSuite_('Acceso a memoria');
  const respaldoRam = Memoria.volcar();
  const respaldoReg = Registros.instantanea();
  const leerOriginal = AccesoMemoria.leer;
  const escribirOriginal = AccesoMemoria.escribir;

  try {
    // ── Contrato de AccesoMemoria ──
    t.prueba('escribir y leer funcionan sin MMU ni caché (00h, 7Fh, 80h, FFh)', () => {
      [[0x00, 0xA5], [0x7F, 0x01], [0x80, 0xFF], [0xFF, 0x00]].forEach(([a, v]) => {
        AccesoMemoria.escribir(a, v);
        t.igual(AccesoMemoria.leer(a, 'D').valor, v);
        t.igual(Memoria.leer(a), v);                    // llegó a la RAM real
      });
    });
    t.prueba('leer devuelve { valor, info } con los campos del contrato', () => {
      Memoria.escribir(0x45, 0x33);
      const r = AccesoMemoria.leer(0x45, 'I');
      t.igual(r.valor, 0x33);
      t.igual(r.info.dirFisica, 0x45);
      t.igual(r.info.vpn, 2);                           // 0x45 >> 5
      t.igual(r.info.pfn, 2);
      t.igual(r.info.fallo, false);
      t.igual(r.info.hitL1, null);
      t.igual(r.info.hitL2, null);
    });
    t.prueba('escribir devuelve { info }', () => {
      const r = AccesoMemoria.escribir(0x90, 7);
      t.igual(r.info.dirFisica, 0x90);
      t.igual(r.info.fallo, false);
    });
    t.prueba('leer exige el tipo de acceso: "I" o "D"', () => {
      t.lanzaError(() => AccesoMemoria.leer(0, undefined));
      t.lanzaError(() => AccesoMemoria.leer(0, 'X'));
      t.igual(AccesoMemoria.leer(0, 'I').valor, Memoria.leer(0));
      t.igual(AccesoMemoria.leer(0, 'D').valor, Memoria.leer(0));
    });
    t.prueba('rechaza direcciones 256, -1 y 1.5', () => {
      t.lanzaError(() => AccesoMemoria.leer(256, 'D'));
      t.lanzaError(() => AccesoMemoria.leer(-1, 'D'));
      t.lanzaError(() => AccesoMemoria.leer(1.5, 'D'));
      t.lanzaError(() => AccesoMemoria.escribir(256, 1));
    });
    t.prueba('rechaza valores 256 y 1.5', () => {
      t.lanzaError(() => AccesoMemoria.escribir(0, 256));
      t.lanzaError(() => AccesoMemoria.escribir(0, 1.5));
    });

    // ── El CPU usa el contrato ──
    t.prueba('Bus: la lectura de RAM pasa por AccesoMemoria con el tipo pedido', () => {
      const llamadas = [];
      AccesoMemoria.leer = (d, tipo) => { llamadas.push(d + tipo); return leerOriginal(d, tipo); };
      Memoria.escribir(0x20, 0x5A);
      Registros.escribir('MAR', 0x20);
      Bus.transferir('RAM', 'MDR', undefined, 'I');
      Bus.transferir('RAM', 'MDR');                     // sin tipo: se asume 'D'
      AccesoMemoria.leer = leerOriginal;
      t.igual(llamadas.join(','), '32I,32D');
      t.igual(Registros.leer('MDR'), 0x5A);
    });
    t.prueba('Bus: la escritura en RAM pasa por AccesoMemoria', () => {
      let escrito = null;
      AccesoMemoria.escribir = (d, v) => { escrito = [d, v]; return escribirOriginal(d, v); };
      Registros.escribir('MAR', 0x88);
      Registros.escribir('MDR', 0x3C);
      Bus.transferir('MDR', 'RAM');
      AccesoMemoria.escribir = escribirOriginal;
      t.igual(escrito.join(','), '136,60');
      t.igual(Memoria.leer(0x88), 0x3C);
    });
    t.prueba('micro-operaciones: la búsqueda y el operando son "I"; LOAD y STORE son "D"', () => {
      const accesos = ops => ops.filter(o => o.tipo === 'bus' && (o.origen === 'RAM' || o.destino === 'RAM')).map(o => o.acceso);
      t.igual(accesos(MicroOperaciones.busqueda()).join(), 'I');
      t.igual(accesos(MicroOperaciones.planificar(ISA.porFirma('MOV', ['AX', 'INM']))).join(), 'I');
      t.igual(accesos(MicroOperaciones.planificar(ISA.porFirma('LOAD', ['AX', 'MEM']))).join(), 'I,D');
      t.igual(accesos(MicroOperaciones.planificar(ISA.porFirma('STORE', ['MEM', 'AX']))).join(), 'I,D');
    });
    t.prueba('un programa completo corre sobre el contrato (accesos I y D) y da 5 × 3 = 15', () => {
      const tipos = { I: 0, D: 0 };
      AccesoMemoria.leer = (d, tipo) => { tipos[tipo]++; return leerOriginal(d, tipo); };
      const r = Ensamblador.ensamblar(PROGRAMA_PRUEBA_MULTIPLICACION);
      if (!r.ok) throw new Error('no ensambla: ' + r.errores[0].mensaje);
      Memoria.cargar(0, r.memoria);
      UnidadControl.reiniciar();
      UnidadControl.ejecutarHastaDetener();
      AccesoMemoria.leer = leerOriginal;
      t.igual(Memoria.leer(0x82), 15);
      t.igual(tipos.I > 0, true);
      t.igual(tipos.D > 0, true);
    });

    // ── Módulos stub ──
    t.prueba('MMU.traducir: identidad con vpn, offset, pfn y presente = true', () => {
      const r = MMU.traducir(0x85);
      t.igual(r.vpn, 4); t.igual(r.offset, 5); t.igual(r.pfn, 4);
      t.igual(r.dirFisica, 0x85); t.igual(r.presente, true);
    });
    t.prueba('MMU: rechaza direcciones fuera de 000h–1FFh y avisa que el fallo de página aún no existe', () => {
      t.lanzaError(() => MMU.traducir(0x200));
      t.lanzaError(() => MMU.traducir(-1));
      t.lanzaError(() => MMU.manejarFalloDePagina(3));
    });
    t.prueba('Cache.acceder: lee y escribe directo en la RAM (nivel RAM, hit = false)', () => {
      const w = Cache.acceder('D', 0x30, true, 0x77);
      t.igual(w.nivel, 'RAM'); t.igual(w.hit, false);
      const r = Cache.acceder('I', 0x30, false);
      t.igual(r.valor, 0x77); t.igual(r.nivel, 'RAM');
      t.lanzaError(() => Cache.acceder('X', 0, false));
    });
    t.prueba('Cache.contadores e invalidarPagina existen y no hacen nada', () => {
      const c = Cache.contadores();
      ['L1I', 'L1D', 'L2'].forEach(n => { t.igual(c[n].h, 0); t.igual(c[n].m, 0); });
      Cache.invalidarPagina(3);
    });
    t.prueba('Perifericos.teclado: cola vacía de 8 bytes', () => {
      t.igual(Perifericos.teclado.encolar('A'), false);
      t.igual(Perifericos.teclado.desencolar(), 0);
      const e = Perifericos.teclado.estado();
      t.igual(e.capacidad, 8); t.igual(e.longitud, 0);
    });
    t.prueba('Perifericos.lcd: pantalla de 8 caracteres y posiciones 0–7', () => {
      t.igual(Perifericos.lcd.texto().length, 8);
      Perifericos.lcd.escribir(7, 0x41);
      t.lanzaError(() => Perifericos.lcd.escribir(8, 0x41));
      t.lanzaError(() => Perifericos.lcd.escribir(0, 256));
    });
  } finally {
    AccesoMemoria.leer = leerOriginal;
    AccesoMemoria.escribir = escribirOriginal;
    UnidadControl.reiniciar();
    UtilMemoria.rangoMatriz().setValues(UtilMemoria.aMatriz(respaldoRam));
    LISTA_REGISTROS.forEach(r => Registros.escribir(r, respaldoReg[r]));
    Registros.escribirBanderas({ ZF: respaldoReg.ZF, CF: respaldoReg.CF, SF: respaldoReg.SF });
  }

  return t;
}
