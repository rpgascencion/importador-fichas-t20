import { parsePdf } from "./parse-pdf.mjs";
import { parseXlsx, readWorkbook } from "./parse-xlsx.mjs";
import { parseGenerico, fichaValida } from "./parse-generico.mjs";
import { linhasDeTexto, linhasDePlanilha, linhasDeCampos, achatarJson } from "./documento.mjs";

export const EXTENSOES = [".pdf", ".xlsx", ".docx", ".txt", ".md", ".csv", ".tsv", ".json", ".html", ".htm", ".rtf"];

const esc = (s) => String(s).replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&amp;/g, "&");
const decodifica = (bytes) => { try { return new TextDecoder("utf-8", { fatal: true }).decode(bytes); } catch { return new TextDecoder("windows-1252").decode(bytes); } };

/** .docx: parágrafos de word/document.xml (tabelas viram linhas com colunas separadas por tab) */
async function textoDocx(bytes, JSZip) {
	const zip = await JSZip.loadAsync(bytes);
	const xml = (await zip.file("word/document.xml")?.async("string")) ?? "";
	if (!xml) throw new Error("O .docx não tem texto legível.");
	const brutos = (x) => [...x.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\s*\/>|<w:br\s*\/>/g)].map((m) => (m[1] ?? (m[0].startsWith("<w:tab") ? "\t" : "\n"))).join("");
	// linha de tabela -> um parágrafo com as células separadas por tab
	const plano = xml.replace(/<w:tr\b[\s\S]*?<\/w:tr>/g, (tr) => `<w:p><w:r><w:t>${[...tr.matchAll(/<w:tc\b[\s\S]*?<\/w:tc>/g)].map((tc) => brutos(tc[0]).replace(/\s+/g, " ").trim()).join("\t")}</w:t></w:r></w:p>`);
	return plano.split(/<\/w:p>/).map((p) => esc(brutos(p))).join("\n");
}
const textoHtml = (h) => esc(h.replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ").replace(/<\/(p|div|tr|li|h\d|br)>|<br\s*\/?>/gi, "\n").replace(/<\/t[dh]>/gi, "\t").replace(/<[^>]+>/g, ""));
const textoRtf = (r) => r.replace(/\\par[d]?/g, "\n").replace(/\\'([0-9a-f]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16))).replace(/\{\\\*[^{}]*\}/g, "").replace(/\\[a-z]+-?\d* ?/gi, "").replace(/[{}]/g, "");

/**
 * Lê uma ficha de qualquer arquivo suportado. Primeiro tenta os formatos conhecidos (leitura nativa);
 * se não for nenhum deles, cai no leitor genérico por palavras-chave.
 * libs: { PDFLib, JSZip, carregarPdfjs } (cada uma só é pedida quando o formato precisa).
 */
export async function lerArquivo(nomeArquivo, bytes, libs) {
	const nome = String(nomeArquivo).toLowerCase();
	const ext = EXTENSOES.find((e) => nome.endsWith(e));
	if (!ext) throw new Error(`Formato não suportado (${nome.split(".").pop()}). Use PDF, xlsx, docx, txt, md, csv, json ou html.`);
	if (ext === ".pdf") {
		const PDFLib = await libs.PDFLib();
		return parsePdf(bytes, PDFLib, { carregarPdfjs: libs.carregarPdfjs });
	}
	if (ext === ".xlsx") {
		const JSZip = await libs.JSZip();
		try { const F = await parseXlsx(bytes, JSZip); if (F.nome || F.classes.length) return F; } catch (e) { if (!/aba "PJ"/.test(e.message)) console.warn("Importador de Fichas | xlsx fora do padrão:", e.message); }
		const { sheets } = await readWorkbook(bytes, JSZip);
		const F = parseGenerico({ linhas: linhasDePlanilha(sheets) }); F.formato = "xlsx";
		return validar(F);
	}
	if (ext === ".json") {
		let obj; try { obj = JSON.parse(decodifica(bytes)); } catch { throw new Error("JSON inválido."); }
		const F = parseGenerico({ linhas: linhasDeCampos(achatarJson(obj)) }); F.formato = "json";
		return validar(F);
	}
	let texto;
	if (ext === ".docx") texto = await textoDocx(bytes, await libs.JSZip());
	else if (ext === ".html" || ext === ".htm") texto = textoHtml(decodifica(bytes));
	else if (ext === ".rtf") texto = textoRtf(decodifica(bytes));
	else if (ext === ".csv" || ext === ".tsv") texto = decodifica(bytes).split(/\r?\n/).map((l) => (ext === ".tsv" ? l : l.split(/[,;](?=(?:[^"]*"[^"]*")*[^"]*$)/).map((c) => c.replace(/^"|"$/g, "")).join("\t"))).join("\n");
	else texto = decodifica(bytes);
	const F = parseGenerico({ linhas: linhasDeTexto(texto) }); F.formato = ext.slice(1);
	return validar(F);
}

function validar(F) {
	if (!fichaValida(F)) throw new Error("Não encontrei dados de ficha no arquivo (nem atributos, nem perícias, nem nome e classe). Confira se ele tem palavras como Força, Destreza, Perícias, Classe, PV.");
	return F;
}
