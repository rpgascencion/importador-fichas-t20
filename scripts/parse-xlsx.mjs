import { emptyFicha, norm, num, attrKey, SKILLS, splitList } from "./ficha.mjs";

const unesc = (s) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16))).replace(/&amp;/g, "&");
const textOf = (xml) => unesc([...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => m[1].replace(/<[^>]*>/g, "")).join(""));

/** Lê uma planilha .xlsx (zip + XML) sem biblioteca de planilhas. Devolve { sheets: { nome: { A1: valor } } }. */
export async function readWorkbook(bytes, JSZip) {
	const zip = await JSZip.loadAsync(bytes);
	const read = async (p) => (await zip.file(p)?.async("string")) ?? "";
	const wb = await read("xl/workbook.xml");
	const rels = await read("xl/_rels/workbook.xml.rels");
	const relMap = Object.fromEntries([...rels.matchAll(/<Relationship\b[^>]*>/g)].map((m) => {
		const id = m[0].match(/\bId="([^"]+)"/)?.[1]; const t = m[0].match(/\bTarget="([^"]+)"/)?.[1];
		return [id, t];
	}));
	const sst = await read("xl/sharedStrings.xml");
	const shared = [...sst.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map((m) => textOf(m[1]));
	const sheets = {};
	for (const m of wb.matchAll(/<sheet\b[^>]*>/g)) {
		const name = unesc(m[0].match(/\bname="([^"]*)"/)?.[1] ?? "");
		const rid = m[0].match(/\br:id="([^"]+)"/)?.[1];
		let target = relMap[rid]; if (!target) continue;
		target = target.replace(/^\/?(xl\/)?/, "xl/");
		const xml = await read(target);
		const cells = {};
		for (const c of xml.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
			const attrs = c[1], body = c[2] ?? "";
			const ref = attrs.match(/\br="([A-Z]+\d+)"/)?.[1]; if (!ref) continue;
			const t = attrs.match(/\bt="([^"]+)"/)?.[1];
			const v = body.match(/<v>([\s\S]*?)<\/v>/)?.[1];
			let val = null;
			if (t === "s" && v != null) val = shared[Number(v)] ?? "";
			else if (t === "inlineStr") val = textOf(body);
			else if (t === "str" || t === "e") val = v != null ? unesc(v) : null;
			else if (t === "b") val = v === "1";
			else if (v != null && v !== "") val = Number(v);
			if (val !== null && val !== "") cells[ref] = val;
		}
		// notas (comentários de célula) da aba
		const relsXml = await read(target.replace(/worksheets\/([^/]+)$/, "worksheets/_rels/$1.rels"));
		const cTarget = [...relsXml.matchAll(/<Relationship\b[^>]*>/g)].map((m) => m[0]).find((r) => /\/comments"/.test(r))?.match(/\bTarget="([^"]+)"/)?.[1];
		const comments = {};
		if (cTarget) {
			const cx = await read(cTarget.replace(/^\.\.\//, "xl/").replace(/^\/?(xl\/)?/, "xl/"));
			for (const cm of cx.matchAll(/<comment\b([^>]*)>([\s\S]*?)<\/comment>/g)) {
				const ref = cm[1].match(/\bref="([A-Z]+\d+)"/)?.[1]; if (!ref) continue;
				const t = textOf(cm[2]).replace(/\r/g, "").trim(); if (t) comments[ref] = t;
			}
		}
		Object.defineProperty(cells, "__comments", { value: comments, enumerable: false });
		sheets[name] = cells;
	}
	return { sheets };
}

/** Linha da planilha (PJ!G8..G36) -> perícia. */
const LINHAS = ["acro", "ades", "atle", "atua", "cava", "conh", "cura", "dipl", "enga", "fort", "furt", "guer", "inic", "inti", "intu", "inve", "joga", "ladi", "luta", "mist", "nobr", "ofic", "perc", "pilo", "pont", "refl", "reli", "sobr", "vont"];
const ATTR_CELLS = { for: "C12", des: "C17", con: "C22", int: "C27", sab: "C32", car: "C37" };
const FONTES = { R: "Raça", O: "Origem", D: "Divindade", I: "Idade", C: "Complicação" };
const FINAL_CELLS = { for: "C10", des: "C15", con: "C20", int: "C25", sab: "C30", car: "C35" };
const SPELL_ROWS = { 1: [50, 54], 2: [56, 59], 3: [61, 64], 4: [66, 68], 5: [70, 72] };
const vazio = (v) => v == null || v === "" || v === "-" || v === 0;
const txt = (v) => (vazio(v) ? "" : String(v).trim());

/** Lê a ficha da planilha "Ficha Template" (aba PJ). */
export async function parseXlsx(bytes, JSZip) {
	const { sheets } = await readWorkbook(bytes, JSZip);
	const pj = sheets["PJ"];
	if (!pj) throw new Error('A planilha não tem a aba "PJ". É a ficha template?');
	const g = (r) => pj[r];
	const F = emptyFicha(); F.formato = "xlsx"; F.notaPoder = {}; F.fontePoder = {}; F.magiasCirculo = {};
	F.nome = txt(g("B3")); F.jogador = /^\d+$/.test(txt(g("AO2"))) ? "" : txt(g("AO2"));
	F.raca = txt(g("S2")); F.origem = txt(g("Z2")).replace(/\s+/g, " ");
	for (const [c, n] of [["S4", "Z4"], ["AD4", "AK4"], ["AD5", "AK5"]]) {
		const nome = txt(g(c)); if (!nome) continue;
		F.classes.push({ nome, nivel: Math.max(1, num(g(n), 1)) });
	}
	F.nivel = F.classes.reduce((s, c) => s + c.nivel, 0);
	for (const [a, cell] of Object.entries(ATTR_CELLS)) F.atributos[a] = num(g(cell), 0);
	F.atributosFinais = false; // C12/C17/... = valor sem a raça
	F.atributosPlanilha = {};   // valores totais mostrados pela planilha (com raça, poderes e itens)
	for (const [a, cell] of Object.entries(FINAL_CELLS)) if (!vazio(g(cell)) && typeof g(cell) === "number") F.atributosPlanilha[a] = g(cell);
	LINHAS.forEach((id, i) => {
		const r = 8 + i;
		F.pericias[id] = { treinado: Number(g("G" + r)) === 1, outros: num(g("O" + r), 0), atributo: attrKey(g("M" + r)) };
	});
	F.pv = { max: vazio(g("V14")) ? null : num(g("V14")), atual: vazio(g("S14")) ? null : num(g("S14")) };
	F.pm = { max: vazio(g("AD14")) ? null : num(g("AD14")), atual: vazio(g("AA14")) ? null : num(g("AA14")) };
	for (let r = 26; r <= 31; r++) {
		const nome = txt(g("Q" + r)); if (!nome) continue;
		F.ataques.push({ nome, teste: txt(g("Z" + r)), bonus: txt(g("AD" + r)), dano: txt(g("AG" + r)), critico: txt(g("AK" + r)), tipo: txt(g("AO" + r)), alcance: txt(g("AT" + r)) });
	}
	F.armadura = txt(g("Q39")); F.escudo = txt(g("Q41"));
	F.dinheiro = vazio(g("Q44")) ? null : num(g("Q44"));
	const com = pj.__comments ?? {};
	F.notasCelulas = com;
	for (let r = 49; r <= 72; r++) {
		const nome = txt(g("U" + r)); if (!nome) continue;
		F.equipamento.push({ nome, qtd: Math.max(1, num(g("Q" + r), 1)), nota: com["U" + r] ?? "" });
	}
	for (const [circ, [a, b]] of Object.entries(SPELL_ROWS)) {
		for (let r = a; r <= b; r++) for (const col of ["C", "I"]) {
			const nome = txt(g(col + r)); if (!nome) continue;
			if (/^\(.*\)$/.test(nome.trim())) { F.futuros.push(nome); continue; }   // (Entre parênteses) = ainda não aprendida
			F.magias.push(nome); F.magiasCirculo[nome] = Number(circ);
		}
	}
	// poderes: raça/origem/divindade/idade (AP39..AP45) e classe/geral (AP47..AP68)
	for (const r of [39, 40, 41, 42, 43, 44, 45, ...Array.from({ length: 22 }, (_, i) => 47 + i)]) {
		const t = txt(g("AP" + r)); if (!t) continue;
		const nota = com["AP" + r] ?? "";
		const fonte = FONTES[String(g("AM" + r) ?? "").trim().toUpperCase()] ?? "";
		for (const seg of splitList(t)) {
			if (/^\(.*\)$/.test(seg)) { F.futuros.push(seg.slice(1, -1)); continue; }
			F.poderes.push(seg); F.notaPoder[seg] = nota; if (fonte) F.fontePoder[seg] = fonte;
		}
	}
	const car = txt(g("AL75")); if (car) F.notas = car;
	return F;
}
