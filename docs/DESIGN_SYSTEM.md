# Design system — VCT Roster Tracker

Base local da Tarefa 02. Tema escuro único, tipografia de sistema sem downloads
de fontes e layout que parte das menores telas. A Tarefa 04 usa essa base na
home pública, com hero, quatro Magic Cards de regiões e mudanças recentes vazias.
Na Tarefa 05, as regiões usam cards de organizações com placeholders, categoria,
busca e ordenação. Na Tarefa 06, os perfis de organização usam cabeçalho com
identidade e temporada, navegação por âncoras e cinco seções com estados vazios.
Na Tarefa 07, o perfil individual reutiliza essa hierarquia para identidade,
equipe atual e histórico de carreira, mantendo o 404 quando não há jogador publicado.

## Tokens

Os tokens ficam em `src/app/globals.css`, expostos ao Tailwind com `@theme inline`.

| Token | Cor | Uso |
| --- | --- | --- |
| `background` | `#0B0D12` | Fundo geral |
| `card` | `#151923` | Superfície de cards |
| `secondary`, `accent`, `muted` | `#1B202B` | Superfície secundária |
| `primary` | `#FF4655` | Destaques e ação principal |
| `primary-foreground` | `#0B0D12` | Texto escuro sobre coral para contraste |
| `foreground` | `#F3F4F7` | Texto principal |
| `muted-foreground` | `#A4ADBE` | Texto secundário |
| `border` | `#2C3342` | Divisórias e contornos decorativos |
| `input` | `#586278` | Contorno de controles |
| `ring` | `#FF7A85` | Foco visível |

Use classes semânticas (`bg-card`, `text-muted-foreground`), evitando repetir
hexadecimais nas telas. Conteúdo limitado a `max-w-7xl`, com margens laterais
de 20, 32 ou 48 px. Cantos discretos entre 4 e 12 px.

## Componentes

- `layout/Container`: alinhamento e espaçamento horizontal comuns.
- `layout/SiteHeader` e `layout/SiteFooter`: marca do projeto, temporada e
  links reais para o conteúdo existente. O cabeçalho tem marca/temporada na
  primeira linha e três âncoras da home na segunda em telas estreitas;
  no desktop, distribui o conteúdo em uma linha.
- `ui/Button`: adaptação do shadcn/ui, variantes `default`, `secondary`,
  `outline`, `ghost` e `link`; tamanhos `default`, `sm`, `lg` e `icon`.
  Todos mantêm pelo menos 44 px de altura; botões têm `type="button"` por padrão.
  Para formulários futuros, passar `type="submit"` explicitamente.
- `ui/Card`: composição com `CardHeader`, `CardTitle` (h2), `CardDescription`,
  `CardContent` e `CardFooter`. Os componentes aceitam atributos HTML e `className`.
- `magicui/MagicCard`: única inclusão Magic UI. Gradiente discreto que acompanha
  o mouse, sem órbitas, molas ou animação contínua. Envolve o conteúdo de um Card.
- `LogoPlaceholder`: `name` obrigatório, `kind="league" | "team"`,
  `size="sm" | "md" | "lg"` e `src` opcional. Sem arquivo ou em falha de
  carregamento, mostra ícone genérico com nome acessível. Quando houver um asset
  autorizado, passar `src="/logos/arquivo.svg"`; a mesma API aceita URL externa.
  Imagens usam Next Image sem otimização remota, sem configuração de domínio.

```tsx
import { Button } from "@/components/ui/button";
import { LogoPlaceholder } from "@/components/logo-placeholder";

<Button asChild variant="outline">
  <a href="#sobre">Sobre o projeto</a>
</Button>
<LogoPlaceholder name={organization.name} src={organization.logoUrl} />
```

Botões desabilitados usam `disabled` em um elemento `button`. Para navegação,
`asChild` compõe um link real; não usar `disabled` em links nem criar controles
sem ação. Botões só com ícone precisam de `aria-label` fornecido pelo chamador.
O símbolo de seta do cabeçalho/favicon é uma marca genérica do projeto, não um
logo oficial de liga ou organização.

## Acessibilidade e movimento

O dashboard administrativo reutiliza Button/Card, tokens escuros e foco global.
Tem sidebar a partir de 1024 px e menu mobile nativo `details/summary`, com
links de 48 px e `aria-current="page"`. A barra superior contém Ver site e
Sair; Atualizar contagens usa formulário GET nativo. Cards exibem números
tabulares em PT-BR, diferenciam zero de falha e mostram avisos com `role="status"`.
A grade principal passa de uma para duas e quatro colunas; resumos com menos
cards ajustam sua largura. O único `main` continua no layout raiz. O HTML foi
verificado, mas a validação visual/axe desta etapa ficou bloqueada por
`spawn EPERM`; detalhes em [ADMIN_DASHBOARD.md](ADMIN_DASHBOARD.md).

`PlayerProfile` tem nickname como h1, nome opcional e lista de definição para
nacionalidade/função. Campos desconhecidos mostram “Não informada”; foto ausente
usa ícone genérico com nome acessível. `PlayerPhoto` recebe uma URL autorizada
opcional e troca por fallback se a imagem falhar. Nomes podem quebrar linha.
As âncoras Equipe atual e Histórico de carreira apontam para seções focáveis
com títulos h2. Vínculos atuais usam lista; passagens encerradas usam lista
ordenada, com nomes de organizações como links, datas semânticas e status.
Os vazios descrevem ausência de publicações, sem afirmar que o jogador está
sem equipe. A página 404 oferece recuperação para as regiões.

Com o cadastro vazio, as capturas de perfil preenchido são cenários isolados
explicitamente identificados como teste, renderizados com o componente real e
CSS de produção. Nenhuma página de demonstração foi adicionada ao aplicativo.

Os perfis de organização têm um h1 com nome sem truncamento, placeholder de logo
e link de retorno à região. As âncoras Titulares, Reservas, Inativos, Técnicos e
Histórico têm altura mínima de 44 px e apontam para seções com título h2 e
`tabIndex={-1}`, permitindo transferir o foco ao destino. A grade de elenco tem
uma coluna no celular e duas a partir de `lg`; o histórico ocupa a largura inteira.
`RosterSection` distingue ausência de publicações de uma lista preenchida.
`PlayerCard` é um link inteiro com nickname e ícone genérico decorativo, pronto
para dados publicados. Nenhum cartão é renderizado enquanto a fonte está vazia.
O 404 de organização inclui explicação em português e link para as regiões.

As listagens regionais usam navegação com `aria-current="page"`, labels visíveis
nos controles nativos de busca/ordenação, contador com `role="status"` e lista
semântica de cards. Limpar a busca devolve o foco ao campo. O estado sem resultados
permite refazer a consulta; uma região sem participações tem mensagem distinta.
Cards são links inteiros para organizações, com foco visível e sem controles
interativos aninhados. A grade usa uma coluna no celular, duas em telas médias,
três a partir de `lg` e quatro a partir de `xl`, sem truncar nomes.

O layout raiz fornece um único `main`, `header`, `nav`, `footer` e link de
salto para `#conteudo`. Cada página deve fornecer seu h1, sem adicionar outro main.
Foco visível em todos os links e botões; ícones decorativos usam `aria-hidden`.
Os textos de conteúdo permanecem renderizados no servidor.

`prefers-reduced-motion: reduce` remove transições/animações CSS e oculta o
gradiente antes mesmo da hidratação. `useReducedMotion` também impede atualizações
do gradiente em JavaScript. Telas de toque recebem o card estático.

`npm run test:e2e` verifica a página em quatro larguras, teclado e acessibilidade
automatizada. As capturas exigem inspeção visual; o axe não substitui testes
manuais com tecnologias assistivas. Não houve teste manual com leitor de tela.

## Origem e adaptações

Integração manual de [shadcn/ui](https://ui.shadcn.com/docs/installation/manual),
usando os componentes Button e Card do registro `new-york` (Radix).
Adaptamos altura de toque, foco, tokens e semântica dos títulos. A configuração
em `components.json` mantém os aliases e o registro `@magicui` disponíveis.

O [Magic Card](https://magicui.design/docs/components/magic-card) foi reduzido ao
modo gradiente com Motion. Não foi instalado `next-themes`, pois o projeto tem
um único tema; foram removidos recursos não utilizados e adicionadas as
proteções de movimento reduzido/toque. As licenças MIT originais estão em
`THIRD_PARTY_NOTICES.md`.
