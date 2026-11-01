/**
 * pruebas/PruebasCompilador.gs
 * Pruebas del compilador de alto nivel (léxico, sintaxis, generación de
 * código y errores) y de la traza de la línea en ejecución.
 * Restaura la RAM y las columnas de la hoja Código al terminar.
 */

function probarCompilador() {
  mostrarReporte_([suiteCompilador_()]);
}

/** Programa de prueba: multiplicación 5 × 3 en alto nivel. */
const PROGRAMA_PRUEBA_ALTO = [
  '// res = a × b',
  'var a = 5',
  'var b = 3',
  'var res = 0',
  'mientras b != 0 {',
  '  res = res + a',
  '  b = b - 1',
  '}'
];

function suiteCompilador_() {
  const t = crearSuite_('Compilador y traza');
  const codigo = lineas => GeneradorCodigo.generar(ParserAlto.analizar(LexerAlto.tokenizar(lineas)))
    .map(l => l.texto).filter(x => x.charAt(0) !== '.' && x.indexOf(' DB ') === -1);
  const color = c => String(c).toLowerCase();

  // ── Léxico y sintaxis ──
  t.prueba('léxico: palabras clave, identificadores, números y operadores', () => {
    const tk = LexerAlto.tokenizar(['mientras b != 0 { // comentario']);
    t.igual(tk.map(x => x.tipo + ':' + x.texto).join(' '), 'CLAVE:mientras ID:b SIMBOLO:!= NUM:0 SIMBOLO:{');
  });
  t.prueba('sintaxis: la multiplicación produce un AST con declaraciones y un bucle', () => {
    const ast = ParserAlto.analizar(LexerAlto.tokenizar(PROGRAMA_PRUEBA_ALTO));
    t.igual(ast.cuerpo.map(s => s.tipo).join(','), 'Declaracion,Declaracion,Declaracion,Mientras');
    t.igual(ast.cuerpo[3].cuerpo.length, 2);
    t.igual(ast.cuerpo[3].condicion.op, '!=');
  });

  // ── Generación de código ──
  t.prueba('x = a + 3 → LOAD, ADD inmediato, STORE', () => {
    t.igual(codigo(['var a = 1', 'var x = 0', 'x = a + 3']).join(' | '),
      'LOAD AX, [a] | ADD AX, 3 | STORE [x], AX | HLT');
  });
  t.prueba('x = a - b usa BX como temporal', () => {
    t.igual(codigo(['var a = 9', 'var b = 4', 'var x = 0', 'x = a - b']).join(' | '),
      'LOAD AX, [a] | LOAD BX, [b] | SUB AX, BX | STORE [x], AX | HLT');
  });
  t.prueba('mientras con != sale del bucle con JZ y vuelve con JMP', () => {
    const c = codigo(['var i = 2', 'mientras i != 0 {', 'i = i - 1', '}']);
    t.igual(c[0], '_m1: LOAD AX, [i]');
    t.igual(c[2], 'JZ _f1');
    t.igual(c[c.length - 3], 'JMP _m1');
    t.igual(c[c.length - 2], '_f1:');
  });
  t.prueba('si con == salta el bloque con JNZ', () => {
    const c = codigo(['var x = 1', 'si x == 1 {', 'x = 7', '}']);
    t.igual(c[2], 'JNZ _s1');
  });

  // ── Errores ──
  t.prueba('errores con número de línea: variable no declarada, falta "}", reservado y fuera de rango', () => {
    const e1 = Compilador.compilar(['var a = 1', 'b = a']);
    t.igual(e1.ok, false); t.igual(e1.errores[0].linea, 2);
    t.igual(Compilador.compilar(['var a = 1', 'mientras a != 0 {', 'a = a - 1']).ok, false);
    t.igual(Compilador.compilar(['var add = 1']).ok, false);
    t.igual(Compilador.compilar(['var a = 300']).errores[0].linea, 1);
  });

  // ── Integración: compilar, ejecutar y trazar ──
  const hoja = SpreadsheetApp.getActive().getSheetByName(HOJAS.CODIGO);
  const respaldoRam = Memoria.volcar();
  const respaldoB = hoja.getRange(4, 2, 100, 1).getDisplayValues();
  const respaldoE = hoja.getRange(4, 5, 100, 1).getDisplayValues();
  const compilarPrueba = () => {
    hoja.getRange(4, 2, 100, 1).clearContent();
    hoja.getRange(4, 2, PROGRAMA_PRUEBA_ALTO.length, 1).setValues(PROGRAMA_PRUEBA_ALTO.map(l => [l]));
    return Simulacion.compilar();
  };
  try {
    t.prueba('compilar escribe el ensamblador en la columna E y 5 × 3 da 15', () => {
      const r = compilarPrueba();
      t.igual(r.ok, true);
      t.igual(hoja.getRange(4, 5).getDisplayValue(), '.data');
      UnidadControl.ejecutarHastaDetener();
      t.igual(Memoria.leer(0x82), 15);
    });
    t.prueba('traza: se resaltan la línea de ensamblador y la de alto nivel en ejecución', () => {
      compilarPrueba();   // recarga: la prueba anterior dejó b = 0 en memoria
      // Instrucciones 1–3: LOAD, CMP, JZ (no salta). La 4.ª y la 5.ª vienen de "res = res + a" (línea 6)
      for (let i = 0; i < 4; i++) Simulacion.instruccion();
      Simulacion.paso();
      const lineas = Traza.lineasDe(UnidadControl.cargarEstado_().dirInstruccion);
      t.igual(lineas.alto, 6);
      t.igual(color(hoja.getRange(3 + lineas.alto, 2).getBackground()), color(COLORES.ACTIVO));
      t.igual(color(hoja.getRange(3 + lineas.ensamblador, 5).getBackground()), color(COLORES.ACTIVO));
    });
    t.prueba('compilar un programa con errores no lo carga y marca la línea en rojo', () => {
      hoja.getRange(4, 2, 100, 1).clearContent();
      hoja.getRange(4, 2, 2, 1).setValues([['var a = 1'], ['a = = 2']]);
      const r = Simulacion.compilar();
      t.igual(r.ok, false);
      t.igual(color(hoja.getRange(5, 2).getBackground()), color(COLOR_ERROR));
    });
  } finally {
    hoja.getRange(4, 2, 100, 1).setValues(respaldoB);
    hoja.getRange(4, 5, 100, 1).setValues(respaldoE);
    UtilMemoria.rangoMatriz().setValues(UtilMemoria.aMatriz(respaldoRam));
    Traza.guardarMapaAlto(null);
    Simulacion.reiniciar();
  }

  return t;
}
