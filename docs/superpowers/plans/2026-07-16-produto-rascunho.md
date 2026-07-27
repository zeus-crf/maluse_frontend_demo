# Produto Rascunho (venda/locação de produto ainda não cadastrado) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir vender/locar um produto que ainda não existe no cadastro: o operador digita nome + valor na hora do pedido/locação, o sistema cria um `Produto` real marcado como *rascunho*, e depois o operador completa os dados desse produto no Estoque para que ele vire um produto normal.

**Architecture:** Em vez de uma tabela paralela de "itens sem produto" (que quebraria a FK `produto_id NOT NULL` e duplicaria a lógica de estoque/relatórios), criamos um `Produto` de verdade na hora da venda, com uma flag booleana `rascunho = true` e defaults seguros (`valorCompra=0`, `medida=PECA`, `categoria=OUTROS`, `estoque=0`). A "segunda tabela só com nomes" vira uma **visão filtrada** (`Produto WHERE rascunho = true`). Completar o cadastro é editar esse produto pelo modal já existente; ao salvar, `rascunho` vira `false` e o produto "passa" para a tabela normal. Toda a lógica de baixa/estorno de estoque, snapshot de custo e relatórios continua funcionando sem alteração, porque o item aponta para um `Produto` real desde o início.

**Tech Stack:** Backend Spring Boot 3 / Java 17 / JPA (MySQL em dev via `ddl-auto: update`, Flyway no perfil docker) / JUnit 5 + `@SpringBootTest` com H2 (`profile=test`). Frontend Angular standalone + PrimeNG. Testes de backend são a fonte de verdade da lógica; o frontend é verificado por unit test pontual + navegador.

**Decisões travadas (confirmadas com o usuário):**
- Abordagem: **Produto rascunho** (não tabela paralela).
- Local da tabela de rascunhos: **seção Estoque** (reaproveita o modal de produto que já tem todos os campos).
- Item de "produto novo" nasce com **baixa de estoque DESMARCADA** (não sabemos o estoque real ainda).

**Limitações conhecidas (aceitas, fora de escopo):**
- O `custoUnitario` do item de venda é fotografado como `valorCompra` do rascunho (= 0) no momento da venda. Completar o cadastro depois NÃO reescreve o custo daquela primeira venda — a margem daquela venda inicial aparecerá cheia. Aceitável.

---

## Convenções de path

- **Backend** (raiz `marluse/`): pacote base `src/main/java/com/example/marluse`, testes `src/test/java/com/example/marluse`, migrações `src/main/resources/db/migration`.
- **Frontend** (raiz `marluse-frontend/`): `src/app`.

Comandos de backend rodam a partir de `marluse/`. Comandos de frontend a partir de `marluse-frontend/`.

---

## File Structure

**Backend — modificar:**
- `estoque/model/Produto.java` — nova coluna `rascunho`.
- `estoque/repository/ProdutoRepository.java` — queries que filtram por `rascunho`.
- `estoque/service/ProdutoService.java` — `listar()` exclui rascunhos; novos `listarRascunhos()` e `criarRascunho(...)`; `atualizar()` completa o rascunho.
- `estoque/dto/ProdutoResponse.java` — expõe `rascunho`.
- `estoque/controller/ProdutoController.java` — `GET /api/produtos/rascunhos`.
- `vendas/dto/ItemPedidoRequest.java` — `productId` opcional + `produtoNome`.
- `vendas/service/PedidoService.java` — resolve produto existente OU cria rascunho.
- `locacoes/dto/ItemLocacaoRequest.java` — `produtoId` opcional + `produtoNome`.
- `locacoes/service/LocacaoService.java` — resolve produto existente OU cria rascunho.

**Backend — criar:**
- `src/main/resources/db/migration/V7__add_rascunho_produto.sql`.

**Backend — reparar (dívida pré-existente que impede compilar os testes):**
- `test/java/com/example/marluse/estoque/ProdutoServiceTest.java` — construtores desatualizados.

**Frontend — modificar:**
- `features/estoque/models/estoque.models.ts` — `rascunho` em `ProdutoResponse`.
- `features/vendas/models/vendas.models.ts` — `rascunho` em `ProdutoResponse`; `produtoNome?` em `ItemPedidoRequest`.
- `features/locacoes/models/locacoes.models.ts` — `produtoNome?` no item request de locação.
- `features/vendas/components/novo-pedido-modal/novo-pedido-modal.component.ts` (+ `.html`) — toggle "Produto novo".
- `features/locacoes/nova-locacao-modal/nova-locacao-modal.component.ts` (+ `.html`) — toggle "Produto novo".
- `features/estoque/estoque/estoque.service.ts` — `getRascunhos()`.
- `features/estoque/estoque/estoque.component.ts` (+ `.html`) — tabela "A completar" + fluxo de conclusão.

---

## Task 1: Reparar testes desatualizados para o suite compilar

O `ProdutoServiceTest` usa construtores antigos de `ProdutoRequest` / `ProdutoAtualizarRequest` (6 args) que não batem com a assinatura atual (9 campos). Enquanto isso não for corrigido, `mvn test` falha na compilação e a TDD dos próximos passos não funciona.

**Files:**
- Modify: `marluse/src/test/java/com/example/marluse/estoque/ProdutoServiceTest.java`

- [ ] **Step 1: Rodar a compilação de testes para ver o estado atual**

Run (em `marluse/`): `./mvnw -q test-compile`
Expected: FALHA de compilação apontando construtores de `ProdutoRequest`/`ProdutoAtualizarRequest` com número errado de argumentos em `ProdutoServiceTest.java` (e possivelmente `PedidoServiceTest.java`).

- [ ] **Step 2: Corrigir os helpers/constructors de `ProdutoServiceTest`**

Assinatura atual de `ProdutoRequest`: `(nome, descricao, valorCompra, preco, precoDiaria, quantidadeEstoque, estoqueMinimo, medida, categoria)`.
Assinatura atual de `ProdutoAtualizarRequest`: `(nome, descricao, valorCompra, preco, precoDiaria, quantidadeEstoque, estoqueMinimo, medida, categoria)`.

Substituir o helper e a chamada de update:

```java
import com.example.marluse.estoque.dto.CategoriaProduto;

private ProdutoRequest produtoValido(String nome, int quantidade) {
    return new ProdutoRequest(
            nome, "Descrição",
            new BigDecimal("10.00"),   // valorCompra
            new BigDecimal("25.00"),   // preco
            new BigDecimal("5.00"),    // precoDiaria
            quantidade, 5,
            UnidadeMedida.SACO,
            CategoriaProduto.OUTROS);
}
```

E, no teste `deveAtualizarProduto`, trocar o `new ProdutoAtualizarRequest(...)` por:

```java
ProdutoAtualizarRequest atualizado = new ProdutoAtualizarRequest(
        "Cimento CP-II", "Nova descrição",
        new BigDecimal("12.00"),   // valorCompra
        new BigDecimal("30.00"),   // preco
        new BigDecimal("6.00"),    // precoDiaria
        50, 10,
        UnidadeMedida.SACO,
        CategoriaProduto.OUTROS);
```

- [ ] **Step 3: Se `PedidoServiceTest.java` também não compilar, corrigir da mesma forma**

Run: `./mvnw -q test-compile`
Se o erro remanescente for em `PedidoServiceTest.java`, abra o arquivo e ajuste as chamadas de construtor de DTO para as assinaturas atuais (mesma técnica: contar os campos do record e preencher em ordem). Não altere a lógica dos testes, só as chamadas de construtor.

- [ ] **Step 4: Rodar o suite inteiro para confirmar base verde**

Run: `./mvnw test`
Expected: BUILD SUCCESS, todos os testes existentes passando.

- [ ] **Step 5: Commit**

```bash
git add marluse/src/test/java/com/example/marluse
git commit -m "test: corrige construtores desatualizados de DTO nos testes de produto/pedido"
```

---

## Task 2: Coluna `rascunho` na entidade Produto + migração

**Files:**
- Modify: `marluse/src/main/java/com/example/marluse/estoque/model/Produto.java`
- Create: `marluse/src/main/resources/db/migration/V7__add_rascunho_produto.sql`

- [ ] **Step 1: Escrever teste que garante o default `false`**

Adicionar em `marluse/src/test/java/com/example/marluse/estoque/ProdutoServiceTest.java`:

```java
@Test
void produtoNormalNaoEhRascunhoPorPadrao() {
    ProdutoResponse response = produtoService.criar(produtoValido("Cimento", 50));
    assertFalse(response.rascunho());
}
```

(Este teste referencia `response.rascunho()`, que ainda não existe — vai falhar na compilação; será suprido na Task 4. Por enquanto, prossiga: o campo na entidade é pré-requisito.)

- [ ] **Step 2: Adicionar o campo na entidade**

Em `Produto.java`, logo após o campo `ativo`:

```java
    @Builder.Default
    @Column(nullable = false)
    private boolean rascunho = false;
```

- [ ] **Step 3: Criar a migração Flyway (perfil docker/prod)**

Criar `marluse/src/main/resources/db/migration/V7__add_rascunho_produto.sql`:

```sql
ALTER TABLE produtos
    ADD COLUMN rascunho TINYINT(1) NOT NULL DEFAULT 0;
```

(Em dev, `ddl-auto: update` cria a coluna automaticamente a partir da entidade; a migração garante paridade no perfil docker onde o Flyway roda.)

- [ ] **Step 4: Compilar**

Run: `./mvnw -q test-compile`
Expected: compila a entidade. (O teste do Step 1 ainda falha porque `rascunho()` não existe no response — normal; será resolvido na Task 4.)

- [ ] **Step 5: Commit**

```bash
git add marluse/src/main/java/com/example/marluse/estoque/model/Produto.java marluse/src/main/resources/db/migration/V7__add_rascunho_produto.sql
git commit -m "feat: adiciona flag rascunho à entidade Produto e migração V7"
```

---

## Task 3: Repository — filtrar produtos por `rascunho`

**Files:**
- Modify: `marluse/src/main/java/com/example/marluse/estoque/repository/ProdutoRepository.java`

- [ ] **Step 1: Adicionar as queries derivadas**

Em `ProdutoRepository.java`, dentro da interface, adicionar:

```java
    List<Produto> findByAtivoTrueAndRascunhoFalse();

    List<Produto> findByAtivoTrueAndRascunhoTrue();
```

- [ ] **Step 2: Compilar**

Run: `./mvnw -q test-compile`
Expected: compila sem erros nas queries (Spring Data valida os nomes na subida do contexto, não na compilação — a validação real vem nos testes da Task 4).

- [ ] **Step 3: Commit**

```bash
git add marluse/src/main/java/com/example/marluse/estoque/repository/ProdutoRepository.java
git commit -m "feat: queries de produto filtradas por rascunho"
```

---

## Task 4: ProdutoService — criar rascunho, listar rascunhos, excluir rascunhos da lista normal, completar

**Files:**
- Modify: `marluse/src/main/java/com/example/marluse/estoque/dto/ProdutoResponse.java`
- Modify: `marluse/src/main/java/com/example/marluse/estoque/service/ProdutoService.java`
- Test: `marluse/src/test/java/com/example/marluse/estoque/ProdutoServiceTest.java`

- [ ] **Step 1: Expor `rascunho` no `ProdutoResponse`**

Em `ProdutoResponse.java`, adicionar o campo `boolean rascunho` ao record (após `categoria`) e no `from(...)`:

```java
public record ProdutoResponse(
        String id,
        String nome,
        String descricao,
        BigDecimal valorCompra,
        BigDecimal preco,
        BigDecimal precoDiaria,
        Integer quantidadeEstoque,
        Integer estoqueMinimo,
        boolean ativo,
        boolean estoqueBaixo,
        UnidadeMedida medida,
        CategoriaProduto categoria,
        boolean rascunho
) {
    public static ProdutoResponse from(Produto produto){
        return new ProdutoResponse(
                produto.getId(),
                produto.getNome(),
                produto.getDescricao(),
                produto.getValorCompra(),
                produto.getPreco(),
                produto.getPrecoDiaria(),
                produto.getQuantidadeEstoque(),
                produto.getEstoqueMinimo(),
                produto.isAtivo(),
                produto.getQuantidadeEstoque() <= produto.getEstoqueMinimo(),
                produto.getMedida(),
                produto.getCategoria(),
                produto.isRascunho()
        );
    }
}
```

- [ ] **Step 2: Escrever os testes de rascunho (falhando)**

Adicionar em `ProdutoServiceTest.java`:

```java
@Test
void deveCriarRascunhoComDefaultsSeguros() {
    Produto rascunho = produtoService.criarRascunho("Broca 10mm", new BigDecimal("15.00"), null);

    assertNotNull(rascunho.getId());
    assertTrue(rascunho.isRascunho());
    assertTrue(rascunho.isAtivo());
    assertEquals(0, rascunho.getQuantidadeEstoque());
    assertEquals(0, new BigDecimal("0.00").compareTo(rascunho.getValorCompra()));
    assertEquals(UnidadeMedida.PECA, rascunho.getMedida());
    assertEquals(CategoriaProduto.OUTROS, rascunho.getCategoria());
    assertEquals(0, new BigDecimal("15.00").compareTo(rascunho.getPreco()));
}

@Test
void listarNaoRetornaRascunhos() {
    produtoService.criar(produtoValido("Cimento", 50));
    produtoService.criarRascunho("Item improvisado", new BigDecimal("9.90"), null);

    List<ProdutoResponse> lista = produtoService.listar();

    assertEquals(1, lista.size());
    assertEquals("Cimento", lista.get(0).nome());
}

@Test
void listarRascunhosRetornaApenasRascunhos() {
    produtoService.criar(produtoValido("Cimento", 50));
    produtoService.criarRascunho("Item improvisado", new BigDecimal("9.90"), null);

    List<ProdutoResponse> rascunhos = produtoService.listarRascunhos();

    assertEquals(1, rascunhos.size());
    assertEquals("Item improvisado", rascunhos.get(0).nome());
    assertTrue(rascunhos.get(0).rascunho());
}

@Test
void atualizarCompletaRascunho() {
    Produto rascunho = produtoService.criarRascunho("Item improvisado", new BigDecimal("9.90"), null);

    ProdutoAtualizarRequest completar = new ProdutoAtualizarRequest(
            "Parafuso Sextavado", "Aço inox",
            new BigDecimal("2.00"),   // valorCompra
            new BigDecimal("5.00"),   // preco
            null,                     // precoDiaria
            120, 10,
            UnidadeMedida.PECA,
            CategoriaProduto.FERRAMENTAS);

    ProdutoResponse resp = produtoService.atualizar(rascunho.getId(), completar);

    assertFalse(resp.rascunho());
    assertEquals("Parafuso Sextavado", resp.nome());
    assertEquals(120, resp.quantidadeEstoque());
    // agora aparece na lista normal e some da lista de rascunhos
    assertEquals(1, produtoService.listar().size());
    assertEquals(0, produtoService.listarRascunhos().size());
}
```

- [ ] **Step 3: Rodar os testes (devem falhar)**

Run: `./mvnw -q -Dtest=ProdutoServiceTest test`
Expected: FALHA — `criarRascunho`/`listarRascunhos` não existem e `listar()` ainda inclui rascunhos.

- [ ] **Step 4: Implementar no `ProdutoService`**

Ajustar imports no topo (`UnidadeMedida`, `BigDecimal` já pode estar ausente — adicionar):

```java
import com.example.marluse.estoque.enums.UnidadeMedida;
import com.example.marluse.estoque.model.Produto;
import java.math.BigDecimal;
```

Trocar `listar()` e adicionar os novos métodos:

```java
    public List<ProdutoResponse> listar(){
        return produtoRepository.findByAtivoTrueAndRascunhoFalse()
                .stream()
                .map(ProdutoResponse::from)
                .toList();
    }

    public List<ProdutoResponse> listarRascunhos(){
        return produtoRepository.findByAtivoTrueAndRascunhoTrue()
                .stream()
                .map(ProdutoResponse::from)
                .toList();
    }

    @org.springframework.transaction.annotation.Transactional
    public Produto criarRascunho(String nome, BigDecimal preco, BigDecimal precoDiaria){
        BigDecimal precoVenda = preco != null ? preco : BigDecimal.ZERO;
        Produto produto = Produto.builder()
                .nome(nome)
                .preco(precoVenda)
                .precoDiaria(precoDiaria != null ? precoDiaria : precoVenda)
                .valorCompra(BigDecimal.ZERO)
                .quantidadeEstoque(0)
                .estoqueMinimo(0)
                .ativo(true)
                .rascunho(true)
                .medida(UnidadeMedida.PECA)
                .categoria(CategoriaProduto.OUTROS)
                .build();
        return produtoRepository.save(produto);
    }
```

No fim de `atualizar(...)`, antes do `return`, marcar como completo:

```java
        produto.setRascunho(false);

        return ProdutoResponse.from(produtoRepository.save(produto));
```

- [ ] **Step 5: Rodar os testes (devem passar)**

Run: `./mvnw -q -Dtest=ProdutoServiceTest test`
Expected: PASS (incluindo `produtoNormalNaoEhRascunhoPorPadrao` da Task 2).

- [ ] **Step 6: Commit**

```bash
git add marluse/src/main/java/com/example/marluse/estoque marluse/src/test/java/com/example/marluse/estoque/ProdutoServiceTest.java
git commit -m "feat: criar/listar/completar produto rascunho no ProdutoService"
```

---

## Task 5: Endpoint `GET /api/produtos/rascunhos`

**Files:**
- Modify: `marluse/src/main/java/com/example/marluse/estoque/controller/ProdutoController.java`

- [ ] **Step 1: Adicionar o endpoint**

Em `ProdutoController.java`, adicionar após `listarAtivos()`:

```java
    @GetMapping("/rascunhos")
    public ResponseEntity<ApiResponse<List<ProdutoResponse>>> listarRascunhos(){
        return ResponseEntity.ok(ApiResponse.ok(produtoService.listarRascunhos()));
    }
```

- [ ] **Step 2: Subir o contexto e validar as queries derivadas**

Run: `./mvnw -q test`
Expected: BUILD SUCCESS — a subida do `@SpringBootTest` valida que `findByAtivoTrueAndRascunhoFalse` / `findByAtivoTrueAndRascunhoTrue` são nomes de query válidos.

- [ ] **Step 3: Commit**

```bash
git add marluse/src/main/java/com/example/marluse/estoque/controller/ProdutoController.java
git commit -m "feat: endpoint GET /api/produtos/rascunhos"
```

---

## Task 6: PedidoService — item de produto novo cria rascunho

**Files:**
- Modify: `marluse/src/main/java/com/example/marluse/vendas/dto/ItemPedidoRequest.java`
- Modify: `marluse/src/main/java/com/example/marluse/vendas/service/PedidoService.java`
- Test: `marluse/src/test/java/com/example/marluse/vendas/PedidoServiceTest.java`

- [ ] **Step 1: Tornar `productId` opcional e adicionar `produtoNome`**

Reescrever `ItemPedidoRequest.java`:

```java
package com.example.marluse.vendas.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

public record ItemPedidoRequest(
        String productId,        // opcional: presente para produto já cadastrado

        String produtoNome,      // usado quando productId ausente (produto novo → rascunho)

        @NotNull(message = "Quantidade é obrigatória")
        @Min(value = 1, message = "A Quantidade deve ser maior que zero")
        Integer quantidade,

        BigDecimal preco,

        boolean baixarEstoque,

        boolean permitirSemEstoque
) {
    public boolean isProdutoNovo() {
        return (productId == null || productId.isBlank())
                && produtoNome != null && !produtoNome.isBlank();
    }
}
```

- [ ] **Step 2: Escrever o teste (falhando)**

Adicionar em `PedidoServiceTest.java` (usar o padrão de criação de pedido já existente no arquivo como referência para montar um `PedidoRequest` mínimo à vista). Teste-alvo:

```java
@Test
void criarPedidoComProdutoNovoGeraRascunho() {
    ItemPedidoRequest itemNovo = new ItemPedidoRequest(
            null, "Cano PVC 50mm", 3,
            new BigDecimal("12.00"),
            false,   // baixarEstoque desmarcado para produto novo
            false);

    PedidoRequest request = new PedidoRequest(
            null, FormaPagamento.DINHEIRO, List.of(itemNovo),
            null, StatusPedido.CONFIRMADO, null,
            null, null, null, null, null, null, null, null);

    PedidoResponse resp = pedidoService.criar(request);

    assertEquals(1, resp.itens().size());
    assertEquals("Cano PVC 50mm", resp.itens().get(0).produtoNome());

    // o produto criado é um rascunho e não aparece na lista normal
    assertEquals(0, produtoService.listar().size());
    assertEquals(1, produtoService.listarRascunhos().size());
}
```

> Ajuste a ordem/aridade do construtor de `PedidoRequest` conforme o record atual (`clienteId, formaPagamento, itens, observacao, status, dataVencimento, desconto, tipoDesconto, numeroParcelas, primeiroVencimento, entrega, juros, tipoJuros, dataMovimento`). Injete `ProdutoService produtoService` no teste via `@Autowired` se ainda não estiver presente.

- [ ] **Step 3: Rodar (deve falhar)**

Run: `./mvnw -q -Dtest=PedidoServiceTest test`
Expected: FALHA — hoje o service faz `produtoRepository.findById(itemRequest.productId())` e lançaria `EntityNotFoundException` para `productId == null`.

- [ ] **Step 4: Implementar a resolução do produto no `PedidoService`**

Injetar o `ProdutoService`. No topo da classe, junto aos outros `final`:

```java
    private final ProdutoService produtoService;
```

(import: `import com.example.marluse.estoque.service.ProdutoService;`)

No método `criar(...)`, dentro do `for (ItemPedidoRequest itemRequest : request.itens())`, substituir a resolução do produto (as linhas atuais `Produto produto = produtoRepository.findById(...).orElseThrow(...)`) por:

```java
            Produto produto;
            if (itemRequest.isProdutoNovo()) {
                produto = produtoService.criarRascunho(
                        itemRequest.produtoNome(), itemRequest.preco(), null);
            } else if (itemRequest.productId() != null && !itemRequest.productId().isBlank()) {
                produto = produtoRepository.findById(itemRequest.productId())
                        .orElseThrow(() -> new EntityNotFoundException("Produto não encontrado"));
            } else {
                throw new IllegalArgumentException(
                        "Item inválido: informe um produto existente ou o nome de um produto novo");
            }
```

O restante do laço (cálculo de `precoVenda`, `subTotal`, montagem do `ItemPedido`, baixa condicional) permanece igual. Como o front envia `baixarEstoque=false` para produto novo, `baixarEstoque(item)` não é chamado para o rascunho.

- [ ] **Step 5: Rodar (deve passar)**

Run: `./mvnw -q -Dtest=PedidoServiceTest test`
Expected: PASS.

- [ ] **Step 6: Rodar o suite completo**

Run: `./mvnw test`
Expected: BUILD SUCCESS.

- [ ] **Step 7: Commit**

```bash
git add marluse/src/main/java/com/example/marluse/vendas
git commit -m "feat: item de produto novo em pedido cria produto rascunho"
```

---

## Task 7: LocacaoService — item de produto novo cria rascunho

**Files:**
- Modify: `marluse/src/main/java/com/example/marluse/locacoes/dto/ItemLocacaoRequest.java`
- Modify: `marluse/src/main/java/com/example/marluse/locacoes/service/LocacaoService.java`

- [ ] **Step 1: Tornar `produtoId` opcional e adicionar `produtoNome`**

Reescrever `ItemLocacaoRequest.java`:

```java
package com.example.marluse.locacoes.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

public record ItemLocacaoRequest (
        String produtoId,       // opcional: presente para produto já cadastrado

        String produtoNome,     // usado quando produtoId ausente (produto novo → rascunho)

        @NotNull(message = "Quantidade é obrigatória")
        @Min(value = 1, message = "Quantidade deve ser maior que zero")
        Integer quantidade,

        BigDecimal precoDiaria,

        boolean baixarEstoque,

        boolean permitirSemEstoque
) {
    public boolean isProdutoNovo() {
        return (produtoId == null || produtoId.isBlank())
                && produtoNome != null && !produtoNome.isBlank();
    }
}
```

- [ ] **Step 2: Injetar `ProdutoService` e resolver o produto no `LocacaoService`**

No topo da classe `LocacaoService`, junto aos outros `final`:

```java
    private final ProdutoService produtoService;
```

(import: `import com.example.marluse.estoque.service.ProdutoService;`)

No `criar(...)`, dentro do `for (ItemLocacaoRequest itemRequest : request.itens())`, substituir `Produto produto = produtoRepository.findById(itemRequest.produtoId()).orElseThrow(...)` por:

```java
            Produto produto;
            if (itemRequest.isProdutoNovo()) {
                // precoDiaria do rascunho = diária digitada; preco de venda fica igual (fallback)
                produto = produtoService.criarRascunho(
                        itemRequest.produtoNome(), itemRequest.precoDiaria(), itemRequest.precoDiaria());
            } else if (itemRequest.produtoId() != null && !itemRequest.produtoId().isBlank()) {
                produto = produtoRepository.findById(itemRequest.produtoId())
                        .orElseThrow(() -> new EntityNotFoundException("Produto não encontrado"));
            } else {
                throw new IllegalArgumentException(
                        "Item inválido: informe um produto existente ou o nome de um produto novo");
            }
```

O restante do laço (cálculo de `diaria`, `subtotal`, montagem do `ItemLocacao`, baixa condicional) permanece igual.

- [ ] **Step 3: Compilar e rodar o suite**

Run: `./mvnw test`
Expected: BUILD SUCCESS (nenhum teste existente quebrado; a lógica de locação com produto novo é validada manualmente no navegador na Task 11).

- [ ] **Step 4: Commit**

```bash
git add marluse/src/main/java/com/example/marluse/locacoes
git commit -m "feat: item de produto novo em locação cria produto rascunho"
```

---

## Task 8: Frontend — modelos (`rascunho` + `produtoNome`)

**Files:**
- Modify: `marluse-frontend/src/app/features/estoque/models/estoque.models.ts`
- Modify: `marluse-frontend/src/app/features/vendas/models/vendas.models.ts`
- Modify: `marluse-frontend/src/app/features/locacoes/models/locacoes.models.ts`

- [ ] **Step 1: `rascunho` em `ProdutoResponse` (estoque)**

Em `estoque.models.ts`, adicionar ao final da interface `ProdutoResponse`:

```typescript
  rascunho: boolean;
```

- [ ] **Step 2: `rascunho` no `ProdutoResponse` e `produtoNome?` no `ItemPedidoRequest` (vendas)**

Em `vendas.models.ts`:
- adicionar `rascunho: boolean;` ao final da interface `ProdutoResponse`;
- adicionar `produtoNome?: string;` na interface `ItemPedidoRequest`, e tornar `productId` opcional:

```typescript
export interface ItemPedidoRequest {
  productId?: string;
  produtoNome?: string;
  quantidade: number;
  preco?: number;
  baixarEstoque?: boolean;
  permitirSemEstoque?: boolean;
}
```

- [ ] **Step 3: `produtoNome?` no item request de locação**

Abrir `marluse-frontend/src/app/features/locacoes/models/locacoes.models.ts`, localizar a interface do item de request de locação (equivalente a `ItemLocacaoRequest`, com `produtoId`, `quantidade`, `precoDiaria`, `baixarEstoque`, `permitirSemEstoque`) e:
- tornar `produtoId` opcional (`produtoId?: string;`);
- adicionar `produtoNome?: string;`.

- [ ] **Step 4: Verificar build de tipos**

Run (em `marluse-frontend/`): `npx tsc -p tsconfig.app.json --noEmit`
Expected: sem novos erros de tipo introduzidos por estas mudanças (podem existir erros pré-existentes não relacionados; confirme que nenhum menciona os campos alterados).

- [ ] **Step 5: Commit**

```bash
git add marluse-frontend/src/app/features/estoque/models/estoque.models.ts marluse-frontend/src/app/features/vendas/models/vendas.models.ts marluse-frontend/src/app/features/locacoes/models/locacoes.models.ts
git commit -m "feat(front): modelos suportam produto rascunho (rascunho + produtoNome)"
```

---

## Task 9: Frontend — toggle "Produto novo" no modal de pedido

**Files:**
- Modify: `marluse-frontend/src/app/features/vendas/components/novo-pedido-modal/novo-pedido-modal.component.ts`
- Modify: `marluse-frontend/src/app/features/vendas/components/novo-pedido-modal/novo-pedido-modal.component.html`

- [ ] **Step 1: Estender `ItemForm` e helpers no componente**

Em `novo-pedido-modal.component.ts`, atualizar a interface `ItemForm` e `novoItem()`:

```typescript
interface ItemForm {
  produtoNovo: boolean;   // true → linha é "produto novo" (cria rascunho)
  produtoId: string;
  produtoNome: string;
  precoUnitario: number;
  quantidade: number;
  baixarEstoque: boolean;
}
```

```typescript
  novoItem(): ItemForm {
    return { produtoNovo: false, produtoId: '', produtoNome: '', precoUnitario: 0, quantidade: 1, baixarEstoque: true };
  }
```

Adicionar um método para alternar o modo da linha:

```typescript
  alternarProdutoNovo(item: ItemForm): void {
    item.produtoNovo = !item.produtoNovo;
    if (item.produtoNovo) {
      // produto novo não conhece estoque: não baixa
      item.produtoId = '';
      item.baixarEstoque = false;
    } else {
      item.produtoNome = '';
      item.precoUnitario = 0;
      item.baixarEstoque = true;
    }
  }
```

- [ ] **Step 2: Ajustar validação para aceitar produto novo**

Em `formValida`, trocar a checagem de item:

```typescript
  get formValida(): boolean {
    const clienteOk = this.consumidorFinal ? !this.exigeCliente : !!this.clienteId;
    return (
      !!this.formaPagamento &&
      this.itens.length > 0 &&
      this.itens.every(i =>
        (i.produtoNovo ? !!i.produtoNome.trim() : !!i.produtoId) && i.quantidade > 0
      ) &&
      clienteOk
    );
  }
```

`itensSemSaldo()` já ignora linhas sem `produtoId` (produto novo tem `produtoId` vazio e `baixarEstoque=false`), então não precisa mudar.

- [ ] **Step 3: Enviar `produtoNome` no payload**

No `enviar(...)`, trocar o `.map` de `itens`:

```typescript
      itens:             this.itens.map(i => i.produtoNovo
                           ? {
                               produtoNome: i.produtoNome.trim(),
                               quantidade: i.quantidade,
                               preco: i.precoUnitario,
                               baixarEstoque: false,
                               permitirSemEstoque: false,
                             }
                           : {
                               productId: i.produtoId,
                               quantidade: i.quantidade,
                               preco: i.precoUnitario,
                               baixarEstoque: i.baixarEstoque,
                               permitirSemEstoque: permitirSemEstoque && i.baixarEstoque,
                             }),
```

- [ ] **Step 4: UI da linha no template**

Em `novo-pedido-modal.component.html`, na linha de item (onde hoje há o `app-select-search` de produto), condicionar por `item.produtoNovo`. Exemplo de estrutura (adaptar classes ao layout existente do arquivo):

```html
<!-- Seleção de produto existente -->
<app-select-search
  *ngIf="!item.produtoNovo"
  [options]="produtoOptions"
  [(ngModel)]="item.produtoId"
  [ngModelOptions]="{ standalone: true }"
  (ngModelChange)="onProdutoChange(item)"
  placeholder="Selecione o produto">
</app-select-search>

<!-- Produto novo: nome + valor digitados na hora -->
<input
  *ngIf="item.produtoNovo"
  type="text"
  [(ngModel)]="item.produtoNome"
  [ngModelOptions]="{ standalone: true }"
  placeholder="Nome do produto novo"
  class="p-inputtext p-component" />

<input
  *ngIf="item.produtoNovo"
  type="number" min="0" step="0.01"
  [(ngModel)]="item.precoUnitario"
  [ngModelOptions]="{ standalone: true }"
  placeholder="Valor unitário"
  class="p-inputtext p-component" />

<!-- Botão para alternar o modo da linha -->
<button type="button" class="p-button p-button-text p-button-sm"
        (click)="alternarProdutoNovo(item)">
  {{ item.produtoNovo ? 'Usar produto do estoque' : '+ Produto novo' }}
</button>
```

Mantenha os controles de quantidade/subtotal existentes. Para linhas com `item.produtoNovo`, o controle de "baixar estoque" (se existir no template) deve ficar oculto ou desabilitado.

- [ ] **Step 5: Verificar no navegador**

Iniciar o dev server (preview_start com o `name` do `.claude/launch.json`; se não existir, criar apontando para `npm start`/`ng serve` na porta 4200). Backend precisa estar rodando (`./mvnw spring-boot:run` em `marluse/`).
Abrir Vendas → Novo pedido → clicar "+ Produto novo", digitar nome + valor + quantidade, escolher forma de pagamento, salvar.
Verificar via read_console_messages/read_network_requests que o POST `/api/pedidos` retornou 201 e que o item veio com `produtoNome`. Verificar que o produto novo **não** aparece no dropdown de produtos.

- [ ] **Step 6: Commit**

```bash
git add marluse-frontend/src/app/features/vendas/components/novo-pedido-modal
git commit -m "feat(front): toggle 'Produto novo' no modal de pedido"
```

---

## Task 10: Frontend — tabela "A completar" no Estoque + conclusão do rascunho

**Files:**
- Modify: `marluse-frontend/src/app/features/estoque/estoque/estoque.service.ts`
- Modify: `marluse-frontend/src/app/features/estoque/estoque/estoque.component.ts`
- Modify: `marluse-frontend/src/app/features/estoque/estoque/estoque.component.html`

- [ ] **Step 1: `getRascunhos()` no service**

Em `estoque.service.ts`, adicionar:

```typescript
  getRascunhos(): Observable<ProdutoResponse[]> {
    return this.http.get<any>(`${this.baseUrl}/rascunhos`).pipe(map(r => r.data));
  }
```

- [ ] **Step 2: Carregar e expor os rascunhos no componente**

Em `estoque.component.ts`:
- adicionar estado `rascunhos: ProdutoResponse[] = [];`
- em `carregar()`, após carregar `produtos`, buscar também os rascunhos:

```typescript
  carregarRascunhos(): void {
    this.service.getRascunhos().subscribe({
      next: data => { this.rascunhos = data; this.cdr.detectChanges(); },
      error: () => { /* silencioso: seção some se falhar */ },
    });
  }
```

Chamar `this.carregarRascunhos();` dentro do `next` de `carregar()` (após `this.produtos = data;`).

- adicionar colunas para a tabela de rascunhos (só nome + valor, como o usuário pediz):

```typescript
  readonly colunasRascunhos: TableColumn[] = [
    { field: 'nome',  header: 'Produto (a completar)', width: '60%' },
    { field: 'preco', header: 'Valor un.', width: '25%', type: 'currency' },
  ];

  readonly acoesRascunhos: TableActionConfig = {
    showView:   false,
    showEdit:   true,
    editIcon:   'pi pi-check-circle',
    editTooltip:'Completar cadastro',
    showDelete: false,
  };
```

- [ ] **Step 3: Reaproveitar o modal de edição para completar**

O modal (`NovoProdutoModalComponent`) já preenche a partir de um `ProdutoResponse` e emite `ProdutoAtualizarRequest`. Como completar é editar, basta abrir o modal com o rascunho. Adicionar:

```typescript
  abrirModalCompletar(rascunho: ProdutoResponse): void {
    this.produtoEdit = rascunho;   // reutiliza o fluxo de edição existente
    this.showModal   = true;
  }
```

Em `onSalvar(...)`, no ramo de edição (`this.produtoEdit`), após o update bem-sucedido, o produto deixa de ser rascunho (o backend zera a flag). Atualizar as duas listas:

```typescript
        next: updated => {
          this.produtos   = [...this.produtos.filter(p => p.id !== updated.id), updated];
          this.rascunhos  = this.rascunhos.filter(r => r.id !== updated.id);
          this.recalcularGrafico();
          this.fecharModal();
          this.salvando = false;
          this.messageService.add({ severity: 'success', summary: 'Salvo', detail: 'Produto atualizado.' });
        },
```

(Se o item editado não era rascunho, o `filter` sobre `rascunhos` simplesmente não remove nada — comportamento correto.)

- [ ] **Step 4: Renderizar a seção condicional no template**

Em `estoque.component.html`, adicionar acima (ou abaixo) da tabela principal um bloco que só aparece quando há rascunhos:

```html
<section *ngIf="rascunhos.length > 0" class="rascunhos-panel">
  <h3>Produtos a completar ({{ rascunhos.length }})</h3>
  <p class="hint">Criados em vendas/locações. Clique para completar o cadastro.</p>
  <app-data-table
    [value]="rascunhos"
    [columns]="colunasRascunhos"
    [actions]="acoesRascunhos"
    (edit)="abrirModalCompletar($event)">
  </app-data-table>
</section>
```

> Ajuste os nomes de `@Input`/`@Output` do `app-data-table` aos usados na tabela principal do mesmo arquivo (mesmos bindings que já alimentam `colunasProdutos`/`acoesProdutos`).

- [ ] **Step 5: Verificar o ciclo completo no navegador**

Com backend + frontend no ar:
1. Criar um pedido com "Produto novo" (Task 9).
2. Ir em Estoque → confirmar que a seção "Produtos a completar" mostra o item só com nome + valor.
3. Clicar em completar → preencher valorCompra, categoria, medida, estoque real → salvar.
4. Confirmar que o item **sai** da seção de rascunhos e **aparece** na tabela normal de produtos, e que passa a aparecer no dropdown de produtos de um novo pedido.

Verificar respostas via read_network_requests (GET `/api/produtos/rascunhos`, PUT `/api/produtos/{id}`).

- [ ] **Step 6: Commit**

```bash
git add marluse-frontend/src/app/features/estoque/estoque
git commit -m "feat(front): seção 'Produtos a completar' e conclusão de rascunho no Estoque"
```

---

## Task 11: Frontend — toggle "Produto novo" no modal de locação

**Files:**
- Modify: `marluse-frontend/src/app/features/locacoes/nova-locacao-modal/nova-locacao-modal.component.ts`
- Modify: `marluse-frontend/src/app/features/locacoes/nova-locacao-modal/nova-locacao-modal.component.html`

- [ ] **Step 1: Estender `ItemForm`, `novoItem()` e adicionar toggle**

Replicar o padrão da Task 9 (Steps 1–2) em `nova-locacao-modal.component.ts`:
- `ItemForm` ganha `produtoNovo: boolean;` e `produtoNome: string;` (este último já existe);
- `novoItem()` inicia `produtoNovo: false`;
- adicionar `alternarProdutoNovo(item)` idêntico ao da Task 9 (com `baixarEstoque = false` quando produto novo);
- em `formValida`, trocar a checagem do item para:

```typescript
      this.itens.every(i =>
        (i.produtoNovo ? !!i.produtoNome.trim() : !!i.produtoId) && i.quantidade > 0
      ) &&
```

- [ ] **Step 2: Enviar `produtoNome` no payload**

No `enviar(...)`, trocar o `.map` de `itens`:

```typescript
            itens: this.itens.map(i => i.produtoNovo
              ? {
                  produtoNome: i.produtoNome.trim(),
                  quantidade: i.quantidade,
                  precoDiaria: i.precoUnitario,
                  baixarEstoque: false,
                  permitirSemEstoque: false,
                }
              : {
                  produtoId: i.produtoId,
                  quantidade: i.quantidade,
                  precoDiaria: i.precoUnitario,
                  baixarEstoque: i.baixarEstoque,
                  permitirSemEstoque: permitirSemEstoque && i.baixarEstoque,
                }),
```

- [ ] **Step 3: UI da linha no template**

Em `nova-locacao-modal.component.html`, aplicar o mesmo bloco condicional da Task 9 Step 4 (select quando `!item.produtoNovo`; inputs de nome + valor de diária quando `item.produtoNovo`; botão de alternância). O input numérico de "produto novo" liga em `item.precoUnitario` (que aqui representa a diária).

- [ ] **Step 4: Verificar no navegador**

Locações → Nova locação → "+ Produto novo", preencher nome + diária + quantidade + datas, salvar. Confirmar POST 201 e que o rascunho aparece em Estoque → "Produtos a completar".

- [ ] **Step 5: Commit**

```bash
git add marluse-frontend/src/app/features/locacoes/nova-locacao-modal
git commit -m "feat(front): toggle 'Produto novo' no modal de locação"
```

---

## Task 12: Verificação de ponta a ponta e limpeza

**Files:** nenhum (verificação).

- [ ] **Step 1: Suite de backend verde**

Run (em `marluse/`): `./mvnw test`
Expected: BUILD SUCCESS.

- [ ] **Step 2: Build de frontend**

Run (em `marluse-frontend/`): `npm run build`
Expected: build sem erros.

- [ ] **Step 3: Roteiro manual completo (navegador)**

1. Pedido com produto novo → rascunho aparece em Estoque.
2. Locação com produto novo → rascunho aparece em Estoque.
3. Completar um rascunho → sai de "A completar", entra na tabela normal, aparece nos dropdowns.
4. Produto rascunho **não** aparece na lista de estoque normal nem nos dropdowns antes de ser completado.
5. Cancelar um pedido que usou produto novo não gera erro (o item tinha `baixarEstoque=false`, então não há estoque a estornar).

- [ ] **Step 4: Commit final (se houver ajustes)**

```bash
git add -A
git commit -m "chore: ajustes finais do fluxo de produto rascunho"
```

---

## Self-Review

**Cobertura do spec:**
- "Botão de produto não existente; digita nome, quantidade e valor" → Tasks 9 e 11 (toggle "+ Produto novo" com nome + valor + quantidade).
- "Depois de vender, aparece numa segunda tabela só com o nome, editável" → Task 10 (seção "Produtos a completar", colunas nome + valor, ação completar).
- "Depois vira produto normal" → Task 4 (`atualizar` zera `rascunho`) + Task 10 Step 3 (move entre listas no front).
- "Verificar se é possível / melhor forma" → resolvido na fase de investigação: abordagem rascunho substitui a tabela paralela literal, preservando FK e lógica existentes.

**Type consistency:** `criarRascunho(String, BigDecimal, BigDecimal)` retorna `Produto` (usado por PedidoService/LocacaoService); `listarRascunhos()` retorna `List<ProdutoResponse>`; `ProdutoResponse.rascunho()` e entity `Produto.isRascunho()` consistentes; front `ItemPedidoRequest.produtoNome?` e `ItemLocacaoRequest.produtoNome?` alinhados aos records backend `produtoNome`.

**Riscos observados:** `ProdutoServiceTest`/`PedidoServiceTest` pré-existentes com construtores desatualizados (tratado na Task 1, pré-requisito da TDD). Construtores de `PedidoRequest`/`ItemPedidoRequest` nos testes têm muitos campos posicionais — conferir aridade contra o record atual ao escrever cada teste.
