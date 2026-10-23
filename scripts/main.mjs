import { lerArquivo, EXTENSOES } from "./ler-arquivo.mjs";
import { planImport, applyImport } from "./build.mjs";

const MOD = "importador-fichas-t20";
const { DialogV2 } = foundry.applications.api;
const DLG = ["importador-t20-dlg"];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/** Carrega uma biblioteca local (pdf-lib / JSZip) uma única vez. */
const _loaded = {};
function loadLib(file, test) {
	if (test()) return Promise.resolve();
	return (_loaded[file] ??= new Promise((res, rej) => {
		const s = document.createElement("script");
		s.src = `modules/${MOD}/lib/${file}`; s.onload = res; s.onerror = () => rej(new Error(`Não foi possível carregar ${file}.`));
		document.head.appendChild(s);
	}));
}

/** pdf.js (só para PDFs de formato desconhecido): módulo ES local, carregado uma vez */
let _pdfjs = null;
async function carregarPdfjs() {
	if (_pdfjs) return _pdfjs;
	const rota = (f) => foundry.utils.getRoute(`modules/${MOD}/lib/${f}`);
	const mod = await import(rota("pdf.min.mjs"));
	mod.GlobalWorkerOptions.workerSrc = rota("pdf.worker.min.mjs");
	return (_pdfjs = mod);
}

async function lerFicha(file) {
	const bytes = new Uint8Array(await file.arrayBuffer());
	return lerArquivo(file.name, bytes, {
		PDFLib: async () => { await loadLib("pdf-lib.min.js", () => globalThis.PDFLib); return globalThis.PDFLib; },
		JSZip: async () => { await loadLib("jszip.min.js", () => globalThis.JSZip); return globalThis.JSZip; },
		carregarPdfjs
	});
}

function previa(F, plan) {
	const li = (arr) => arr.length ? arr.map((x) => `<li>${esc(x)}</li>`).join("") : "<li class='muted'>nenhum</li>";
	const m = plan.missing;
	const faltam = [m.race && `Raça: ${m.race}`, ...m.classes.map((c) => `Classe: ${c}`), m.origin && `Origem: ${m.origin}`, ...m.powers.map((p) => `Poder: ${p}`), ...m.spells.map((s) => `Magia: ${s}`), ...m.items.filter((i) => !i.generico).map((i) => `Item: ${i.nome}`), m.armor && `Armadura: ${m.armor}`, m.shield && `Escudo: ${m.shield}`].filter(Boolean);
	const trein = Object.entries(F.pericias).filter(([, v]) => v.treinado).map(([k]) => k);
	const atr = Object.entries(F.atributos).map(([k, v]) => `${k.toUpperCase()} ${v >= 0 ? "+" : ""}${v}`).join(" · ");
	return `<div class="importador-t20">
<p><strong>${esc(F.nome || "(sem nome)")}</strong> · nível ${F.nivel} · ${esc(F.raca || "sem raça")} · ${esc(F.classes.map((c) => `${c.nome} ${c.nivel}`).join(" / ") || "sem classe")}</p>
<p class="hint">${atr}</p>
<p class="hint">Formato: ${esc(F.fonteDoFormato ?? (F.formato === "generico" || !["pdf", "xlsx"].includes(F.formato) || F.avisos?.some((a) => /palavras-chave/.test(a)) ? "leitura genérica por palavras-chave" : F.formato))}</p>
<fieldset><legend>Será criado</legend><ul>
<li>Raça: ${esc(plan.race?.name ?? "—")}</li>
<li>Classes: ${esc(plan.classes.map((c) => `${c.entry.name} ${c.nivel}`).join(", ") || "—")}</li>
<li>Origem: ${esc(F.origem || "—")}${plan.origin ? " (poder único adicionado)" : ""}</li>
<li>Perícias treinadas: ${trein.length}</li>
<li>Poderes: ${plan.powers.length + plan.paths.length} · Magias: ${plan.spells.length}${plan.genericPowers.length ? ` · Poderes só da ficha: ${plan.genericPowers.length}` : ""}</li>
<li>Itens: ${plan.items.length + (plan.armor ? 1 : 0) + (plan.shield ? 1 : 0)} · Armas: ${plan.weapons.length} · Parceiros: ${plan.partners.length}</li>
${plan.generic.length ? `<li>Itens criados como genéricos: ${esc(plan.generic.map((g) => g.nome).join(", "))}</li>` : ""}</ul></fieldset>
<fieldset><legend>Sem correspondência (${faltam.length})</legend><ul class="miss">${li(faltam)}</ul><p class="hint">Esses itens vão para as Anotações do personagem.</p></fieldset>
${plan.avisos.length ? `<p class="hint">${plan.avisos.map(esc).join("<br>")}</p>` : ""}</div>`;
}

/** Fluxo completo: escolhe o arquivo, mostra a prévia e cria/atualiza o ator. */
export async function importarFicha(actor = null) {
	const arq = await DialogV2.wait({
		classes: DLG, window: { title: "Importar ficha", icon: "fa-solid fa-file-import" }, position: { width: 460 }, modal: true, rejectClose: false,
		content: `<div class="importador-t20"><p>Escolha a ficha: PDF (os modelos conhecidos são lidos direto; qualquer outro é lido pelas palavras-chave), planilha <strong>.xlsx</strong>, <strong>.docx</strong>, <strong>.txt</strong>, <strong>.md</strong>, <strong>.csv</strong> ou <strong>.json</strong>.${actor ? ` Os dados serão adicionados a <strong>${esc(actor.name)}</strong>.` : " Um novo personagem será criado."}</p>
<label class="row"><input type="file" name="arquivo" accept="${EXTENSOES.join(',')}"></label></div>`,
		buttons: [
			{ action: "ok", label: "Ler ficha", icon: "fa-solid fa-magnifying-glass", default: true, callback: (ev, btn, dlg) => dlg.element.querySelector("input[name=arquivo]").files[0] ?? null },
			{ action: "cancel", label: "Cancelar", icon: "fa-solid fa-xmark", callback: () => null }
		]
	});
	if (!arq) return;
	let F, plan;
	try { F = await lerFicha(arq); plan = await planImport(F); }
	catch (err) { console.error("Importador de Fichas |", err); return ui.notifications.error(`Importador: ${err.message}`); }
	const ok = await DialogV2.wait({
		classes: DLG, window: { title: "Importar ficha: conferir", icon: "fa-solid fa-clipboard-check" }, position: { width: 480 }, modal: true, rejectClose: false,
		content: previa(F, plan),
		buttons: [
			{ action: "ok", label: actor ? "Adicionar ao personagem" : "Criar personagem", icon: "fa-solid fa-check", default: true, callback: () => true },
			{ action: "cancel", label: "Cancelar", icon: "fa-solid fa-xmark", callback: () => false }
		]
	});
	if (!ok) return;
	try {
		const { actor: a, rel } = await applyImport(F, plan, { actor });
		a.sheet?.render(true);
		ui.notifications.info(`Ficha importada: ${a.name}.${rel.naoEncontrados.length ? ` ${rel.naoEncontrados.length} item(ns) sem correspondência foram para a Biografia.` : ""}`);
		if (rel.avisos.length || rel.ajustes.length) await DialogV2.prompt({ classes: DLG, window: { title: rel.avisos.length ? "Importação concluída: avisos" : "Importação concluída", icon: "fa-solid fa-triangle-exclamation" }, position: { width: 480 }, modal: false, rejectClose: false, content: `<div class="importador-t20">${rel.ajustes.length ? `<p><strong>Melhorias aplicadas</strong></p><ul>${rel.ajustes.map((w) => `<li>${esc(w)}</li>`).join("")}</ul>` : ""}${rel.avisos.length ? `<ul>${rel.avisos.map((w) => `<li>${esc(w)}</li>`).join("")}</ul>` : ""}</div>`, ok: { label: "Ok" } });
	} catch (err) { console.error("Importador de Fichas |", err); ui.notifications.error("Importador: falha ao criar a ficha. Veja o console (F12)."); }
}

Hooks.once("ready", () => { game.modules.get(MOD).api = { importarFicha, lerFicha, planImport, applyImport }; });

/* botão na barra de Atores */
Hooks.on("renderActorDirectory", (app, html) => {
	if (!game.user.isGM && !game.user.hasPermission("ACTOR_CREATE")) return;
	const root = html instanceof HTMLElement ? html : html[0];
	if (!root || root.querySelector(".importador-t20-btn")) return;
	const btn = document.createElement("button");
	btn.type = "button"; btn.className = "importador-t20-btn";
	btn.innerHTML = '<i class="fa-solid fa-file-import"></i> Importar ficha';
	btn.addEventListener("click", () => importarFicha());
	const header = root.querySelector(".header-actions") ?? root.querySelector(".directory-header .action-buttons") ?? root.querySelector("header");
	(header ?? root).append(btn);
});

/* botão no cabeçalho da ficha (importa para o personagem aberto) */
Hooks.on("getActorSheetHeaderButtons", (sheet, buttons) => {
	if (sheet.actor?.type !== "character" || !sheet.actor.isOwner) return;
	buttons.unshift({ label: "Importar", class: "importador-t20-hdr", icon: "fa-solid fa-file-import", onclick: () => importarFicha(sheet.actor) });
});
