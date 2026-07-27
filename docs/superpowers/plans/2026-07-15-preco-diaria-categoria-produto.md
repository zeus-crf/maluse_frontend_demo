# Preço Diária + Categoria em Produtos (e diária editável na locação) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar `precoDiaria` e `categoria` ao Produto, fazer as locações usarem a diária do produto com override editável por item, e corrigir o bug em que a diária editada no modal não era salva.

**Architecture:** Mudança full-stack em dois repositórios: backend Spring Boot (`../marluse`, MySQL + Flyway) e frontend Angular (`marluse-frontend`). O Produto ganha um preço de diária próprio (separado do `preco` de venda) e uma categoria (enum fixo). A criação de locação passa a calcular subtotal com `precoDiaria` do produto, aceitando um valor sobrescrito por item vindo do formulário.

**Tech Stack:** Java 21 / Spring Boot / Hibernate / Flyway / MySQL (backend); Angular standalone + PrimeNG + Tailwind (frontend).

**Decisões travadas (do brainstorming):**
- `precoDiaria` é **campo novo separado**; `preco` continua sendo o preço de venda.
- `categoria` é **enum fixo no código**: `FERRAMENTAS, ELETRICA, CONEXOES_E_TUBOS, ENSACADOS, MATERIAL_BRUTO, LOCACAO, OUTROS`.
- Diária no modal de locação é **editável com override** (puxa `precoDiaria` do produto como padrão, permite alterar, e salva o valor alterado).

**⚠️ Testes backend:** A suíte de testes do backend **não compila hoje** (`ProdutoServiceTest`, `LocacoesServiceTest`, `PedidoServiceTest`, `AuthServiceTest` usam assinaturas antigas). Por decisão do usuário, este plano **não** conserta nem adiciona testes backend — a verificação é **manual** (subir a API). Adicionar `precoDiaria`/`categoria` aos records vai piorar a incompatibilidade desses testes, mas como `mvn test` já está vermelho, isso não introduz regressão de suíte verde.

**Ambientes/comandos úteis:**
- Backend build: exige JDK 21. Nesta máquina não há JDK 21; usar Corretto 24 apenas para compilar: `JAVA_HOME="C:/Users/Miguel/.jdks/corretto-24.0.2" ./mvnw compile -o`
- Backend run local: precisa de MySQL em `localhost:3306` (ver `application.yml`). Flyway roda as migrations no start.
- Frontend build: `npm run build`; dev server: `npm start` (Angular).

---

## File Structure

**Backend (`../marluse/src/main/java/com/example/marluse`)**
- `estoque/enums/CategoriaProduto.java` — **criar** — enum das categorias.
- `estoque/model/Produto.java` — **modificar** — 2 colunas novas.
- `estoque/dto/ProdutoRequest.java` — **modificar** — campos de criação.
- `estoque/dto/ProdutoAtualizarRequest.java` — **modificar** — campos de edição.
- `estoque/dto/ProdutoResponse.java` — **modificar** — campos de resposta.
- `estoque/service/ProdutoService.java` — **modificar** — persistir campos novos.
- `locacoes/dto/ItemLocacaoRequest.java` — **modificar** — `precoDiaria` opcional (override).
- `locacoes/service/LocacaoService.java` — **modificar** — usar `precoDiaria` do produto/override.
- `../marluse/src/main/resources/db/migration/V5__add_preco_diaria_categoria_produto.sql` — **criar** — migration MySQL.

**Frontend (`marluse-frontend/src/app`)**
- `features/estoque/models/estoque.models.ts` — **modificar** — tipo `CategoriaProduto` + campos.
- `features/estoque/novo-produto-modal/novo-produto-modal.component.ts` — **modificar** — form + payload.
- `features/estoque/novo-produto-modal/novo-produto-modal.component.html` — **modificar** — inputs novos.
- `features/locacoes/models/locacoes.models.ts` — **modificar** — `ProdutoSimples.precoDiaria` + `ItemLocacaoRequest.precoDiaria`.
- `features/locacoes/nova-locacao-modal/nova-locacao-modal.component.ts` — **modificar** — puxar/enviar diária.

**Ordem obrigatória:** Backend Tasks 1→5 antes do Frontend, porque o frontend depende de a API já devolver `precoDiaria`/`categoria`. Dentro do backend, Task 2 (migration) deve rodar antes de subir a app.

---

## Phase A — Backend (`../marluse`)

### Task 1: Criar enum `CategoriaProduto`

**Files:**
- Create: `../marluse/src/main/java/com/example/marluse/estoque/enums/CategoriaProduto.java`

- [ ] **Step 1: Criar o enum**

```java
package com.example.marluse.estoque.enums;

public enum CategoriaProduto {
    FERRAMENTAS,
    ELETRICA,
    CONEXOES_E_TUBOS,
    ENSACADOS,
    MATERIAL_BRUTO,
    LOCACAO,
    OUTROS
}
```

- [ ] **Step 2: Commit**

```bash
cd ../marluse
git add src/main/java/com/example/marluse/estoque/enums/CategoriaProduto.java
git commit -m "feat(estoque): adiciona enum CategoriaProduto"
```

---

### Task 2: Adicionar colunas ao `Produto` + migration Flyway

**Files:**
- Modify: `../marluse/src/main/java/com/example/marluse/estoque/model/Produto.java`
- Create: `../marluse/src/main/resources/db/migration/V5__add_preco_diaria_categoria_produto.sql`

- [ ] **Step 1: Adicionar os campos na entidade**

Em `Produto.java`, adicione o import e os dois campos. Import (junto aos outros imports do topo):

```java
import com.example.marluse.estoque.enums.CategoriaProduto;
```

Campos novos (inserir logo após o campo `preco`, dentro da classe):

```java
    @Column(name = "preco_diaria", precision = 10, scale = 2)
    private BigDecimal precoDiaria;

    @Enumerated(EnumType.STRING)
    @Column(name = "categoria", length = 30)
    private CategoriaProduto categoria;
```

> Observação: colunas **nullable na entidade** de propósito — a migration faz o backfill e só então aplica `NOT NULL` no banco. Isso evita erro do Hibernate ao validar o schema em bases antigas.

- [ ] **Step 2: Criar a migration MySQL**

Arquivo `V5__add_preco_diaria_categoria_produto.sql`:

```sql
-- V5 — Adiciona preco_diaria e categoria em produtos.
-- Backfill: diária inicial = preço de venda atual (comportamento antigo das locações,
-- que usavam `preco` como diária); categoria padrão OUTROS para registros existentes.

ALTER TABLE produtos
    ADD COLUMN preco_diaria DECIMAL(10,2) NULL,
    ADD COLUMN categoria    VARCHAR(30)   NULL;

UPDATE produtos SET preco_diaria = preco   WHERE preco_diaria IS NULL;
UPDATE produtos SET categoria    = 'OUTROS' WHERE categoria IS NULL;

ALTER TABLE produtos
    MODIFY COLUMN preco_diaria DECIMAL(10,2) NOT NULL,
    MODIFY COLUMN categoria    VARCHAR(30)   NOT NULL;
```

- [ ] **Step 3: Compilar o backend**

Run: `JAVA_HOME="C:/Users/Miguel/.jdks/corretto-24.0.2" ./mvnw compile -o` (na pasta `../marluse`)
Expected: `BUILD SUCCESS` (compila só `src/main`, não os testes quebrados).

- [ ] **Step 4: Commit**

```bash
cd ../marluse
git add src/main/java/com/example/marluse/estoque/model/Produto.java src/main/resources/db/migration/V5__add_preco_diaria_categoria_produto.sql
git commit -m "feat(estoque): adiciona colunas preco_diaria e categoria em produtos"
```

---

### Task 3: Atualizar DTOs de Produto

**Files:**
- Modify: `../marluse/src/main/java/com/example/marluse/estoque/dto/ProdutoRequest.java`
- Modify: `../marluse/src/main/java/com/example/marluse/estoque/dto/ProdutoAtualizarRequest.java`
- Modify: `../marluse/src/main/java/com/example/marluse/estoque/dto/ProdutoResponse.java`

- [ ] **Step 1: `ProdutoRequest` — arquivo completo**

```java
package com.example.marluse.estoque.dto;

import com.example.marluse.estoque.enums.CategoriaProduto;
import com.example.marluse.estoque.enums.UnidadeMedida;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

public record ProdutoRequest(
        @NotBlank(message = "Nome é obrigatório")
        String nome,

        String descricao,

        @NotNull(message = "O valor de compra é obrigatorio")
        @DecimalMin(value = "0.0", inclusive = false, message = "O Preço deve ser maior que 0")
        BigDecimal valorCompra,

        @NotNull(message = "Preço é obrigatório")
        @DecimalMin(value = "0.0", inclusive = false, message = "Preço deve ser maior que zero")
        BigDecimal preco,

        @NotNull(message = "Preço da diária é obrigatório")
        @DecimalMin(value = "0.0", inclusive = false, message = "Preço da diária deve ser maior que zero")
        BigDecimal precoDiaria,

        @Min(value = 0, message = "Quantidade não pode ser negativa")
        Integer quantidadeEstoque,

        @Min(value = 0, message = "Estoque mínimo não pode ser negativo")
        Integer estoqueMinimo,

        @NotNull(message = "Unidade de medida é obrigatória")
        UnidadeMedida medida,

        @NotNull(message = "Categoria é obrigatória")
        CategoriaProduto categoria
) {
}
```

- [ ] **Step 2: `ProdutoAtualizarRequest` — arquivo completo**

```java
package com.example.marluse.estoque.dto;

import com.example.marluse.estoque.enums.CategoriaProduto;
import com.example.marluse.estoque.enums.UnidadeMedida;

import java.math.BigDecimal;

public record ProdutoAtualizarRequest(
        String nome,
        String descricao,
        BigDecimal valorCompra,
        BigDecimal preco,
        BigDecimal precoDiaria,
        Integer quantidadeEstoque,
        Integer estoqueMinimo,
        UnidadeMedida medida,
        CategoriaProduto categoria
) {
}
```

- [ ] **Step 3: `ProdutoResponse` — arquivo completo**

```java
package com.example.marluse.estoque.dto;

import com.example.marluse.estoque.enums.CategoriaProduto;
import com.example.marluse.estoque.enums.UnidadeMedida;
import com.example.marluse.estoque.model.Produto;

import java.math.BigDecimal;

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
        CategoriaProduto categoria
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
                produto.getCategoria()
        );
    }
}
```

- [ ] **Step 4: Compilar**

Run: `JAVA_HOME="C:/Users/Miguel/.jdks/corretto-24.0.2" ./mvnw compile -o`
Expected: `BUILD SUCCESS`.

- [ ] **Step 5: Commit**

```bash
cd ../marluse
git add src/main/java/com/example/marluse/estoque/dto/
git commit -m "feat(estoque): expõe preco_diaria e categoria nos DTOs de produto"
```

---

### Task 4: Persistir os campos novos no `ProdutoService`

**Files:**
- Modify: `../marluse/src/main/java/com/example/marluse/estoque/service/ProdutoService.java`

- [ ] **Step 1: Adicionar import**

No topo, junto aos imports:

```java
import com.example.marluse.estoque.enums.CategoriaProduto;
```

- [ ] **Step 2: Atualizar `criar()`**

Substituir o bloco `Produto.builder()...build()` do método `criar` por:

```java
        Produto produto = Produto.builder()
                .nome(request.nome())
                .descricao(request.descricao())
                .preco(request.preco())
                .precoDiaria(request.precoDiaria() != null ? request.precoDiaria() : request.preco())
                .valorCompra(request.valorCompra())
                .quantidadeEstoque(request.quantidadeEstoque() != null ? request.quantidadeEstoque() : 0)
                .estoqueMinimo(request.estoqueMinimo() != null ? request.estoqueMinimo() : 0)
                .ativo(true)
                .medida(request.medida())
                .categoria(request.categoria() != null ? request.categoria() : CategoriaProduto.OUTROS)
                .build();
```

- [ ] **Step 3: Atualizar `atualizar()`**

No método `atualizar`, logo após a linha `if (request.preco() != null) produto.setPreco(request.preco());`, adicionar:

```java
        if (request.precoDiaria() != null) produto.setPrecoDiaria(request.precoDiaria());
        if (request.categoria() != null) produto.setCategoria(request.categoria());
```

- [ ] **Step 4: Compilar**

Run: `JAVA_HOME="C:/Users/Miguel/.jdks/corretto-24.0.2" ./mvnw compile -o`
Expected: `BUILD SUCCESS`.

- [ ] **Step 5: Commit**

```bash
cd ../marluse
git add src/main/java/com/example/marluse/estoque/service/ProdutoService.java
git commit -m "feat(estoque): persiste preco_diaria e categoria ao criar/atualizar produto"
```

---

### Task 5: Locação usa `precoDiaria` do produto, com override por item

**Files:**
- Modify: `../marluse/src/main/java/com/example/marluse/locacoes/dto/ItemLocacaoRequest.java`
- Modify: `../marluse/src/main/java/com/example/marluse/locacoes/service/LocacaoService.java:95-118`

- [ ] **Step 1: `ItemLocacaoRequest` — arquivo completo**

```java
package com.example.marluse.locacoes.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

public record ItemLocacaoRequest (
        @NotNull(message = "Produto é obrigatório")
        String produtoId,

        @NotNull(message = "Quantidade é obrigatória")
        @Min(value = 1, message = "Quantidade deve ser maior que zero")
        Integer quantidade,

        // Opcional — quando presente, sobrescreve a diária padrão do produto nesta locação.
        BigDecimal precoDiaria
) {
}
```

- [ ] **Step 2: Usar a diária no `criar()` do `LocacaoService`**

Localizar, dentro do `for (ItemLocacaoRequest itemRequest : request.itens())`, o trecho que hoje calcula `subtotal` e monta o `ItemLocacao` (linhas ~108-118). Substituí-lo por:

```java
            // Diária: override do item (se enviado) tem prioridade; senão usa a diária do produto;
            // fallback final para o preço de venda, cobrindo produtos antigos sem diária definida.
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
                    .build();
```

- [ ] **Step 3: Compilar**

Run: `JAVA_HOME="C:/Users/Miguel/.jdks/corretto-24.0.2" ./mvnw compile -o`
Expected: `BUILD SUCCESS`.

- [ ] **Step 4: Verificação manual da API (subir o backend)**

Subir o backend (MySQL local em `localhost:3306`) para que o Flyway aplique a V5. Depois:

1. Criar produto com diária/categoria:

```bash
curl -s -X POST http://localhost:8080/produtos \
  -H "Content-Type: application/json" \
  -d '{"nome":"Furadeira Bosch","valorCompra":300.00,"preco":450.00,"precoDiaria":40.00,"quantidadeEstoque":5,"estoqueMinimo":1,"medida":"PECA","categoria":"FERRAMENTAS"}'
```
Expected: JSON com `"precoDiaria":40.00` e `"categoria":"FERRAMENTAS"`.

2. Criar locação com override de diária (`precoDiaria:55.00`) para 2 dias, 1 item — usar o `id` do produto acima:

```bash
curl -s -X POST http://localhost:8080/locacoes \
  -H "Content-Type: application/json" \
  -d '{"formaPagamento":"PIX","dataRetirada":"2026-07-15","dataDevolucaoPrevista":"2026-07-17","itens":[{"produtoId":"<ID>","quantidade":1,"precoDiaria":55.00}]}'
```
Expected: no item da resposta, `"precoDiaria":55.00` e `"subtotal":110.00` (55 × 1 × 2). Confirma que o override é salvo (bug original resolvido no backend).

3. Repetir a locação **sem** `precoDiaria` no item — Expected: `"precoDiaria":40.00` (a diária do produto), `"subtotal":80.00`.

- [ ] **Step 5: Commit**

```bash
cd ../marluse
git add src/main/java/com/example/marluse/locacoes/dto/ItemLocacaoRequest.java src/main/java/com/example/marluse/locacoes/service/LocacaoService.java
git commit -m "feat(locacoes): usa precoDiaria do produto com override por item"
```

---

## Phase B — Frontend (`marluse-frontend`)

### Task 6: Modelos de estoque

**Files:**
- Modify: `src/app/features/estoque/models/estoque.models.ts`

- [ ] **Step 1: Adicionar o tipo `CategoriaProduto`**

Logo abaixo da linha `export type UnidadeMedida = ...` (linha 1), adicionar:

```ts
export type CategoriaProduto =
  | 'FERRAMENTAS'
  | 'ELETRICA'
  | 'CONEXOES_E_TUBOS'
  | 'ENSACADOS'
  | 'MATERIAL_BRUTO'
  | 'LOCACAO'
  | 'OUTROS';
```

- [ ] **Step 2: Adicionar campos em `ProdutoRequest`**

Dentro de `interface ProdutoRequest`, após `preco: number;`:

```ts
  precoDiaria: number;
```
E após `medida: UnidadeMedida;`:

```ts
  categoria: CategoriaProduto;
```

- [ ] **Step 3: Adicionar campos em `ProdutoResponse`**

Dentro de `interface ProdutoResponse`, após `preco: number;`:

```ts
  precoDiaria: number;
```
E após `medida: UnidadeMedida;`:

```ts
  categoria: CategoriaProduto;
```

- [ ] **Step 4: Adicionar campos em `ProdutoAtualizarRequest`**

Dentro de `interface ProdutoAtualizarRequest`, após `preco: number;`:

```ts
  precoDiaria: number;
```
E após `medida: UnidadeMedida;`:

```ts
  categoria: CategoriaProduto;
```

- [ ] **Step 5: Commit**

```bash
git add src/app/features/estoque/models/estoque.models.ts
git commit -m "feat(estoque): tipos de precoDiaria e categoria no modelo de produto"
```

---

### Task 7: Modal de cadastro/edição de produto

**Files:**
- Modify: `src/app/features/estoque/novo-produto-modal/novo-produto-modal.component.ts`
- Modify: `src/app/features/estoque/novo-produto-modal/novo-produto-modal.component.html`

- [ ] **Step 1: Import do tipo no componente**

No `.ts`, no import de `../models/estoque.models`, adicionar `CategoriaProduto`:

```ts
import {
  ProdutoRequest,
  ProdutoAtualizarRequest,
  ProdutoResponse,
  UnidadeMedida,
  CategoriaProduto,
} from '../models/estoque.models';
```

- [ ] **Step 2: Campos novos no form**

No `this.fb.group({...})`, após a linha `preco: [null as number | null, [Validators.required, Validators.min(0.01)]],` adicionar:

```ts
    precoDiaria:       [null as number | null, [Validators.required, Validators.min(0.01)]],
```
E após a linha `medida: [null as unknown as UnidadeMedida, [Validators.required]],` adicionar:

```ts
    categoria:         [null as unknown as CategoriaProduto, [Validators.required]],
```

- [ ] **Step 3: Lista de categorias para o select**

Logo após o array `readonly unidades: {...} = [ ... ];` (termina na linha ~54), adicionar:

```ts
  readonly categorias: { value: CategoriaProduto; label: string }[] = [
    { value: 'FERRAMENTAS',      label: 'Ferramentas' },
    { value: 'ELETRICA',         label: 'Elétrica' },
    { value: 'CONEXOES_E_TUBOS', label: 'Conexões e Tubos' },
    { value: 'ENSACADOS',        label: 'Ensacados' },
    { value: 'MATERIAL_BRUTO',   label: 'Material Bruto' },
    { value: 'LOCACAO',          label: 'Locação' },
    { value: 'OUTROS',           label: 'Outros' },
  ];
```

- [ ] **Step 4: Preencher os campos no `ngOnChanges`**

No ramo `if (this.produto)`, dentro de `this.form.reset({...})`, após `preco: Number(this.produto.preco),` adicionar:

```ts
        precoDiaria:       Number(this.produto.precoDiaria),
```
e após `medida: this.produto.medida,` adicionar:

```ts
        categoria:         this.produto.categoria,
```

No ramo `else`, substituir o `this.form.reset({...})` inteiro por:

```ts
      this.form.reset({ nome: '', descricao: '', valorCompra: null, preco: null, precoDiaria: null, quantidadeEstoque: 0, estoqueMinimo: 0, medida: null as unknown as UnidadeMedida, categoria: null as unknown as CategoriaProduto });
```

- [ ] **Step 5: Incluir no payload do `onSalvar`**

No objeto `payload`, após `preco: v.preco!,` adicionar:

```ts
      precoDiaria:       v.precoDiaria!,
```
e após `medida: v.medida as UnidadeMedida,` adicionar:

```ts
      categoria:         v.categoria as CategoriaProduto,
```

- [ ] **Step 6: Inputs no HTML**

No `.html`, o bloco "Preço + Unidade" (grid de 2 colunas, linhas ~61-88) mistura preço e unidade. Substituir esse bloco inteiro pelos dois blocos abaixo (preço + diária numa linha; unidade + categoria noutra):

```html
    <!-- Preço de venda + Preço da diária -->
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div class="flex flex-col gap-1.5">
        <div class="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.06em]">
          Preço de venda <span class="text-red-500">*</span>
        </div>
        <p-inputnumber formControlName="preco"
          mode="currency" currency="BRL" locale="pt-BR" [minFractionDigits]="2"
          class="w-full" />
        @if (form.get('preco') | fieldError; as msg) {
          <span class="text-xs text-red-500 mt-0.5 flex items-center gap-1">
            <i class="pi pi-times-circle text-[10px]"></i>{{ msg }}
          </span>
        }
      </div>
      <div class="flex flex-col gap-1.5">
        <div class="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.06em]">
          Preço da diária <span class="text-red-500">*</span>
        </div>
        <p-inputnumber formControlName="precoDiaria"
          mode="currency" currency="BRL" locale="pt-BR" [minFractionDigits]="2"
          class="w-full" />
        @if (form.get('precoDiaria') | fieldError; as msg) {
          <span class="text-xs text-red-500 mt-0.5 flex items-center gap-1">
            <i class="pi pi-times-circle text-[10px]"></i>{{ msg }}
          </span>
        }
      </div>
    </div>

    <!-- Unidade + Categoria -->
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div class="flex flex-col gap-1.5">
        <div class="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.06em]">
          Unidade <span class="text-red-500">*</span>
        </div>
        <app-select-search formControlName="medida"
          [options]="unidades"
          placeholder="Selecionar unidade…" />
        @if (form.get('medida') | fieldError; as msg) {
          <span class="text-xs text-red-500 mt-0.5 flex items-center gap-1">
            <i class="pi pi-times-circle text-[10px]"></i>{{ msg }}
          </span>
        }
      </div>
      <div class="flex flex-col gap-1.5">
        <div class="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.06em]">
          Categoria <span class="text-red-500">*</span>
        </div>
        <app-select-search formControlName="categoria"
          [options]="categorias"
          placeholder="Selecionar categoria…" />
        @if (form.get('categoria') | fieldError; as msg) {
          <span class="text-xs text-red-500 mt-0.5 flex items-center gap-1">
            <i class="pi pi-times-circle text-[10px]"></i>{{ msg }}
          </span>
        }
      </div>
    </div>
```

- [ ] **Step 7: Build**

Run: `npm run build`
Expected: build sem erros de TypeScript/template.

- [ ] **Step 8: Verificação manual**

Subir o dev server (`npm start`), abrir Estoque → Novo produto. Confirmar: campos "Preço da diária" e "Categoria" aparecem, são obrigatórios (bloqueiam salvar se vazios), e ao editar um produto existente vêm preenchidos.

- [ ] **Step 9: Commit**

```bash
git add src/app/features/estoque/novo-produto-modal/
git commit -m "feat(estoque): campos de diária e categoria no cadastro de produto"
```

---

### Task 8: Modelos de locação

**Files:**
- Modify: `src/app/features/locacoes/models/locacoes.models.ts:46-49` (ItemLocacaoRequest)
- Modify: `src/app/features/locacoes/models/locacoes.models.ts:129-134` (ProdutoSimples)

- [ ] **Step 1: `precoDiaria` opcional no `ItemLocacaoRequest`**

Substituir a interface por:

```ts
export interface ItemLocacaoRequest {
  produtoId: string;          // backend espera String, não número
  quantidade: number;
  precoDiaria?: number;       // override opcional da diária do produto
}
```

- [ ] **Step 2: `precoDiaria` no `ProdutoSimples`**

Substituir a interface por:

```ts
export interface ProdutoSimples {
  id: string;
  nome: string;
  preco: number;
  precoDiaria: number;
  quantidadeEstoque: number;
}
```

> A fonte de `ProdutoSimples` é o endpoint `GET /pedidos/produtos`, que retorna `ProdutoResponse` (agora com `precoDiaria`). Nenhuma mudança de endpoint é necessária — só consumir o campo.

- [ ] **Step 3: Commit**

```bash
git add src/app/features/locacoes/models/locacoes.models.ts
git commit -m "feat(locacoes): modelo aceita precoDiaria em item e produto"
```

---

### Task 9: Modal de nova locação — puxar e enviar a diária

**Files:**
- Modify: `src/app/features/locacoes/nova-locacao-modal/nova-locacao-modal.component.ts:193-199` (onProdutoChange)
- Modify: `src/app/features/locacoes/nova-locacao-modal/nova-locacao-modal.component.ts:213` (salvar → itens)

- [ ] **Step 1: `onProdutoChange` usa a diária do produto como padrão**

Substituir o método por:

```ts
    onProdutoChange(item: ItemForm): void {
        const produto = this.produtos.find(p => p.id === item.produtoId);
        if (produto) {
            item.produtoNome   = produto.nome;
            item.precoUnitario = Number(produto.precoDiaria);
        }
    }
```

- [ ] **Step 2: `salvar()` envia a diária editada**

No `this.service.postLocacao({...})`, substituir a linha do `itens`:

```ts
            itens:                 this.itens.map(i => ({ produtoId: i.produtoId, quantidade: i.quantidade })),
```
por:

```ts
            itens:                 this.itens.map(i => ({ produtoId: i.produtoId, quantidade: i.quantidade, precoDiaria: i.precoUnitario })),
```

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: build sem erros.

- [ ] **Step 4: Verificação manual (end-to-end do bug original)**

Com backend + frontend no ar:
1. Abrir "Nova locação", escolher um produto → campo "Diária (R$)" preenche com `precoDiaria` do produto.
2. **Editar** a diária para um valor diferente, escolher datas com ≥1 dia, salvar.
3. Abrir a locação criada (detalhe) → a coluna "Diária" mostra o valor **editado** (não o padrão), e "Subtotal" = diária × qtd × dias. Bug resolvido ponta a ponta.

- [ ] **Step 5: Commit**

```bash
git add src/app/features/locacoes/nova-locacao-modal/nova-locacao-modal.component.ts
git commit -m "fix(locacoes): salva a diária editada por item na nova locação"
```

---

## Out of scope / follow-ups (não implementar neste plano)

- **Exibir/filtrar categoria na lista de Estoque** (`estoque.component.*`, `estoque-filtros-modal.*`): a categoria fica persistida e editável, mas mostrar como coluna/badge e filtrar por ela é uma melhoria separada.
- **Consertar a suíte de testes do backend** (`ProdutoServiceTest`, `LocacoesServiceTest`, `PedidoServiceTest`, `AuthServiceTest`): hoje não compila; foi decisão pular. Vale um plano próprio.
- **Editar diária por item numa locação já existente** (`locacao-edicao-modal`): o edição atual não mexe em itens; fora do escopo.

---

## Self-Review

**Spec coverage:**
- "Adicionar preço diária em produtos" → Tasks 1-4 (backend), 6-7 (frontend). ✔
- "Adicionar categoria em produtos" (enum fixo) → Tasks 1, 2, 3, 4, 6, 7. ✔
- "Diária editável com override (bug original)" → Task 5 (backend) + Tasks 8-9 (frontend). ✔
- Migração de dados existentes (backfill) → Task 2 (V5). ✔

**Type consistency:**
- `CategoriaProduto`: enum Java (Task 1) ↔ `type CategoriaProduto` TS (Task 6) — mesmos 7 valores. ✔
- `precoDiaria`: `BigDecimal` (Java) ↔ `number` (TS); campo do request de item é opcional em ambos (`BigDecimal` nullable / `precoDiaria?: number`). ✔
- `ProdutoResponse.from` mantém a ordem posicional do record atualizado (Task 3). ✔
- Frontend `item.precoUnitario` (nome interno do `ItemForm`, mantido) é mapeado para `precoDiaria` no payload (Task 9). ✔

**Placeholder scan:** nenhum TODO/TBD; todo passo de código traz o código real. ✔
