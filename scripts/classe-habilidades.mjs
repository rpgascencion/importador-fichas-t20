/**
 * Habilidades fixas de cada classe: [nome do poder, nível em que é recebida]. Fontes: Livro Básico (14 classes),
 * Heróis de Arton (15 classes variantes) e Deuses de Arton (Frade). O poder é procurado pelo nome e pela classe (subtipo).
 * Habilidades que só crescem com o nível (Fúria +2/+3, Ataque Furtivo +1d6...) entram uma vez, no primeiro nível.
 * Ficam de fora: poderes de classe e caminhos (escolha do jogador) e habilidades com escolha (Escola de Duelo, Lorde,
 * Dádiva da Fé, Bênção da Justiça...) ou sem poder equivalente no compêndio (Sorte de Nimb, Vaso Sagrado...).
 */
export const HABILIDADES_CLASSE = {
 "arcanista": [
  [
   "Magias (Arcanista)",
   1
  ],
  [
   "Alta Arcana",
   20
  ]
 ],
 "barbaro": [
  [
   "Fúria",
   1
  ],
  [
   "Instinto Selvagem",
   3
  ],
  [
   "Redução de Dano",
   5
  ],
  [
   "Fúria Titânica",
   20
  ]
 ],
 "bardo": [
  [
   "Inspiração",
   1
  ],
  [
   "Magias (Bardo)",
   1
  ],
  [
   "Eclético",
   2
  ],
  [
   "Artista Completo",
   20
  ]
 ],
 "bucaneiro": [
  [
   "Audácia",
   1
  ],
  [
   "Insolência",
   1
  ],
  [
   "Evasão (Bucaneiro)",
   2
  ],
  [
   "Esquiva Sagaz",
   3
  ],
  [
   "Panache",
   5
  ],
  [
   "Evasão Aprimorada (Bucaneiro)",
   10
  ]
 ],
 "cacador": [
  [
   "Marca da Presa",
   1
  ],
  [
   "Rastreador",
   1
  ],
  [
   "Explorador",
   3
  ],
  [
   "Mestre Caçador",
   20
  ]
 ],
 "cavaleiro": [
  [
   "Baluarte",
   1
  ],
  [
   "Código de Honra",
   1
  ],
  [
   "Duelo",
   2
  ],
  [
   "Resoluto",
   11
  ],
  [
   "Bravura Final",
   20
  ]
 ],
 "clerigo": [
  [
   "Devoto Fiel (Clérigo)",
   1
  ],
  [
   "Magias (Clérigo)",
   1
  ],
  [
   "Mão da Divindade",
   20
  ]
 ],
 "druida": [
  [
   "Devoto Fiel (Druida)",
   1
  ],
  [
   "Empatia Selvagem (Druida)",
   1
  ],
  [
   "Magias (Druida)",
   1
  ],
  [
   "Força da Natureza",
   20
  ]
 ],
 "guerreiro": [
  [
   "Ataque Especial",
   1
  ],
  [
   "Durão",
   3
  ],
  [
   "Ataque Extra",
   6
  ],
  [
   "Campeão",
   20
  ]
 ],
 "inventor": [
  [
   "Engenhosidade (Inventor)",
   1
  ],
  [
   "Protótipo",
   1
  ],
  [
   "Fabricar Item Superior",
   2
  ],
  [
   "Comerciante",
   3
  ],
  [
   "Encontrar Fraqueza",
   7
  ],
  [
   "Fabricar Item Mágico",
   9
  ],
  [
   "Olho de Dragão",
   10
  ],
  [
   "Obra-Prima",
   20
  ]
 ],
 "ladino": [
  [
   "Ataque Furtivo",
   1
  ],
  [
   "Especialista",
   1
  ],
  [
   "Evasão (Ladino)",
   2
  ],
  [
   "Esquiva Sobrenatural (Ladino)",
   4
  ],
  [
   "Olhos nas Costas",
   8
  ],
  [
   "Evasão Aprimorada (Ladino)",
   10
  ],
  [
   "A Pessoa Certa para o Trabalho",
   20
  ]
 ],
 "lutador": [
  [
   "Briga",
   1
  ],
  [
   "Golpe Relâmpago",
   1
  ],
  [
   "Casca Grossa",
   3
  ],
  [
   "Golpe Cruel",
   5
  ],
  [
   "Golpe Violento",
   9
  ],
  [
   "Dono da Rua",
   20
  ]
 ],
 "nobre": [
  [
   "Autoconfiança",
   1
  ],
  [
   "Espólio",
   1
  ],
  [
   "Orgulho",
   1
  ],
  [
   "Palavras Afiadas",
   2
  ],
  [
   "Riqueza",
   3
  ],
  [
   "Gritar Ordens",
   4
  ],
  [
   "Presença Aristocrática",
   5
  ],
  [
   "Realeza",
   20
  ]
 ],
 "paladino": [
  [
   "Abençoado",
   1
  ],
  [
   "Código do Herói",
   1
  ],
  [
   "Golpe Divino",
   1
  ],
  [
   "Cura pelas Mãos",
   2
  ],
  [
   "Aura Sagrada",
   3
  ],
  [
   "Vingador Sagrado",
   20
  ]
 ],
 "treinador": [
  [
   "Direcionar",
   1
  ],
  [
   "Melhor Amigo",
   1
  ],
  [
   "Domar Criatura",
   2
  ],
  [
   "Sincronia de Combate",
   6
  ],
  [
   "Sincronia Perfeita",
   20
  ]
 ],
 "alquimista": [
  [
   "Engenhosidade",
   1
  ],
  [
   "Laboratório Pessoal",
   1
  ],
  [
   "Alquimista Iniciado",
   2
  ],
  [
   "Mistura Básica",
   3
  ],
  [
   "Aplicação Rápida",
   5
  ],
  [
   "Magia Engarrafada",
   7
  ],
  [
   "Odores Alquímicos",
   8
  ],
  [
   "Fabricar Emulsão",
   9
  ],
  [
   "Mestre Alquimista",
   10
  ],
  [
   "Bombardeio Eficiente",
   11
  ],
  [
   "Pedra Filosofal",
   20
  ]
 ],
 "atleta": [
  [
   "Briga",
   1
  ],
  [
   "Arremesso Atlético",
   2
  ],
  [
   "Poderio Muscular",
   2
  ],
  [
   "Casca Grossa",
   3
  ],
  [
   "Mais Alto e Mais Rápido",
   5
  ],
  [
   "Disciplina Atlética",
   9
  ],
  [
   "Corpo Ideal",
   20
  ]
 ],
 "burgues": [
  [
   "Meios de Produção",
   1
  ],
  [
   "Orgulho",
   1
  ],
  [
   "Poder Monetário",
   1
  ],
  [
   "Desmoralizar",
   2
  ],
  [
   "Negociante Nato",
   3
  ],
  [
   "Suborno",
   4
  ],
  [
   "Ostentação",
   5
  ],
  [
   "Novo Rico",
   9
  ],
  [
   "Magnata",
   20
  ]
 ],
 "duelista": [
  [
   "Duelo",
   1
  ],
  [
   "Insolência",
   1
  ],
  [
   "Esquiva Sagaz",
   3
  ],
  [
   "Truques de Capa",
   4
  ],
  [
   "Duelista Lendário",
   20
  ]
 ],
 "ermitao": [
  [
   "Devoto Fiel",
   1
  ],
  [
   "Empatia Selvagem",
   1
  ],
  [
   "Magias (Ermitão)",
   1
  ],
  [
   "Sítio Sagrado",
   3
  ],
  [
   "Vínculo com a Terra",
   5
  ],
  [
   "Temperado pelo Clima",
   11
  ],
  [
   "Eixo de Pedras",
   20
  ]
 ],
 "inovador": [
  [
   "Do Bom e do Melhor",
   1
  ],
  [
   "Sequência Especial",
   1
  ],
  [
   "Bombardeio Sequencial",
   2
  ],
  [
   "Acrobacia Defensiva",
   3
  ],
  [
   "Domínio Excêntrico",
   4
  ],
  [
   "Estilo Único",
   20
  ]
 ],
 "machado de pedra": [
  [
   "Fúria",
   1
  ],
  [
   "Grunhidos",
   1
  ],
  [
   "Machado de Pedra",
   1
  ],
  [
   "Tanga de Peles",
   1
  ],
  [
   "Fúria Primitiva",
   2
  ],
  [
   "Instinto Selvagem",
   3
  ],
  [
   "Resiliência Primal",
   5
  ],
  [
   "Fúria Rústica",
   20
  ]
 ],
 "magimarcialista": [
  [
   "Cadência Magimarcial",
   1
  ],
  [
   "Magificação",
   1
  ],
  [
   "Magias (Magimarcialista)",
   1
  ],
  [
   "Bravado Magimarcial",
   2
  ],
  [
   "Dança Defensiva",
   3
  ],
  [
   "Arte Sublime",
   7
  ],
  [
   "Crescendo Vitorioso",
   20
  ]
 ],
 "necromante": [
  [
   "Falar com Mortos",
   1
  ],
  [
   "Magias (Necromante)",
   1
  ],
  [
   "Animar Cadáver",
   2
  ],
  [
   "Necrologia",
   3
  ],
  [
   "Distorção Necrótica",
   4
  ],
  [
   "Necropotência",
   5
  ],
  [
   "Domínio Sobre a Morte",
   20
  ]
 ],
 "santo": [
  [
   "Abençoado",
   1
  ],
  [
   "Código do Herói",
   1
  ],
  [
   "Ladainha de Combate",
   1
  ],
  [
   "Santo Curandeiro",
   2
  ],
  [
   "Mártir",
   6
  ],
  [
   "Pira Santa",
   8
  ],
  [
   "Vingador Santificado",
   20
  ]
 ],
 "seteiro": [
  [
   "Marca da Presa",
   1
  ],
  [
   "Tiro de Supressão",
   1
  ],
  [
   "Evasão",
   3
  ],
  [
   "Disparo Constritor",
   5
  ],
  [
   "Evasão Aprimorada",
   13
  ],
  [
   "Sentinela",
   15
  ],
  [
   "Mestre do Disparo",
   20
  ]
 ],
 "usurpador": [
  [
   "Inimigo dos Deuses",
   1
  ],
  [
   "Magias (Usurpador)",
   1
  ],
  [
   "Usurpar",
   1
  ],
  [
   "Canalização Falsa",
   2
  ],
  [
   "Discrição Divina",
   3
  ],
  [
   "Poder Capturado",
   4
  ],
  [
   "Roubo Divino",
   20
  ]
 ],
 "vassalo": [
  [
   "Baluarte",
   1
  ],
  [
   "Código de Honra",
   1
  ],
  [
   "Jovem Pajem",
   1
  ],
  [
   "Suserano",
   1
  ],
  [
   "Valete",
   2
  ],
  [
   "Escudeiro Aprendiz",
   3
  ],
  [
   "Guarda do Castelo",
   4
  ],
  [
   "Vigilante de Estradas",
   5
  ],
  [
   "Cavaleiro do Reino",
   6
  ],
  [
   "Sargento do Reino",
   7
  ],
  [
   "Capitão do Reino",
   8
  ],
  [
   "Barão",
   10
  ],
  [
   "Visconde",
   11
  ],
  [
   "Conde",
   12
  ],
  [
   "Marquês",
   13
  ],
  [
   "Duque",
   14
  ],
  [
   "Arquiduque",
   15
  ],
  [
   "Conselheiro Real",
   16
  ],
  [
   "Rei Mercenário",
   17
  ],
  [
   "Rei",
   18
  ],
  [
   "Alto Rei",
   19
  ],
  [
   "Imperador",
   20
  ]
 ],
 "ventanista": [
  [
   "Charme",
   1
  ],
  [
   "Truques do Ofício",
   1
  ],
  [
   "Evasão",
   2
  ],
  [
   "Disfarce Elaborado",
   3
  ],
  [
   "Esquiva Sobrenatural",
   4
  ],
  [
   "Virar a Casaca",
   7
  ],
  [
   "Olhos nas Costas",
   8
  ],
  [
   "Evasão Aprimorada",
   10
  ],
  [
   "Provocação Ousada",
   11
  ]
 ],
 "frade": [
  [
   "Devoto Fiel (Frade)",
   1
  ],
  [
   "Erudição",
   1
  ],
  [
   "Magias (Frade)",
   1
  ],
  [
   "Versiculário",
   2
  ],
  [
   "Solo Santificado",
   20
  ]
 ],
	"mistico": [["Afinidade", 1], ["Ataque Elemental", 1], ["Magias", 1], ["Língua Primordial", 2], ["Tradição Oral", 3], ["Sexto Sentido", 4], ["Comunhão Suprema", 20]],
	"samurai": [["Arma Ancestral", 1], ["Código do Samurai", 1], ["Grito de Kiai", 1], ["Olhar Assustador", 3], ["Arma Espiritual", 10], ["Shogun", 20]],
	"miragem": [["Dança da Areia", 1], ["Rastreador", 1], ["Explorador", 3], ["Cortina de Poeira", 7], ["Passo do Deserto", 9], ["Mestre do Deserto", 20]]
};
