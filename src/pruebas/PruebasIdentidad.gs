/**
 * pruebas/PruebasIdentidad.gs
 * Tarea 1-8: identidad del equipo, leyenda de colores y controles
 * PASO / EJECUTAR / PAUSA / REINICIAR con todos los módulos (MMU, caché,
 * teclado, LCD, buses). Restaura RAM, CPU y periféricos al terminar.
 */

function probarIdentidad() {
  mostrarReporte_([suiteIdentidad_()]);
}

function suiteIdentidad_() {
  const t = crearSuite_('Identidad y controles');
  const ss = SpreadsheetApp.getActive();
  const minus = c => String(c).toLowerCase();
  const respaldoRam = Memoria.volcar();
  const instruccionOriginal = Simulacion.instruccion;

  // Programa que usa todos los módulos: teclado (IN), MMU + caché (LOAD/STORE
  // en el segmento de datos), ALU con los 4 registros, LCD (OUT) y saltos.
  const PROGRAMA = ['.data', 'n DB 3', 'r DB 0', '.code',
    'IN AX, [KBD]', 'LOAD CX, [n]', 'MOV DX, 0',
    'vuelta: ADD DX, 2', 'DEC CX', 'JNZ vuelta',
    'STORE [r], DX', 'MOV BX, AX', 'OUT [LCD], BX', 'HLT'];
  const cargar = () => {
    const r = Ensamblador.ensamblar(PROGRAMA);
    if (!r.ok) throw new Error('no ensambla: ' + r.errores[0].mensaje);
    Ensamblador.cargarEnMemoria(r);
    Simulacion.reiniciar();
    Perifericos.teclado.reiniciar();
    Perifericos.teclado.encolar('T');
  };
  const comprobarResultado = () => {
    t.igual(Registros.leer('DX'), 6);
    t.igual(Registros.leer('BX'), 0x54);                       // 'T'
    t.igual(AccesoMemoria.leer(0x81, 'D').valor, 6);
    t.igual(Perifericos.lcd.texto().charAt(0), 'T');
  };

  try {
    // ── Identidad ──
    t.prueba('la portada (hoja Inicio) muestra el nombre del equipo y sus integrantes', () => {
      const hoja = ss.getSheetByName(HOJAS.INICIO);
      t.igual(hoja !== null, true);
      t.igual(hoja.getRange('F2').getValue(), 'LOS TIGRIS');
      const integrantes = hoja.getRange(7, 6, 3, 1).getValues().map(f => f[0]).join(' ');
      EQUIPO.INTEGRANTES.forEach(n => t.igual(integrantes.indexOf(n) >= 0, true));
    });
    t.prueba('la hoja CPU muestra el nombre del equipo', () => {
      t.igual(/LOS TIGRIS/.test(ss.getSheetByName(HOJAS.CPU).getRange('P1').getValue()), true);
    });

    // ── Leyenda ──
    t.prueba('leyenda de colores en la portada: cada fila pintada con su color', () => {
      const hoja = ss.getSheetByName(HOJAS.INICIO);
      const fila0 = 12 + GUIA_CONTROLES.length + 4;
      LEYENDA_COLORES.forEach((l, i) => {
        t.igual(hoja.getRange(fila0 + i, 6).getValue(), l[1]);
        t.igual(minus(hoja.getRange(fila0 + i, 6).getBackground()), minus(l[0]));
      });
    });
    t.prueba('leyenda compacta en la hoja CPU, debajo de los controles', () => {
      const hoja = ss.getSheetByName(HOJAS.CPU);
      const fila = FILA_PRIMER_CONTROL + CONTROLES.length + 7;
      t.igual(hoja.getRange(fila, COL_CONTROLES).getValue(), 'LEYENDA DE COLORES');
      t.igual(minus(hoja.getRange(fila + 1, COL_CONTROLES).getBackground()), minus(LEYENDA_COLORES[0][0]));
    });
    t.prueba('la leyenda usa los mismos colores que el simulador', () => {
      const colores = LEYENDA_COLORES.map(l => minus(l[0]));
      [COLORES.ACTIVO, COLORES.ORIGEN, COLORES.SEG_CODIGO, COLORES.SEG_DATOS, COLORES.ENTRADA,
        COLORES_BUSES.CONDUCE, COLORES_BUSES.HIGH_Z].forEach(c => t.igual(colores.indexOf(minus(c)) >= 0, true));
    });

    // ── Controles con todos los módulos ──
    t.prueba('existen los controles PASO, INSTRUCCIÓN, EJECUTAR, PAUSA y REINICIAR', () => {
      const etiquetas = CONTROLES.map(c => c.etiqueta).join(' ');
      ['PASO', 'INSTRUCCIÓN', 'EJECUTAR', 'PAUSA', 'REINICIAR'].forEach(n => t.igual(etiquetas.indexOf(n) >= 0, true));
    });
    t.prueba('PASO: avanza una micro-operación y actualiza log y buses', () => {
      cargar();
      const r = Simulacion.paso();
      t.igual(r.paso, 1);
      t.igual(Registros.leerTexto('RELOJ'), '1');
      t.igual(LogMicroops.leerFila(1)[5], 'En_PC · Ld_MAR');
      t.igual(VistaBuses.celdaLinea('INTERNO').getValue(), 'PC → MAR');
    });
    t.prueba('EJECUTAR: corre hasta HLT pasando por teclado, MMU, caché, ALU y LCD', () => {
      cargar();
      const antes = Cache.contadores();
      const r = Controles.ejecutarContinuo();
      t.igual(r.motivo, 'hlt');
      t.igual(r.detenido, true);
      comprobarResultado();
      const despues = Cache.contadores();
      const accesos = c => c.L1I.h + c.L1I.m + c.L1D.h + c.L1D.m;
      t.igual(accesos(despues) > accesos(antes), true);
    });
    t.prueba('PAUSA: detiene EJECUTAR y EJECUTAR continúa hasta HLT', () => {
      cargar();
      let llamadas = 0;
      Simulacion.instruccion = function () {
        const r = instruccionOriginal.call(Simulacion);
        if (++llamadas === 2) Controles.pausar();               // el usuario marca PAUSA
        return r;
      };
      const r1 = Controles.ejecutarContinuo();
      t.igual(r1.motivo, 'pausa');
      t.igual(r1.detenido, false);
      t.igual(llamadas, 2);
      Simulacion.instruccion = instruccionOriginal;
      const r2 = Controles.ejecutarContinuo();
      t.igual(r2.motivo, 'hlt');
      comprobarResultado();
    });
    t.prueba('REINICIAR: CPU, log y buses en reposo; el programa se vuelve a ejecutar igual', () => {
      Simulacion.reiniciar();
      t.igual(Registros.leer('PC'), 0);
      t.igual(Registros.leer('DX'), 0);
      t.igual(UnidadControl.estaDetenido(), false);
      t.igual(LogMicroops.leerFila(1)[0], '');
      t.igual(VistaBuses.celdaBit('En_PC').getValue(), '0');
      Perifericos.teclado.encolar('T');
      t.igual(Controles.ejecutarContinuo().motivo, 'hlt');
      comprobarResultado();
    });
    t.prueba('las casillas de la hoja CPU disparan su control (PASO) y escriben el mensaje', () => {
      cargar();
      const hoja = ss.getSheetByName(HOJAS.CPU);
      const indicePaso = CONTROLES.findIndex(c => c.etiqueta.indexOf('PASO') >= 0);
      Controles.atender({ range: hoja.getRange(FILA_PRIMER_CONTROL + indicePaso, COL_CONTROLES), value: 'TRUE' });
      t.igual(Registros.leerTexto('RELOJ'), '1');
      t.igual(String(ss.getRangeByName(NOMBRES.MENSAJE_CONTROL).getValue()).length > 0, true);
    });
  } finally {
    Simulacion.instruccion = instruccionOriginal;
    UtilMemoria.rangoMatriz().setValues(UtilMemoria.aMatriz(respaldoRam));
    Simulacion.reiniciar();
    Perifericos.teclado.reiniciar();
  }

  return t;
}
