/**
 * Configuracion.gs
 * Constantes globales compartidas por todos los módulos: nombres de hojas,
 * mapa de memoria, posiciones de la matriz y paleta de colores.
 * Aquí solo hay constantes, nada de lógica.
 */

const HOJAS = {
  CPU: 'CPU',
  BUSES: 'Buses',
  RAM: 'RAM',
  CODIGO: 'Código',
  COMPILADOR: 'Compilador',
  LOG: 'Log',
  ISA: 'ISA',
  CACHE_IO: 'Cache_IO',
  SWAP: 'Swap',
  TABLA_MARCOS: 'TablaMarcos'
};

/** Mapa de memoria (espacio de direcciones de 8 bits: 00h–FFh). */
const MAPA_MEMORIA = {
  TAMANO: 256,
  CODIGO_INICIO: 0x00,
  CODIGO_FIN: 0x7F,
  DATOS_INICIO: 0x80,
  DATOS_FIN: 0xFF,
  BYTE_MAX: 0xFF
};

/** Posición de la matriz 16x16 dentro de la hoja RAM (base 1). */
const MATRIZ_RAM = {
  FILA_ENCABEZADO: 3,   // fila con los encabezados de columna +0..+F
  PRIMERA_FILA: 4,      // primera fila de datos (direcciones 00h–0Fh)
  COL_ENCABEZADO: 2,    // columna B: encabezados de fila 00h..F0h
  PRIMERA_COL: 3,       // columna C: nibble bajo 0
  TAMANO: 16
};

/** Posición del inspector de memoria dentro de la hoja RAM. */
const INSPECTOR = {
  ENTRADA: 'U4',        // dirección que escribe el usuario (hex)
  COL_ETIQUETA: 20,     // columna T
  COL_VALOR: 21         // columna U
};

/** Paleta de colores de todo el libro. */
const COLORES = {
  ENCABEZADO_FONDO: '#263238',
  ENCABEZADO_TEXTO: '#FFFFFF',
  TITULO: '#263238',
  SEG_CODIGO: '#E3F2FD',   // celeste     -> segmento de código
  SEG_DATOS: '#E8F5E9',    // verde claro -> segmento de datos
  ACTIVO: '#FFD54F',       // ámbar       -> componente / celda activa (destino)
  ORIGEN: '#B3E5FC',       // celeste     -> origen de una transferencia
  REGISTRO: '#ECEFF1',     // gris        -> registro en reposo
  UNIDAD_CONTROL: '#DDE7F7',
  UNIDAD_ALU: '#EEF5DC',
  UNIDAD_MEMORIA: '#F6E3E3',
  ENTRADA: '#FFF8E1',
  BORDE: '#90A4AE'
};
