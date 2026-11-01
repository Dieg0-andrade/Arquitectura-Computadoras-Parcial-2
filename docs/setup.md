# Instalación — Google Sheets + Apps Script + clasp

## 1. Crear la hoja de cálculo y su script
1. Crea una hoja de Google Sheets llamada **Simulador CPU**.
2. Abre **Extensiones → Apps Script**. Así se crea el proyecto de script vinculado a la hoja.
3. En el editor de Apps Script entra a **Configuración del proyecto** y copia el **ID de la secuencia de comandos** (Script ID).

## 2. Instalar clasp e iniciar sesión
```bash
npm install -g @google/clasp
clasp login
```
Activa la API de Apps Script en https://script.google.com/home/usersettings (ponla en **Activado**).

## 3. Vincular el repositorio
Desde la raíz del repositorio:
```bash
cp .clasp.json.example .clasp.json
# edita .clasp.json y pega tu Script ID
clasp push          # sube todo lo de /src al proyecto de script
```
`rootDir` es `src`, así que solo se sube el código de Apps Script.

## 4. Flujo de trabajo diario
```bash
clasp push   # después de editar en local
clasp pull   # si editaste en el editor web
git add . && git commit -m "feat(...): ..."
git push
```

## 5. Primera ejecución
1. Recarga la hoja. Aparece el menú **Simulador CPU**.
2. **Simulador CPU → Preparar libro** (la primera vez Google pide autorización).
3. **Simulador CPU → Pruebas → Ejecutar todas**. Deben salir 102/102 aprobadas.

## Convención de nombres
Todo el código usa nombres en español (funciones, variables, archivos y comentarios).
Se mantienen en inglés solo los nombres técnicos estándar: registros (PC, IR, MAR, MDR, AX, BX),
banderas (ZF, CF, SF), mnemónicos de la ISA (MOV, ADD, JMP…) y la API de Apps Script.

## Panel lateral
El panel es un archivo HTML: en el editor de Apps Script, **＋ → HTML**, nombre **`Panel`**, y pegar `src/Panel.html`
(con `clasp push` se sube solo).

## Estructura del proyecto
La estructura completa de módulos está en la sección 11 del [README](../README.md#11-estructura-del-código).

---

## Generar el script completo y probar en local (Parcial 2)

```
node herramientas/construir.js          # crea dist/SimuladorCompleto.gs (y dist/Panel.html)
node herramientas/probar-local.js       # corre las 102 pruebas con una hoja simulada
```

1. Abre `dist/SimuladorCompleto.gs`, copia todo y pégalo en el editor de Apps Script de tu copia de la hoja (reemplaza el contenido anterior).
2. Si usas el panel lateral, crea un archivo HTML llamado `Panel` y pega `dist/Panel.html`.
3. En la hoja, ejecuta el menú **Simulador CPU → Preparar libro** y luego **Pruebas → Ejecutar todas**.
4. La región de la hoja debe ser **Estados Unidos** (Archivo → Configuración).

`dist/` está en `.gitignore`: cada integrante lo genera en su máquina y no se sube.
La hoja simulada de `probar-local.js` no reemplaza probar en Google Sheets real.
