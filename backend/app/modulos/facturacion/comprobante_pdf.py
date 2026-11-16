"""Comprobante de pago en PDF (botón "Descargar comprobante PDF" de M3.3)."""

from zoneinfo import ZoneInfo

from fpdf import FPDF

from app.core.config import obtener_configuracion
from app.modulos.facturacion.esquemas import ComprobanteSalida

MARINO = (18, 58, 77)
PRIMARIO = (31, 94, 124)
SUAVE = (90, 102, 114)
BORDE = (211, 217, 222)
FONDO_TABLA = (230, 240, 245)
MEDIOS = {"EFECTIVO": "efectivo", "TRANSFERENCIA": "transferencia", "TARJETA": "tarjeta"}


def pesos(valor: float | None) -> str:
    return "$ " + f"{valor or 0:,.0f}".replace(",", ".")


def generar_pdf(comprobante: ComprobanteSalida) -> bytes:
    zona = ZoneInfo(obtener_configuracion().zona_horaria)
    pdf = FPDF(format="Letter")
    pdf.set_auto_page_break(auto=True, margin=18)
    pdf.add_page()
    pdf.set_margins(18, 18, 18)

    pdf.set_text_color(*MARINO)
    pdf.set_font("Helvetica", "B", 18)
    pdf.cell(0, 10, "Clínica Veterinaria", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(*SUAVE)
    pdf.cell(0, 6, "Comprobante de pago", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(4)

    pdf.set_text_color(*PRIMARIO)
    pdf.set_font("Helvetica", "B", 15)
    titulo = f"Factura {comprobante.numero}"
    if comprobante.estado == "ANULADA":
        titulo += " (ANULADA)"
    pdf.cell(0, 9, titulo, new_x="LMARGIN", new_y="NEXT")

    pdf.set_text_color(31, 41, 51)
    pdf.set_font("Helvetica", "", 10)
    emitida = comprobante.emitida_en.astimezone(zona)
    atencion = comprobante.fecha_atencion.astimezone(zona)
    datos = [
        ("Emitida", emitida.strftime("%d/%m/%Y %H:%M")),
        ("Paciente", f"{comprobante.paciente.nombre} · {comprobante.paciente.numero_historia}"),
        ("Propietario(a)", comprobante.propietario),
        ("Atención", f"{atencion:%d/%m/%Y} · {comprobante.servicio_principal or 'Consulta'}"),
    ]
    for etiqueta, valor in datos:
        pdf.set_font("Helvetica", "B", 10)
        pdf.cell(32, 6, etiqueta)
        pdf.set_font("Helvetica", "", 10)
        pdf.cell(0, 6, valor, new_x="LMARGIN", new_y="NEXT")
    pdf.ln(4)

    columnas = [("Descripción", 78), ("Lote", 28), ("Cant.", 16), ("Precio", 28), ("Subtotal", 30)]
    pdf.set_fill_color(*FONDO_TABLA)
    pdf.set_draw_color(*BORDE)
    pdf.set_text_color(*MARINO)
    pdf.set_font("Helvetica", "B", 10)
    for nombre, ancho in columnas:
        pdf.cell(ancho, 8, nombre, border="B", fill=True, align="R" if ancho <= 30 else "L")
    pdf.ln()
    pdf.set_text_color(31, 41, 51)
    pdf.set_font("Helvetica", "", 10)
    for detalle in comprobante.detalles:
        valores = [
            detalle.descripcion,
            detalle.lote or "-",
            str(detalle.cantidad),
            pesos(detalle.precio_unitario),
            pesos(detalle.subtotal),
        ]
        for (_, ancho), valor in zip(columnas, valores, strict=True):
            pdf.cell(ancho, 8, valor, border="B", align="R" if ancho <= 30 else "L")
        pdf.ln()
    pdf.ln(3)

    pdf.set_text_color(*MARINO)
    pdf.set_font("Helvetica", "B", 13)
    pdf.cell(0, 8, f"Total: {pesos(comprobante.total)}", new_x="LMARGIN", new_y="NEXT")
    pdf.set_text_color(*SUAVE)
    pdf.set_font("Helvetica", "", 10)
    medio = MEDIOS.get(comprobante.medio or "", "-")
    linea_pago = f"Medio de pago: {medio}"
    if comprobante.medio == "EFECTIVO":
        linea_pago += (
            f" · Recibido: {pesos(comprobante.valor_recibido)}"
            f" · Cambio: {pesos(comprobante.cambio)}"
        )
    pdf.cell(0, 6, linea_pago, new_x="LMARGIN", new_y="NEXT")
    if comprobante.estado == "ANULADA" and comprobante.anulada_en:
        anulada = comprobante.anulada_en.astimezone(zona)
        pdf.ln(2)
        pdf.multi_cell(
            0,
            6,
            f"Anulada el {anulada:%d/%m/%Y %H:%M} por {comprobante.anulada_por}. "
            f"Motivo: {comprobante.motivo_anulacion}",
        )
    return bytes(pdf.output())
