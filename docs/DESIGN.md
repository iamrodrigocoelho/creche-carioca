## Overview

Este design system preserva a composição de baixa densidade, a hierarquia tipográfica e a interface discreta da referência visual original, mas substitui sua camada de marca pela identidade oficial da Prefeitura do Rio. Cores, gradiente e logotipos devem seguir o **Manual de Marca Prefeitura Rio 2025**; quando houver conflito entre a referência de layout e a identidade institucional, prevalece o manual oficial.

As superfícies alternam branco, cinza-claro institucional e azul institucional. O azul-escuro conduz navegação, títulos e ações; o azul-claro funciona como realce sobre fundos escuros e não como texto sobre branco. A interface deve transmitir confiança, clareza e acolhimento para famílias que realizam a inscrição em creches, inclusive em dispositivos móveis e em contextos de conexão limitada.

**Características principais:**
- Identidade visual da Prefeitura do Rio aplicada a todos os pontos de contato.
- Azul institucional (`{colors.primary}` — #13335a) como cor principal de ação e estrutura.
- Cinza-claro oficial (`{colors.canvas-parchment}` — #eceded) para alternância de superfícies e agrupamento de conteúdo.
- Gradiente institucional (`{gradient.brand}` — #2a688f → #42b9eb) usado apenas em momentos de marca aprovados.
- Contraste e legibilidade priorizados: o azul-claro não deve ser usado para texto sobre branco.
- Componentes com estados claros, áreas de toque de no mínimo 44 × 44px e foco de teclado visível.
- Logotipos sempre carregados dos arquivos oficiais mantidos em `/img/logo`.

## Brand Assets & Logotipos

Os logotipos oficiais da Prefeitura do Rio estarão no diretório **`/img/logo` na raiz do projeto**. Esse diretório é a única fonte autorizada de logotipos para a aplicação.

- Antes de implementar cabeçalho, rodapé, autenticação ou peças institucionais, inspecione `/img/logo` e escolha a variante adequada ao fundo utilizado.
- Não faça download de versões externas em tempo de execução e não redesenhe o símbolo em HTML, CSS ou SVG improvisado.
- Não altere cores, proporções, espaçamento interno, tipografia, alinhamento relativo, orientação ou ordem dos elementos da marca.
- Não aplique contorno, sombra, transparência, máscara, recorte, distorção ou efeitos sobre o logotipo.
- Preserve a proporção original (`height: auto`) e a área de proteção definida no Manual de Marca Prefeitura Rio 2025.
- Use a variante indicada para fundo azul, branco ou fotográfico. Se a variante necessária não existir, registre um `TODO` explícito e não invente uma nova versão.
- Todo uso informativo deve ter texto alternativo adequado, por exemplo `alt="Prefeitura da Cidade do Rio de Janeiro"`. Em repetição puramente decorativa, use `alt=""`.
- Referencie os arquivos por caminho absoluto a partir da raiz pública, por exemplo `/img/logo/<arquivo-oficial>`; o nome real do arquivo deve ser obtido pela inspeção do diretório.

## Colors

> **Fonte normativa:** [Manual de Marca Prefeitura Rio 2025](https://educacao.prefeitura.rio/wp-content/uploads/sites/42/2025/01/MANUAL-DE-MARCA-PREFEITURA-RIO-2025.pdf). Os valores abaixo reproduzem a paleta oficial para tela. Tons marcados como “derivado de interface” não substituem cores oficiais da marca e servem apenas para estados funcionais ou profundidade.

### Paleta oficial da marca

| Token | Nome | HEX | RGB | Uso principal |
|---|---|---:|---:|---|
| `{colors.primary}` | Azul Rio institucional | `#13335a` | 19, 51, 90 | Ações primárias, navegação, títulos e ícones ativos |
| `{colors.canvas-parchment}` | Cinza-claro institucional | `#eceded` | 236, 237, 237 | Fundo alternativo, rodapé e agrupamento de conteúdo |
| `{colors.brand-gradient-start}` | Azul médio do gradiente | `#2a688f` | 42, 104, 143 | Início do gradiente e foco de teclado |
| `{colors.brand-gradient-end}` | Azul-claro do gradiente | `#42b9eb` | 66, 185, 235 | Fim do gradiente e realce sobre azul-escuro |

### Tokens semânticos

- **Primary** (`{colors.primary}` — #13335a): cor padrão para botões, links sobre fundos claros, navegação e títulos institucionais. Tem contraste aproximado de 12,74:1 sobre branco.
- **Primary Hover/Focus** (`{colors.primary-focus}` — #2a688f): estado de foco e interação, com `outline: 2px solid` e `outline-offset: 2px`. Tem contraste aproximado de 6,04:1 sobre branco.
- **Primary On Dark** (`{colors.primary-on-dark}` — #42b9eb): links, ícones e realces sobre `{colors.primary}`. Tem contraste aproximado de 5,68:1 contra o azul institucional.
- **On Primary** (`{colors.on-primary}` — #ffffff): texto e ícones sobre o azul institucional.
- **Canvas** (`{colors.canvas}` — #ffffff): fundo principal de páginas, formulários e cartões.
- **Surface Pearl** (`{colors.surface-pearl}` — #f7f8f8): tom derivado de interface para cartões sobre o cinza-claro.
- **Surface Tile 1** (`{colors.surface-tile-1}` — #13335a): superfície escura oficial e fundo padrão da navegação.
- **Surface Tile 2** (`{colors.surface-tile-2}` — #102b4c): tom derivado de interface para pequena variação de profundidade.
- **Surface Tile 3** (`{colors.surface-tile-3}` — #0d233e): tom derivado de interface para mídia e regiões de maior profundidade.
- **Surface Black** (`{colors.surface-black}` — #000000): restrito a players de mídia ou fotografias que exijam preto real; não usar como cor padrão da navegação.
- **Surface Chip Translucent** (`{colors.surface-chip-translucent}` — rgba(236, 237, 237, 0.78)): controles flutuantes sobre imagem.

### Texto, divisores e bordas

- **Ink** (`{colors.ink}` — #13335a): títulos e textos de forte hierarquia sobre fundos claros.
- **Body** (`{colors.body}` — #1d2733): tom neutro derivado para corpo de texto longo.
- **Body On Dark** (`{colors.body-on-dark}` — #ffffff): texto principal sobre superfícies azuis escuras.
- **Body Muted On Dark** (`{colors.body-muted}` — #eceded): texto secundário sobre superfícies azuis escuras.
- **Ink Muted 80** (`{colors.ink-muted-80}` — #34495e): texto secundário sobre fundos claros.
- **Ink Muted 48** (`{colors.ink-muted-48}` — #66717d): texto auxiliar; valide contraste no contexto e não use abaixo de 14px quando não atingir WCAG AA.
- **Divider Soft** (`{colors.divider-soft}` — rgba(19, 51, 90, 0.10)): separadores discretos.
- **Hairline** (`{colors.hairline}` — #d4d7da): bordas de 1px em cartões e controles.

### Gradiente institucional

`{gradient.brand}`: `linear-gradient(90deg, #2a688f 0%, #42b9eb 100%)`.

- Use apenas em fundos institucionais, faixas de destaque, estados de carregamento de marca ou peças previstas pelo projeto.
- Não use o gradiente em texto, preenchimento de campos, mensagens de erro/sucesso ou como substituto do botão primário.
- Não crie outros gradientes ou altere direção e cores sem aprovação da equipe responsável pela marca.
- O conteúdo sobre o gradiente deve manter contraste WCAG AA em toda a faixa; quando isso não for garantido, use uma superfície sólida `{colors.primary}`.
- `#42b9eb` tem contraste aproximado de apenas 2,24:1 sobre branco e, portanto, não deve ser usado em texto, ícone essencial ou borda funcional sobre fundo branco.

## Typography

### Font Family
- **Display**: `SF Pro Display, system-ui, -apple-system, sans-serif` — Apple's proprietary display face, optimized for sizes ≥ 19px. Defines the voice of every headline.
- **Body / UI**: `SF Pro Text, system-ui, -apple-system, sans-serif` — the text-optimized variant used for body copy, captions, buttons, and links below 20px.
- **OpenType features**: `font-variant-numeric: numerator` is enabled on numeric links (pricing tables, spec sheets). Display sizes rely on tight tracking rather than contextual ligatures.

### Hierarchy

| Token | Size | Weight | Line Height | Letter Spacing | Use |
|---|---|---|---|---|---|
| `{typography.hero-display}` | 56px | 600 | 1.07 | -0.28px | Hero headline; the signature "Apple tight" tracking |
| `{typography.display-lg}` | 40px | 600 | 1.10 | 0 | Tile headlines atop every product tile |
| `{typography.display-md}` | 34px | 600 | 1.47 | -0.374px | Section heads (SF Pro Text at display proportions) |
| `{typography.lead}` | 28px | 400 | 1.14 | 0.196px | Product tile subcopy |
| `{typography.lead-airy}` | 24px | 300 | 1.5 | 0 | Environment-page lead paragraphs (the rare weight 300) |
| `{typography.tagline}` | 21px | 600 | 1.19 | 0.231px | Sub-tile tagline; sub-nav category name |
| `{typography.body-strong}` | 17px | 600 | 1.24 | -0.374px | Inline strong emphasis |
| `{typography.body}` | 17px | 400 | 1.47 | -0.374px | Default paragraph |
| `{typography.dense-link}` | 17px | 400 | 2.41 | 0 | Footer / store utility link lists (relaxed leading) |
| `{typography.caption}` | 14px | 400 | 1.43 | -0.224px | Secondary captions, button text |
| `{typography.caption-strong}` | 14px | 600 | 1.29 | -0.224px | Emphasized captions |
| `{typography.button-large}` | 18px | 300 | 1.0 | 0 | Store hero CTAs (the rare weight 300) |
| `{typography.button-utility}` | 14px | 400 | 1.29 | -0.224px | Utility/nav button labels |
| `{typography.fine-print}` | 12px | 400 | 1.0 | -0.12px | Fine-print, footer body |
| `{typography.micro-legal}` | 10px | 400 | 1.3 | -0.08px | Micro legal disclaimers |
| `{typography.nav-link}` | 12px | 400 | 1.0 | -0.12px | Global nav menu items |

### Principles

- **Negative letter-spacing at display sizes.** Every headline at 17px and up carries a slight tracking tighten (`-0.12 → -0.374px`). This produces the iconic "Apple tight" headline cadence. Never used at 12px or below.
- **Body copy at 17px, not 16px.** Apple breaks the SaaS convention and runs paragraph text at 17px. The extra pixel gives the page an unmistakable "reading, not scanning" pace.
- **Weight 300 is real and rare.** Used deliberately on a handful of large-size reads (`{typography.button-large}` at 18px/300 and `{typography.lead-airy}` at 24px/300). It's not an accident — it's a light-atmosphere cue reserved for moments where the content should feel airy.
- **Weight 600, not 700, for headlines.** Apple's headlines sit at weight 600. Weight 700 is used sparingly for `{typography.tagline}` (21px) when a touch more assertion is needed.
- **Line-height is context-specific.** Display sizes use 1.07–1.19 (tight). Body uses 1.47. Utility link stacks in the footer/store use an unusually relaxed 2.41 (`{typography.dense-link}`). The 2.41 is not a bug — it's how the footer's dense link columns breathe.
- **Weight 500 is deliberately absent.** The ladder is 300 / 400 / 600 / 700. Mid-weight readings always use 600.

### Note on Font Substitutes
SF Pro is Apple's proprietary system font. When building off-system:

- Use `system-ui, -apple-system, BlinkMacSystemFont` as the first stack entry — on macOS/iOS/Safari this resolves to the real SF Pro.
- For non-Apple platforms, **Inter** (Google Fonts, variable) is the closest open-source equivalent. Inter at weight 600 with `font-feature-settings: "ss03"` approximates SF Pro's rounded "a" character.
- Nudge `letter-spacing` down by `-0.01em` on display sizes to re-create the Apple tight feel; Inter's default tracking runs slightly wider than SF Pro.
- For body text, tighten line-height by `0.03` (from 1.47 → 1.44) when substituting Inter — Inter's taller x-height needs less leading.

## Layout

### Spacing System
- **Base unit:** 8px. Sub-base values (2, 4, 5, 6, 7) are used for tight typographic adjustments; structural layout snaps to 8/12/16/20/24.
- **Tokens:** `{spacing.xxs}` 4px · `{spacing.xs}` 8px · `{spacing.sm}` 12px · `{spacing.md}` 17px · `{spacing.lg}` 24px · `{spacing.xl}` 32px · `{spacing.xxl}` 48px · `{spacing.section}` 80px.
- **Section vertical padding:** `{spacing.section}` (80px) inside a product tile; tiles stack edge-to-edge with 0 gap (the color change provides the break).
- **Card padding:** `{spacing.lg}` (24px) inside utility grid cards.
- **Button padding:** 8–11px vertical, 15–22px horizontal.
- **Universal rhythm constants:** the 17px body line-height multiplier (~25px line) and 21px tagline size show up on every analyzed page.

### Grid & Container
- **Max content width:** ~980px on text-heavy sections (environment), ~1440px on product grids (store, accessories), full-bleed for product tiles (homepage).
- **Column patterns:** 3 to 5 column utility card grid on store/accessories; 2-column side-by-side tiles on homepage occasional sections; single-column centered stack on product tile heroes.
- **Gutters:** 20–24px between cards in a utility grid.

### Whitespace Philosophy
Apple's whitespace is the product's pedestal. Every tile begins with at least 64px of air above its headline and 48–64px below. Product renders are never crowded; the nearest content to a product image is at least 40px away. The footer is the only area that breaks this — there, Apple goes deliberately dense to make the full information architecture visible at a glance.

## Elevation & Depth

| Level | Treatment | Use |
|---|---|---|
| Flat | No shadow, no border | Full-bleed tiles, global nav, footer, body sections |
| Soft hairline | 1px `rgba(0, 0, 0, 0.08)` border | Utility cards, sub-nav frosted-glass separator |
| Backdrop blur | `backdrop-filter: blur(N)` on Parchment 80% | Sub-nav and the iPhone buy floating sticky bar |
| Product shadow | `rgba(0, 0, 0, 0.22) 3px 5px 30px 0` | Product renders resting on a surface (the only true "shadow" in the system) |

**Shadow philosophy.** Apple uses **exactly one** drop-shadow, and it is applied to photographic product imagery — never to cards, never to buttons, never to text. Elevation in the UI comes from (a) surface-color change (light tile ↔ dark tile) and (b) backdrop-blur on sticky bars. The single shadow is about giving the product weight, not about UI hierarchy.

### Decorative Depth
- **Atmospheric imagery** on the environment page (photographic vista) supplies mood; no CSS gradient involved.
- **Edge-to-edge tile alternation** creates rhythm without borders or shadows — the color change itself is the divider.
- **Backdrop-filter blur** on `{component.sub-nav-frosted}` and `{component.floating-sticky-bar}` creates a "floating over content" effect that's functional, not decorative.

## Shapes

### Border Radius Scale

| Token | Value | Use |
|---|---|---|
| `{rounded.none}` | 0px | Full-bleed product tiles (no corner rounding) |
| `{rounded.xs}` | 5px | Inline links when styled as subtle chips (rare) |
| `{rounded.sm}` | 8px | Dark utility buttons (Sign In, Bag), inline card imagery |
| `{rounded.md}` | 11px | White Pearl Button capsules |
| `{rounded.lg}` | 18px | Store utility cards, accessories grid cards |
| `{rounded.pill}` | 9999px | Primary blue pill CTAs, sub-nav buy button, configurator option chips, search input — the signature Apple pill |
| `{rounded.full}` | 9999px / 50% | Circular control chips floating over photography |

### Photography Geometry
- **Hero imagery**: full-bleed, 21:9 or taller on the homepage; 16:9 on environment and shop pages. Product renders are photographic-realistic, often shot on a tinted surface that becomes the tile background.
- **Product renders**: PNG/WebP with transparency; rest on a surface tile and pick up the system shadow.
- **Accessory grid**: square 1:1 crops at `{rounded.lg}` (18px) radius, light neutral backgrounds, product centered with 20–40px internal padding.
- **No rounded imagery in hero tiles** — images are full-bleed rectangular. Rounding (`{rounded.sm}`, `{rounded.lg}`) appears only on inline card imagery.
- Lazy-loading via responsive `srcset` and `sizes` across all breakpoints; CDN-optimized WebP.

## Components

### Top Navigation

**`global-nav`** — Navegação persistente em azul institucional, fixada no topo. Background `{colors.surface-tile-1}` (#13335a), altura mínima de 56px, texto `{colors.body-on-dark}` em `{typography.nav-link}`. O logotipo deve ser carregado de `/img/logo`, respeitar a variante indicada para fundo azul e nunca ser reconstruído por código. Em telas menores, os links podem ser recolhidos em menu; o logotipo oficial e o acesso às ações essenciais permanecem visíveis.

**`sub-nav-frosted`** — Surface-specific nav that sticks below the global nav. Background `{colors.canvas-parchment}` at 80% opacity with backdrop-filter blur, creating a frosted-glass effect. Height 52px. Content on left: product category name ("iPhone", "Store", "Accessories") in `{typography.tagline}` (21px / 600). Content right: inline nav links in `{typography.button-utility}` (14px), ending in a persistent `{component.button-primary}` ("Buy") or a utility link.

### Buttons

**`button-primary`** — Ação principal. Background `{colors.primary}` (#13335a), texto `{colors.on-primary}` em `{typography.body}` (17px / 400), rounded `{rounded.pill}`, padding 11px × 22px. Deve atingir contraste WCAG AA e área de toque mínima de 44 × 44px.
- Active state: `{component.button-primary-active}` — `transform: scale(0.95)` (the system-wide micro-interaction).
- Focus state: `{component.button-primary-focus}` — 2px solid `{colors.primary-focus}` outline.

**`button-secondary-pill`** — Used as the second CTA when two blue pills appear together ("Learn more" / "Buy"). Background transparent, text `{colors.primary}`, 1px solid `{colors.primary}` border, rounded `{rounded.pill}`, padding 11px × 22px. Reads as a "ghost pill."

**`button-dark-utility`** — Ações utilitárias de navegação. Background `{colors.primary}` (#13335a), texto `{colors.on-primary}` em `{typography.button-utility}` (14px / 400 / -0.224px tracking), rounded `{rounded.sm}` (8px), padding 8px × 15px. Quando estiver sobre a própria navegação azul, use variante com borda e texto brancos para não perder separação visual.

**`button-pearl-capsule`** — Botão secundário em cartão. Background `{colors.surface-pearl}` (#f7f8f8), texto `{colors.ink-muted-80}` em `{typography.caption}` (14px), 1px solid `{colors.hairline}`, rounded `{rounded.md}` (11px), padding 8px × 14px.

**`button-store-hero`** — CTA primário de maior destaque. Usa `{colors.primary}` com `{colors.on-primary}`, `{typography.button-large}` (18px / 300) e padding 14px × 28px. Deve ser usado com parcimônia, como na ação “Iniciar inscrição”.

**`button-icon-circular`** — Floats over photography. 44 × 44px, background `{colors.surface-chip-translucent}` at ~64% alpha, icon in `{colors.ink}`, rounded `{rounded.full}`. Used for carousel controls, close buttons, and in-image controls (product image thumbnails on the iPhone buy page).

**`text-link`** — Links no corpo em `{colors.primary}` (#13335a). Devem permanecer sublinhados no texto corrido; não depender apenas de cor para indicar interatividade.

**`text-link-on-dark`** — Links sobre superfícies escuras em `{colors.primary-on-dark}` (#42b9eb), sempre sublinhados ou acompanhados de outro indicador visual.

### Cards & Containers

**`product-tile-light`** — Full-bleed light tile. Background `{colors.canvas}` (white), text `{colors.ink}`, rounded `{rounded.none}` (0 — tiles touch edges), vertical padding `{spacing.section}` (80px). Centered stack: product name in `{typography.display-lg}` (40px / 600) → one-line tagline in `{typography.lead}` (28px / 400) → two `{component.button-primary}` CTAs ("Learn more" / "Buy") → product render resting on the surface with the system shadow.

**`product-tile-parchment`** — Mesmo padrão de `{component.product-tile-light}`, sobre `{colors.canvas-parchment}` (#eceded). Usado para agrupar conteúdo e alternar duas seções brancas consecutivas.

**`product-tile-dark`** — Seção escura em largura total. Background `{colors.surface-tile-1}` (#13335a), texto `{colors.body-on-dark}`, rounded `{rounded.none}`, padding vertical `{spacing.section}` (80px). Links usam `{component.text-link-on-dark}`; CTAs sobre o mesmo azul devem usar botão branco ou variante contornada, não preenchimento azul idêntico ao fundo.

**`product-tile-dark-2`** — Variante sobre `{colors.surface-tile-2}` (#102b4c), um tom derivado de interface usado para pequena variação de profundidade.

**`product-tile-dark-3`** — Variante sobre `{colors.surface-tile-3}` (#0d233e), restrita a regiões de maior profundidade e frames de mídia.

**`store-utility-card`** — Used in store grid and accessories grid. Background `{colors.canvas}` (white), 1px solid `{colors.hairline}` border, rounded `{rounded.lg}` (18px), padding `{spacing.lg}` (24px). Top: product image (1:1 crop with `{rounded.sm}` (8px) inner image radius). Below: product name in `{typography.body-strong}` (17px / 600), price in `{typography.body}` (17px / 400), and a `{component.text-link}` ("Buy" or "Learn more"). No shadow by default; product render itself carries the system product-shadow.

**`configurator-option-chip`** — Pill-shaped tappable cell used in the iPhone 17 Pro buy page. Background `{colors.canvas}`, text `{colors.ink}` in `{typography.caption}`, rounded `{rounded.pill}`, padding 12px × 16px. Contains a small product thumbnail + label + price delta. Arranged in a grid of 4–5 options per row.

**`configurator-option-chip-selected`** — Selected state. Border upgrades to 2px solid `{colors.primary-focus}`. Same shape, same content.

**`environment-quote-card`** — Hero de conteúdo institucional sobre fotografia. Usa `{colors.surface-tile-1}` como fallback, headline centralizado em branco e `{typography.display-lg}` (40px). Quando houver assinatura institucional, use exclusivamente um ativo de `/img/logo`; sobre fotografia, garanta área limpa ou aplique a variante de marca prevista no manual. Padding `{spacing.section}` (80px).

**`floating-sticky-bar`** — Floats at the bottom of the viewport on the iPhone 17 Pro buy page during scroll. Background `{colors.canvas-parchment}` at 80% opacity with `backdrop-filter: blur(N)`, height 64px, padding 12px × 32px. Left: running price total in `{typography.body}`. Right: `{component.button-primary}` ("Add to Bag").

### Inputs & Forms

**`search-input`** — The accessories search input. Background `{colors.canvas}`, text `{colors.ink}` in `{typography.body}` (17px), 1px solid `rgba(0, 0, 0, 0.08)` border, rounded `{rounded.pill}` (full pill — search is also pill-shaped, matching the CTA grammar), padding 12px × 20px, height 44px. Leading icon: search glyph at 14px, muted tint.

Error and validation states were not surfaced in the analyzed pages.

### Footer

**`footer`** — Background `{colors.canvas-parchment}` (#eceded), texto `{colors.ink-muted-80}`. Inclui logotipo oficial carregado de `/img/logo`, links de atendimento, privacidade e acessibilidade. Títulos de coluna usam `{typography.caption-strong}`; a linha legal usa `{typography.fine-print}` com `{colors.ink-muted-48}`. Padding vertical de 64px.

## Do's and Don'ts

### Do
- Use `{colors.primary}` (#13335a) em ações primárias, links sobre fundo claro, navegação e títulos institucionais.
- Use `{colors.primary-on-dark}` (#42b9eb) apenas para realces e links sobre azul-escuro; mantenha sublinhado ou outro indicador além da cor.
- Use `{gradient.brand}` somente em momentos de marca previstos e valide o contraste do conteúdo sobre toda a faixa.
- Carregue todos os logotipos oficiais a partir de `/img/logo` e preserve a variante, proporção e área de proteção.
- Set headlines in `{typography.hero-display}` or `{typography.display-lg}` with negative letter-spacing (`-0.28 → -0.374px`) to get the signature "Apple tight" cadence.
- Run body copy at `{typography.body}` (17px / 400 / 1.47 / -0.374px) — not 16px. The extra pixel defines the brand's reading pace.
- Alternate `{component.product-tile-light}` (or parchment) and `{component.product-tile-dark}` for full-bleed section rhythm. The color change IS the divider.
- Reserve `{rounded.pill}` for the primary blue CTA and any other element that should read as an "action" (configurator chips, search input, sticky bar CTA).
- Apply the single product-shadow (`rgba(0, 0, 0, 0.22) 3px 5px 30px`) only to product renders resting on a surface — never on cards, buttons, or text.
- Use `transform: scale(0.95)` as the active/press state on every button — it's the system-wide micro-interaction.
- Mantenha a navegação global em `{colors.surface-tile-1}` (#13335a), com conteúdo branco e foco visível.

### Don't
- Não introduza azuis ou cores de marca fora da paleta documentada sem aprovação da Prefeitura do Rio.
- Não use `#42b9eb` em texto, ícone essencial ou borda funcional sobre branco; o contraste é insuficiente.
- Não redesenhe, recolora, distorça, recorte ou aplique efeitos aos logotipos de `/img/logo`.
- Don't add shadows to cards, buttons, or text — shadow is reserved for product imagery.
- Não crie gradientes arbitrários; quando autorizado, use apenas `{gradient.brand}`.
- Don't set body copy at weight 500 — Apple's ladder is 300 / 400 / 600 / 700, with 500 deliberately absent. Body is always 400; strong inline is 600; display is 600.
- Don't round full-bleed tiles — tiles are rectangular and edge-to-edge; the color change is the divider.
- Don't tighten line-height below 1.47 for body copy — the editorial leading is part of the brand.
- Don't mix radii grammars — use `{rounded.sm}` for compact utility, `{rounded.lg}` for utility cards, `{rounded.pill}` for pills, and nothing in between (except the rare `{rounded.md}` Pearl Button).
- Não use `{colors.primary-on-dark}` sobre superfícies claras; use `{colors.primary}`.

## Responsive Behavior

### Breakpoints

| Name | Width | Key Changes |
|---|---|---|
| Small phone | ≤ 419px | Single-column tiles; sub-nav collapses to category name + primary CTA only; hero typography drops to 28px |
| Phone | 420–640px | Single-column stack; product renders scale to 80% of tile width; hero h1 drops to 34px |
| Large phone | 641–735px | Tiles transition to tighter padding (48px vertical vs 80px); fine-print wraps |
| Tablet portrait | 736–833px | Global nav collapses to hamburger; sub-nav hides category chips, keeps primary CTA |
| Tablet landscape | 834–1023px | Global nav returns fully expanded; 3-column utility grids become 2-column |
| Small desktop | 1024–1068px | Product tiles use 2/3 width with margin gutters; hero h1 stays at 40px |
| Desktop | 1069–1440px | Full layout; 4–5 column store grids; 1440px content max |
| Wide desktop | ≥ 1441px | Content locks at 1440px, margins absorb extra width |

The structural breakpoints that matter for agents: 1440px (content lock), 1068px (small-desktop), 833px (tablet landscape switch), 734px (tablet portrait), 640px (phone), 480px (small phone).

### Touch Targets
- Minimum 44 × 44px. `{component.button-primary}` lands at ~44 × 100px (with the full-pill radius making the visible hit area more generous than the label suggests).
- `{component.button-icon-circular}` is exactly 44 × 44px.
- Global nav utility links are smaller (~32 × 80px) — they deliberately sit at a tighter target because they're precision desktop actions, and the mobile hamburger replaces them at ≤ 833px.

### Collapsing Strategy
- **Global nav**: linha horizontal completa no desktop → em 834px ou menos, recolhe os links e mantém o logotipo oficial de `/img/logo`, menu e ações essenciais.
- **Sub-nav**: category name + inline links + primary CTA → category name + primary CTA only at mobile; inline links move into a hamburger tray.
- **Product tiles**: stack from 2-column to 1-column at 834px; vertical padding tightens from 80px → 48px at small-phone.
- **Utility grids** (store, accessories): 5-col → 4-col (1440px) → 3-col (1068px) → 2-col (834px) → 1-col (640px).
- **Hero typography**: `{typography.hero-display}` (56px) → `{typography.display-lg}` (40px) at 1068px → 34px at 640px → 28px at 419px.

### Image Behavior
- All product imagery uses responsive `srcset` with breakpoint-matched crops.
- Hero photography may switch art direction at mobile (e.g., the environment page's vista crops to a taller aspect ratio on mobile, framing the subject differently).
- Product renders maintain their 1:1 or 4:3 aspect ratios across breakpoints; only scale changes.
- Lazy-loading is default; the above-fold hero loads eagerly.

## Iteration Guide

1. Focus on ONE component at a time. Reference its YAML key directly (`{component.product-tile-dark}`, `{component.search-input}`).
2. Variants of an existing component (`-active`, `-focus`, `-2`, `-3`) live as separate entries in `components:`.
3. Use `{token.refs}` everywhere — never inline hex.
4. Never document hover. Default and Active/Pressed states only.
5. Display headlines stay SF Pro Display 600 with negative letter-spacing. Body stays SF Pro Text 400 at 17px. The boundary is unbreakable.
6. The single drop-shadow (`rgba(0, 0, 0, 0.22) 3px 5px 30px`) is reserved for product photography only.
7. When in doubt about emphasis: alternate surface (light → dark tile) before adding chrome.

## Known Gaps

- Form validation and error states were not surfaced on the analyzed pages; only the neutral search input is documented.
- The homepage's embedded video/player frame uses `{colors.surface-black}`; interior player controls are not documented (they're a platform widget, not a web-design token).
- Some component imagery is dynamic (rotating product hero) and its specific copy varies per surface — component specs name the structure, not the rotating content.
- Contrapartes de modo escuro para cartões utilitários ainda não foram formalizadas; o sistema documenta a variante predominantemente clara.
- Atmospheric photography (environment page mountain vista) is a content asset, not a design token; the documented `{component.environment-quote-card}` describes the structural surface only.
- The exact backdrop-filter blur radius on `{component.sub-nav-frosted}` and `{component.floating-sticky-bar}` is platform-dependent; production CSS uses `saturate(180%) blur(20px)` as a typical baseline but the value isn't formalized as a token.
