/**
 * Ponte com o T20 Hayd Itens Superiores e Mágicos (t20-hayd-itens).
 * Com ele ativo, as melhorias, encantos e materiais citados no nome do item da ficha
 * ("Ostensório Santificado Harmonizado") entram no item pela API dele: ficam nas flags,
 * criam os efeitos e acertam o preço. É o mesmo formato que a T20 Hayd Loja lê, então
 * a loja já enxerga o que o item tem.
 */
const ID = "t20-hayd-itens";
const norm = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\([^)]*\)/g, " ").replace(/[^a-z0-9]+/g, " ").trim();
/** Tira o gênero/plural da palavra: "harmonizado" e "harmonizada" viram "harmoniz". */
const raiz = (w) => w.replace(/(os|as|o|a|e)$/, "");
const chave = (s) => norm(s).split(" ").filter(Boolean).map(raiz).join(" ");

/** API do t20-hayd-itens, só com o módulo ativo e pronto. */
export function apiItens() {
	const m = game.modules?.get(ID);
	return m?.active && m.api?.efeitos?.adicionarEntrada && m.api?.catalogo?.obterMelhorias ? m.api : null;
}

/**
 * Converte as palavras do nome da ficha em entradas do catálogo que servem ao item.
 * Tenta os nomes de várias palavras primeiro ("Cano Duplo"); palavra que não existe no catálogo é ignorada.
 * @returns {{tipo:"melhoria"|"encanto"|"material", key:string, nome:string}[]}
 */
export function resolverEntradas(api, doc, palavras) {
	const cat = api.catalogo;
	const cats = cat.categoriasDoItem?.(doc) ?? [];
	const serve = (def) => (def.cats ?? []).some((c) => cats.includes(c));
	const tabelas = [
		["melhoria", cat.obterMelhorias(), serve],
		["encanto", cat.obterEncantos(), serve],
		["material", cat.obterMateriais(), (def) => cat.materialServeNoItem?.(def, doc) ?? true]
	];
	const indice = new Map();   // chave do nome -> [{tipo,key,nome}]
	for (const [tipo, tabela, ok] of tabelas) {
		for (const [key, def] of Object.entries(tabela ?? {})) {
			if (!def?.nome || !ok(def)) continue;
			const k = chave(def.nome); if (!k) continue;
			if (!indice.has(k)) indice.set(k, []);
			indice.get(k).push({ tipo, key, nome: def.nome, principal: (def.cats ?? []).includes(cats[0]) ? 0 : 1 });
		}
	}
	for (const l of indice.values()) l.sort((a, b) => a.principal - b.principal);
	const w = palavras.flatMap((p) => norm(p).split(" ")).filter(Boolean).map(raiz);
	const out = [], vistos = new Set();
	for (let i = 0; i < w.length;) {
		let achou = null, n = 0;
		for (n = Math.min(4, w.length - i); n >= 1 && !achou; n--) achou = indice.get(w.slice(i, i + n).join(" "))?.[0] ?? null;
		if (achou) {
			if (!vistos.has(achou.key)) { vistos.add(achou.key); out.push(achou); }
			i += n + 1;
		} else i++;
	}
	return out;
}

/** Aplica as entradas no item (já criado no ator), uma de cada vez. @returns nomes aplicados */
export async function aplicarEntradas(api, item, entradas) {
	const feitas = [];
	for (const e of entradas) {
		try {
			if (e.tipo === "material") await api.efeitos.adicionarMaterial(item, e.key);
			else await api.efeitos.adicionarEntrada(item, e.key);
			feitas.push(e.nome);
			item = item.actor?.items.get(item.id) ?? item;
		} catch (err) { console.warn("Importador de Fichas | melhoria", e.nome, "em", item.name, err); }
	}
	return feitas;
}
