# Vector Driver Print Spike (2026-10-19)

**Hardware**: Zenpert 4T530, Windows driver, 300 dpi, 60×40 mm gap labels, USB001.

## Question

Driver mode currently sends an antialiased PNG; the Windows driver dithers it, so text
and barcodes are softer than native TSPL. Would a vector page/PDF be sharper?

## Experiments

1. **Vector PDF**: an HTML page with vector text and bwip-js SVG barcodes was exported
   with Electron `printToPDF` (`app/release/vector-pdf/vector-label.pdf`, gitignored):
   - MediaBox 169.92×113.04 pt (≈59.94×39.88 mm)
   - 0 image XObjects; Arial fonts embedded
   - Printing it through Electron's built-in PDF viewer produced a blank label — that
     viewer print path is not reliable.
2. **Vector HTML through the driver**: the same content (vector text + inline SVG
   barcode/QR) printed through `webContents.print` to the 4T530 produced one correctly
   oriented label, **close to TSPL and clearly sharper than the PNG driver path**.
3. **PNG driver path**: same label through the existing driver raster path was visibly
   softer, confirming the loss comes from the antialiased PNG + driver dithering.

## Conclusion

The format is not the deciding factor; **vector content** is. A vector PDF with a reliable
print path should behave like the vector HTML. The product change therefore uses Fabric
`StaticCanvas.toSVG()` for the page and bwip-js SVG for barcodes, with a per-page PNG
fallback for unsupported content. The final app-generated vector driver page was printed
on the 4T530 and matched the vector HTML result.

Evidence: `tests/e2e/vector-render.spec.ts`,
`specs/003-printing-pipeline/verification/hardware-matrix.md`.
