import { norm } from "./ficha.mjs";

/** Prioridade dos compêndios: sistema primeiro, depois suplementos e módulos próprios. */
const prio = (pack) => (pack.startsWith("tormenta20.") ? 0 : pack.startsWith("suplementos-de-arton.") ? 1 : 2);
let _index = null;

/** Indexa todos os compêndios de Item do sistema Tormenta20 e dos módulos instalados. */
/** Itens do mundo (poderes próprios) também valem, como no importador de monstros do sistema; lidos a cada importação. */
const doMundo = () => (game.items?.contents ?? (Array.isArray(game.items) ? game.items : [])).map((it) => ({ name: it.name, n: norm(it.name), type: it.type, uuid: it.uuid, pack: "world", flags: it.flags ?? {}, subtipo: it.system?.subtipo ?? "" }));
export async function loadIndex(force = false) {
	if (_index && !force) return [..._index, ...doMundo()];
	const list = [];
	for (const pack of game.packs) {
		if (pack.documentName !== "Item") continue;
		const idx = await pack.getIndex({ fields: ["type", "flags", "system.subtipo"] });
		for (const e of idx) list.push({ name: e.name, n: norm(e.name), type: e.type, uuid: e.uuid, pack: pack.collection, flags: e.flags ?? {}, subtipo: e.system?.subtipo ?? "" });
	}
	list.sort((a, b) => prio(a.pack) - prio(b.pack));
	_index = list;
	return [...list, ...doMundo()];
}

const ATTR_FULL = { for: "Força", des: "Destreza", con: "Constituição", int: "Inteligência", sab: "Sabedoria", car: "Carisma" };
const base = (n) => n.replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
/** Remove asteriscos, preço "(1050 T$)" e espaços do nome como vem na ficha. */
export function limpar(name) {
	return String(name ?? "").replace(/\*/g, "").replace(/\(\s*\d[\d.,]*\s*(?:T\$|tp|po)\s*\)/gi, "").replace(/\s+/g, " ").trim();
}
const qualif = (name) => norm(String(name).match(/\(([^)]*)\)\s*$/)?.[1] ?? "");

/** Variações de um nome para tentar: completo, sem parênteses, sem "+N"/"xN" no fim. */
export function variants(name) {
	const out = new Set();
	const add = (s) => { const k = norm(s); if (k) out.add(k); };
	const nome = limpar(name);
	add(nome);
	const semParen = nome.replace(/\([^)]*\)/g, " ");
	add(semParen);
	for (const s of [nome, semParen]) add(String(s).replace(/\s*[+x×]\s*\d+\s*$/i, "").replace(/\s+\d+\s*$/i, ""));
	add(nome.split(":")[0]);
	add(semParen.replace(/\s+-\s+.*$/, ""));
	return [...out];
}

/**
 * Procura um item pelo nome entre os tipos informados. Devolve { entry, exact, resto } ou null.
 * opts.prefer: nomes (classe/raça/divindade) usados para escolher entre variantes "Nome (Qualificador)".
 */
export function find(index, name, types, opts = {}) {
	const pool = index.filter((e) => types.includes(e.type) && !e.flags?.["origens-t20"]?.origin && !e.flags?.["criador-t20"]?.origin);
	const prefer = (opts.prefer ?? []).map(norm).filter(Boolean);
	const nome = limpar(name);
	// "Aumento de Atributo - Sab" -> "Aumento de Atributo (Sabedoria)"
	const au = nome.match(/^aumento de atributo\s*[-–:(]\s*([^)]+)\)?$/i);
	if (au) {
		const k = norm(au[1]).slice(0, 3);
		if (ATTR_FULL[k]) { const hit = pool.find((e) => e.n === norm(`Aumento de Atributo (${ATTR_FULL[k]})`)); if (hit) return { entry: hit, exact: true }; }
	}
	const vs = variants(name);
	for (const v of vs) {
		const iguais = pool.filter((e) => e.n === v);
		const variantes = pool.filter((e) => e.n !== v && norm(base(e.name)) === v);
		const cands = [...iguais, ...variantes];
		if (!cands.length) continue;
		// mesmo nome em mais de um lugar ("Punição Divina" do Clérigo e da distinção Sumo-Sacerdote): prefere a da classe da ficha e, na dúvida, a que não é distinção
		const ehDist = (e) => /distinc/.test(e.pack) ? 1 : 0, daClasse = (e) => (e.subtipo && prefer.includes(norm(e.subtipo))) ? 0 : 1;
		iguais.sort((a, b) => daClasse(a) - daClasse(b) || ehDist(a) - ehDist(b));
		cands.sort((a, b) => (iguais.includes(b) ? 1 : 0) - (iguais.includes(a) ? 1 : 0) || daClasse(a) - daClasse(b) || ehDist(a) - ehDist(b));
		const pref = variantes.find((e) => prefer.some((p) => norm(qualif(e.name)).includes(p)));
		if (pref) return { entry: pref, exact: true };
		return { entry: cands[0], exact: !!iguais.length };
	}
	// prefixo: o nome da ficha = nome do compêndio + melhorias ("Ostensório Santificado Harmonizado"); só vale para itens, nunca para poderes/magias
	for (const v of vs) {
		let best = null;
		for (const e of pool) {
			const b = norm(base(e.name));
			if (!b || b.split(" ").length < 1 || b.length < 5) continue;
			if (opts.semResto && b.split(" ").length < 2) continue;      // poderes: só prefixo com 2+ palavras ("Círculo interno Nós" -> Círculo Interno), nunca "Presente"
			if (v.startsWith(b + " ") && (!best || b.length > best.b.length)) best = { e, b };
		}
		if (best) return { entry: best.e, exact: false, resto: v.slice(best.b.length).trim() };
	}
	// aproximado: todos os termos do nome aparecem no candidato, e o candidato é único
	for (const v of vs) {
		const toks = v.split(" ").filter((t) => t.length > 1);
		if (toks.length < 2) continue;
		const cand = pool.filter((e) => toks.every((t) => e.n.split(" ").includes(t)));
		const names = new Set(cand.map((c) => c.n));
		if (names.size === 1) return { entry: cand[0], exact: false };
	}
	return null;
}

const NIVEIS_PARCEIRO = ["iniciante", "veterano", "mestre"];
/** Parceiros ("Parceiro Montaria Trobo Iniciante", "Servo Morto-Vivo Ajudante Iniciante"): casa pelo tipo no compêndio de parceiros. */
export function findPartner(index, name) {
	const q = norm(limpar(name).replace(/^parceiro\b/i, ""));
	const nivel = NIVEIS_PARCEIRO.find((n) => q.split(" ").includes(n)) ?? null;
	let best = null;
	for (const e of index) {
		if (e.type !== "poder" || !/\.parceiros$/.test(e.pack)) continue;
		const tail = norm(e.name.split(":").pop());
		if (!tail) continue;
		if ((" " + q + " ").includes(" " + tail + " ") && (!best || tail.length > best.tail.length)) best = { e, tail };
	}
	return best ? { entry: best.e, nivel } : null;
}

/** Origens: itens marcados com a flag "origin" (módulo origens-t20 ou criador-t20). */
export function findOrigin(index, name) {
	const pool = index.filter((e) => e.flags?.["origens-t20"]?.origin || e.flags?.["criador-t20"]?.origin);
	const base = norm(String(name).split(/\s-\s/).pop());
	return pool.find((e) => e.n === norm(name)) ?? pool.find((e) => e.n === base) ?? null;
}

/** Classes da ficha que viram "Arcanista" + Caminho. */
export const CLASS_ALIAS = { bruxo: ["Arcanista", "Caminho do Arcanista: Bruxo"], feiticeiro: ["Arcanista", "Caminho do Arcanista: Feiticeiro"], mago: ["Arcanista", "Caminho do Arcanista: Mago"] };
