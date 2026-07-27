# Fornecedores em Produtos — Design

**Data:** 2026-07-24
**Status:** Aprovado (revisado — inclui preço por fornecedor, lista editável e modal de view)

## Problema

Produtos não registram de quem são comprados nem por quanto. É preciso saber
quais fornecedores oferecem cada produto e a que preço cada um vende — para
consulta de compra, sem interferir no custo/lucro do produto.

## Decisões

| Questão | Decisão |
|---|---|
| Natureza | Vários fornecedores por produto |
| Cadastro de fornecedor | Mínimo: apenas nome (único) |
| Preço por fornecedor | **Sim** — cada vínculo guarda o preço de compra daquele fornecedor |
| `preco_compra` × `valorCompra` | Independentes. O preço do vínculo **não** altera o `valorCompra` do produto nem qualquer cálculo de lucro |
| Preço obrigatório? | Opcional (pode vincular sem preço) |
| Escopo do preço | Por par (produto, fornecedor). O mesmo fornecedor pode ter preços diferentes em produtos diferentes |
| Obrigatoriedade do vínculo | Opcional. Sem backfill |
| UX de cadastro | Botão "+ adicionar" cria uma linha editável (fornecedor + preço) |
| UX de edição | Fornecedor **e** preço editáveis por linha; remover a linha |
| Visualização | Novo modal de view do produto; linha do estoque ganha ícone "ver" separado do "editar" |

O preço morar no vínculo (e não no fornecedor) é o que permite preços distintos
por produto. Sua independência de `valorCompra` é deliberada: `valorCompra`
alimenta custo/lucro em vendas, e o preço por fornecedor é só informação de compra.

## Modelo de dados

O vínculo deixa de ser junção pura e vira **entidade** `ProdutoFornecedor`.

Migration `V11__fornecedores.sql` (editada — a V11 ainda não rodou em produção,
Flyway só no perfil docker):

```sql
CREATE TABLE fornecedores (
    id         VARCHAR(36)  NOT NULL,
    nome       VARCHAR(120) NOT NULL,
    ativo      BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at DATETIME     NULL,
    updated_at DATETIME     NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_fornecedor_nome UNIQUE (nome)
);

CREATE TABLE produto_fornecedores (
    id            VARCHAR(36)   NOT NULL,
    produto_id    VARCHAR(36)   NOT NULL,
    fornecedor_id VARCHAR(36)   NOT NULL,
    preco_compra  DECIMAL(10,2) NULL,
    created_at    DATETIME      NULL,
    updated_at    DATETIME      NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_produto_fornecedor UNIQUE (produto_id, fornecedor_id),
    CONSTRAINT fk_pf_produto    FOREIGN KEY (produto_id)    REFERENCES produtos (id),
    CONSTRAINT fk_pf_fornecedor FOREIGN KEY (fornecedor_id) REFERENCES fornecedores (id)
);
```

Nenhuma coluna de `produtos` muda. Nenhum backfill.

A collation padrão do MySQL é case-insensitive, então o `UNIQUE (nome)` já barra
"Votorantim" vs "votorantim". A garantia real de dedup, porém, vive no código
(ver `resolverPorNomes`), porque em H2 (testes) o UNIQUE é case-sensitive.

## Backend

Pacote `com.example.marluse.fornecedores` (Fornecedor + service + controller,
já existentes) e a entidade de junção junto do produto.

- `Fornecedor` (inalterado): `nome`, `ativo`.
- **`ProdutoFornecedor`** (entidade nova, extends `BaseEntity`):
  `@ManyToOne produto`, `@ManyToOne fornecedor`, `BigDecimal precoCompra` (nullable).
- `Produto`: `@OneToMany(mappedBy = "produto", cascade = ALL, orphanRemoval = true)
  List<ProdutoFornecedor> fornecedores`. O `cascade`/`orphanRemoval` faz adicionar
  e remover linha no modal refletir direto no banco.
- `FornecedorService.resolverPorNomes` (inalterado): continua resolvendo
  nome→`Fornecedor` (trim, dedup, buscar-ou-criar).
- `ProdutoService`: para cada linha recebida, resolve o fornecedor pelo nome e
  monta um `ProdutoFornecedor` com o preço.

### Contrato

- `ProdutoFornecedorRequest(String nome, BigDecimal precoCompra)`
- `ProdutoFornecedorResponse(String nome, BigDecimal precoCompra)`
- `ProdutoRequest.fornecedores: List<ProdutoFornecedorRequest>`
- `ProdutoAtualizarRequest.fornecedores: List<ProdutoFornecedorRequest>`
- `ProdutoResponse.fornecedores: List<ProdutoFornecedorResponse>` (ordenado por nome)

No `atualizar`, patch parcial: `null` = não mexe; lista = substitui o conjunto
inteiro de vínculos (remove os que sumiram, cria os novos, atualiza preços).

`@EntityGraph(attributePaths = "fornecedores")` nos finders que alimentam
`ProdutoResponse.from()` — resolve o LAZY fora de transação e evita N+1.

## Frontend

### Modal de produto (criar + editar)

Novo componente **`produto-fornecedores-editor`** (CVA, valor
`ProdutoFornecedorRequest[]`). Seção "Fornecedores" com botão "+ adicionar" que
insere uma linha vazia. Cada linha: seleção/criação de fornecedor + input de
preço (opcional) + remover. Substitui o `multi-select-create`.

Models: `fornecedores` nas 3 interfaces passa de `string[]` para
`ProdutoFornecedorDto[]` (`{ nome: string; precoCompra: number | null }`).

### Modal de visualização (novo)

`produto-detalhe-modal`, no padrão de `cliente-detalhe-modal` /
`pedido-detalhe-modal` (PrimeNG dialog, somente leitura). Exibe os dados do
produto e a lista de fornecedores com seus preços. Botão "Editar" leva ao modal
de edição. A linha do produto no estoque ganha um ícone de olho (ver) ao lado do
lápis (editar).

## Descartado do escopo anterior

- **`multi-select-create`** (componente + spec): não comporta preço por chip.
  Removido.

## Erros

- Falha ao carregar a lista de fornecedores: o campo continua funcional
  (digitação livre, sem sugestões). Não bloqueia o salvamento.
- Nome limitado a 120 caracteres; nomes vazios ou só espaços são descartados.
- Linha sem fornecedor selecionado é ignorada no envio.

### Limitação aceita: corrida na criação

Duas requisições simultâneas criando o mesmo fornecedor novo podem violar a
`UNIQUE`; o salvamento daquele produto falha e o operador tenta de novo (na
segunda vez o fornecedor já existe). A `UNIQUE` garante que nunca haja duplicata.
Tratar a corrida exigiria `REQUIRES_NEW`, que não se justifica para o volume.

## Testes

Backend (`ProdutoServiceTest`, `FornecedorServiceTest`):
- criar produto com fornecedores e preços
- preço nulo permitido no vínculo
- mesmo fornecedor com preços diferentes em produtos diferentes
- update substitui o conjunto; remove linha; `null` preserva
- `resolverPorNomes` (inalterado): dedup case-insensitive, trim, trunca em 120

Frontend:
- `produto-fornecedores-editor`: adiciona linha vazia, edita, remove, emite lista
- `produto-detalhe-modal`: renderiza fornecedores e preços

## Fora de escopo

Tela/CRUD global de fornecedores, renomear/excluir fornecedor globalmente,
coluna de fornecedor na listagem de estoque, filtro por fornecedor, histórico de
preços, dados de contato do fornecedor (telefone/CNPJ/e-mail).
