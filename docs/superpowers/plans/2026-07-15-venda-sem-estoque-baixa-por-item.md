# Venda sem Estoque + Baixa de Estoque por Item — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir vender/locar produtos sem baixar o estoque (controle por item) e permitir vender produtos sem saldo, deixando o estoque negativo mediante confirmação explícita.

**Architecture:** Hoje a baixa de estoque é decidida por um único booleano `estoque_descontado` no **pedido/locação inteiro**, com trava rígida que impede saldo negativo. Vamos mover a decisão e o estado para o **item** (`ItemPedido`/`ItemLocacao`), adicionando três campos por item: `baixarEstoque` (intenção, default `true`), `permitirSemEstoque` (libera saldo negativo, default `false`) e `estoqueDescontado` (estado real, fonte de verdade para restauração). O frontend ganha um toggle por linha e um `confirmDialog` que, ao vender sem saldo, marca `permitirSemEstoque` para aquele item.

**Tech Stack:** Backend Spring Boot 3 / Java 17 / JPA / Flyway / MySQL (JUnit 5 + `@SpringBootTest`). Frontend Angular standalone + PrimeNG (`ConfirmationService`).

**Repositórios (dois repos git separados):**
- Backend: `C:\Users\Miguel\Documents\Claude\Projects\Luiz - SaaS\marluse`
- Frontend: `C:\Users\Miguel\Documents\Claude\Projects\Luiz - SaaS\marluse-frontend`

> Crie **uma branch nova** em cada repositório antes de começar (ex.: `feat/venda-sem-estoque`).

---

## Modelo de dados (contrato entre as tarefas)

Campos novos, usados de forma idêntica em `ItemPedido` e `ItemLocacao`:

| Campo | Tipo | Default | Significado |
|---|---|---|---|
| `baixarEstoque` | `boolean` | `true` | Se `false`, o item **nunca** é baixado automaticamente (venda sob encomenda / não sai do meu estoque). |
| `permitirSemEstoque` | `boolean` | `false` | Se `true`, a baixa pode deixar o saldo negativo em vez de lançar exceção. |
| `estoqueDescontado` | `boolean` | `false` | Estado: o estoque **deste item** já foi baixado. Fonte de verdade para restauração. |

Nos **request DTOs** (`ItemPedidoRequest`/`ItemLocacaoRequest`) os dois primeiros são `Boolean` (nulláveis). Normalização no service:
- `boolean baixar = req.baixarEstoque() == null || req.baixarEstoque();`  *(null → true)*
- `boolean permitir = Boolean.TRUE.equals(req.permitirSemEstoque());`  *(null → false)*

Regra única de baixa (vale em criar/confirmar/entregar):
> Um item só é baixado quando `baixarEstoque == true` **e** `estoqueDescontado == false`. Se `saldo - quantidade < 0` e `permitirSemEstoque == false`, lança `IllegalArgumentException("Estoque insuficiente: <nome>")`; caso contrário grava o saldo (podendo ficar negativo) e marca `estoqueDescontado = true`.

Regra única de restauração (cancelar/devolver/deletar):
> Para cada item com `estoqueDescontado == true`: devolve a quantidade ao produto e zera `estoqueDescontado`. Itens nunca baixados não são tocados.

O booleano de nível de pedido/locação `estoqueDescontado` **permanece na tabela** e passa a ser derivado (`true` se algum item foi baixado), apenas para leitura/compatibilidade — **não é mais usado para decidir restauração**.

---

## File Structure

**Backend (`marluse`):**
- `src/main/resources/db/migration/V6__add_controle_estoque_por_item.sql` — Create. Colunas novas em `itens_pedido` e `itens_locacao` + backfill.
- `src/main/java/com/example/marluse/vendas/model/ItemPedido.java` — Modify. 3 campos novos.
- `src/main/java/com/example/marluse/locacoes/model/ItemLocacao.java` — Modify. 3 campos novos.
- `src/main/java/com/example/marluse/vendas/dto/ItemPedidoRequest.java` — Modify. 2 campos.
- `src/main/java/com/example/marluse/vendas/dto/ItemPedidoResponse.java` — Modify. 2 campos.
- `src/main/java/com/example/marluse/locacoes/dto/ItemLocacaoRequest.java` — Modify. 2 campos.
- `src/main/java/com/example/marluse/locacoes/dto/ItemLocacaoResponse.java` — Modify. 2 campos.
- `src/main/java/com/example/marluse/vendas/service/PedidoService.java` — Modify. Baixa/restauração por item.
- `src/main/java/com/example/marluse/locacoes/service/LocacaoService.java` — Modify. Baixa/restauração por item.
- `src/main/java/com/example/marluse/entrega/service/EntregaService.java` — Modify. Baixa por item na entrega.
- `src/test/java/com/example/marluse/locacoes/LocacoesServiceTest.java` — Modify. Realinhar construtores (está quebrado) + novos testes.
- `src/test/java/com/example/marluse/vendas/PedidoServiceTest.java` — Modify. Novos testes.

**Frontend (`marluse-frontend`):**
- `src/app/features/vendas/models/vendas.models.ts` — Modify. Campos nos DTOs.
- `src/app/features/locacoes/models/locacoes.models.ts` — Modify. Campos nos DTOs.
- `src/app/features/vendas/components/novo-pedido-modal/novo-pedido-modal.component.ts` — Modify. Toggle + confirmDialog.
- `src/app/features/vendas/components/novo-pedido-modal/novo-pedido-modal.component.html` — Modify. Coluna de toggle.
- `src/app/features/locacoes/nova-locacao-modal/nova-locacao-modal.component.ts` — Modify. Toggle + confirmDialog.
- `src/app/features/locacoes/nova-locacao-modal/nova-locacao-modal.component.html` — Modify. Coluna de toggle.

---

## Task 1: Restaurar compilação da suíte de testes (baseline)

O `LocacoesServiceTest` usa assinaturas antigas de `ItemLocacaoRequest`/`LocacaoRequest` e **não compila**. Sem baseline verde não há TDD. Esta tarefa apenas realinha os construtores ao código atual — sem mudar comportamento.

**Files:**
- Modify: `marluse/src/test/java/com/example/marluse/locacoes/LocacoesServiceTest.java`

- [ ] **Step 1: Rodar a suíte para confirmar a quebra de compilação**

Run (na raiz `marluse`): `./mvnw test -Dtest=LocacoesServiceTest`
Expected: FAIL na compilação — mensagens como `constructor ItemLocacaoRequest ... cannot be applied` e `constructor LocacaoRequest ... cannot be applied`.

- [ ] **Step 2: Corrigir o helper `locacaoValida` e a chamada `criar`**

O `criar` do service tem assinatura `criar(LocacaoRequest request, boolean isOrcamento)`. Os testes chamam `locacaoService.criar(request)` (1 arg). Ajuste o helper e todas as chamadas. Substitua o método `locacaoValida` e adote a assinatura completa de `LocacaoRequest` (15 campos, ordem: clienteId, formaPagamento, dataRetirada, dataDevolucaoPrevista, itens, observacao, status, desconto, tipoDesconto, numeroParcelas, primeiroVencimento, entrega, juros, tipoJuros, dataMovimento) e de `ItemLocacaoRequest` (produtoId, quantidade, precoDiaria):

```java
private LocacaoRequest locacaoValida(String clienteId, int quantidade, int dias) {
    LocalDate retirada = LocalDate.now();
    LocalDate devolucao = retirada.plusDays(dias);
    return new LocacaoRequest(
            clienteId,
            FormaPagamento.PIX,
            retirada,
            devolucao,
            List.of(new ItemLocacaoRequest(produto.getId(), quantidade, null)),
            null,   // observacao
            null,   // status
            null,   // desconto
            null,   // tipoDesconto
            null,   // numeroParcelas
            null,   // primeiroVencimento
            null,   // entrega
            null,   // juros
            null,   // tipoJuros
            null    // dataMovimento
    );
}
```

- [ ] **Step 3: Atualizar cada `new LocacaoRequest(...)` e `new ItemLocacaoRequest(...)` inline dos testes**

Nos testes `deveCriarLancamentoPagoAoCriarLocacaoComPagamentoImediato`, `deveCriarLancamentoPendenteAoCriarLocacaoFiado` e `deveLancarExcecaoQuandoDatasInvalidas`, troque cada `new ItemLocacaoRequest(produto.getId(), N)` por `new ItemLocacaoRequest(produto.getId(), N, null)` e complete os `new LocacaoRequest(...)` com os 15 argumentos (usando `null` para os opcionais, como no helper). E toda chamada `locacaoService.criar(request)` vira `locacaoService.criar(request, false)`.

- [ ] **Step 4: Rodar a suíte e confirmar verde**

Run: `./mvnw test -Dtest=LocacoesServiceTest`
Expected: PASS (todos os testes existentes verdes).

- [ ] **Step 5: Commit**

```bash
git add src/test/java/com/example/marluse/locacoes/LocacoesServiceTest.java
git commit -m "test: realinha LocacoesServiceTest às assinaturas atuais de DTO"
```

---

## Task 2: Migração Flyway V6 (colunas por item)

**Files:**
- Create: `marluse/src/main/resources/db/migration/V6__add_controle_estoque_por_item.sql`

- [ ] **Step 1: Criar o script de migração**

Segue o padrão de `V4__add_estoque_descontado.sql`. Registros existentes: assumem `baixar_estoque = 1`, `permitir_sem_estoque = 0`, e herdam `estoque_descontado` do pedido/locação pai.

```sql
-- Controle de baixa de estoque por item (venda sem estoque + baixa opcional).
-- baixar_estoque: intenção de descontar o item (default TRUE, comportamento antigo).
-- permitir_sem_estoque: autoriza saldo negativo (default FALSE).
-- estoque_descontado: estado real por item (fonte de verdade para restauração).

ALTER TABLE itens_pedido
    ADD COLUMN baixar_estoque        TINYINT(1) NOT NULL DEFAULT 1,
    ADD COLUMN permitir_sem_estoque  TINYINT(1) NOT NULL DEFAULT 0,
    ADD COLUMN estoque_descontado    TINYINT(1) NOT NULL DEFAULT 0;

ALTER TABLE itens_locacao
    ADD COLUMN baixar_estoque        TINYINT(1) NOT NULL DEFAULT 1,
    ADD COLUMN permitir_sem_estoque  TINYINT(1) NOT NULL DEFAULT 0,
    ADD COLUMN estoque_descontado    TINYINT(1) NOT NULL DEFAULT 0;

-- Backfill: itens herdam o estado de baixa do pai (comportamento antigo era all-or-nothing).
UPDATE itens_pedido i
    JOIN pedidos p ON p.id = i.pedido_id
    SET i.estoque_descontado = p.estoque_descontado;

UPDATE itens_locacao i
    JOIN locacoes l ON l.id = i.locacao_id
    SET i.estoque_descontado = l.estoque_descontado;
```

- [ ] **Step 2: Validar o SQL localmente (perfil docker)**

Run (na raiz `marluse`, com o MySQL do `docker-compose` no ar): `./mvnw -Dspring-boot.run.profiles=docker spring-boot:run`
Expected: log do Flyway aplicando `V6` sem erro; a aplicação sobe. (Encerre com Ctrl+C.)
Observação: o perfil de teste usa `ddl-auto` do Hibernate e **não** roda Flyway — os testes das próximas tarefas dependem apenas das entidades JPA.

- [ ] **Step 3: Commit**

```bash
git add src/main/resources/db/migration/V6__add_controle_estoque_por_item.sql
git commit -m "feat(db): colunas de controle de estoque por item (V6)"
```

---

## Task 3: Campos novos em `ItemLocacao`

**Files:**
- Modify: `marluse/src/main/java/com/example/marluse/locacoes/model/ItemLocacao.java`

- [ ] **Step 1: Adicionar os três campos com defaults**

Adicione dentro da classe (após o campo `subtotal`):

```java
    @Builder.Default
    @Column(name = "baixar_estoque", nullable = false)
    private boolean baixarEstoque = true;

    @Builder.Default
    @Column(name = "permitir_sem_estoque", nullable = false)
    private boolean permitirSemEstoque = false;

    @Builder.Default
    @Column(name = "estoque_descontado", nullable = false)
    private boolean estoqueDescontado = false;
```

- [ ] **Step 2: Compilar**

Run: `./mvnw -q compile`
Expected: BUILD SUCCESS.

- [ ] **Step 3: Commit**

```bash
git add src/main/java/com/example/marluse/locacoes/model/ItemLocacao.java
git commit -m "feat(locacoes): campos de controle de estoque em ItemLocacao"
```

---

## Task 4: Campos novos em `ItemPedido`

**Files:**
- Modify: `marluse/src/main/java/com/example/marluse/vendas/model/ItemPedido.java`

- [ ] **Step 1: Adicionar os três campos com defaults**

Adicione dentro da classe (após o campo `subTotal`):

```java
    @Builder.Default
    @Column(name = "baixar_estoque", nullable = false)
    private boolean baixarEstoque = true;

    @Builder.Default
    @Column(name = "permitir_sem_estoque", nullable = false)
    private boolean permitirSemEstoque = false;

    @Builder.Default
    @Column(name = "estoque_descontado", nullable = false)
    private boolean estoqueDescontado = false;
```

- [ ] **Step 2: Compilar**

Run: `./mvnw -q compile`
Expected: BUILD SUCCESS.

- [ ] **Step 3: Commit**

```bash
git add src/main/java/com/example/marluse/vendas/model/ItemPedido.java
git commit -m "feat(vendas): campos de controle de estoque em ItemPedido"
```

---

## Task 5: DTOs de Locação (request + response)

**Files:**
- Modify: `marluse/src/main/java/com/example/marluse/locacoes/dto/ItemLocacaoRequest.java`
- Modify: `marluse/src/main/java/com/example/marluse/locacoes/dto/ItemLocacaoResponse.java`

- [ ] **Step 1: Adicionar campos ao request**

Substitua o corpo do record `ItemLocacaoRequest` por (mantendo validações existentes):

```java
public record ItemLocacaoRequest (
        @NotNull(message = "Produto é obrigatório")
        String produtoId,

        @NotNull(message = "Quantidade é obrigatória")
        @Min(value = 1, message = "Quantidade deve ser maior que zero")
        Integer quantidade,

        BigDecimal precoDiaria,

        Boolean baixarEstoque,

        Boolean permitirSemEstoque
) {
}
```

> ⚠️ Isso muda o construtor de 3 → 5 args. O `LocacoesServiceTest` (Task 1) usa `new ItemLocacaoRequest(id, qtd, null)` — será atualizado na Task 9.

- [ ] **Step 2: Expor estado no response**

Substitua o record `ItemLocacaoResponse` por:

```java
public record ItemLocacaoResponse(
        String id,
        String produtoId,
        String produtoNome,
        Integer quantidade,
        BigDecimal precoDiaria,
        BigDecimal subtotal,
        boolean baixarEstoque,
        boolean estoqueDescontado
) {
    public static ItemLocacaoResponse from(ItemLocacao item) {
        return new ItemLocacaoResponse(
                item.getId(),
                item.getProduto().getId(),
                item.getProduto().getNome(),
                item.getQuantidade(),
                item.getPrecoDiaria(),
                item.getSubtotal(),
                item.isBaixarEstoque(),
                item.isEstoqueDescontado()
        );
    }
}
```

- [ ] **Step 3: Compilar**

Run: `./mvnw -q compile`
Expected: BUILD SUCCESS.

- [ ] **Step 4: Commit**

```bash
git add src/main/java/com/example/marluse/locacoes/dto/ItemLocacaoRequest.java src/main/java/com/example/marluse/locacoes/dto/ItemLocacaoResponse.java
git commit -m "feat(locacoes): campos de estoque nos DTOs de item"
```

---

## Task 6: DTOs de Venda (request + response)

**Files:**
- Modify: `marluse/src/main/java/com/example/marluse/vendas/dto/ItemPedidoRequest.java`
- Modify: `marluse/src/main/java/com/example/marluse/vendas/dto/ItemPedidoResponse.java`

- [ ] **Step 1: Adicionar campos ao request**

Substitua o corpo do record `ItemPedidoRequest` por:

```java
public record ItemPedidoRequest(
        @NotNull(message = "Produto é obrigatório")
        String productId,

        @NotNull(message = "Quantidade é obrigatória")
        @Min(value = 1, message = "A Quantidade deve ser maior que zero")
        Integer quantidade,

        BigDecimal preco,

        Boolean baixarEstoque,

        Boolean permitirSemEstoque
) {
}
```

- [ ] **Step 2: Expor estado no response**

Substitua o record `ItemPedidoResponse` por:

```java
public record ItemPedidoResponse(
        String id,
        String produtoId,
        String produtoNome,
        Integer quantidade,
        BigDecimal precoUnitario,
        BigDecimal subtotal,
        boolean baixarEstoque,
        boolean estoqueDescontado
) {
    public static ItemPedidoResponse from(ItemPedido item) {
        return new ItemPedidoResponse(
                item.getId(),
                item.getProduto().getId(),
                item.getProduto().getNome(),
                item.getQuantidade(),
                item.getPrecoUnitario(),
                item.getSubTotal(),
                item.isBaixarEstoque(),
                item.isEstoqueDescontado()
        );
    }
}
```

- [ ] **Step 3: Compilar**

Run: `./mvnw -q compile`
Expected: BUILD SUCCESS.

- [ ] **Step 4: Commit**

```bash
git add src/main/java/com/example/marluse/vendas/dto/ItemPedidoRequest.java src/main/java/com/example/marluse/vendas/dto/ItemPedidoResponse.java
git commit -m "feat(vendas): campos de estoque nos DTOs de item"
```

---

## Task 7: `LocacaoService` — baixa e restauração por item

**Files:**
- Modify: `marluse/src/main/java/com/example/marluse/locacoes/service/LocacaoService.java`
- Test: `marluse/src/test/java/com/example/marluse/locacoes/LocacoesServiceTest.java`

Nesta tarefa escrevemos os testes primeiro. Os construtores dos testes já precisam do formato de 5 args de `ItemLocacaoRequest` — atualize o helper e escreva os novos casos.

- [ ] **Step 1: Atualizar helper e escrever os testes (falhando)**

No `LocacoesServiceTest`, ajuste `locacaoValida` para o construtor de 5 args e adicione um helper de request customizado + 4 testes. Cole:

```java
private LocacaoRequest locacaoComItens(List<ItemLocacaoRequest> itens) {
    return new LocacaoRequest(
            null, FormaPagamento.PIX, LocalDate.now(), LocalDate.now().plusDays(3),
            itens, null, null, null, null, null, null, null, null, null, null);
}

@Test
void naoDeveBaixarEstoqueQuandoBaixarEstoqueFalse() {
    ItemLocacaoRequest item = new ItemLocacaoRequest(produto.getId(), 2, null, false, null);
    locacaoService.criar(locacaoComItens(List.of(item)), false);

    Produto atualizado = produtoRepository.findById(produto.getId()).orElseThrow();
    assertEquals(5, atualizado.getQuantidadeEstoque()); // inalterado
}

@Test
void devePermitirEstoqueNegativoQuandoPermitirSemEstoqueTrue() {
    ItemLocacaoRequest item = new ItemLocacaoRequest(produto.getId(), 8, null, true, true);
    locacaoService.criar(locacaoComItens(List.of(item)), false);

    Produto atualizado = produtoRepository.findById(produto.getId()).orElseThrow();
    assertEquals(-3, atualizado.getQuantidadeEstoque()); // 5 - 8
}

@Test
void deveLancarExcecaoAoVenderSemEstoqueSemPermissao() {
    ItemLocacaoRequest item = new ItemLocacaoRequest(produto.getId(), 8, null, true, false);
    assertThrows(IllegalArgumentException.class,
            () -> locacaoService.criar(locacaoComItens(List.of(item)), false));
}

@Test
void naoDeveRestaurarEstoqueDeItemNaoBaixadoAoCancelar() {
    ItemLocacaoRequest item = new ItemLocacaoRequest(produto.getId(), 2, null, false, null);
    LocacaoResponse loc = locacaoService.criar(locacaoComItens(List.of(item)), false);

    locacaoService.cancelar(loc.id());

    Produto atualizado = produtoRepository.findById(produto.getId()).orElseThrow();
    assertEquals(5, atualizado.getQuantidadeEstoque()); // não sobe para 7
}
```

- [ ] **Step 2: Rodar os novos testes e ver falhar**

Run: `./mvnw test -Dtest=LocacoesServiceTest`
Expected: FAIL — os 4 novos falham (comportamento antigo baixa/restaura tudo e lança em estoque insuficiente sempre).

- [ ] **Step 3: Adicionar helper de baixa e ajustar `criar`**

Adicione o método privado ao `LocacaoService`:

```java
/** Baixa o estoque de um item respeitando permitirSemEstoque; marca o item como descontado. */
private void baixarEstoqueItem(ItemLocacao item) {
    Produto produto = item.getProduto();
    int novoSaldo = produto.getQuantidadeEstoque() - item.getQuantidade();
    if (novoSaldo < 0 && !item.isPermitirSemEstoque()) {
        throw new IllegalArgumentException("Estoque insuficiente para: " + produto.getNome());
    }
    produto.setQuantidadeEstoque(novoSaldo);
    produtoRepository.save(produto);
    item.setEstoqueDescontado(true);
}
```

No `criar`, dentro do loop de itens, **substitua** o bloco atual de checagem/baixa (as linhas que fazem `if (statusInicial != ORCAMENTO && !temEntrega) { ... produto.setQuantidadeEstoque(...) }`) e a construção do item por:

```java
    boolean baixar = itemRequest.baixarEstoque() == null || itemRequest.baixarEstoque();
    boolean permitir = Boolean.TRUE.equals(itemRequest.permitirSemEstoque());

    BigDecimal diaria = itemRequest.precoDiaria() != null
            ? itemRequest.precoDiaria()
            : (produto.getPrecoDiaria() != null ? produto.getPrecoDiaria() : produto.getPreco());

    BigDecimal subtotal = diaria
            .multiply(BigDecimal.valueOf(itemRequest.quantidade()))
            .multiply(BigDecimal.valueOf(dias));

    ItemLocacao item = ItemLocacao.builder()
            .locacao(locacao)
            .produto(produto)
            .quantidade(itemRequest.quantidade())
            .precoDiaria(diaria)
            .subtotal(subtotal)
            .baixarEstoque(baixar)
            .permitirSemEstoque(permitir)
            .build();

    // Orçamento nunca baixa; com entrega, baixa só na confirmação da entrega
    if (statusInicial != StatusLocacao.ORCAMENTO && !temEntrega && baixar) {
        baixarEstoqueItem(item);
    }

    locacao.getItens().add(item);
    total = total.add(subtotal);
```

Depois do loop, **substitua** `if (statusInicial != StatusLocacao.ORCAMENTO && !temEntrega) { locacao.setEstoqueDescontado(true); }` por uma derivação por item:

```java
    locacao.setEstoqueDescontado(
            locacao.getItens().stream().anyMatch(ItemLocacao::isEstoqueDescontado));
```

- [ ] **Step 4: Ajustar `confirmar` (orçamento → ativa)**

No `confirmar`, **substitua** o bloco `if (!temEntregaConfirmar) { for (...) { checa/baixa } locacao.setEstoqueDescontado(true); }` por:

```java
    if (!temEntregaConfirmar) {
        for (ItemLocacao item : locacao.getItens()) {
            if (item.isBaixarEstoque() && !item.isEstoqueDescontado()) {
                baixarEstoqueItem(item);
            }
        }
    }
    locacao.setEstoqueDescontado(
            locacao.getItens().stream().anyMatch(ItemLocacao::isEstoqueDescontado));
```

- [ ] **Step 5: Ajustar restauração em `devolver`, `cancelar` e `deletar`**

Nos três métodos, **substitua** o bloco `if (locacao.isEstoqueDescontado()) { for (ItemLocacao item : locacao.getItens()) { restaura } }` por iteração por item:

```java
    for (ItemLocacao item : locacao.getItens()) {
        if (item.isEstoqueDescontado()) {
            Produto produto = item.getProduto();
            produto.setQuantidadeEstoque(produto.getQuantidadeEstoque() + item.getQuantidade());
            produtoRepository.save(produto);
            item.setEstoqueDescontado(false);
        }
    }
```

- [ ] **Step 6: Rodar os testes e confirmar verde**

Run: `./mvnw test -Dtest=LocacoesServiceTest`
Expected: PASS (existentes + 4 novos).

- [ ] **Step 7: Commit**

```bash
git add src/main/java/com/example/marluse/locacoes/service/LocacaoService.java src/test/java/com/example/marluse/locacoes/LocacoesServiceTest.java
git commit -m "feat(locacoes): baixa e restauração de estoque por item"
```

---

## Task 8: `PedidoService` — baixa e restauração por item

**Files:**
- Modify: `marluse/src/main/java/com/example/marluse/vendas/service/PedidoService.java`
- Test: `marluse/src/test/java/com/example/marluse/vendas/PedidoServiceTest.java`

- [ ] **Step 1: Ler o setup atual do `PedidoServiceTest`**

Run: `sed -n '1,90p' src/test/java/com/example/marluse/vendas/PedidoServiceTest.java`
Expected: identificar o nome do produto/campo (`produto`), o `ProdutoRepository` injetado e o helper de `PedidoRequest`/`ItemPedidoRequest` usado. Anote a ordem dos 14 campos de `PedidoRequest` (clienteId, formaPagamento, itens, observacao, status, dataVencimento, desconto, tipoDesconto, numeroParcelas, primeiroVencimento, entrega, juros, tipoJuros, dataMovimento) e ajuste os `new ItemPedidoRequest(...)` para 5 args.

- [ ] **Step 2: Escrever os testes (falhando)**

Adicione ao `PedidoServiceTest` (ajuste `produto`/campos ao que o setup expõe; assume estoque inicial 5 como no setup padrão — se diferente, ajuste os valores esperados):

```java
private PedidoRequest pedidoComItens(List<ItemPedidoRequest> itens) {
    return new PedidoRequest(
            null, FormaPagamento.DINHEIRO, itens, null, StatusPedido.CONFIRMADO,
            null, null, null, null, null, null, null, null, null);
}

@Test
void naoDeveBaixarEstoqueQuandoBaixarEstoqueFalse() {
    ItemPedidoRequest item = new ItemPedidoRequest(produto.getId(), 2, null, false, null);
    pedidoService.criar(pedidoComItens(List.of(item)));

    Produto atualizado = produtoRepository.findById(produto.getId()).orElseThrow();
    assertEquals(5, atualizado.getQuantidadeEstoque());
}

@Test
void devePermitirEstoqueNegativoQuandoPermitirSemEstoqueTrue() {
    ItemPedidoRequest item = new ItemPedidoRequest(produto.getId(), 8, null, true, true);
    pedidoService.criar(pedidoComItens(List.of(item)));

    Produto atualizado = produtoRepository.findById(produto.getId()).orElseThrow();
    assertEquals(-3, atualizado.getQuantidadeEstoque());
}

@Test
void deveLancarExcecaoAoVenderSemEstoqueSemPermissao() {
    ItemPedidoRequest item = new ItemPedidoRequest(produto.getId(), 8, null, true, false);
    assertThrows(IllegalArgumentException.class,
            () -> pedidoService.criar(pedidoComItens(List.of(item))));
}

@Test
void naoDeveRestaurarEstoqueDeItemNaoBaixadoAoCancelar() {
    ItemPedidoRequest item = new ItemPedidoRequest(produto.getId(), 2, null, false, null);
    PedidoResponse ped = pedidoService.criar(pedidoComItens(List.of(item)));

    pedidoService.cancelar(ped.id());

    Produto atualizado = produtoRepository.findById(produto.getId()).orElseThrow();
    assertEquals(5, atualizado.getQuantidadeEstoque());
}
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `./mvnw test -Dtest=PedidoServiceTest`
Expected: FAIL nos 4 novos testes.

- [ ] **Step 4: Adicionar helper de baixa e ajustar `criar`**

Adicione o método privado ao `PedidoService`:

```java
/** Baixa o estoque de um item respeitando permitirSemEstoque; marca o item como descontado. */
private void baixarEstoqueItem(ItemPedido item) {
    Produto produto = item.getProduto();
    int novoSaldo = produto.getQuantidadeEstoque() - item.getQuantidade();
    if (novoSaldo < 0 && !item.isPermitirSemEstoque()) {
        throw new IllegalArgumentException("Estoque insuficiente: " + produto.getNome());
    }
    produto.setQuantidadeEstoque(novoSaldo);
    produtoRepository.save(produto);
    item.setEstoqueDescontado(true);
}
```

No `criar`, dentro do loop, **substitua** o bloco de checagem/baixa e a construção do item por:

```java
    boolean baixar = itemRequest.baixarEstoque() == null || itemRequest.baixarEstoque();
    boolean permitir = Boolean.TRUE.equals(itemRequest.permitirSemEstoque());

    BigDecimal precoVenda = itemRequest.preco() != null
            ? itemRequest.preco()
            : produto.getPreco();

    BigDecimal subTotal = precoVenda.multiply(BigDecimal.valueOf(itemRequest.quantidade()));

    ItemPedido item = ItemPedido.builder()
            .pedido(pedido)
            .produto(produto)
            .quantidade(itemRequest.quantidade())
            .custoUnitario(produto.getValorCompra())
            .precoUnitario(precoVenda)
            .subTotal(subTotal)
            .baixarEstoque(baixar)
            .permitirSemEstoque(permitir)
            .build();

    if (statusInicial != StatusPedido.ORCAMENTO && !temEntrega && baixar) {
        baixarEstoqueItem(item);
    }

    pedido.getItens().add(item);
    total = total.add(subTotal);
```

Depois do loop, **substitua** o `if (statusInicial != StatusPedido.ORCAMENTO && !temEntrega) { pedido.setEstoqueDescontado(true); }` por:

```java
    pedido.setEstoqueDescontado(
            pedido.getItens().stream().anyMatch(ItemPedido::isEstoqueDescontado));
```

> Atenção à ordem: hoje esse `setEstoqueDescontado(true)` está **antes** de `pedidoRepository.save(pedido)`. Mantenha a derivação também antes do save.

- [ ] **Step 5: Ajustar `confirmar`**

No `confirmar`, **substitua** o loop que baixa estoque e o `pedido.setEstoqueDescontado(true)` por:

```java
    for (ItemPedido item : pedido.getItens()) {
        if (!temEntregaConfirmar && item.isBaixarEstoque() && !item.isEstoqueDescontado()) {
            baixarEstoqueItem(item);
        }
        item.setCustoUnitario(item.getProduto().getValorCompra());
    }
    pedido.setEstoqueDescontado(
            pedido.getItens().stream().anyMatch(ItemPedido::isEstoqueDescontado));
```

- [ ] **Step 6: Ajustar restauração em `cancelar`**

**Substitua** o bloco `if (pedido.isEstoqueDescontado()) { for (...) { restaura } }` por:

```java
    for (ItemPedido item : pedido.getItens()) {
        if (item.isEstoqueDescontado()) {
            Produto produto = item.getProduto();
            produto.setQuantidadeEstoque(produto.getQuantidadeEstoque() + item.getQuantidade());
            produtoRepository.save(produto);
            item.setEstoqueDescontado(false);
        }
    }
```

- [ ] **Step 7: Rodar e confirmar verde**

Run: `./mvnw test -Dtest=PedidoServiceTest`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/main/java/com/example/marluse/vendas/service/PedidoService.java src/test/java/com/example/marluse/vendas/PedidoServiceTest.java
git commit -m "feat(vendas): baixa e restauração de estoque por item"
```

---

## Task 9: `EntregaService` — baixa por item na entrega

Hoje a entrega baixa **todos** os itens quando `pedido/locacao.estoqueDescontado == false`. Agora deve respeitar `baixarEstoque` e `permitirSemEstoque` por item, e marcar `estoqueDescontado` por item.

**Files:**
- Modify: `marluse/src/main/java/com/example/marluse/entrega/service/EntregaService.java`

- [ ] **Step 1: Reescrever `entregar` para operar por item**

**Substitua** os dois blocos (pedido e locação) dentro de `entregar` por lógica por item. Para o pedido:

```java
    Pedido pedido = entrega.getPedido();
    if (pedido != null) {
        for (ItemPedido item : pedido.getItens()) {
            if (item.isBaixarEstoque() && !item.isEstoqueDescontado()) {
                Produto produto = item.getProduto();
                int novoSaldo = produto.getQuantidadeEstoque() - item.getQuantidade();
                if (novoSaldo < 0 && !item.isPermitirSemEstoque()) {
                    throw new IllegalArgumentException(
                            "Estoque insuficiente para entregar: " + produto.getNome());
                }
                produto.setQuantidadeEstoque(novoSaldo);
                produtoRepository.save(produto);
                item.setEstoqueDescontado(true);
            }
        }
        pedido.setEstoqueDescontado(
                pedido.getItens().stream().anyMatch(ItemPedido::isEstoqueDescontado));
        pedidoRepository.save(pedido);
    }
```

Para a locação (análogo, com `ItemLocacao`):

```java
    Locacao locacao = entrega.getLocacao();
    if (locacao != null) {
        for (ItemLocacao item : locacao.getItens()) {
            if (item.isBaixarEstoque() && !item.isEstoqueDescontado()) {
                Produto produto = item.getProduto();
                int novoSaldo = produto.getQuantidadeEstoque() - item.getQuantidade();
                if (novoSaldo < 0 && !item.isPermitirSemEstoque()) {
                    throw new IllegalArgumentException(
                            "Estoque insuficiente para entregar: " + produto.getNome());
                }
                produto.setQuantidadeEstoque(novoSaldo);
                produtoRepository.save(produto);
                item.setEstoqueDescontado(true);
            }
        }
        locacao.setEstoqueDescontado(
                locacao.getItens().stream().anyMatch(ItemLocacao::isEstoqueDescontado));
        locacaoRepository.save(locacao);
    }
```

- [ ] **Step 2: Compilar e rodar a suíte completa do backend**

Run: `./mvnw test`
Expected: BUILD SUCCESS, todos verdes.

- [ ] **Step 3: Commit**

```bash
git add src/main/java/com/example/marluse/entrega/service/EntregaService.java
git commit -m "feat(entrega): baixa de estoque por item na confirmação da entrega"
```

---

## Task 10: Modelos do frontend (Venda + Locação)

**Files:**
- Modify: `marluse-frontend/src/app/features/vendas/models/vendas.models.ts`
- Modify: `marluse-frontend/src/app/features/locacoes/models/locacoes.models.ts`

- [ ] **Step 1: Atualizar DTOs de Venda**

Em `vendas.models.ts`, **substitua** `ItemPedidoRequest`, `ItemPedidoResponse` e `ItemPedidoForm` por:

```typescript
export interface ItemPedidoRequest {
  productId: string;
  quantidade: number;
  preco?: number;
  baixarEstoque?: boolean;
  permitirSemEstoque?: boolean;
}

export interface ItemPedidoResponse {
  id: string;
  produtoId: string;
  produtoNome: string;
  quantidade: number;
  precoUnitario: number;
  subtotal: number;
  baixarEstoque: boolean;
  estoqueDescontado: boolean;
}

export interface ItemPedidoForm {
  productId: string;
  produtoNome: string;
  preco: number;
  quantidade: number;
  baixarEstoque: boolean;
}
```

- [ ] **Step 2: Atualizar DTOs de Locação**

Em `locacoes.models.ts`, **substitua** `ItemLocacaoRequest`, `ItemLocacaoResponse` e `ItemLocacaoForm` por:

```typescript
export interface ItemLocacaoRequest {
  produtoId: string;
  quantidade: number;
  precoDiaria?: number;
  baixarEstoque?: boolean;
  permitirSemEstoque?: boolean;
}

export interface ItemLocacaoResponse {
  id: string;
  produtoId: string;
  produtoNome: string;
  quantidade: number;
  precoDiaria: number;
  subtotal: number;
  baixarEstoque: boolean;
  estoqueDescontado: boolean;
}

export interface ItemLocacaoForm {
  produtoId: string;
  produtoNome: string;
  precoDiaria: number;
  quantidade: number;
  baixarEstoque: boolean;
}
```

- [ ] **Step 3: Compilar o frontend**

Run (na raiz `marluse-frontend`): `npm run build`
Expected: build sem erros de tipo.

- [ ] **Step 4: Commit**

```bash
git add src/app/features/vendas/models/vendas.models.ts src/app/features/locacoes/models/locacoes.models.ts
git commit -m "feat: campos de controle de estoque nos modelos de item"
```

---

## Task 11: Modal Nova Locação — toggle por item + confirmDialog

**Files:**
- Modify: `marluse-frontend/src/app/features/locacoes/nova-locacao-modal/nova-locacao-modal.component.ts`
- Modify: `marluse-frontend/src/app/features/locacoes/nova-locacao-modal/nova-locacao-modal.component.html`

- [ ] **Step 1: Importar ConfirmationService e ConfirmDialog no componente**

No `nova-locacao-modal.component.ts`, adicione aos imports do topo:

```typescript
import { ConfirmationService, MessageService } from 'primeng/api';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
```

No decorator `@Component`, adicione `ConfirmDialogModule` ao array `imports` e um `providers`:

```typescript
    imports: [CommonModule, FormsModule, DialogModule, ConfirmDialogModule, SelectSearchComponent, DatePickerComponent],
    providers: [ConfirmationService],
```

E injete o serviço junto aos outros `inject(...)`:

```typescript
    private confirmationService = inject(ConfirmationService);
```

- [ ] **Step 2: Atualizar a interface `ItemForm` e `novoItem`**

**Substitua** a interface `ItemForm` (topo do arquivo) e o método `novoItem`:

```typescript
interface ItemForm {
  produtoId: string;
  produtoNome: string;
  precoUnitario: number;
  quantidade: number;
  baixarEstoque: boolean;
}
```

```typescript
    novoItem(): ItemForm {
        return { produtoId: '', produtoNome: '', precoUnitario: 0, quantidade: 1, baixarEstoque: true };
    }
```

- [ ] **Step 3: Adicionar helper de saldo e refatorar `salvar`**

Adicione um método para descobrir itens que vendem sem saldo e **substitua** o corpo de `salvar` para checar antes de postar. O produto tem `quantidadeEstoque` em `this.produtos`.

```typescript
    /** Itens que vão baixar estoque mas cuja quantidade excede o saldo disponível. */
    private itensSemSaldo(): ItemForm[] {
        return this.itens.filter(i => {
            if (!i.baixarEstoque || !i.produtoId) return false;
            const prod = this.produtos.find(p => p.id === i.produtoId);
            return !!prod && i.quantidade > prod.quantidadeEstoque;
        });
    }

    salvar(): void {
        if (!this.formValida) return;

        const semSaldo = this.itensSemSaldo();
        if (semSaldo.length > 0) {
            const nomes = semSaldo.map(i => i.produtoNome).join(', ');
            this.confirmationService.confirm({
                header: 'Vender sem estoque?',
                message: `Sem itens em estoque para: ${nomes}. O estoque ficará negativo. Deseja continuar?`,
                icon: 'pi pi-exclamation-triangle',
                acceptLabel: 'Sim, vender',
                rejectLabel: 'Cancelar',
                acceptButtonProps: { severity: 'danger' },
                rejectButtonProps: { severity: 'secondary', outlined: true },
                accept: () => this.enviar(true),
            });
            return;
        }
        this.enviar(false);
    }
```

- [ ] **Step 4: Extrair o POST para `enviar(permitirSemEstoque)`**

Mova a lógica que hoje está em `salvar` (o `this.salvando = true; this.service.postLocacao({...})...`) para um novo método `enviar`, mapeando os campos por item. **Substitua** o `.map` dos itens para incluir os flags:

```typescript
    private enviar(permitirSemEstoque: boolean): void {
        this.salvando = true;
        const status: StatusLocacao = this.tipo === 'ORCAMENTO' ? 'ORCAMENTO' : 'ATIVA';

        this.service.postLocacao({
            clienteId:             this.clienteId || undefined,
            formaPagamento:        this.formaPagamento as FormaPagamento,
            dataRetirada:          this.dataRetirada,
            dataDevolucaoPrevista: this.dataDevolucaoPrevista,
            itens:                 this.itens.map(i => ({
                                     produtoId: i.produtoId,
                                     quantidade: i.quantidade,
                                     precoDiaria: i.precoUnitario,
                                     baixarEstoque: i.baixarEstoque,
                                     permitirSemEstoque: permitirSemEstoque && i.baixarEstoque,
                                   })),
            observacao:            this.observacao || null,
            status,
            desconto:              this.desconto || null,
            tipoDesconto:          this.desconto ? this.tipoDesconto : null,
            numeroParcelas:        this.numeroParcelas > 1 ? this.numeroParcelas : undefined,
            primeiroVencimento:    this.usaParcelas && this.primeiroVencimento ? this.primeiroVencimento : undefined,
            entrega:               this.temEntrega && this.enderecoEntrega
                                     ? { endereco: this.enderecoEntrega, dataPrevista: this.dataPrevistaEntrega || null }
                                     : null,
            dataMovimento:         this.dataMovimento || undefined,
            juros:                 this.juros || null,
            tipoJuros:             this.juros ? this.tipoJuros : null,
        }, this.tipo === 'ORCAMENTO').pipe(
            finalize(() => { this.salvando = false; this.cdr.detectChanges(); })
        ).subscribe({
            next: (locacao) => { this.locacaoCriada.emit(locacao); this.resetForm(); },
            error: (err: any) => {
                const detail = err?.error?.message ?? 'Não foi possível criar a locação';
                this.messageService.add({ severity: 'error', summary: 'Erro', detail, life: 5000 });
            },
        });
    }
```

- [ ] **Step 5: Adicionar o toggle e o `<p-confirmdialog>` no HTML**

Abra `nova-locacao-modal.component.html` e localize a linha de item (onde há o `<select>`/`SelectSearch` do produto e o controle de quantidade, iterando `itens`). Adicione, na mesma linha do item, um checkbox vinculado a `item.baixarEstoque`:

```html
<label class="flex items-center gap-1 text-xs whitespace-nowrap">
  <input type="checkbox" [(ngModel)]="item.baixarEstoque" [name]="'baixar-' + i" />
  Baixar estoque
</label>
```

> Use o índice `i` já disponível no `*ngFor` (o template usa `trackByIndex`). Se o `*ngFor` não expõe `i`, altere para `*ngFor="let item of itens; let i = index; trackBy: trackByIndex"`.

E, ao final do template (dentro do `<p-dialog>`), adicione o diálogo de confirmação:

```html
<p-confirmdialog />
```

- [ ] **Step 6: Verificar no navegador (dev server)**

Suba o frontend e o backend e valide o fluxo (ver Task 13). Confirme visualmente: checkbox aparece por item; ao desmarcar e salvar, estoque não muda; ao vender acima do saldo com checkbox marcado, aparece o confirmDialog.

- [ ] **Step 7: Commit**

```bash
git add src/app/features/locacoes/nova-locacao-modal/
git commit -m "feat(locacoes): toggle de baixa por item e confirmação de venda sem estoque"
```

---

## Task 12: Modal Novo Pedido — toggle por item + confirmDialog

Espelha a Task 11 para o fluxo de Venda.

**Files:**
- Modify: `marluse-frontend/src/app/features/vendas/components/novo-pedido-modal/novo-pedido-modal.component.ts`
- Modify: `marluse-frontend/src/app/features/vendas/components/novo-pedido-modal/novo-pedido-modal.component.html`

- [ ] **Step 1: Imports, providers e injeção**

No `novo-pedido-modal.component.ts` adicione:

```typescript
import { ConfirmationService, MessageService } from 'primeng/api';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
```

No `@Component`: adicione `ConfirmDialogModule` a `imports` e `providers: [ConfirmationService]`. Injete:

```typescript
  private confirmationService = inject(ConfirmationService);
```

- [ ] **Step 2: Atualizar `ItemForm` e `novoItem`**

```typescript
interface ItemForm {
  produtoId: string;
  produtoNome: string;
  precoUnitario: number;
  quantidade: number;
  baixarEstoque: boolean;
}
```

```typescript
  novoItem(): ItemForm {
    return { produtoId: '', produtoNome: '', precoUnitario: 0, quantidade: 1, baixarEstoque: true };
  }
```

- [ ] **Step 3: Helper de saldo + refatorar `salvar`**

```typescript
  private itensSemSaldo(): ItemForm[] {
    return this.itens.filter(i => {
      if (!i.baixarEstoque || !i.produtoId) return false;
      const prod = this.produtos.find(p => p.id === i.produtoId);
      return !!prod && i.quantidade > prod.quantidadeEstoque;
    });
  }

  salvar(): void {
    if (!this.formValida) return;

    const semSaldo = this.itensSemSaldo();
    if (semSaldo.length > 0) {
      const nomes = semSaldo.map(i => i.produtoNome).join(', ');
      this.confirmationService.confirm({
        header: 'Vender sem estoque?',
        message: `Sem itens em estoque para: ${nomes}. O estoque ficará negativo. Deseja continuar?`,
        icon: 'pi pi-exclamation-triangle',
        acceptLabel: 'Sim, vender',
        rejectLabel: 'Cancelar',
        acceptButtonProps: { severity: 'danger' },
        rejectButtonProps: { severity: 'secondary', outlined: true },
        accept: () => this.enviar(true),
      });
      return;
    }
    this.enviar(false);
  }
```

- [ ] **Step 4: Extrair `enviar(permitirSemEstoque)`**

Mova o `this.salvando = true; this.service.postPedidos({...})` para `enviar`, incluindo os flags por item:

```typescript
  private enviar(permitirSemEstoque: boolean): void {
    this.salvando = true;
    const status: StatusPedido = this.tipo === 'ORCAMENTO' ? 'ORCAMENTO' : 'CONFIRMADO';
    this.service.postPedidos({
      clienteId:         this.clienteId || undefined,
      formaPagamento:    this.formaPagamento as FormaPagamento,
      itens:             this.itens.map(i => ({
                           productId: i.produtoId,
                           quantidade: i.quantidade,
                           preco: i.precoUnitario,
                           baixarEstoque: i.baixarEstoque,
                           permitirSemEstoque: permitirSemEstoque && i.baixarEstoque,
                         })),
      status,
      dataVencimento:    this.isFiado && this.numeroParcelas === 1 && this.primeiroVencimento ? this.primeiroVencimento : undefined,
      observacao:        this.observacao || undefined,
      desconto:          this.desconto || null,
      tipoDesconto:      this.desconto ? this.tipoDesconto : null,
      numeroParcelas:    this.numeroParcelas > 1 ? this.numeroParcelas : undefined,
      primeiroVencimento: this.usaParcelas && this.primeiroVencimento ? this.primeiroVencimento : undefined,
      entrega:           this.temEntrega && this.enderecoEntrega
                           ? { endereco: this.enderecoEntrega, dataPrevista: this.dataPrevistaEntrega || null }
                           : null,
      dataMovimento:     this.dataMovimento || undefined,
      juros:             this.juros || null,
      tipoJuros:         this.juros ? this.tipoJuros : null,
    }).pipe(
      finalize(() => { this.salvando = false; this.cdr.detectChanges(); })
    ).subscribe({
      next: (pedido) => { this.pedidoCriado.emit(pedido); this.resetForm(); },
      error: (err) => {
        const detail = err?.error?.message ?? 'Não foi possível criar o pedido';
        this.messageService.add({ severity: 'error', summary: 'Erro', detail, life: 5000 });
      },
    });
  }
```

- [ ] **Step 5: HTML — toggle + `<p-confirmdialog>`**

Em `novo-pedido-modal.component.html`, adicione na linha do item:

```html
<label class="flex items-center gap-1 text-xs whitespace-nowrap">
  <input type="checkbox" [(ngModel)]="item.baixarEstoque" [name]="'baixar-' + i" />
  Baixar estoque
</label>
```

E, ao final do `<p-dialog>`:

```html
<p-confirmdialog />
```

Garanta que o `*ngFor` dos itens expõe o índice: `*ngFor="let item of itens; let i = index; trackBy: trackByIndex"`.

- [ ] **Step 6: Build do frontend**

Run: `npm run build`
Expected: sem erros.

- [ ] **Step 7: Commit**

```bash
git add src/app/features/vendas/components/novo-pedido-modal/
git commit -m "feat(vendas): toggle de baixa por item e confirmação de venda sem estoque"
```

---

## Task 13: Verificação ponta-a-ponta

Valida os quatro cenários no app real (backend + frontend rodando).

**Files:** nenhum (verificação manual/observada).

- [ ] **Step 1: Subir backend e frontend**

Backend (raiz `marluse`, com MySQL do docker-compose no ar): `./mvnw -Dspring-boot.run.profiles=docker spring-boot:run`
Frontend (raiz `marluse-frontend`): `npm start` (proxy já configurado em `proxy.conf.json`).

- [ ] **Step 2: Cenário A — desmarcar "Baixar estoque"**

Crie uma locação/venda com um produto de estoque conhecido (ex.: 5), desmarque "Baixar estoque" no item, salve.
Expected: registro criado; estoque do produto permanece 5 (confira na tela de Estoque).

- [ ] **Step 3: Cenário B — vender sem saldo (confirmação)**

Crie uma venda com quantidade maior que o saldo (ex.: 8 com saldo 5), mantendo "Baixar estoque" marcado, salve.
Expected: aparece o diálogo "Vender sem estoque?"; ao confirmar, registro criado e estoque fica negativo (ex.: -3).

- [ ] **Step 4: Cenário C — cancelar restaura só o que baixou**

Cancele a venda do Cenário B.
Expected: estoque volta ao valor anterior (de -3 para 5). Cancele a do Cenário A: estoque permanece 5 (não sobe para 7).

- [ ] **Step 5: Cenário D — entrega baixa por item**

Crie uma venda **com entrega** contendo dois itens: um com "Baixar estoque" marcado e outro desmarcado. Confirme a entrega.
Expected: apenas o item marcado é baixado; o desmarcado não altera o estoque.

- [ ] **Step 6: Registrar evidência**

Anote/print dos saldos antes/depois de cada cenário. Se algum divergir, volte à tarefa correspondente (7/8/9) e depure.

---

## Self-Review

**Cobertura do spec:**
- "Opção por item de descontar ou não do estoque" → `baixarEstoque` (Tasks 3–6 backend, 10–12 frontend). ✓
- "Não tirar do estoque produtos ainda não entregues" → já coberto pelo fluxo de entrega, agora por item (Task 9). ✓
- "Vender produto sem estoque com confirmDialog, deixando saldo negativo" → `permitirSemEstoque` + confirmDialog (Tasks 5–8 backend, 11–12 frontend). ✓
- Correção de restauração (bug latente do booleano por pedido) → `estoqueDescontado` por item (Tasks 3–4, 7–9). ✓
- Migração de schema para produção (Flyway `validate`) → Task 2. ✓

**Riscos/consequências conhecidas:**
- Estoque negativo passará a aparecer no dashboard de estoque crítico e relatórios — comportamento desejado (alerta), mas confirme com o usuário se algum relatório soma estoque de forma que negativos distorçam.
- Comprovantes (`pedido-comprovante`, `locacao-comprovante`) e modais de detalhe consomem `ItemPedidoResponse`/`ItemLocacaoResponse` — os campos novos são aditivos, então não quebram; opcionalmente exibir "não baixa estoque" no detalhe (fora do escopo).

**Consistência de tipos:** `baixarEstoque`/`permitirSemEstoque`/`estoqueDescontado` usados com o mesmo nome e semântica em entidade, DTOs e frontend. Request DTO usa `Boolean` (nullável, normalizado no service); entidade e response usam `boolean`.
