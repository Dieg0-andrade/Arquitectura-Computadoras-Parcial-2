/**
 * pruebas/PruebasIntegracionFinal.gs
 * Tarea 1-10: integración final. Reúne en "Ejecutar todas" las pruebas de
 * caché y E/S que eran funciones sueltas (Integrante 3) y corre los 3
 * programas del catálogo de principio a fin hasta HLT, con MMU, caché,
 * teclado y LCD funcionando juntos.
 *
 * Se ejecuta aparte de "Ejecutar todas" (menú Pruebas → Integración final)
 * para que ninguna de las dos ejecuciones se acerque al límite de 6 minutos
 * de Apps Script. El catálogo carga sus propios programas en memoria virtual. Antes guarda el estado de la memoria virtual (tabla de
 * marcos, Swap, contadores de fallos, RAM y modo de la MMU) y al terminar lo
 * restaura, así "Ejecutar todas" se puede correr varias veces seguidas.
 */

function probarIntegracionFinal() {
  mostrarReporte_([suiteIntegracionFinal_()]);
}

function suiteIntegracionFinal_() {
  const t = crearSuite_('Integración final');
  const virtualAntes = MMU.estaActiva();
  const tablaAntes = TablaMarcos.rango_().offset(0, 0, 16, 5).getValues();
  const fallosAntes = ManejadorFallos.cargarEstado_();
  const swapAntes = [];
  for (let vpn = 0; vpn < 16; vpn++) swapAntes.push(Swap.leerPagina(vpn));
  const ramAntes = Memoria.volcar();

  // Pruebas del Integrante 3: cada función lanza un error si algo falla.
  const sueltas = [
    ['Caché: jerarquía L1I / L1D / L2', 'probarJerarquiaCache'],
    ['Caché: integración con AccesoMemoria y contadores', 'probarIntegracionCache'],
    ['Caché: animación de hit / miss en Cache_IO y Log', 'probarAnimacionCache'],
    ['Teclado: cola FIFO de 8 bytes', 'probarTecladoFIFO'],
    ['LCD 8x1: buffer de video de 8 bytes', 'probarLCD8x1'],
    ['IN / OUT por el bus con IO = 1', 'probarInOut'],
    ['Editor: validación de sintaxis y carga virtual', 'probarEditor']
  ];

  try {
    sueltas.forEach(p => {
      t.prueba(p[0], () => {
        const fn = globalThis[p[1]];
        if (typeof fn !== 'function') throw new Error('no existe ' + p[1]);
        fn();
      });
    });

    // Programas del catálogo de punta a punta (verificar() lanza error si el resultado no es el esperado).
    ProgramasCatalogo.lista().forEach((programa, i) => {
      t.prueba('Catálogo ' + (i + 1) + ': ' + programa.nombre + ' corre hasta HLT con el resultado esperado', () => {
        const mensaje = ProgramasCatalogo.probar(i);
        t.igual(/^PASS/.test(mensaje), true);
        t.igual(Registros.leerTexto('ESTADO'), 'DETENIDO');
      });
    });

    t.prueba('Catálogo 3: provoca Page Faults y misses de caché', () => {
      ProgramasCatalogo.probar(2);
      t.igual(ManejadorFallos.cargarEstado_().fallos > 0, true);
      t.igual(Cache.contadores().L1D.m > 0, true);
    });

    t.prueba('ninguna micro-operación del catálogo usa dos emisores en el bus', () => {
      ProgramasCatalogo.construir();
      ProgramasCatalogo.cargar(ProgramasCatalogo.lista()[0].nombre);
      let pasos = 0, maxEmisores = 0;
      UnidadControl.suscribir(e => {
        pasos++;
        if (e.palabra) maxEmisores = Math.max(maxEmisores, MicroPalabra.emisores(e.palabra).length);
      });
      try { UnidadControl.ejecutarHastaDetener(); } finally { UnidadControl.limpiarSuscriptores(); }
      t.igual(pasos > 20, true);
      t.igual(maxEmisores, 1);
    });
  } finally {
    UnidadControl.limpiarSuscriptores();
    TablaMarcos.rango_().offset(0, 0, 16, 5).setValues(tablaAntes);
    ManejadorFallos.guardarEstado_(fallosAntes);
    swapAntes.forEach((bytes, vpn) => Swap.escribirPagina(vpn, bytes));
    UtilMemoria.rangoMatriz().setValues(UtilMemoria.aMatriz(ramAntes));
    Cache.reiniciar();
    MMU.activarMemoriaVirtual(virtualAntes);
    Simulacion.reiniciar();
  }

  return t;
}
