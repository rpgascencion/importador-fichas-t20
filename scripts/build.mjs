import { norm, SKILLS } from "./ficha.mjs";
import { apiItens, resolverEntradas, aplicarEntradas } from "./itens.mjs";
import { loadIndex, find, findOrigin, findPartner, limpar, CLASS_ALIAS } from "./match.mjs";

const POWER_TYPES = ["poder"];
const EQUIP_TYPES = ["equipamento", "arma", "consumivel", "tesouro"];
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const GENERICO = /^(magias?\b.*c[ií]rculo\)?|poderes? de classe|nenhum|-)\s*$/i;

/** Títulos de parágrafos de uma nota ("Nome. texto..."), usados como nomes alternativos. */
export function titulosNota(nota) {
	return String(nota ?? "").split(/\n\s*\n/).map((par) => par.trim()).map((par) => {
		const t = par.match(/^([^.\n]{2,60})\.\s/)?.[1] ?? (par.split("\n")[0].length <= 40 ? par.split("\n")[0] : "");
		return { titulo: t.replace(/\s*\([^)]*\)\s*$/, "").trim(), texto: par };
	}).filter((x) => x.titulo);
}
const paraHtml = (t) => `<p>${esc(t).replace(/\n+/g, "<br>")}</p>`;

/** Casa os nomes da ficha com os compêndios. Não altera nada: só produz o plano. */
export async function planImport(F) {
	const index = await loadIndex();
	const plan = { race: null, classes: [], paths: [], origin: null, powers: [], spells: [], items: [], partners: [], generic: [], genericPowers: [], weapons: [], armor: null, shield: null, abencoado: false, classPowers: [], missing: { race: null, classes: [], origin: null, powers: [], spells: [], items: [], armor: null, shield: null }, avisos: [...F.avisos] };
	const prefer = [];
	if (F.raca && !/^-$/.test(F.raca)) {
		const r = find(index, F.raca, ["race"]); if (r) { plan.race = r.entry; prefer.push(r.entry.name); } else plan.missing.race = F.raca;
	}
	for (const c of F.classes) {
		if (norm(c.nome) === "mundano") { plan.avisos.push("Classe Mundano ignorada (não existe como classe no sistema)."); continue; }
		const alias = CLASS_ALIAS[norm(c.nome)];
		const nomeClasse = alias ? alias[0] : c.nome;
		prefer.push(nomeClasse, c.nome);
		const r = find(index, nomeClasse, ["classe"]);
		if (r) {
			const ja = plan.classes.find((x) => x.entry.uuid === r.entry.uuid);
			if (ja) ja.nivel += c.nivel; else plan.classes.push({ entry: r.entry, nivel: c.nivel });
		} else plan.missing.classes.push(c.nome);
		if (alias) { const p = find(index, alias[1], POWER_TYPES); if (p && !plan.paths.some((x) => x.uuid === p.entry.uuid)) plan.paths.push(p.entry); }
	}
	// habilidades fixas da classe (módulo classes-extras-t20): poderes marcados com a classe e o nível em que são recebidos
	plan.classPowers = [];
	for (const c of plan.classes) {
		for (const e of index) {
			const f = e.flags?.["classes-extras-t20"];
			if (e.type === "poder" && f?.classe && norm(f.classe) === norm(c.entry.name) && Number(f.nivel) <= c.nivel && !plan.classPowers.some((x) => x.uuid === e.uuid)) plan.classPowers.push(e);
		}
	}
	if (F.origem && !/^-$/.test(F.origem)) {
		const o = findOrigin(index, F.origem);
		if (o) plan.origin = o; else plan.missing.origin = F.origem;
	}
	const opts = { prefer, semResto: true };
	for (const nomeBruto of F.poderes) {
		const nome = limpar(nomeBruto);
		if (!nome || GENERICO.test(nome)) continue;
		const cam = nome.match(/^caminho do arcanista\s*\(([^)]*)\)/i);
		if (cam) {
			const k = norm(cam[1]);
			if (/abencoad/.test(k)) plan.abencoado = true;
			const tipo = ["bruxo", "feiticeiro", "mago"].find((t) => k.includes(t));
			if (tipo) { const p = find(index, `Caminho do Arcanista: ${tipo[0].toUpperCase() + tipo.slice(1)}`, POWER_TYPES); if (p && !plan.paths.some((x) => x.uuid === p.entry.uuid)) plan.paths.push(p.entry); }
			continue;
		}
		let r = find(index, nome, POWER_TYPES, opts);
		if (r) { plan.powers.push({ nome, entry: r.entry, exact: r.exact, fonte: F.fontePoder?.[nomeBruto] ?? "" }); continue; }
		const sp = find(index, nome, ["magia"], opts);        // a ficha PDF mistura poderes e magias na mesma caixa
		if (sp) { plan.spells.push({ nome, entry: sp.entry, exact: sp.exact }); continue; }
		// nomes dos parágrafos da nota da célula, se houver
		const par = titulosNota(F.notaPoder?.[nomeBruto]).find((t) => norm(t.titulo) === norm(nome.replace(/\([^)]*\)/g, "")));
		if (par) { plan.genericPowers.push({ nome, texto: par.texto, fonte: F.fontePoder?.[nomeBruto] ?? "" }); plan.missing.powers.push(nome); continue; }
		plan.missing.powers.push(nome);
	}
	const seenS = new Set(plan.spells.map((s) => norm(s.nome)));
	for (const nome of F.magias) {
		const k = norm(limpar(nome)); if (!k || seenS.has(k)) continue; seenS.add(k);
		const r = find(index, nome, ["magia"], opts);
		if (r) { plan.spells.push({ nome, entry: r.entry, exact: r.exact }); continue; }
		const pa = findPartner(index, limpar(nome));                        // "Servo Cavalo de guerra" listado entre as magias
		if (pa) plan.partners.push({ nome: limpar(nome), entry: pa.entry, nivel: pa.nivel, nota: "" }); else plan.missing.spells.push(limpar(nome));
	}
	for (const it of F.equipamento) {
		const nome = limpar(it.nome);
		const nota = it.nota ?? "";
		let r = find(index, nome, EQUIP_TYPES, { prefer });
		if (r && r.entry.type === "poder") r = null;
		if (r) {
			const melhorias = r.resto ? r.resto.split(" ").filter(Boolean) : [];   // resolvidas na hora de criar (precisa do módulo classes-extras-t20 para melhorias novas)
			plan.items.push({ nome: it.nome, qtd: it.qtd, entry: r.entry, melhorias });
			continue;
		}
		const pa = findPartner(index, nome);
		if (pa) { plan.partners.push({ nome, entry: pa.entry, nivel: pa.nivel, nota }); continue; }
		plan.generic.push({ nome, qtd: it.qtd, nota });
		plan.missing.items.push({ nome, qtd: it.qtd, generico: true });
	}
	for (const a of F.ataques) {
		const r = find(index, a.nome, ["arma"]);
		plan.weapons.push({ ataque: a, entry: r?.entry ?? null, melhorias: r?.resto ? r.resto.split(" ").filter(Boolean) : [] });
	}
	if (F.armadura && !/^-$/.test(F.armadura)) { const r = find(index, F.armadura, ["equipamento"]); if (r) { plan.armor = r.entry; plan.armorMel = r.resto ? r.resto.split(" ").filter(Boolean) : []; } else plan.missing.armor = F.armadura; }
	if (F.escudo && !/^-$/.test(F.escudo)) {
		// só "Escudo" = escudo leve; só melhorias ("Vigilante") = escudo leve com essas melhorias
		const nomeEscudo = /^escudo$/i.test(limpar(F.escudo).trim()) ? "Escudo Leve" : F.escudo;
		let r = find(index, nomeEscudo, ["equipamento"]);
		if (r) { plan.shield = r.entry; plan.shieldMel = r.resto ? r.resto.split(" ").filter(Boolean) : []; if (nomeEscudo !== F.escudo) plan.avisos.push(`Escudo "${F.escudo}" na ficha: usei Escudo Leve.`); }
		else {
			const leve = find(index, "Escudo Leve", ["equipamento"]);
			if (leve && !/^escudo\b/i.test(limpar(F.escudo))) { plan.shield = leve.entry; plan.shieldMel = norm(limpar(F.escudo)).split(" ").filter(Boolean); plan.avisos.push(`Escudo "${F.escudo}" na ficha: não achei o item, usei Escudo Leve com "${limpar(F.escudo)}" como melhoria.`); }
			else plan.missing.shield = F.escudo;
		}
	}
	return plan;
}

/** melhorias/material/encantos pelo nome (lista do sistema e do classes-extras-t20, se ativo); o que não existir é ignorado.
 *  Com o t20-hayd-itens ativo, as melhorias entram depois pela API dele. */
function aplicarUpgrades(d, w) {
	const api = apiItens() ? null : game.modules?.get("classes-extras-t20")?.api;
	if (!(api?.chavePorNome && w?.length && d.system.upgrades)) return;
	const usados = new Set(); let slot = 1, slotE = 1;
	for (const t of [...w, ...w.slice(0, -1).map((x, i) => `${x} ${w[i + 1]}`)]) {
		const r = api.chavePorNome(d, t); if (!r || usados.has(r.chave)) continue;
		usados.add(r.chave);
		if (r.campo === "material") d.system.upgrades.material = r.chave; else if (r.campo === "encanto") { if (slotE <= 3) d.system.upgrades[`encanto${slotE++}`] = r.chave; } else if (slot <= 4) d.system.upgrades[`melhoria${slot++}`] = r.chave;
	}
}

const clone = async (entry, mut) => {
	const doc = await foundry.utils.fromUuid(entry.uuid); if (!doc) return null;
	const d = game.items.fromCompendium(doc); if (mut) mut(d); return d;
};

const pausa = (ms) => new Promise((r) => setTimeout(r, ms));
/** A raça concede poderes de forma assíncrona (depois do create): espera a contagem de itens estabilizar. */
async function esperarItens(actor, max = 6000) {
	let ultimo = -1, estavel = 0; const t0 = Date.now();
	while (Date.now() - t0 < max && estavel < 3) {
		const n = actor.items.size ?? actor.items.length;
		if (n === ultimo) estavel++; else { estavel = 0; ultimo = n; }
		await pausa(300);
	}
}
const contar = (actor, nome, type) => actor.items.filter((i) => i.name === nome && i.type === type).length;

/** Aplica o plano: cria (ou atualiza) o ator. Devolve { actor, rel }. */
export async function applyImport(F, plan, { actor = null } = {}) {
	const rel = { criados: [], avisos: [...plan.avisos], naoEncontrados: [], ajustes: [] };
	if (!actor) actor = await Actor.create({ name: F.nome || "Personagem importado", type: "character" });
	const opts = { importadorFichas: true };
	const getp = foundry.utils.getProperty;

	// 1. raça (concede poderes e bônus de atributo), depois classes (a primeira é a classe inicial)
	if (plan.race && !actor.items.some((i) => i.type === "race")) {
		await criar(actor, [await clone(plan.race)].filter(Boolean), opts, rel);
		await esperarItens(actor);
	}
	const temClasse = actor.items.some((i) => i.type === "classe");
	let primeira = !temClasse;
	const cls = [];
	for (const c of plan.classes) {
		if (actor.items.some((i) => i.type === "classe" && i.name === c.entry.name)) { rel.avisos.push(`O ator já tinha a classe ${c.entry.name}; nível não alterado.`); continue; }
		const ini = primeira; primeira = false;
		cls.push(await clone(c.entry, (d) => { d.system.niveis = c.nivel; if (ini) d.system.inicial = true; }));
	}
	await criar(actor, cls.filter(Boolean), opts, rel);

	// 2. caminhos, poder único da origem, poderes (conta repetições: Conhecimento Mágico x3 etc.)
	const itens = [];
	const falta = new Map();                       // "tipo|nome" -> quantas cópias a ficha pede
	const pedir = (entry, n = 1, fonte = "") => { const k = `${entry.type}|${entry.name}`; const v = falta.get(k) ?? { entry, n: 0, fonte: "" }; v.n += n; if (fonte && !v.fonte) v.fonte = fonte; falta.set(k, v); };
	for (const p of plan.paths) pedir(p);
	if (plan.origin) {
		const o = plan.origin.flags?.["origens-t20"]?.origin ?? plan.origin.flags?.["criador-t20"]?.origin;
		const uuid = o?.unique?.uuid ?? o?.powers?.find((x) => x.unique)?.uuid ?? (o?.kind === "single" ? o.power?.uuid : null);
		if (uuid) { const doc = await foundry.utils.fromUuid(uuid); if (doc && !plan.powers.some((p) => norm(p.entry.name) === norm(doc.name))) pedir({ uuid, name: doc.name, type: "poder" }); }
		rel.avisos.push(`Origem ${F.origem}: só o poder único foi adicionado. Confira os demais benefícios na ficha.`);
	}
	for (const e of plan.classPowers ?? []) pedir(e, 1, "Classe");
	for (const p of plan.powers) pedir(p.entry, 1, p.fonte);
	for (const s of plan.spells) pedir(s.entry);
	const marcaFonte = (fonte) => (d) => { if (fonte) d.system.description = { ...(d.system.description ?? {}), value: `<p><strong>Fonte na ficha:</strong> ${esc(fonte)}</p>${d.system.description?.value ?? ""}` }; };
	for (const { entry, n, fonte } of falta.values()) {
		const faltantes = n - contar(actor, entry.name, entry.type);
		for (let i = 0; i < faltantes; i++) itens.push(await clone(entry, marcaFonte(fonte)));
	}
	await criar(actor, itens.filter(Boolean), opts, rel);

	// 3. equipamento, armadura, escudo, armas, parceiros e itens sem equivalente
	const eq = [];
	const tem = (nome, type) => actor.items.some((i) => i.name === nome && i.type === type);
	for (const it of plan.items) {
		const nomeFinal = it.entry.name;
		if (tem(nomeFinal, it.entry.type)) continue;
		eq.push(await clone(it.entry, (d) => {
			d.system.qtd = it.qtd;
			// itens com efeitos só valem equipados: equipa os que dão bônus (a ficha já conta esses bônus)
			if (["equipamento", "arma"].includes(d.type) && (d.effects ?? []).some((e) => e.transfer)) d.system.equipado = true;
			aplicarUpgrades(d, it.melhorias);
		}));
	}
	if (plan.armor && !tem(plan.armor.name, "equipamento")) eq.push(await clone(plan.armor, (d) => { d.system.equipado = true; aplicarUpgrades(d, plan.armorMel); }));
	if (plan.shield && !tem(plan.shield.name, "equipamento")) eq.push(await clone(plan.shield, (d) => { d.system.equipado = true; aplicarUpgrades(d, plan.shieldMel); }));
	for (const w of plan.weapons) {
		if (w.entry) { if (!tem(w.entry.name, "arma")) eq.push(await clone(w.entry, (d) => aplicarUpgrades(d, w.melhorias))); }
		else {
			const a = w.ataque;
			eq.push({ name: a.nome, type: "arma", img: "systems/tormenta20/icons/itens/armas/espada-curta.webp", system: { description: { value: `<p><strong>Importada da ficha.</strong> Bônus de ataque: ${esc(a.bonus || "-")}. Dano: ${esc(a.dano || "-")}. Crítico: ${esc(a.critico || "-")}. Tipo: ${esc(a.tipo || "-")}. Alcance: ${esc(a.alcance || "-")}.</p>` } } });
			rel.avisos.push(`Arma "${a.nome}" não existe nos compêndios: criada como arma genérica (confira dano/ataque).`);
		}
	}
	for (const pa of plan.partners) {
		if (tem(pa.entry.name, "poder")) continue;
		eq.push(await clone(pa.entry, (d) => { if (pa.nivel) d.system.description = { ...(d.system.description ?? {}), value: `<p><strong>Nível do parceiro na ficha:</strong> ${esc(pa.nivel)}</p>${d.system.description?.value ?? ""}` }; }));
	}
	for (const g of plan.genericPowers) {
		if (tem(g.nome, "poder")) continue;
		eq.push({ name: g.nome, type: "poder", img: "systems/tormenta20/icons/poderes/destino.webp", system: { description: { value: `${g.fonte ? `<p><strong>Fonte na ficha:</strong> ${esc(g.fonte)}</p>` : ""}<p><em>Poder importado da ficha (sem equivalente nos compêndios).</em></p>${paraHtml(g.texto)}` } } });
	}
	for (const g of plan.generic) {
		const tipo = /^po[cç][aã]o\b/i.test(g.nome) ? "consumivel" : "tesouro";
		if (tem(g.nome, tipo)) continue;
		eq.push({ name: g.nome, type: tipo, system: { qtd: g.qtd, description: { value: `<p><em>Item importado da ficha (sem equivalente nos compêndios).</em></p>${g.nota ? paraHtml(g.nota) : ""}` } } });
	}
	const docsEq = await criar(actor, eq.filter(Boolean), opts, rel);
	const apiHayd = apiItens();
	const apiMel = apiHayd ? null : game.modules?.get("classes-extras-t20")?.api;
	if (apiHayd) {
		const palavras = new Map([...plan.items.map((i) => [i.entry.name, i.melhorias]), ...plan.weapons.filter((x) => x.entry).map((x) => [x.entry.name, x.melhorias]), [plan.armor?.name, plan.armorMel], [plan.shield?.name, plan.shieldMel]].filter(([n, m]) => n && m?.length));
		for (const doc of docsEq) {
			const w = palavras.get(doc.name); if (!w || !doc.id) continue;
			const feitas = await aplicarEntradas(apiHayd, doc, resolverEntradas(apiHayd, doc, w));
			if (feitas.length) rel.ajustes.push(`${doc.name}: ${feitas.join(", ")} (Itens Superiores)`);
		}
	} else if (apiMel?.criarEfeitosMelhorias) for (const doc of docsEq) { try { await apiMel.criarEfeitosMelhorias(doc); } catch (e) { console.warn("Importador de Fichas | melhorias de", doc.name, e); } }
	else if ([...plan.items, ...plan.weapons].some((i) => i.melhorias?.length) || plan.armorMel?.length || plan.shieldMel?.length) rel.avisos.push("Melhorias dos itens não aplicadas: ative o módulo t20-hayd-itens (ou o classes-extras-t20).");
	await esperarItens(actor, 2000);

	// 4. atributos: o valor da ficha é o total; ajusta a base para o sistema (raça + poderes + itens) chegar nele
	const upd = {};
	for (const [k, v] of Object.entries(F.atributos)) {
		const alvo = F.atributosPlanilha?.[k] ?? (F.atributosFinais ? v : null);
		const atual = actor.system.atributos?.[k];
		if (alvo == null || !atual) { upd[`system.atributos.${k}.base`] = v; continue; }
		const base = Number(atual.base ?? 0), valor = Number(atual.value ?? base);
		upd[`system.atributos.${k}.base`] = base + (alvo - valor);
	}
	for (const id of SKILLS) {
		const p = F.pericias[id]; if (!p) continue;
		if (p.treinado) upd[`system.pericias.${id}.treinado`] = true;
		if (p.outros) upd[`system.pericias.${id}.bonus`] = p.outros;
	}
	for (const o of F.oficios) if (o.treinado) upd["system.pericias.ofic.treinado"] = true;
	if (F.origem) upd["system.detalhes.origem"] = F.origem;
	if (F.divindade) upd["system.detalhes.divindade"] = F.divindade;
	if (F.dinheiro != null) upd["system.dinheiro.tp"] = F.dinheiro;
	await actor.update(upd);
	// atributo-chave das perícias diferente do padrão
	const upd2 = {};
	for (const id of SKILLS) {
		const p = F.pericias[id]; const cur = actor.system.pericias?.[id]?.atributo;
		if (p?.atributo && cur && cur !== p.atributo) upd2[`system.pericias.${id}.atributo`] = p.atributo;
	}
	if (Object.keys(upd2).length) await actor.update(upd2);
	// confere se os atributos bateram
	for (const [k, alvo] of Object.entries(F.atributosPlanilha ?? {})) {
		const v = Number(actor.system.atributos?.[k]?.value);
		if (Number.isFinite(v) && v !== alvo) rel.avisos.push(`Atributo ${k.toUpperCase()}: a ficha tem ${alvo} e o sistema calculou ${v}.`);
	}

	// 5. PV/PM: o máximo é calculado pelo sistema. Se a ficha tiver outro valor, só avisa (não compensa)
	for (const [tipo, dado] of [["pv", F.pv], ["pm", F.pm]]) {
		const res = actor.system.attributes?.[tipo]; if (!res) continue;
		if (dado.max != null && Number.isFinite(Number(res.max)) && dado.max !== Number(res.max))
			rel.avisos.push(`${tipo === "pv" ? "Pontos de vida" : "Pontos de mana"}: a ficha tinha ${dado.max} e o sistema calculou ${res.max}.`);
	}
	const upd4 = {};
	if (F.pv.atual != null) upd4["system.attributes.pv.value"] = F.pv.atual;
	if (F.pm.atual != null) upd4["system.attributes.pm.value"] = F.pm.atual;
	if (Object.keys(upd4).length) await actor.update(upd4);

	// 6. o que não casou vai para as anotações do ator
	const m = plan.missing;
	const naoCasou = [];
	if (m.race) naoCasou.push(`Raça: ${m.race}`); for (const c of m.classes) naoCasou.push(`Classe: ${c}`);
	if (m.origin) naoCasou.push(`Origem: ${m.origin}`);
	for (const p of m.powers) if (!plan.genericPowers.some((g) => g.nome === p)) naoCasou.push(`Poder/habilidade: ${p}`); for (const sp of m.spells) naoCasou.push(`Magia: ${sp}`);
	for (const i of m.items) if (!i.generico) naoCasou.push(`Item: ${i.qtd > 1 ? i.qtd + "x " : ""}${i.nome}`);
	if (m.armor) naoCasou.push(`Armadura: ${m.armor}`); if (m.shield) naoCasou.push(`Escudo: ${m.shield}`);
	for (const o of F.oficios) naoCasou.push(`Ofício: ${o.nome}${o.treinado ? " (treinado)" : ""}`);
	if (F.proficiencias) naoCasou.push(`Proficiências: ${F.proficiencias}`);
	rel.naoEncontrados = naoCasou;
	const futuros = F.futuros?.length ? `<p><strong>Previstos para níveis futuros (não importados):</strong> ${esc(F.futuros.map((x) => limpar(x)).join(", "))}</p>` : "";
	const notasPoder = [...new Set(naoCasou.length ? m.powers.map((p) => Object.entries(F.notaPoder ?? {}).find(([k]) => limpar(k) === p)?.[1]).filter(Boolean) : [])];
	if (naoCasou.length || F.notas || futuros || plan.generic.length) {
		const atual = getp(actor, "system.detalhes.biography.value") ?? "";
		const html = `${atual}<h3>Importado da ficha (${F.formato.toUpperCase()})</h3>${naoCasou.length ? `<p><strong>Sem correspondência nos compêndios:</strong></p><ul>${naoCasou.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}${notasPoder.map(paraHtml).join("")}${plan.generic.length ? `<p><strong>Itens criados como genéricos:</strong> ${esc(plan.generic.map((g) => g.nome).join(", "))}</p>` : ""}${futuros}${F.notas ? `<p>${esc(F.notas).replace(/\n/g, "<br>")}</p>` : ""}`;
		await actor.update({ "system.detalhes.biography.value": html });
	}
	return { actor, rel };
}

async function criar(actor, datas, opts, rel) {
	if (!datas.length) return [];
	const docs = [];
	try { const c = await actor.createEmbeddedDocuments("Item", datas, opts); rel.criados.push(...c.map((d) => d.name)); docs.push(...c); }
	catch (err) {
		console.error("Importador de Fichas | falha em lote, tentando um a um:", err);
		for (const d of datas) {
			try { const c = await actor.createEmbeddedDocuments("Item", [d], opts); rel.criados.push(...c.map((x) => x.name)); docs.push(...c); }
			catch (e) { console.error("Importador de Fichas | falha no item", d.name, e); rel.avisos.push(`Não foi possível adicionar "${d.name}".`); }
		}
	}
	return docs;
}

