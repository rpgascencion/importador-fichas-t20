/**
 * Documento neutro para o leitor genérico: uma lista de LINHAS, cada uma com CÉLULAS posicionadas.
 * Qualquer formato (PDF com ou sem formulário, planilha, texto, docx, json) é convertido para isso,
 * e o leitor genérico procura palavras-chave e os números/textos que estão perto delas.
 *   linha  = { y, pagina, virtual?, cel: [{ t, n, x, w }] }   (t = texto, n = texto normalizado, x/w = posição e largura)
 */
import { norm } from "./ficha.mjs";

const cel = (t, x, w) => ({ t: String(t).replace(/[ \t ]+/g, " ").trim(), n: norm(t), x, w });

/** Agrupa itens soltos { t, x, y, w } de uma página em linhas (tolerância vertical) e junta pedaços vizinhos em células. */
export function linhasDeItens(itens, pagina = 0, tolY = 3.5) {
	const ord = [...itens].filter((i) => String(i.t).trim() !== "").sort((a, b) => b.y - a.y || a.x - b.x);
	const grupos = [];
	for (const it of ord) {
		const g = grupos.find((g) => Math.abs(g.y - it.y) <= tolY);
		if (g) { g.itens.push(it); g.y = (g.y * (g.itens.length - 1) + it.y) / g.itens.length; } else grupos.push({ y: it.y, itens: [it] });
	}
	grupos.sort((a, b) => b.y - a.y);
	return grupos.map((g) => {
		const its = g.itens.sort((a, b) => a.x - b.x);
		const cels = [];
		for (const it of its) {
			const ult = cels[cels.length - 1];
			// pedaços colados (mesma palavra/frase quebrada pelo PDF) viram uma célula só; o texto de widgets nunca é colado
			if (ult && !it.campo && !ult.campo && it.x - (ult.x + ult.w) < 5 && !String(it.t).includes("\n")) {
				ult.t += (it.x - (ult.x + ult.w) > 0.8 ? " " : "") + it.t; ult.w = it.x + it.w - ult.x;
			} else cels.push({ t: it.t, x: it.x, w: Math.max(it.w, 1), campo: !!it.campo });
		}
		return { y: g.y, pagina, cel: cels.map((c) => cel(c.t, c.x, c.w)) };
	});
}

/** Texto corrido (txt, md, csv, docx...): cada linha vira uma linha; colunas por tab, "|", ";" ou 2+ espaços. */
export function linhasDeTexto(texto) {
	const out = [];
	let y = 0;
	for (const bruta of String(texto ?? "").split(/\r?\n/)) {
		y -= 12;
		if (!bruta.trim()) continue;
		const partes = bruta.includes("\t") ? bruta.split("\t") : bruta.includes("|") ? bruta.split("|") : /;\s*\S/.test(bruta) && bruta.split(";").length >= 3 ? bruta.split(";") : bruta.split(/ {2,}/);
		const tabela = bruta.includes("\t") || bruta.includes("|") || partes.length > 1 && /;/.test(bruta);
		let x = 0, col = 0; const cels = [];
		// tabelas (tab, |, ;): coluna = posição; texto com espaços: posição do caractere (alinhamento monoespaçado)
		for (const p of partes) { const t = p.trim(); if (t) cels.push(cel(t, tabela ? col * 100 : x, tabela ? 90 : t.length * 5)); x += (p.length + 2) * 5; col++; }
		if (cels.length) out.push({ y, pagina: 0, cel: cels, texto: true });
	}
	return out;
}

/** Planilha: { nome: { A1: valor } } -> linhas (a coluna vira x). */
export function linhasDePlanilha(sheets) {
	const out = [];
	const col = (s) => [...s].reduce((a, c) => a * 26 + c.charCodeAt(0) - 64, 0);
	let pag = 0;
	for (const cells of Object.values(sheets ?? {})) {
		const porLinha = new Map();
		for (const [ref, v] of Object.entries(cells)) {
			const m = ref.match(/^([A-Z]+)(\d+)$/); if (!m) continue;
			if (v === "" || v == null || typeof v === "boolean") continue;
			const r = Number(m[2]); if (!porLinha.has(r)) porLinha.set(r, []);
			porLinha.get(r).push({ t: String(v), x: col(m[1]) * 60, w: 55 });
		}
		for (const r of [...porLinha.keys()].sort((a, b) => a - b)) out.push({ y: -r * 12, pagina: pag, cel: porLinha.get(r).sort((a, b) => a.x - b.x).map((c) => cel(c.t, c.x, c.w)) });
		pag++;
	}
	return out;
}

/** Pares nome -> valor (campos de formulário, JSON achatado) viram linhas "virtuais" [nome | valor]. */
export function linhasDeCampos(campos) {
	const out = [];
	let y = 1e6;
	for (const [nome, v] of Object.entries(campos ?? {})) {
		if (v == null || typeof v === "boolean" || String(v).trim() === "") continue;
		y -= 1000;
		out.push({ y, pagina: -1, virtual: true, cel: [cel(nome.replace(/[._]+/g, " ").replace(/\s+\d+$/, ""), 0, 50), cel(String(v), 100, 50)] });
	}
	return out;
}

/** Achata um JSON (objeto/array) em pares "caminho -> valor" (só valores simples). */
export function achatarJson(obj, prefixo = "", out = {}, prof = 0) {
	if (prof > 6 || out.__n > 3000) return out;
	if (Array.isArray(obj)) obj.forEach((v, i) => achatarJson(v, prefixo, out, prof + 1));
	else if (obj && typeof obj === "object") for (const [k, v] of Object.entries(obj)) achatarJson(v, k, out, prof + 1);
	else if (obj != null && prefixo) { let k = prefixo, n = 1; while (k in out) k = `${prefixo} ${++n}`; out[k] = obj; }
	return out;
}
