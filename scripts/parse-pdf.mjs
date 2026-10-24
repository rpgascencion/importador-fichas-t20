import { emptyFicha, norm, num, attrKey, splitList } from "./ficha.mjs";
import { ehAreaRpg, parseAreaRpg } from "./parse-area-rpg.mjs";
import { lerPdfDocumento } from "./pdf-texto.mjs";
import { parseGenerico } from "./parse-generico.mjs";

/** Linha da ficha PDF -> perícia (campos "0NN" ficam em ordem de linha). */
const LINHAS = { acro: "01", ades: "02", atle: "03", atua: "04", cava: "05", conh: "06", cura: "07", dipl: "08", enga: "09", fort: "10", furt: "11", guer: "12", inic: "13", inti: "14", intu: "15", inve: "16", joga: "17", ladi: "18", luta: "19", mist: "20", pilo: "21", nobr: "22", ofi1: "23", ofi2: "24", perc: "25", pont: "26", refl: "27", reli: "28", sobr: "29", vont: "30" };
const CHECK = { acro: "acro", ades: "ades", atle: "atle", atua: "atua", cava: "caval", conh: "conhe", cura: "cura", dipl: "dipl", enga: "enga", fort: "forti", furt: "furti", guer: "guerra", inic: "ini", inti: "inti", intu: "intu", inve: "inve", joga: "joga", ladi: "ladi", luta: "luta", mist: "misti", nobr: "nobre", ofi1: "ofi1", ofi2: "ofi2", perc: "perce", pilo: "pilo", pont: "ponta", refl: "refle", reli: "reli", sobr: "sobre", vont: "vonta" };
const SELE = { acro: "Acro", ades: "Ades", atle: "Atle", atua: "Atua", cava: "Cava", conh: "Conh", cura: "Cura", dipl: "Dipl", enga: "Enga", fort: "Fort", furt: "Furt", guer: "Guer", inic: "Inic", inti: "Inti", intu: "Intu", inve: "Inve", joga: "Joga", ladi: "Ladi", luta: "Luta", mist: "Mist", nobr: "Nobr", ofi1: "Ofi1", ofi2: "Ofi2", perc: "Perc", pilo: "Pilo", pont: "Pont", refl: "Refl", reli: "Reli", sobr: "Sobr", vont: "Vont" };

/** Lê a ficha editável de 2 páginas (PDF com campos de formulário). `PDFLib` é a biblioteca pdf-lib. */
export async function lerCampos(bytes, PDFLib) {
	const doc = await PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
	const form = doc.getForm();
	const campos = {};
	for (const f of form.getFields()) {
		const n = f.getName(); let v = null;
		try {
			// instanceof: o pdf-lib minificado muda o nome das classes, então constructor.name não serve
			if (f instanceof PDFLib.PDFCheckBox) v = f.isChecked();
			else if (f instanceof PDFLib.PDFDropdown || f instanceof PDFLib.PDFOptionList) v = f.getSelected()?.[0] ?? null;
			else if (f instanceof PDFLib.PDFRadioGroup) v = f.getSelected() ?? null;
			else if (f instanceof PDFLib.PDFTextField) v = f.getText() ?? null;
		} catch { /* campo ilegível */ }
		if (!(n in campos) || (campos[n] == null || campos[n] === "")) campos[n] = v;
	}
	return campos;
}

export const ehFichaAntiga = (campos) => "NOME DO PERSONAGEM" in campos || ("CLASSE" in campos && "RAÇA" in campos && "ORIGEM" in campos);


/** Divide por vírgula só fora de parênteses. */
function virgulasFora(t) {
	const out = []; let d = 0, cur = "";
	for (const ch of t) {
		if (ch === "(") d++; else if (ch === ")") d = Math.max(0, d - 1);
		if (ch === "," && d === 0) { out.push(cur); cur = ""; } else cur += ch;
	}
	out.push(cur); return out;
}
const FONTES = { "defeitos de idade": "Defeito de idade", "defeito de idade": "Defeito de idade", "defeitos gerais": "Defeito geral", "defeito geral": "Defeito geral", "defeitos geral": "Defeito geral", "defeitos de classe": "Defeito de classe", "defeito de classe": "Defeito de classe" };
const ATR_BONUS = /^(for[cç]a|destreza|constitui[cç][aã]o|intelig[eê]ncia|sabedoria|carisma)\s*[+\-–−]\s*\d+$/i;
/**
 * Caixas de poderes da ficha de 2 páginas são texto livre: "lvl6 - Punição Divina", "Defeitos de idade (Teimoso)",
 * "Saque rápido (Origem)", linhas quebradas ("presente dos" / "deuses (3 melhorias)"), separadores "====Racial====".
 * Devolve só os nomes dos poderes e de onde vêm.
 */
export function listaPoderesFicha(textos) {
	const linhas = [];
	for (const raw of textos) for (const l of String(raw ?? "").split(/[\r\n]+/).map((x) => x.trim().replace(/^[-•·]\s+/, "")).filter(Boolean)) {
		const p = linhas[linhas.length - 1];
		if (p && /\b(de|do|da|dos|das|e|com|em)$/i.test(p) && !/^=+/.test(l)) linhas[linhas.length - 1] = `${p} ${l}`; else linhas.push(l);
	}
	const lista = [], fonte = {};
	for (let l of linhas) {
		if (/^=+/.test(l) || /=+$/.test(l)) continue;
		l = l.replace(/^lv(?:l|\.)?\s*\d+\s*[-–:]\s*/i, "").replace(/^\(\s*(?=[^)]*(?:,|$))/, (m) => (l.split("(").length > l.split(")").length ? "" : m));
		for (let n of virgulasFora(l)) {
			n = n.trim().replace(/[.,;]+$/, "").trim(); if (!n) continue;
			if (/^origem\s*:/i.test(n) || /^um poder geral/i.test(n) || ATR_BONUS.test(n)) continue;
			let src = "";
			const d = n.match(/^(defeitos?(?:\s+(?:de idade|gerais?|de classe))?)\s*\(\s*(.+)\)$/i);
			if (d) { src = FONTES[d[1].toLowerCase()] ?? "Defeito"; for (const x of virgulasFora(d[2])) { const nm = x.trim(); if (nm) { lista.push(nm); fonte[nm] = src; } } continue; }
			const sf = n.match(/^(.*?)\s*\(\s*(origem|classe|ra[cç]a|devo[cç][aã]o|defeito geral|defeito de idade|defeito de classe)\s*\)$/i);
			if (sf) { n = sf[1].trim(); src = FONTES[sf[2].toLowerCase()] ?? (sf[2][0].toUpperCase() + sf[2].slice(1).toLowerCase()); }
			if (!n) continue;
			lista.push(n); if (src) fonte[n] = src;
		}
	}
	return { lista, fonte };
}
const semSeparador = (arr) => arr.filter((x) => !/^=+/.test(x) && !/=+$/.test(x));

function parsePdfAntigo(campos) {
	const g = (n) => { const v = campos[n]; return v == null ? "" : String(v).trim(); };
	const F = emptyFicha(); F.formato = "pdf";
	F.nome = g("NOME DO PERSONAGEM"); F.jogador = g("JOGADOR"); F.raca = g("RAÇA"); F.origem = g("ORIGEM"); F.divindade = g("DIVINDADE");
	F.nivel = num(g("Lv"), 1);
	// "CLASSE" aceita "Guerreiro 3 / Ladino 2", "Guerreiro 3, Ladino 2" ou só "Guerreiro" (nível total)
	const cl = g("CLASSE");
	const partes = cl.split(/[\/+,;|]|\be\b/i).map((s) => s.trim()).filter(Boolean);
	for (const p of partes) {
		const m = p.match(/^(.*?)[\s-]*(\d{1,2})\s*(?:º|°|o)?$/) ?? p.match(/^(\d{1,2})\s*(?:º|°)?\s*(.*)$/);
		if (m && /^\d/.test(m[1])) F.classes.push({ nome: m[2].trim(), nivel: num(m[1], 1) });
		else if (m) F.classes.push({ nome: m[1].trim(), nivel: num(m[2], 1) });
		else F.classes.push({ nome: p, nivel: partes.length === 1 ? F.nivel : 1 });
	}
	if (F.classes.length === 1 && !/\d/.test(cl)) F.classes[0].nivel = F.nivel;
	F.pv = { max: num(g("PVs Totais"), null), atual: num(g("PVs Atuais"), null) };
	F.pm = { max: num(g("PMs Totais"), null), atual: num(g("PMs Atuais"), null) };
	for (const a of ["for", "des", "con", "int", "sab", "car"]) F.atributos[a] = num(g(a[0].toUpperCase() + a.slice(1)), 0);
	F.atributosFinais = true; // a ficha PDF guarda o valor final (já com a raça)
	for (const [id, linha] of Object.entries(LINHAS)) {
		const treinado = campos[`Mar Trei ${CHECK[id]}`] === true;
		const outros = num(g(linha + "4"), 0);
		const atr = attrKey(g("SeleAtrib" + SELE[id]));
		if (id === "ofi1" || id === "ofi2") {
			const nomeOf = g(id === "ofi1" ? "Ofício 1" : "Ofício_2");
			if (nomeOf) F.oficios.push({ nome: nomeOf, treinado });
			continue;
		}
		F.pericias[id] = { treinado, outros, atributo: atr };
	}
	for (let i = 1; i <= 5; i++) {
		const nome = g(`Ataque ${i}`); if (!nome) continue;
		F.ataques.push({ nome, bonus: g(`Bônus Atq ${i}`), dano: g(`Dano ${i}`), critico: g(`Crítico ${i}`), tipo: g(`Tipo ${i}`), alcance: g(`Alcance ${i}`) });
	}
	F.armadura = g("Armadura"); F.escudo = g("Escudo");
	F.defesa = num(g("CA"), null);
	F.proficiencias = g("Proficiências");
	F.dinheiro = g("T") === "" ? null : num(g("T"), null);
	const lp = listaPoderesFicha([g("HabRaçasOrigem"), g("HabClassePoderes"), g("Habilidades & Magias 1"), g("Habilidades & Magias 2")]);
	F.poderes = lp.lista; F.fontePoder = lp.fonte;
	F.magias = semSeparador(splitList(g("Magias")));
	F.equipamento = semSeparador(splitList(g("Equipamento"))).map((nome) => ({ nome, qtd: 1 }));
	F.notas = [g("Anotações"), g("Descrição")].filter(Boolean).join("\n\n");
	return F;
}

/**
 * Lê qualquer PDF de ficha. Ordem: (1) ficha "Área de RPG" (nativo); (2) ficha editável de 2 páginas (nativo);
 * (3) leitor genérico por palavras-chave, que usa o texto e os campos do PDF (precisa do pdf.js: opts.carregarPdfjs).
 */
export async function parsePdf(bytes, PDFLib, opts = {}) {
	let campos = {};
	try { campos = await lerCampos(bytes, PDFLib); } catch (e) { console.warn("Importador de Fichas | PDF sem formulário legível:", e?.message); }
	if (ehAreaRpg(campos)) {
		const F = parseAreaRpg(campos);
		if (F.vazia) throw new Error("Esta é a ficha Área de RPG em branco (só o modelo, sem dados de personagem). Preencha raça, classe, atributos etc. e importe de novo.");
		return F;
	}
	if (ehFichaAntiga(campos)) return parsePdfAntigo(campos);
	if (!opts.carregarPdfjs) throw new Error("PDF de formato desconhecido e o leitor de texto (pdf.js) não está disponível.");
	const pdfjs = await opts.carregarPdfjs();
	const { linhas, campos: camposTxt } = await lerPdfDocumento(bytes, pdfjs);
	const F = parseGenerico({ linhas, campos: { ...camposTxt, ...Object.fromEntries(Object.entries(campos).filter(([, v]) => typeof v === "string" && v.trim())) } });
	F.formato = "pdf";
	return F;
}
