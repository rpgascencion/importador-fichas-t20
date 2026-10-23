import { linhasDeItens, linhasDeCampos } from "./documento.mjs";

/**
 * Lê um PDF com o pdf.js (carregado por quem chama): texto posicionado + valores dos campos de formulário.
 * Devolve { linhas, campos } no formato do documento neutro. Não depende do layout da ficha.
 */
export async function lerPdfDocumento(bytes, pdfjs) {
	const doc = await pdfjs.getDocument({ data: bytes.slice(), useSystemFonts: true, isEvalSupported: false, verbosity: 0 }).promise;
	const linhas = [], campos = {};
	for (let p = 1; p <= doc.numPages; p++) {
		const page = await doc.getPage(p);
		const tc = await page.getTextContent();
		const itens = [];
		for (const i of tc.items) { if (typeof i.str !== "string" || !i.str.trim()) continue; itens.push({ t: i.str, x: i.transform[4], y: i.transform[5], w: i.width ?? i.str.length * 4 }); }
		let anns = [];
		try { anns = await page.getAnnotations({ intent: "display" }); } catch { /* sem anotações */ }
		for (const a of anns) {
			if (a.subtype !== "Widget" || a.hidden || (a.annotationFlags & (2 | 32))) continue;
			const nome = String(a.fieldName ?? "");
			const v = Array.isArray(a.fieldValue) ? a.fieldValue.join(", ") : a.fieldValue;
			if (v == null || v === "" || v === "Off" || v === "Yes") continue;
			if (a.checkBox || a.radioButton) continue;
			const [x0, y0, x1, y1] = a.rect;
			campos[nome] ??= String(v);
			itens.push({ t: String(v).replace(/\r/g, "\n"), x: x0, y: (y0 + y1) / 2 - 3, w: x1 - x0, campo: true, multi: y1 - y0 > 30 });
		}
		linhas.push(...linhasDeItens(itens, p));
	}
	return { linhas, campos };
}
