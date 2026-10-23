import { emptyFicha, norm, num, ATRIBUTO_PADRAO, bonusTreino, parseClasses, splitList } from "./ficha.mjs";
import { linhasDeCampos } from "./documento.mjs";
import { limparPoder, textoUtil } from "./parse-area-rpg.mjs";

/**
 * Leitor genérico: procura PALAVRAS-CHAVE (nome, raça, classe, FOR/DES..., nomes de perícias, PV, PM, defesa, T$...)
 * e pega o número ou texto que está ao lado (direita), em cima ou embaixo delas, em qualquer layout.
 * Entrada: { linhas, campos } (veja documento.mjs). Nunca inventa: o que não achar fica vazio e aparece nos avisos.
 */

const ATRIBUTOS = { for: ["for", "forca", "str", "strength"], des: ["des", "destreza", "dex", "dexterity"], con: ["con", "constituicao", "constitution"], int: ["int", "inteligencia", "intelligence"], sab: ["sab", "sabedoria", "wis", "wisdom"], car: ["car", "carisma", "cha", "charisma"] };
const PERICIAS = { acro: ["acrobacia"], ades: ["adestramento"], atle: ["atletismo"], atua: ["atuacao"], cava: ["cavalgar"], conh: ["conhecimento"], cura: ["cura"], dipl: ["diplomacia"], enga: ["enganacao"], fort: ["fortitude"], furt: ["furtividade"], guer: ["guerra"], inic: ["iniciativa"], inti: ["intimidacao"], intu: ["intuicao"], inve: ["investigacao"], joga: ["jogatina"], ladi: ["ladinagem"], luta: ["luta"], mist: ["misticismo"], nobr: ["nobreza"], ofic: ["oficio"], perc: ["percepcao"], pilo: ["pilotagem"], pont: ["pontaria"], refl: ["reflexos"], reli: ["religiao"], sobr: ["sobrevivencia"], vont: ["vontade"] };
const TXT = {
	nome: ["nome do personagem", "personagem", "nome", "name", "character name", "character"],
	jogador: ["jogador", "nome do jogador", "player"],
	raca: ["raca", "race"], origem: ["origem", "origin"], divindade: ["divindade", "deus", "devocao", "patrono"],
	classe: ["classe e nivel", "classe nivel", "classes", "classe", "class"]
};
const SECOES = {
	poderes: ["poderes", "habilidades", "poderes e habilidades", "habilidades e poderes", "habilidades de classe", "poderes de classe", "habilidades e magias", "habilidades magias", "poderes habilidades", "talentos"],
	magias: ["magias", "grimorio", "feiticos", "engenhocas", "magias e engenhocas", "magias conhecidas"],
	equip: ["equipamento", "equipamentos", "inventario", "itens", "item", "mochila", "pertences", "equipment", "inventory"],
	notas: ["anotacoes", "notas", "historia", "background", "personalidade", "biografia", "descricao"]
};
const PARAR = ["carga total", "sobrecarga", "carga maxima", "carregando", "bonus de carga", "pericias", "ataques", "armas", "armadura e escudo", "atributos", "pontos de vida", "pontos de mana", "defesa", "resistencias", "proficiencias", "deslocamento"];
const ROTULOS = new Set([
	...Object.values(ATRIBUTOS).flat(), ...Object.values(PERICIAS).flat(), ...Object.values(TXT).flat(), ...Object.values(SECOES).flat(), ...PARAR,
	"pea", "nivel", "nv", "lv", "total", "treino", "outros", "atributo", "teste de ataque", "ataque", "dano", "critico", "tipo", "alcance", "tamanho", "armadura", "escudo", "maximos", "atuais",
	"atributo chave", "mod", "teste de resistencia", "escola", "execucao", "area", "duracao", "resistencia", "efeito", "alvo", "carga", "peso", "espaco", "vestido", "pv", "pm", "pontos de experiencia", "xp", "descricao", "tibares", "dinheiro", "bonus", "penalidade", "mod de", "bonus de"
]);

const ehNum = (t) => /^[+\-–−]?\s*\d+([.,]\d+)?$/.test(String(t).trim());
const paraNum = (t) => Number(String(t).replace(/[–−]/g, "-").replace(/\s/g, "").replace(",", "."));
const centro = (c) => c.x + c.w / 2;
const sobrepoe = (a, b, folga = 30) => a.x - folga <= b.x + b.w && b.x - folga <= a.x + a.w;
const ehRotuloCel = (c) => ROTULOS.has(c.n) || ROTULOS.has(c.n.replace(/ g$/, ""));

class Doc {
	constructor(linhas) { this.L = linhas; }
	/** células cujo texto normalizado é igual (ou começa com) a um dos rótulos; devolve [{ ri, ci, c, inline }] */
	achar(rotulos, { prefixo = true, bruto = null } = {}) {
		const out = [];
		this.L.forEach((l, ri) => l.cel.forEach((c, ci) => {
			if (bruto && bruto.test(c.t.trim())) { const m = c.t.trim().match(/^(?:t\$|tp)\s*:?\s*(.+)$/i); out.push({ ri, ci, c, ...(m ? { inline: m[1] } : {}) }); return; }
			for (const r of rotulos) {
				if (c.n === r || (c.n.replace(/ g$/, "") === r)) { out.push({ ri, ci, c }); break; }
				if (prefixo && c.n.startsWith(r + " ") && c.t.length - r.length < 40) {
					const p = c.t.indexOf(":");
					if (p > 0 && norm(c.t.slice(0, p)) === r) { out.push({ ri, ci, c, inline: c.t.slice(p + 1).trim() }); break; }
					if (!/\d/.test(c.n.slice(r.length)) && c.n.split(" ").length <= 4 && ROTULOS.has(c.n)) { out.push({ ri, ci, c }); break; }
					// "PV 28/31", "Raça Elfo": rótulo seguido do valor, sem dois-pontos
					const k = r.split(" ").length, pal = c.t.trim().split(/\s+/);
					if (pal.length > k && norm(pal.slice(0, k).join(" ")) === r) {
						const resto = pal.slice(k).join(" ").replace(/^[:=\-–]\s*/, "");
						if (/^[\p{L}\d+\-–−(]/u.test(resto) && !ROTULOS.has(norm(resto)) && resto.length < 60) { out.push({ ri, ci, c, inline: resto }); break; }
					}
				}
			}
		}));
		return out;
	}
	/** próximas células à direita, na mesma linha */
	direita(ri, ci) { return this.L[ri].cel.slice(ci + 1); }
	/** células de linhas vizinhas (±1..2) com sobreposição horizontal; mais perto primeiro */
	vizinhas(ri, ci, { folga = 30, alcance = 6, so = 0 } = {}) {
		const base = this.L[ri], c = base.cel[ci];
		const out = [];
		if (base.virtual) return out;
		for (let d = 1; d <= alcance; d++) for (const s of (so ? [so] : [-1, 1])) {
			const r = this.L[ri + s * d]; if (!r || r.virtual || r.pagina !== base.pagina || Math.abs(r.y - base.y) > 60) continue;
			for (const o of r.cel) if (sobrepoe(c, o, folga)) {
				const contem = centro(c) >= o.x - 2 && centro(c) <= o.x + o.w + 2, toca = c.x <= o.x + o.w && o.x <= c.x + c.w;
				out.push({ c: o, dy: Math.abs(r.y - base.y), lado: s, ri: ri + s * d, tier: contem ? 0 : toca ? 1 : 2 });
			}
		}
		// 1º quem fica sob/sobre o centro do rótulo, 2º quem encosta nele, 3º quem só está perto; em cada grupo, o mais próximo
		const PEN = [0, 6, 14];
		return out.sort((a, b) => (a.dy + PEN[a.tier]) - (b.dy + PEN[b.tier]) || Math.abs(centro(a.c) - centro(c)) - Math.abs(centro(b.c) - centro(c)));
	}
}

/** Valor de texto ao lado de um rótulo: inline > direita (se a linha não é só de rótulos) > vizinho mais próximo */
function valorTexto(doc, rotulos, { aceita = () => true, usados = null } = {}) {
	const livre = (c) => !usados || !usados.has(c);
	const pega = (c) => { usados?.add(c); return c.t; };
	for (const h of doc.achar(rotulos)) {
		if (h.inline && aceita(h.inline)) return h.inline;
		const linha = doc.L[h.ri];
		const nRot = linha.cel.filter(ehRotuloCel).length;
		const dir = doc.direita(h.ri, h.ci).find((c) => c.t && !ehRotuloCel(c) && aceita(c.t) && livre(c));
		if (dir && (nRot < 2 || linha.virtual)) return pega(dir);
		const viz = doc.vizinhas(h.ri, h.ci).find((v) => v.c.t && !ehRotuloCel(v.c) && aceita(v.c.t) && livre(v.c));
		if (viz) return pega(viz.c);
		if (dir) return pega(dir);
	}
	return "";
}

/** Número ao lado de um rótulo (direita primeiro; opcionalmente também em cima/embaixo) */
function valorNumero(doc, rotulos, { vertical = true, texto = false, bruto = null } = {}) {
	for (const h of doc.achar(rotulos, { bruto })) {
		if (h.inline && /\d/.test(h.inline)) return h.inline;
		const dir = doc.direita(h.ri, h.ci).find((c) => (texto ? /\d/.test(c.t) : ehNum(c.t) || /^[+\-–−]?\d+\s*\(/.test(c.t)));
		if (dir) return dir.t;
		if (vertical) { const v = doc.vizinhas(h.ri, h.ci).find((x) => ehNum(x.c.t)); if (v) return v.c.t; }
	}
	return null;
}

const modDe = (t) => { const m = String(t).match(/\(([+\-–−]?\d+)\)/); return m ? paraNum(m[1]) : paraNum(t); };

function lerAtributos(doc, F, avisos) {
	const achados = {};
	// A) linha de cabeçalho com vários atributos (FOR DES CON INT SAB CAR) e os números logo acima/abaixo
	for (const [ri, l] of doc.L.entries()) {
		const hits = []; l.cel.forEach((c, ci) => { for (const [k, al] of Object.entries(ATRIBUTOS)) if (al.includes(c.n)) hits.push({ k, ci, c }); });
		if (new Set(hits.map((h) => h.k)).size < 4) continue;
		for (const h of hits) {
			if (achados[h.k] != null) continue;
			const v = doc.vizinhas(ri, h.ci, { folga: 12 }).find((x) => ehNum(x.c.t) || /^[+\-–−]?\d+\s*\(/.test(x.c.t));
			if (v) achados[h.k] = modDe(v.c.t);
		}
		if (Object.keys(achados).length >= 4) break;
	}
	// B) "FOR 14", "Força: 14", "Força (+2)"
	for (const [k, al] of Object.entries(ATRIBUTOS)) {
		if (achados[k] != null) continue;
		const v = valorNumero(doc, al, { vertical: false });
		if (v != null) achados[k] = modDe(v);
	}
	// C) texto corrido: "Força 14 Destreza 12 ..."
	const texto = doc.L.map((l) => l.cel.map((c) => c.t).join(" ")).join("\n");
	for (const [k, al] of Object.entries(ATRIBUTOS)) {
		if (achados[k] != null) continue;
		const m = texto.match(new RegExp(`(?:^|[^a-zà-ú])(?:${al.slice(0, 2).join("|")}|${al[1]})\\b\\.?\\s*[:=]?\\s*([+\\-–−]?\\d{1,2})(?:\\s*\\(([+\\-–−]?\\d+)\\))?`, "i"));
		if (m) achados[k] = m[2] != null ? paraNum(m[2]) : paraNum(m[1]);
	}
	const vals = Object.values(achados);
	if (vals.length >= 3 && Math.max(...vals) >= 13 && Math.min(...vals) >= 3) {
		for (const k of Object.keys(achados)) achados[k] = Math.floor((achados[k] - 10) / 2);
		avisos.push("Os atributos pareciam valores brutos (estilo 10 a 20); foram convertidos em modificadores (valor − 10 ÷ 2).");
	}
	return achados;
}

function lerRecurso(doc, tipo) {
	const T = tipo === "pv"
		? { max: ["pv maximo", "pvs maximos", "pv max", "pv total", "pvs totais", "pontos de vida maximos", "pontos de vida totais", "vida maxima", "vida total", "hp max", "max hp"], atual: ["pv atual", "pvs atuais", "pontos de vida atuais", "vida atual", "hp atual", "current hp"], geral: ["pontos de vida", "pv", "pvs", "vida", "hp"] }
		: { max: ["pm maximo", "pms maximos", "pm max", "pm total", "pms totais", "pontos de mana maximos", "pontos de mana totais", "mana maxima", "mana total", "mp max"], atual: ["pm atual", "pms atuais", "pontos de mana atuais", "mana atual", "mp atual"], geral: ["pontos de mana", "pm", "pms", "mana", "mp"] };
	const r = { max: null, atual: null };
	const mx = valorNumero(doc, T.max), at = valorNumero(doc, T.atual);
	if (mx != null) r.max = paraNum(mx);
	if (at != null) r.atual = paraNum(at);
	if (r.max != null) return r;
	for (const h of doc.achar(T.geral)) {
		const txt = h.inline ?? doc.direita(h.ri, h.ci).map((c) => c.t).slice(0, 3).join(" ");
		const par = txt.match(/^\s*(\d+)\s*(?:\/|de)\s*(\d+)/);
		if (!par && h.inline && /^\s*\d+\s*$/.test(h.inline)) return { max: Number(h.inline), atual: null };
		if (par) return { atual: Number(par[1]), max: Number(par[2]) };
		if (/^\s*\d+\s*$/.test(txt.split(" ")[0] ?? "") && !doc.L[h.ri].virtual && doc.direita(h.ri, h.ci)[1]?.t === "/") { const c = doc.direita(h.ri, h.ci); return { atual: Number(c[0].t), max: Number(c[2]?.t) }; }
		const dir = doc.direita(h.ri, h.ci).find((c) => ehNum(c.t));
		if (dir) return { max: paraNum(dir.t), atual: null };
		// números logo abaixo/acima do título; "Máximos"/"Atuais" dizem qual é qual
		for (const so of [1, -1]) {
			const viz = doc.vizinhas(h.ri, h.ci, { folga: 80, alcance: 2, so }).filter((v) => ehNum(v.c.t));
			if (!viz.length) continue;
			const linhaN = doc.L[viz[0].ri];
			const nums = linhaN.cel.filter((c) => ehNum(c.t) && Math.abs(centro(c) - centro(h.c)) < 90).sort((a, b) => a.x - b.x);
			if (!nums.length) continue;
			const sub = [-1, 1].flatMap((s) => { const rr = doc.L[doc.L.indexOf(linhaN) + s]; return rr && !rr.virtual ? rr.cel.filter((c) => /^(maximos?|atuais|atual|max|total)$/.test(c.n)) : []; });
			const pega = (palavras) => { const s = sub.filter((c) => palavras.test(c.n)); if (!s.length) return null; let best = null; for (const c of nums) { const d = Math.abs(centro(c) - centro(s.reduce((a, b) => Math.abs(centro(b) - centro(c)) < Math.abs(centro(a) - centro(c)) ? b : a))); if (!best || d < best.d) best = { c, d }; } return best?.c ?? null; };
			const cm = pega(/^(maximos?|max|total)$/), ca = pega(/^(atuais|atual)$/);
			if (cm) return { max: paraNum(cm.t), atual: ca && ca !== cm ? paraNum(ca.t) : null };
			if (nums.length >= 2) { const a = paraNum(nums[0].t), b = paraNum(nums[1].t); return { max: Math.max(a, b), atual: Math.min(a, b) }; }
			return { max: paraNum(nums[0].t), atual: null };
		}
	}
	return r;
}

function lerPericias(doc, F, nivel, avisos) {
	const meio = Math.floor((nivel || 1) / 2), treino = bonusTreino(nivel || 1);
	let achou = 0;
	for (const [id, al] of Object.entries(PERICIAS)) {
		const cands = [];
		doc.L.forEach((l, ri) => l.cel.forEach((c, ci) => {
			const n = c.n;
			const ok = al.some((a) => n === a || (n.startsWith(a) && n.length - a.length <= 2 && /^[a-z]{0,2}$/.test(n.slice(a.length).trim())) || (id === "ofic" && n.startsWith("oficio") ));
			if (ok) cands.push({ ri, ci, c });
		}));
		for (const h of cands) {
			const linha = doc.L[h.ri];
			// rótulo no cabeçalho de coluna? (muitas perícias alinhadas): só vale número/ND à direita na mesma linha
			let valor = null, nd = false, i = h.ci + 1;
			const dir = linha.cel.slice(h.ci + 1);
			const c0 = dir.find((c) => ehNum(c.t) || /^nd$/i.test(c.t.trim()) || /^[+\-–−]?\d+\s*\(/.test(c.t));
			if (c0) { if (/^nd$/i.test(c0.t.trim())) nd = true; else valor = modDe(c0.t); }
			if (valor == null && !nd && h.c.t.match(/[:=]\s*[+\-–−]?\d+/)) valor = paraNum(h.c.t.match(/[:=]\s*([+\-–−]?\d+)/)[1]);
			if (valor == null && !nd) continue;
			achou++;
			if (id === "ofic") { const nome = h.c.t.match(/\(([^)_]{2,})\)/)?.[1]; if (nome && valor != null) F.oficios.push({ nome: nome.trim(), treinado: true }); if (valor != null) F.pericias.ofic = F.pericias.ofic ?? { treinado: true, outros: 0, atributo: null }; continue; }
			if (nd) { F.pericias[id] = { treinado: false, outros: 0, atributo: null }; break; }
			// atributo-chave escrito na linha ("= 5 + Des")
			const atrLinha = linha.cel.map((c) => c.t).join(" ").match(/\+\s*(for|des|con|int|sab|car)\b/i)?.[1]?.toLowerCase() ?? null;
			F.pericias[id] = { total: valor, atributo: atrLinha && atrLinha !== ATRIBUTO_PADRAO[id] ? atrLinha : null, atrUsado: atrLinha ?? ATRIBUTO_PADRAO[id] };
			break;
		}
	}
	// deduz treinado/outros: total − ½ nível − atributo; se sobrar pelo menos o bônus de treino, está treinado
	const negativas = [];
	for (const [id, p] of Object.entries(F.pericias)) {
		if (p.total == null) continue;
		const atr = F.atributos[p.atrUsado] ?? 0;
		const dif = p.total - meio - atr;
		const treinado = dif >= treino;
		const outros = treinado ? dif - treino : dif;
		if (outros < 0) { negativas.push(id); F.pericias[id] = { treinado, outros: 0, atributo: p.atributo }; }   // provável penalidade de armadura: o sistema já calcula
		else F.pericias[id] = { treinado, outros, atributo: p.atributo };
	}
	if (achou >= 6 && negativas.length > achou / 2) {                      // a coluna lida não é de totais: melhor não importar do que importar errado
		for (const id of Object.keys(F.pericias)) F.pericias[id] = { treinado: false, outros: 0, atributo: F.pericias[id].atributo };
		avisos.push("Não consegui interpretar a coluna de perícias desta ficha (os números não parecem totais). As perícias treinadas não foram importadas: marque-as na ficha.");
		return achou;
	}
	if (negativas.length) avisos.push(`Perícias com total menor que o esperado (provável penalidade de armadura, que o sistema calcula sozinho): ${negativas.join(", ")}.`);
	return achou;
}

function lerAtaques(doc, F) {
	const COL = { bonus: ["teste de ataque", "ataque", "bonus de ataque", "bonus", "acerto"], dano: ["dano"], critico: ["critico", "crit"], tipo: ["tipo"], alcance: ["alcance"] };
	for (const [ri, l] of doc.L.entries()) {
		const cols = {};
		l.cel.forEach((c) => { for (const [k, al] of Object.entries(COL)) if (al.includes(c.n) && cols[k] == null) cols[k] = c; });
		if (!(cols.dano && (cols.critico || cols.bonus))) continue;
		const nomeCol = l.cel.find((c) => /^(ataques?|armas?|nome)$/.test(c.n));
		const limiteDir = Math.max(...Object.values(cols).map((c) => c.x + c.w)) + 12;
		const xNome = (nomeCol ? nomeCol.x : Math.min(...Object.values(cols).map((c) => c.x)) - 100) - 80;
		for (let k = 1; k <= 14; k++) {
			const r = doc.L[ri + k]; if (!r || r.pagina !== l.pagina) break;
			const cs = r.cel.filter((c) => c.x < limiteDir && c.x > xNome - 20);
			if (!cs.length) continue;
			if (cs.some((c) => ehRotuloCel(c) && !/\d/.test(c.n))) { if (cs.length <= 3) break; }
			const por = {};
			for (const c of cs.filter((c) => c.x + c.w / 2 >= (cols.bonus ?? cols.dano).x - 4)) { let best = null; for (const [kk, hc] of Object.entries(cols)) { const d = Math.abs(centro(c) - centro(hc)); if (!best || d < best.d) best = { kk, d }; } por[best.kk] = por[best.kk] ? `${por[best.kk]} ${c.t}` : c.t; }
			const nome = cs.filter((c) => c.x + c.w / 2 < (cols.bonus ?? cols.dano).x - 4 && !ehNum(c.t))[0]?.t;
			if (!nome || !/\d/.test(por.dano ?? "") ) continue;
			F.ataques.push({ nome, bonus: por.bonus ?? "", dano: por.dano ?? "", critico: por.critico ?? "", tipo: por.tipo ?? "", alcance: por.alcance ?? "" });
		}
		if (F.ataques.length) break;
	}
}

/** Entradas em ordem de leitura (blocos com várias linhas viram uma entrada por linha) para ler as seções em lista */
function fluxo(doc) {
	const out = [];
	doc.L.forEach((l, ri) => l.cel.forEach((c, ci) => {
		const partes = c.t.split("\n");
		partes.forEach((p, i) => { const t = p.trim(); if (t) out.push({ t, n: norm(t.replace(/^[=#*\-–:\s]+|[=#*\-–:\s]+$/g, "")), x: c.x, w: c.w, ri, ci, y: l.y, pagina: l.pagina, virtual: l.virtual, bloco: partes.length > 1 || c.t.length > 60 }); });
	}));
	return out;
}
const TITULO = [[/poder|habilidade|racial|origem|devot|talento|classe/, "poderes"], [/magia|circulo|feitico|engenhoca|grimorio/, "magias"], [/equip|invent|\bitens?\b|mochila|pertence/, "equip"]];
const secaoDoTitulo = (n) => { for (const [re, k] of TITULO) if (re.test(n)) return k; return "nenhuma"; };
const chaveSecao = (n) => Object.entries(SECOES).find(([, al]) => al.includes(n))?.[0] ?? null;
const decorado = (l) => /^\s*(={2,}|#{1,6}\s)/.test(l) && l.replace(/[=#*\-–\s]/g, "").length > 0;
const semInstrucoes = (t) => { let x = String(t ?? "").replace(/\*[^*]*\*/g, " "); const i = x.search(/exemplo de preenchimento/i); return i >= 0 ? x.slice(0, i) : x; };
const limpaTitulo = (l) => norm(l.replace(/^[=#*\-–:\s]+|[=#*\-–:\s]+$/g, ""));

function lerSecoes(doc) {
	const sec = { poderes: [], magias: [], equip: [] };
	const usa = (estado, t) => { if (estado && sec[estado]) sec[estado].push(t); };
	// uma sequência de linhas com títulos ("=== Poderes ===", "Magias:") ou sem (estado inicial vindo do rótulo)
	const percorre = (linhas, estado) => {
		for (const bruta of linhas) {
			const t = bruta.trim(); if (!t) continue;
			const n = limpaTitulo(t);
			if (decorado(t)) { estado = secaoDoTitulo(n); continue; }
			const k = chaveSecao(n) ?? (PARAR.includes(n) ? "nenhuma" : null);
			if (k && t.length < 40) { estado = k === "notas" ? "nenhuma" : k === "nenhuma" ? "nenhuma" : k; continue; }
			const m = t.match(/^([^:]{2,40}):\s*(.+)$/);
			if (m && chaveSecao(limpaTitulo(m[1])) && chaveSecao(limpaTitulo(m[1])) !== "notas") { sec[chaveSecao(limpaTitulo(m[1]))].push(m[2]); continue; }
			usa(estado, t);
		}
	};
	// (a) campos de formulário e textos de várias linhas
	for (const l of doc.L) {
		if (l.virtual) { const k = chaveSecao(l.cel[0].n); const v = l.cel[1]?.t ?? ""; if (k && k !== "notas" && !v.includes("\n")) { if (v.trim() && !/^\*|\*$/.test(v.trim())) sec[k].push(`\u0001${v.trim()}`); } else if (k && k !== "notas") percorre(semInstrucoes(v).split("\n"), k); else if (v.includes("\n")) percorre(semInstrucoes(v).split("\n"), null); continue; }
		if (l.texto) continue;
		for (const c of l.cel) if (c.t.includes("\n")) percorre(semInstrucoes(c.t).split("\n"), null);
	}
	// (b) texto corrido (txt/md/docx): máquina de estados linha a linha
	const txt = doc.L.filter((l) => l.texto);
	if (txt.length) percorre(txt.map((l) => l.cel.map((c) => c.t).join("  ")), null);
	// (c) PDF/planilha posicionados: título de seção + o que está logo abaixo, na mesma coluna
	doc.L.forEach((h, ri) => {
		if (h.virtual || h.texto) return;
		h.cel.forEach((hc) => {
			if (hc.t.includes("\n")) return;
			const dec = decorado(hc.t);
			const k = dec ? secaoDoTitulo(limpaTitulo(hc.t)) : chaveSecao(hc.n);
			if (!k || k === "notas" || k === "nenhuma" || (!dec && hc.t.length > 40)) return;
			for (const r of doc.L.slice(ri + 1, ri + 120)) {
				if (r.pagina !== h.pagina || h.y - r.y > 560) break;
				const cs = r.cel.filter((c) => !c.t.includes("\n") && (dec ? Math.abs(c.x - hc.x) < 60 : c.x + c.w > hc.x - 100 && c.x < hc.x + 200));
				if (!cs.length) continue;
				if (cs.some((c) => decorado(c.t) || PARAR.includes(c.n) || (chaveSecao(c.n) && c.t.length < 40))) break;
				for (const c of cs) { if (/^\*|\*$/.test(c.t.trim())) continue; sec[k].push(h.texto ? c.t : `\u0001${c.t}`); }
			}
		});
	});
	return sec;
}

export function parseGenerico({ linhas = [], campos = {} } = {}) {
	const L = [...linhas, ...linhasDeCampos(campos)];
	const doc = new Doc(L);
	const F = emptyFicha(); F.formato = "generico";
	const avisos = [];
	const lido = [];
	const usados = new Set();                                              // cada texto da ficha pertence a um campo só
	const txt = (k, aceita) => { const v = valorTexto(doc, TXT[k], { aceita, usados }); if (v) lido.push(k); return v.replace(/\s+/g, " ").trim(); };
	const semNumeroSolto = (t) => !/^[\d\s.,+\-–/]+$/.test(t);
	F.raca = txt("raca", semNumeroSolto); F.origem = txt("origem", semNumeroSolto); F.divindade = txt("divindade", semNumeroSolto);
	let nivelDaLinha = null;
	const classeTxt = (() => {
		const aceita = (t) => /[a-zà-ú]/i.test(t);
		for (const h of doc.achar(TXT.classe)) {
			if (h.inline && aceita(h.inline)) { lido.push("classe"); return h.inline; }
			const cand = doc.direita(h.ri, h.ci).find((c) => c.t && !ehRotuloCel(c) && aceita(c.t));
			const viz = doc.vizinhas(h.ri, h.ci).find((v) => v.c.t && !ehRotuloCel(v.c) && aceita(v.c.t) && !usados.has(v.c));
			const alvo = (doc.L[h.ri].cel.filter(ehRotuloCel).length < 2 || doc.L[h.ri].virtual) ? (cand ? { c: cand, ri: h.ri } : viz) : (viz ?? (cand ? { c: cand, ri: h.ri } : null));
			if (!alvo) continue;
			const linha = doc.L[alvo.ri ?? h.ri], i = linha.cel.indexOf(alvo.c);
			const prox = linha.cel[i + 1];
			if (prox && ehNum(prox.t) && paraNum(prox.t) >= 1 && paraNum(prox.t) <= 20 && prox.x - (alvo.c.x + alvo.c.w) < 110) nivelDaLinha = paraNum(prox.t);   // "Cruzado | 10": o nível mora na célula ao lado
			usados.add(alvo.c); lido.push("classe"); return alvo.c.t.replace(/\s+/g, " ").trim();
		}
		return "";
	})();
	F.jogador = txt("jogador", semNumeroSolto); F.nome = txt("nome", semNumeroSolto);
	const nv = valorNumero(doc, ["nivel", "nivel total", "nv", "lv", "level", "nc"], { vertical: false });
	F.nivel = nv != null ? Math.round(paraNum(nv)) : (nivelDaLinha ?? 0);
	F.classes = parseClasses(classeTxt, F.nivel || 1);
	if (!F.classes.length) {                                              // classes do T20 citadas em qualquer lugar do texto ("Guerreiro 5")
		const todo = L.map((l) => l.cel.map((c) => c.t).join(" ")).join("\n");
		const m = [...todo.matchAll(/\b(arcanista|b[áa]rbaro|bardo|bucaneiro|ca[çc]ador|cavaleiro|cl[ée]rigo|druida|guerreiro|inventor|ladino|lutador|nobre|paladino)\b\s*(?:n[íi]vel|nv\.?|lv\.?)?\s*(\d{1,2})/gi)];
		for (const x of m) F.classes.push({ nome: x[1][0].toUpperCase() + x[1].slice(1).toLowerCase(), nivel: Number(x[2]) });
	}
	if (!F.nivel) F.nivel = F.classes.reduce((a, c) => a + c.nivel, 0) || 1;
	else if (F.classes.length === 1 && !/\d/.test(classeTxt)) F.classes[0].nivel = F.nivel;
	// "Cruzado 10" lido como classe + nível na mesma célula: o nível vem da classe
	if (!nv && F.classes.length) F.nivel = F.classes.reduce((a, c) => a + c.nivel, 0);

	const atr = lerAtributos(doc, F, avisos);
	Object.assign(F.atributos, atr); F.atributosFinais = Object.keys(atr).length > 0;
	const pv = lerRecurso(doc, "pv"), pm = lerRecurso(doc, "pm");
	F.pv = { max: pv.max ?? null, atual: pv.atual ?? null }; F.pm = { max: pm.max ?? null, atual: pm.atual ?? null };
	const nPer = lerPericias(doc, F, F.nivel, avisos);

	// defesa: "30  =10 + ..." (padrão das fichas T20) ou rótulo "Defesa"/"CA" ao lado
	for (const [ri, l] of L.entries()) {
		const i = l.cel.findIndex((c) => /^=\s*10\b/.test(c.t)); if (i < 0) continue;
		if (i > 0 && ehNum(l.cel[i - 1].t)) { F.defesa = paraNum(l.cel[i - 1].t); break; }
		for (const d of [1, -1]) { const r = L[ri + d]; const n = r && !r.virtual && Math.abs(r.y - l.y) < 20 ? r.cel.filter((c) => ehNum(c.t) && c.x < l.cel[i].x).pop() : null; if (n) { F.defesa = paraNum(n.t); break; } }
		if (F.defesa != null) break;
	}
	if (F.defesa == null) { const d = valorNumero(doc, ["defesa", "ca", "armor class", "classe de armadura"], { vertical: false }); if (d != null) F.defesa = paraNum(d); }
	const din = valorNumero(doc, ["tibares", "dinheiro", "gold"], { vertical: true, bruto: /^(t\$|tp)\s*:?(\s*\d.*)?$/i });
	if (din != null) F.dinheiro = Math.round(paraNum(din));
	{ // tabela "ARMADURA & ESCUDO": a 1ª linha embaixo é a armadura e a 2ª o escudo
		const h = doc.achar(["armadura escudo", "armadura e escudo"])[0];
		if (h) { const nomes = []; for (let k = 1; k <= 4 && nomes.length < 2; k++) { const r = doc.L[h.ri + k]; if (!r || r.pagina !== doc.L[h.ri].pagina) break; const c = r.cel.find((x) => Math.abs(x.x - h.c.x) < 25 && !ehNum(x.t) && !ehRotuloCel(x) && /[a-zà-ú]{3}/i.test(x.t)); if (c) nomes.push(c.t); else if (r.cel.some((x) => /^(mod|bonus|defesa|penalidade|des)\b/i.test(x.n))) continue; } F.armadura = nomes[0] ?? ""; F.escudo = nomes[1] ?? ""; }
	}
	if (!F.armadura) F.armadura = valorTexto(doc, ["armadura", "armor"], { aceita: (t) => /[a-zà-ú]{3}/i.test(t) && !/^(defesa|penalidade|armadura|escudo|bonus)/i.test(norm(t)) }).trim();
	if (!F.escudo) F.escudo = valorTexto(doc, ["escudo", "shield"], { aceita: (t) => /[a-zà-ú]{3}/i.test(t) && !/^(defesa|penalidade|armadura|escudo|bonus)/i.test(norm(t)) }).trim();
	if (norm(F.armadura) === "armadura" || /^(armadura|escudo)\s*(&|e)\s*(escudo|armadura)\b/i.test(F.armadura)) F.armadura = "";
	lerAtaques(doc, F);

	// ---- listas: poderes, magias, equipamento ----
	const sec = lerSecoes(doc);
	const ruido = (s) => !s || s.length < 3 || norm(s).length < 3 || /^[\d\s.,+\-–/x×]+$/.test(s) || /^classe\s*\d/i.test(s) || /^-?\s*\(.*\)\s*$/.test(s) || /:\s*$/.test(s) || /^nome d[ao]\b/i.test(s) || /estilo de uma arma/i.test(s) || ehNum(s) || ROTULOS.has(norm(s)) || /^=+/.test(s) || /^\*/.test(s) || /^\(.*\)$/.test(s) || /^(\d+[ºo°]?\s*c[ií]rculo)/i.test(norm(s));
	const vistos = new Set();
	const fonte = {};
	for (const e of sec.poderes) for (const parte of (e.startsWith("\u0001") ? [e.slice(1).trim()] : splitList(e))) {
		const { nome, fonte: f } = limparPoder(parte);
		if (ruido(nome) || vistos.has(norm(nome)) || nome.length > 70 || /^per[ií]cias?\b/i.test(nome)) continue;
		if (/^(for[çc]a|destreza|constitui|intelig|sabedoria|carisma)\b.*[+\-–]\s*\d/i.test(nome)) continue;
		vistos.add(norm(nome)); F.poderes.push(nome); if (f) fonte[nome] = f;
	}
	if (Object.keys(fonte).length) F.fontePoder = fonte;
	const vm = new Set();
	for (const e of sec.magias) for (const parte of (e.startsWith("\u0001") ? [e.slice(1).split("|")[0].trim()] : splitList(e.split("|")[0]))) { const nome = parte.trim(); if (ruido(nome) || vm.has(norm(nome)) || nome.length > 60) continue; vm.add(norm(nome)); if (/^(servo|parceiro)\b/i.test(nome)) F.equipamento.push({ nome, qtd: 1 }); else F.magias.push(nome); }
	const ve = new Set(F.equipamento.map((i) => norm(i.nome)));
	const atq = new Set(F.ataques.map((a) => norm(a.nome).split(" ").slice(0, 3).join(" ")));
	for (const e of sec.equip) for (const parte of (e.startsWith("\u0001") ? [e.slice(1).trim()] : splitList(e))) {
		let nome = parte, qtd = 1;
		const q1 = nome.match(/^(\d+)\s*[x×]?\s+(.*)$/i), q2 = nome.match(/^(.*?)\s*[x×]\s*(\d+)$/i), q3 = nome.match(/^(.*?)\s*\((\d{1,3})\)$/);
		if (q1 && q1[2].length > 2) { qtd = Number(q1[1]); nome = q1[2]; } else if (q2) { nome = q2[1]; qtd = Number(q2[2]); } else if (q3) { nome = q3[1]; qtd = Number(q3[2]); }
		nome = nome.trim();
		const k = norm(nome);
		if (ruido(nome) || ve.has(k) || nome.length > 70 || atq.has(k.split(" ").slice(0, 3).join(" ")) || k === norm(F.armadura) || k === norm(F.escudo)) continue;
		ve.add(k); F.equipamento.push({ nome, qtd });
	}

	// ---- avisos ----
	const nAtr = Object.keys(atr).length;
	const faltam = [];
	if (!F.nome) faltam.push("nome"); if (!F.classes.length) faltam.push("classe"); if (nAtr < 6) faltam.push(`atributos (achei ${nAtr} de 6)`);
	F.avisos.push(`Ficha de formato desconhecido: li por palavras-chave (${nAtr} atributos, ${nPer} perícias, ${F.poderes.length} poderes, ${F.magias.length} magias, ${F.equipamento.length} itens, ${F.ataques.length} ataques). Confira os dados.`);
	if (faltam.length) F.avisos.push(`Não encontrei: ${faltam.join(", ")}.`);
	F.avisos.push(...avisos);
	F.reconhecidos = { atributos: nAtr, pericias: nPer, nome: !!F.nome, classes: F.classes.length };
	return F;
}

/** A leitura serve? (alguma coisa de ficha foi encontrada) */
export const fichaValida = (F) => !!F && ((F.reconhecidos?.atributos ?? 0) >= 3 || (F.reconhecidos?.pericias ?? 0) >= 5 || (!!F.nome && F.classes.length > 0));
