/**
 * pruebas/PruebasEnsamblador.gs
 * Pruebas del ensamblador. Casi todas son puras (Ensamblador.ensamblar no toca
 * la hoja); la última carga un programa en la RAM y la restaura al final.
 */

function probarEnsamblador() {
  mostrarReporte_([suiteEnsamblador_()]);
}

/** Multiplicación por sumas sucesivas: res = a × b (usada también en las pruebas del CPU). */
const PROGRAMA_PRUEBA_MULTIPLICACION = [
  '.data',
  'a    DB 5',
  'b    DB 3',
  'res  DB 0',
  '.code',
  '       MOV AX, 0',
  '       STORE [res], AX',
  'bucle: LOAD BX, [b]',
  '       CMP BX, 0',
  '       JZ fin',
  '       DEC BX',
  '       STORE [b], BX',
  '       LOAD AX, [res]',
  '       LOAD BX, [a]',
  '       ADD AX, BX',
  '       STORE [res], AX',
  '       JMP bucle',
  'fin:   HLT'
];

function suiteEnsamblador_() {
  const t = crearSuite_('Ensamblador');
  const bytes = (res, desde, n) => res.memoria.slice(desde, desde + n).map(UtilMemoria.aHex).join(' ');

  // ── Léxico ──
  t.prueba('números: 15, 0x0F, 0Fh y -1', () => {
    t.igual(LexerEnsamblador.parsearNumero('15'), 15);
    t.igual(LexerEnsamblador.parsearNumero('0x0F'), 15);
    t.igual(LexerEnsamblador.parsearNumero('0Fh'), 15);
    t.igual(LexerEnsamblador.parsearNumero('-1'), 255);
    t.igual(LexerEnsamblador.parsearNumero('300'), null);
  });
  t.prueba('tokenizar ignora comentarios y clasifica cada palabra', () => {
    const tk = LexerEnsamblador.tokenizar('bucle: ADD AX, [x] ; suma', 1);
    t.igual(tk.map(x => x.tipo).join(' '), 'ETIQUETA MNEMONICO REGISTRO , [ IDENT ]');
  });

  // ── Generación de código ──
  t.prueba('MOV AX, 5 / ADD AX, BX / HLT → 10 05 21 00', () => {
    const r = Ensamblador.ensamblar(['MOV AX, 5', 'ADD AX, BX', 'HLT']);
    t.igual(r.ok, true);
    t.igual(bytes(r, 0, 4), '10 05 21 00');
  });
  t.prueba('CX y DX: MOV CX, 5 / MOV DX, 7 / ADD CX, DX / HLT → 18 05 19 07 8B 00', () => {
    const r = Ensamblador.ensamblar(['MOV CX, 5', 'MOV DX, 7', 'ADD CX, DX', 'HLT']);
    t.igual(r.ok, true);
    t.igual(bytes(r, 0, 6), '18 05 19 07 8B 00');
  });
  t.prueba('CX y DX: INC, DEC, CMP, LOAD y STORE se ensamblan', () => {
    const r = Ensamblador.ensamblar(['.data', 'x DB 9', '.code', 'LOAD CX, [x]', 'INC CX', 'DEC DX', 'CMP CX, 3', 'STORE [x], DX', 'HLT']);
    t.igual(r.ok, true);
    t.igual(bytes(r, 0, 9), '1A 80 60 63 68 03 1D 80 00');
  });
  t.prueba('CX y DX se escriben en minúsculas y no se pueden usar como nombre de variable', () => {
    t.igual(Ensamblador.ensamblar(['mov cx, 1', 'HLT']).ok, true);
    t.igual(Ensamblador.ensamblar(['.data', 'cx DB 1', '.code', 'HLT']).ok, false);
  });
  t.prueba('instrucciones que no existen con CX/DX dan error con número de línea', () => {
    const r = Ensamblador.ensamblar(['HLT', 'AND CX, 1']);
    t.igual(r.ok, false);
    t.igual(r.errores[0].linea, 2);
  });
  t.prueba('salto hacia adelante: JMP fin se resuelve en la segunda pasada', () => {
    const r = Ensamblador.ensamblar(['JMP fin', 'MOV AX, 1', 'fin: HLT']);
    t.igual(r.ok, true);
    t.igual(bytes(r, 0, 5), '40 04 10 01 00');
  });
  t.prueba('variables en .data desde 80h y acceso con [ ]', () => {
    const r = Ensamblador.ensamblar(['.data', 'x DB 7', 'y DB 0x10', '.code', 'LOAD AX, [x]', 'STORE [y], BX', 'HLT']);
    t.igual(r.ok, true);
    t.igual(bytes(r, 0x80, 2), '07 10');
    t.igual(bytes(r, 0, 5), '14 80 17 81 00');
    t.igual(r.simbolos.length, 2);
  });
  t.prueba('el listado tiene dirección, bytes y fuente de cada instrucción', () => {
    const r = Ensamblador.ensamblar(['MOV AX, 5', 'HLT']);
    t.igual(r.listado.length, 2);
    t.igual(r.listado[1].direccion, 2);
    t.igual(r.listado[0].fuente, 'MOV AX, 5');
  });
  t.prueba('programa de multiplicación: 23 bytes sin errores', () => {
    const r = Ensamblador.ensamblar(PROGRAMA_PRUEBA_MULTIPLICACION);
    t.igual(r.ok, true);
    const codigo = r.listado.filter(l => l.direccion <= MAPA_MEMORIA.CODIGO_FIN);
    const ultimo = codigo[codigo.length - 1];
    t.igual(ultimo.direccion + ultimo.bytes.length, 23);
    t.igual(r.listado.length - codigo.length, 3);
  });

  // ── Errores ──
  t.prueba('mnemónico desconocido informa la línea', () => {
    const r = Ensamblador.ensamblar(['MOV AX, 1', 'FOO AX']);
    t.igual(r.ok, false);
    t.igual(r.errores[0].linea, 2);
  });
  t.prueba('operandos no válidos (MOV AX sin dato)', () => {
    t.igual(Ensamblador.ensamblar(['MOV AX']).ok, false);
  });
  t.prueba('símbolo no definido y etiqueta duplicada', () => {
    t.igual(Ensamblador.ensamblar(['JMP nada']).ok, false);
    t.igual(Ensamblador.ensamblar(['a: HLT', 'a: HLT']).ok, false);
  });
  t.prueba('número fuera de 8 bits', () => {
    t.igual(Ensamblador.ensamblar(['MOV AX, 300']).ok, false);
  });

  // ── Integración con la hoja ──
  const respaldo = Memoria.volcar();
  try {
    t.prueba('cargarEnMemoria escribe código y datos en la RAM', () => {
      const r = Ensamblador.ensamblar(PROGRAMA_PRUEBA_MULTIPLICACION);
      Ensamblador.cargarEnMemoria(r);
      t.igual(Memoria.leer(0x00), 0x10);
      t.igual(Memoria.leer(0x80), 5);
      t.igual(Memoria.leer(0x81), 3);
    });
  } finally {
    UtilMemoria.rangoMatriz().setValues(UtilMemoria.aMatriz(respaldo));
  }

  return t;
}
