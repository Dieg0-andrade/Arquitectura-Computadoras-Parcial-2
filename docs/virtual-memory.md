# Virtual memory — module and verification (English)

**Project:** 8-bit CPU Simulator, Los Tigris — Computer Architecture.  
**Task:** 26, Issue #27.  
**Implementation:** Google Sheets and Apps Script.

## 1. Memory organization

The virtual address space has **512 bytes** (`000h–1FFh`, 9-bit addresses), split into **16 pages of 32 bytes**. Physical RAM contains **256 bytes**, arranged as **8 frames of 32 bytes** each. Frames 0–6 are replaceable; **frame 7** is reserved for virtual page **15** (memory-mapped I/O).

| Virtual segment | Addresses | VPN | Purpose |
|---|---|---|---|
| Code | `000h–0FFh` | 0–7 | Instructions; the PC remains 8 bits wide |
| Data | `100h–1DFh` | 8–14 | Variables and program data |
| I/O | `1E0h–1FFh` | 15 | Devices; VPN 15 is pinned to PFN 7 |

The keyboard uses `1F0h–1F7h`, and the LCD uses `1F8h–1FFh`. The **Swap** sheet simulates secondary storage using 16 pages of 32 bytes. Program loading uses pages 0–14; page 15 is reserved for I/O.

## 2. Address translation

The **MMU** computes:

```text
VPN            = virtualAddress >> 5
Offset         = virtualAddress & 31
PhysicalAddress = PFN * 32 + Offset
```

The **TablaMarcos** sheet displays `VPN`, `P` (present), `PFN` (physical frame number), `Dirty` (modified), and `Ref` (referenced). A page with `P = 0` has no assigned physical frame. For example, if VPN 8 resides in PFN 1, virtual address `103h` translates to physical address `023h`.

When virtual memory is disabled, the simulator keeps its first-midterm flat-RAM mode: code at `00h–7Fh` and data at `80h–FFh`.

## 3. Program loading and page faults

The virtual assembler generates a 512-byte image, placing code at `000h` and data at `100h`. Data symbols retain their full virtual addresses; `LOAD`/`STORE` instructions use 8-bit offsets relative to `100h`. The loader writes program pages to **Swap** and preloads up to seven pages into replaceable RAM frames without incrementing the page-fault counter.

If a CPU operation accesses a nonresident page, `AccesoMemoria` raises a `PAGE_FAULT`. The handler reads 32 bytes from Swap, finds a free frame or chooses a victim, and updates the page table. **UnidadControl** retries the failed micro-operation without incorrectly advancing the PC. The missing page is highlighted in red and the target RAM frame in yellow.

## 4. FIFO and LRU replacement

The replacement policy is selected in **TablaMarcos!H20**:

- **FIFO (First-In, First-Out):** evicts the resident page that was loaded first, even if it was accessed recently.
- **LRU (Least Recently Used):** evicts the resident page that has not been accessed for the longest time; reads and writes update access history.

VPN 15 can never be evicted. When a frame is reused, its cache lines are invalidated to prevent stale data from being read.

## 5. Dirty-page write-back

Reads set `Ref = 1`; writes also set `Dirty = 1`. If a dirty page becomes a victim, **ManejadorFallos** copies its current 32-byte RAM contents to Swap before loading the replacement page. A clean page does not require this write-back. If the page is requested again, it can be loaded from Swap with the modified bytes preserved.

The data cache uses *write-through* to RAM, whereas page-level **Dirty Write-Back** refers to the **RAM → Swap** copy at eviction time. These are distinct persistence layers.

## 6. Counters and visual feedback

The **TablaMarcos** sheet provides the FIFO/LRU selector, page-fault and eviction counters, and the most recently assigned frame. Columns G–H show the most recent page-fault details, and the **Log** sheet records the event. Running `prepararLibro()` rebuilds the simulator, so it should only be used on a test copy when existing data must be preserved.

## 7. Responsible source files

| File | Responsibility |
|---|---|
| `src/MMU.gs` | Virtual-to-physical address translation |
| `src/TablaMarcos.gs` | Visual page table and P/PFN/Dirty/Ref bits |
| `src/Swap.gs` | Reading and writing 32-byte pages |
| `src/ManejadorFallos.gs` | Page faults, FIFO/LRU, eviction, dirty write-back |
| `src/AccesoMemoria.gs` | MMU → cache → RAM integration |
| `src/Ensamblador.gs` | Virtual program image, Swap loading, RAM preloading |
| `src/pruebas/PruebasMemoriaVirtualFinal.gs` | Final tests for task 26 |

## 8. Reproducible tests

Run these commands from the repository root:

```powershell
node herramientas/construir.js
node herramientas/probar-local.js
```

In a **personal copy** of Google Sheets, paste `dist/SimuladorCompleto.gs`, refresh the spreadsheet, and run **Simulador CPU → Preparar libro**. Then use the Apps Script function selector to execute **`probarMemoriaVirtualFinal`**.

The suite checks scattered accesses, FIFO, LRU, dirty write-back, no write-back for clean pages, and protection of VPN 15. The Node-based emulator does not check actual spreadsheet rendering or colors; therefore the real Apps Script results must be checked separately. Record actual execution results in [`testing.md`](testing.md).

**Español:** [`memoria-virtual.md`](memoria-virtual.md).
