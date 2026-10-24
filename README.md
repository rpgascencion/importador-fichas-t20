# Importador de Fichas (T20)
Autor: ASCUNCAO · Foundry v13 · Tormenta20 1.5+

Importa uma ficha de personagem para o Foundry a partir de:
- **PDF editável de 2 páginas** (campos de formulário),
- **ficha "Área de RPG"** (PDF de 4 páginas),
- **planilha .xlsx "Ficha Template"** (aba PJ), ou
- **qualquer outro PDF, planilha, docx, txt, md, csv, json ou html** que tenha as palavras-chave de uma ficha (leitura genérica).

## v0.5.0: ficha Área de RPG e leitura de qualquer arquivo

- **Ficha "Área de RPG"** (PDF de 4 páginas, campos Nome Personagem, ModFor, Ata.0, untitled4...): leitor nativo. Lê nome, raça, origem, classe e nível, atributos (valor final), PV/PM, perícias (treinado, bônus e atributo-chave de cada linha, inclusive os Ofícios), ataques, armadura, escudo, defesa, T$, poderes (racial, origem, devoção, classe e a lista "Poderes/Habilidades", com a fonte), magias por círculo, equipamento e as anotações que você realmente escreveu. Os textos de instrução do modelo (entre asteriscos) e os exemplos são ignorados. A ficha em branco gera um aviso em vez de criar um personagem vazio.
- **Leitor genérico por palavras-chave**: se o arquivo não for nenhum modelo conhecido, o importador procura as palavras (Nome, Raça, Classe, Nível, FOR/Força, PV, PM, Defesa, T$, nomes de perícias, Poderes, Magias, Equipamento) e pega o número ou texto à direita, em cima ou embaixo delas. Funciona com PDF (com ou sem campos de formulário), .xlsx fora do padrão, .docx, .txt, .md, .csv, .tsv, .json, .html e .rtf. As perícias vêm como total na ficha: o importador deduz quais são treinadas (total − ½ nível − atributo ≥ bônus de treino) e o bônus extra. Atributos em escala 10-20 são convertidos em modificadores, com aviso. A prévia sempre mostra o que foi lido e os avisos; arquivos sem nenhum dado de ficha dão um erro claro.
- Para PDFs de formato desconhecido o módulo usa o **pdf.js** (Mozilla, Apache-2.0), incluído em lib/.
- **Correção**: o leitor de PDF antigo identificava o tipo de cada campo pelo nome da classe do pdf-lib, que na versão minificada muda de nome; agora usa instanceof. Se o PDF de 2 páginas já falhava em ler os campos, era isso.
- Magias que na verdade são parceiros ("Servo Cavalo de guerra") passam pelo compêndio de parceiros.

## Como usar
- Aba **Atores**: botão **Importar ficha** (cria um personagem novo), ou
- Cabeçalho da ficha de um personagem: botão **Importar** (adiciona ao personagem aberto).
Escolha o arquivo, confira a prévia (o que casou e o que não casou) e confirme.

## O que é importado
Nome, raça, classes e níveis (multiclasse), origem (e seu poder único, se o módulo *origens-t20* estiver ativo), atributos, perícias treinadas e bônus de "outros", PV/PM atuais, T$, divindade, poderes, magias, equipamento, armadura/escudo (equipados) e armas. Nomes são casados com os compêndios do sistema, de *suplementos-de-arton* e de outros módulos.

## Planilha: notas e células
Lê também as **notas (comentários de célula)** da planilha, usadas para identificar itens, poderes e parceiros. Poderes entre parênteses são tratados como "ainda não adquiridos" e não são importados. Poderes repetidos (Conhecimento Mágico, Aumento de Atributo) são adicionados quantas vezes aparecem. Atributos são ajustados para bater com o total da ficha. PV e PM só são conferidos: se o sistema calcular outro valor, o importador avisa e não compensa.

## Limites
- Bruxo/Feiticeiro/Mago viram **Arcanista** + o Caminho correspondente.
- Itens sem correspondência viram itens genéricos (com a nota da ficha); poderes sem correspondência e com nota viram poderes genéricos. Melhorias que não existem no sistema são ignoradas.
- Na planilha, os atributos são lidos sem o bônus racial; confira a raça (Humano e raças de escolha livre).
- O módulo *criador-t20* (0.5.2+) não abre diálogos durante a importação.
- Ficha importada deve ser conferida: o sistema recalcula PV, PM e defesa.


## v0.4.0: Itens Superiores (t20-hayd-itens)
Com o **T20 Hayd Itens Superiores e Mágicos** ativo, as melhorias, encantos e materiais que vêm no nome do item da ficha ("Ostensório Santificado Harmonizado") entram no item pela API dele: ficam nas flags dele, criam os efeitos e acertam o preço. A **T20 Hayd Loja** lê esse mesmo formato, então já enxerga o que o item tem. Palavras que não existem no catálogo para aquele tipo de item são ignoradas. O resultado aparece no final da importação ("Melhorias aplicadas"). Sem o t20-hayd-itens, continua usando o classes-extras-t20.

## v0.4.1
- Sem o t20-hayd-itens, os **encantos** do nome do item (ex.: "Espada Flamejante") também são preenchidos (campos de encanto do item), usando a lista do sistema e a do classes-extras-t20.
- Com o t20-hayd-itens, as entradas que só o classes-extras-t20 tem (ele as registra no catálogo do t20-hayd-itens) também são reconhecidas.

## v0.5.1
- Ficha Área de RPG: "Poder de combate(X)" (e similares) importa **X** como poder (ex.: *Estilo de Uma Arma*).
- Seção **Defeitos** agora vira poderes (ex.: *Teimoso*, *Cabeça Quente*), com fonte "Defeito de idade/geral", em vez de ir para as notas. São buscados nos compêndios; os que faltam estão no módulo Classes Extras 0.9.0 (compêndio "Defeitos").

## v0.5.2
- Ao importar uma classe do módulo Classes Extras (Cruzado, Sentinela), as habilidades fixas dela até o nível da ficha entram sozinhas (ex.: Cruzado nível 10 recebe Devoto Fiel, Magias, Presente dos Deuses, Alma Guerreira, Fé Inabalável e Oração Marcial). Os "poder de clérigo" continuam vindo da lista de poderes da ficha. Exige classes-extras-t20 0.10.3.

## v0.5.3
- Melhorias, material e encantos agora também são aplicados às **armas** (campo Ataques), **armadura** e **escudo** da ficha, não só aos itens da lista de equipamento. Ex.: "Machado de batalha Grande de mitral, precisa, harmonizada e veloz".

## v0.5.4
- Poderes e magias não casam mais por prefixo do nome (antes "Círculo interno Nós" virava o poder "Círculo Interno" de outra distinção). Se o nome não existir igual nos compêndios, vai para a lista de "faltando". Itens, armas e armaduras continuam aceitando melhorias depois do nome.

## v0.5.5
- Escudo: se a ficha traz só "Escudo", importa como Escudo Leve; se traz só melhorias (ex.: "Vigilante"), usa Escudo Leve com essa melhoria e avisa no relatório. Armadura: "Armadura de pedra reforçada" = item Armadura de Pedra + melhoria reforçada (já funcionava se o item existir no compêndio).

## v0.5.6
- Poderes que evoluem com o nível e aparecem repetidos na ficha ("Presente dos Deuses (1 melhoria)", "(2 melhorias)"…, "Palavras Afiadas (2d6)", "(4d6)") agora entram uma vez só. Poderes com escolha entre parênteses (Aumento de Atributo (Força), Foco em Magia (…)) continuam contando cada um.
- Habilidades fixas de classe que o importador já adiciona sozinho (Cruzado, Sentinela, Comandante) não são duplicadas pela lista da ficha.
