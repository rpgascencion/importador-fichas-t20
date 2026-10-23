import { emptyFicha, norm, num, attrKey, splitList, parseClasses } from "./ficha.mjs";

/**
 * Ficha editável "Área de RPG" (PDF de 4 páginas: Personagem / Poderes e magias / Equipamento / Missões e PeA).
 * Os campos do formulário têm nomes próprios (Nome Personagem, ModFor, Ata.0, untitled4...). As perícias são
 * campos indexados na ordem das linhas: Per1.N (treinado), O.N (outros) e T.N (bônus de treino).
 */
export const ehAreaRpg = (campos) => "Nome Personagem" in campos && ("ModFor" in campos || "ModDes" in campos) && ("untitled4" in campos || "Ata.0" in campos);

/** Ordem das 33 linhas da tabela de perícias (índice N dos campos Per1.N / T.N / O.N). */
const LINHAS = ["acro", "ades", "atle", "atua", "cava", "conh", "cura", "dipl", "enga", "fort", "furt", "guer", "inic", "inti", "intu", "inve", "joga", "ladi", "luta", "mist", "nobr", "ofi1", "ofi2", "ofi3", "ofi4", "ofi5", "perc", "pilo", "pont", "refl", "reli", "sobr", "vont"];
/** Campo "Mod<Perícia>" que guarda o atributo-chave de cada linha */
const MOD = { acro: "ModAcrob", ades: "ModAdest", atle: "ModAtlet", atua: "ModAtua", cava: "ModCaval", conh: "ModConh", cura: "ModCura", dipl: "ModDipl", enga: "ModEng", fort: "ModFort", furt: "ModFurt", guer: "ModGuerr", inic: "ModInic", inti: "ModInti", intu: "ModIntu", inve: "ModInve", joga: "ModJoga", ladi: "ModLadi", luta: "ModLuta", mist: "ModMist", nobr: "ModNobr", ofi1: "ModOfic1", ofi2: "ModOfic2", ofi3: "ModOfic3", ofi4: "ModOfic4", ofi5: "ModOfic5", perc: "ModPerc", pilo: "ModPilo", pont: "ModPont", refl: "ModRefl", reli: "ModReli", sobr: "ModSobr", vont: "ModVont" };

/** Remove o que é instrução/exemplo do modelo: trechos *entre asteriscos*, títulos "=====", rótulos vazios e textos de exemplo. */
export function textoUtil(txt) {
	let t = String(txt ?? "").replace(/\r/g, "\n").replace(/\*[^*]*\*/g, " ");
	const i = t.search(/exemplo de preenchimento/i); if (i >= 0) t = t.slice(0, i);
	return t.split("\n").map((l) => l.trim()).filter((l) => l && !/^=+.*=*$/.test(l) && !/^-?\s*\(.*\)\s*$/.test(l) && !/^[\wçãéíóúâêôà ]+:\s*$/i.test(l) && !/nome d[oa] \w+.*\|/i.test(l) && !/^\d+\s*-\s*(\(|missão 000)/i.test(l) && !/^ações:\s*$/i.test(l) && !/^\(?caso /i.test(l)).join("\n");
}

/** "Poder (Origem)", "Aumento de atributo (Sabedoria +2) (Classe)", "lvl3 - Poder" -> { nome, fonte } */
const FONTES = /\(\s*(origem|classe|ra[çc]a|racial|devo[çc][ãa]o|divindade|defeito[^)]*|item|aliado|poder de [^)]*|complica[çc][ãa]o|idade)\s*\)\s*\.?$/i;
export function limparPoder(linha) {
	let s = String(linha ?? "").replace(/^\s*[-–—•*]+\s*/, "").replace(/^lvl?\s*\d+\s*[-–:]\s*/i, "").trim();
	let fonte = "";
	const m = s.match(FONTES); if (m) { fonte = m[1]; s = s.slice(0, m.index).trim(); }
	s = s.replace(/[.;]+$/, "").replace(/\s+/g, " ").trim().replace(/^aumento de tributo/i, "Aumento de atributo");
	return { nome: s, fonte };
}
const ehLinhaAtributo = (l) => /^((for[çc]a|destreza|constitui[çc][ãa]o|intelig[êe]ncia|sabedoria|carisma)\s*[+\-–−]\s*\d+[,.\s]*)+$/i.test(norm(l) === "" ? "" : l.normalize("NFC").trim());

export function parseAreaRpg(campos) {
	const g = (n) => { const v = campos[n]; return v == null || typeof v === "boolean" ? "" : String(v).trim(); };
	const F = emptyFicha(); F.formato = "pdf";
	F.nome = g("Nome Personagem"); F.jogador = g("Nome Jogador"); F.raca = g("Raça"); F.origem = g("Origem"); F.divindade = g("Divindade");
	F.nivel = num(g("Nv"), 1);
	F.classes = parseClasses(g("Classe"), F.nivel);
	if (F.classes.length > 1 && !F.nivel) F.nivel = F.classes.reduce((a, c) => a + c.nivel, 0);
	F.pv = { max: num(g("PVm"), null), atual: num(g("PVa"), null) };
	F.pm = { max: num(g("PMm"), null), atual: num(g("PMa"), null) };
	for (const a of ["for", "des", "con", "int", "sab", "car"]) F.atributos[a] = num(g("Mod" + a[0].toUpperCase() + a.slice(1)), 0);
	F.atributosFinais = true;
	LINHAS.forEach((id, i) => {
		const treinado = campos[`Per1.${i}`] === true;
		const outros = num(g(`O.${i}`), 0);
		if (id.startsWith("ofi")) {
			const nome = g(`Oficio.${Number(id[3]) - 1}`);
			if (nome && !/^_+$/.test(nome)) F.oficios.push({ nome, treinado });
			return;
		}
		F.pericias[id] = { treinado, outros, atributo: attrKey(g(MOD[id])) };
	});
	for (let i = 0; i < 7; i++) {
		const nome = g(`Ata.${i}`); if (!nome) continue;
		F.ataques.push({ nome, bonus: g(`TesA.${i}`), dano: g(`Dano.${i}`), critico: g(`Crit.${i}`), tipo: g(`Tipo.${i}`), alcance: g(`Alcance.${i}`) });
	}
	F.armadura = g("Armadura"); F.escudo = g("Escudo");
	F.defesa = num(g("Defesa"), null);
	F.proficiencias = textoUtil(g("untitled1")).replace(/^-\s*/gm, "").replace(/\n/g, "; ");
	F.dinheiro = g("T$") === "" ? null : num(g("T$"), null);

	// ---- poderes: racial, origem, devoção, classe, "Poderes/Habilidades" ----
	const vistos = new Set(), fonte = {};
	const add = (linha, fonteSecao = "") => {
		let { nome, fonte: f } = limparPoder(linha);
		const pp = nome.match(/^poder(?:es)? (?:de|do|da) [\wçãéíóúâêôà]+\s*\(\s*([^()]+?)\s*\)$/i);   // "Poder de combate(Estilo de uma arma)" -> o poder é o que está entre parênteses
		if (pp) nome = pp[1];
		if (!nome || nome.length < 3 || vistos.has(norm(nome)) || /^\(.*\)$/.test(nome) || /^per[ií]cias?\b/i.test(nome)) return;
		vistos.add(norm(nome)); F.poderes.push(nome); if (f || fonteSecao) fonte[nome] = f || fonteSecao;
	};
	const secoes = String(campos["untitled4"] ?? "").replace(/\r/g, "\n").split(/\n(?=[ \t]*=+[^=\n]+=+[ \t]*$)/m);
	for (const bloco of secoes) {
		const titulo = bloco.match(/^=+\s*([^=\n]+?)\s*=+/)?.[1] ?? "";
		const t = norm(titulo);
		const corpo = textoUtil(bloco).split("\n");
		if (/^defeitos/.test(t)) {                                                 // "Defeitos de idade (Teimoso)", "Defeitos gerais (Cabeça Quente, Tolo)"
			for (const l of corpo) {
				const m = l.replace(/^[-–]\s*/, "").match(/^defeitos?\s+(de idade|gerais|geral|de classe)\s*\((.*)\)\s*\.?$/i);
				if (!m) continue;
				const tipo = /idade/i.test(m[1]) ? "Defeito de idade" : /classe/i.test(m[1]) ? "Defeito de classe" : "Defeito geral";
				for (const n of splitList(m[2])) { if (/poder escolhido|nome do defeito|listar|colocar/i.test(n)) continue; add(n, tipo); }
			}
			continue;
		}
		if (/^(classe|outros)$/.test(t)) continue;                                  // listas de perícias escolhidas
		const devoto = /^devoto/.test(t);
		for (const l of corpo) {
			if (ehLinhaAtributo(l)) continue;                                        // "Sabedoria +2, Inteligência +1..." (bônus racial de atributo)
			for (const parte of splitList(l.replace(/^[-–]\s*/, ""))) {
				const mm = devoto && parte.match(/^[^()]+\(([^)]+)\)$/);               // "Thwor(Ushultt)" -> poder "Ushultt"
				add(mm ? mm[1] : parte, /^racial/.test(t) ? "Raça" : /^origem/.test(t) ? "Origem" : devoto ? "Devoção" : "");
			}
		}
	}
	const cls = String(campos["untitled5"] ?? "").replace(/\r/g, "\n");
	const iPod = cls.search(/=+\s*Poderes\/Habilidades\s*=+/i);
	const blocoClasse = iPod >= 0 ? cls.slice(0, iPod) : cls, blocoPoderes = iPod >= 0 ? cls.slice(iPod) : "";
	for (const l of textoUtil(blocoClasse).split("\n")) {
		if (/^classe\s*\d/i.test(l)) { const nome = l.match(/\(([^)]+)\)/)?.[1]; if (nome && F.classes.length && !F.classes.some((c) => norm(c.nome) === norm(nome))) F.avisos.push(`A ficha cita a classe ${nome} em "Habilidades de classe", mas ela não está no campo Classe.`); continue; }
		if (/^lvl?\s*\d+\s*[-–:]/i.test(l)) add(l, "Classe");
	}
	for (const l of textoUtil(blocoPoderes).split("\n")) if (!/^poderes recebidos/i.test(l)) add(l);
	for (const [nome, f] of Object.entries(fonte)) (F.fontePoder ??= {})[nome] = f;

	// ---- magias (por círculo); "Servo ..." / "Parceiro ..." são parceiros, vão como itens para casar com o compêndio de parceiros ----
	const vm = new Set();
	for (const l of textoUtil(campos["untitled6"]).split("\n")) {
		for (const parte of splitList(l.split("|")[0])) {
			const nome = parte.replace(/\s*\([^)]*\)\s*$/, (m) => /\d/.test(m) ? "" : m).trim();
			if (!nome || vm.has(norm(nome))) continue; vm.add(norm(nome));
			if (/^(servo|parceiro)\b/i.test(nome)) F.equipamento.push({ nome, qtd: 1 }); else F.magias.push(nome);
		}
	}

	// ---- equipamento (coluna carregada); a coluna "Outros" (itens que não pesam) também entra; arma/armadura repetidas são ignoradas ----
	const base = (s) => norm(s).split(" ").slice(0, 3).join(" ");
	const jaTem = new Set([...F.ataques.map((a) => base(a.nome)), F.armadura && norm(F.armadura), F.escudo && norm(F.escudo)].filter(Boolean));
	const pegaItens = (prefixo) => { for (let i = 0; i < 40; i++) { const t = g(`${prefixo}.${i}`); if (t && !/\*/.test(t) && !/^pois aqui/i.test(t)) { const nome = t.replace(/^\s*[-–]\s*/, ""); const k = norm(nome); if (jaTem.has(k) || jaTem.has(base(nome))) continue; F.equipamento.push({ nome, qtd: 1 }); } } };
	pegaItens("Item"); pegaItens("ItemO");

	// ---- anotações: só o que o jogador realmente escreveu (o modelo vem cheio de instruções) ----
	const rot = { untitled7: "História e personalidade", untitled3: "Aliados, benefícios, deveres e restrições", untitled8: "Missões", untitled9: "Pontos de experiência abertos (PeA)" };
	const blocos = [];
	for (const [k, titulo] of Object.entries(rot)) { const t = textoUtil(campos[k]); if (t) blocos.push(`${titulo}:\n${t}`); }
	if (F.notas) blocos.unshift(F.notas);
	F.notas = blocos.join("\n\n");
	F.fonteDoFormato = "Ficha Área de RPG";
	// modelo em branco (só os exemplos que vêm no PDF): sem nome real, raça, classe nem PV
	F.vazia = (!F.nome || /siga as instru/i.test(F.nome)) && !F.raca && !F.classes.length && F.pv.max == null;
	if (/siga as instru/i.test(F.nome)) F.nome = "";
	return F;
}
