/** Utilidades comuns aos leitores de ficha. A "ficha" é um objeto neutro, independente do formato de origem. */
export const norm = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
export const num = (v, def = 0) => { const n = Number(String(v ?? "").replace(",", ".").replace(/[^\d.+-]/g, "")); return Number.isFinite(n) && String(v ?? "").trim() !== "" ? n : def; };
export const ATTRS = ["for", "des", "con", "int", "sab", "car"];
export const ATTR_NAME = { for: "for", des: "des", con: "con", int: "int", sab: "sab", car: "car" };
export const attrKey = (s) => { const k = norm(s).slice(0, 3); return ATTRS.includes(k) ? k : null; };
export const SKILLS = ["acro", "ades", "atle", "atua", "cava", "conh", "cura", "dipl", "enga", "fort", "furt", "guer", "inic", "inti", "intu", "inve", "joga", "ladi", "luta", "mist", "nobr", "ofic", "perc", "pilo", "pont", "refl", "reli", "sobr", "vont"];
/** Divide um texto livre em itens (linhas, ponto e vírgula, vírgulas fora de parênteses, marcadores). */
export function splitList(text) {
	if (!text) return [];
	const out = [];
	for (const line of String(text).split(/[\r\n;•·▪●■□♦►]+/)) {
		let depth = 0, cur = "";
		for (const ch of line) {
			if (ch === "(") depth++; if (ch === ")") depth = Math.max(0, depth - 1);
			if (ch === "," && depth === 0) { out.push(cur); cur = ""; } else cur += ch;
		}
		out.push(cur);
	}
	return out.map((s) => s.replace(/^\s*[-–—*]+\s*/, "").replace(/\s+/g, " ").trim()).filter((s) => s && s.length > 1);
}
export const emptyFicha = () => ({
	formato: "", nome: "", jogador: "", raca: "", origem: "", divindade: "",
	classes: [], nivel: 0, atributos: {}, atributosFinais: false,
	pericias: {}, oficios: [], ataques: [], armadura: "", escudo: "", defesa: null,
	pv: { max: null, atual: null }, pm: { max: null, atual: null }, dinheiro: null,
	proficiencias: "", poderes: [], magias: [], equipamento: [], futuros: [], notas: "", avisos: []
});

/** "Guerreiro 3 / Ladino 2", "Guerreiro 3, Ladino 2", "3 Guerreiro" ou só "Guerreiro" (usa o nível total) -> [{ nome, nivel }] */
export function parseClasses(texto, nivelTotal = 1) {
	const classes = [];
	const cl = String(texto ?? "").trim();
	const partes = cl.split(/[\/+,;|]|\be\b/i).map((s) => s.trim()).filter(Boolean);
	for (const p of partes) {
		const m = p.match(/^(.*?)[\s-]*(\d{1,2})\s*(?:º|°|o)?$/) ?? p.match(/^(\d{1,2})\s*(?:º|°)?\s*(.*)$/);
		if (m && /^\d/.test(m[1])) classes.push({ nome: m[2].trim(), nivel: num(m[1], 1) });
		else if (m) classes.push({ nome: m[1].trim(), nivel: num(m[2], 1) });
		else classes.push({ nome: p, nivel: partes.length === 1 ? nivelTotal : 1 });
	}
	if (classes.length === 1 && !/\d/.test(cl)) classes[0].nivel = nivelTotal;
	return classes.filter((c) => c.nome);
}

/** Atributo-chave padrão de cada perícia do T20 e bônus de treino por nível (usados para deduzir "treinado" a partir do total). */
export const ATRIBUTO_PADRAO = { acro: "des", ades: "car", atle: "for", atua: "car", cava: "des", conh: "int", cura: "sab", dipl: "car", enga: "car", fort: "con", furt: "des", guer: "int", inic: "des", inti: "car", intu: "sab", inve: "int", joga: "car", ladi: "des", luta: "for", mist: "int", nobr: "int", ofic: "int", perc: "sab", pilo: "des", pont: "des", refl: "des", reli: "sab", sobr: "sab", vont: "sab" };
export const bonusTreino = (nivel) => (nivel >= 15 ? 6 : nivel >= 7 ? 4 : 2);
