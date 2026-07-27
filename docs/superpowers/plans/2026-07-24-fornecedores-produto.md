# Fornecedores em Produtos (com preço por fornecedor) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Associar vários fornecedores a um produto, cada vínculo com um preço de compra opcional; permitir montar/editar essa lista no modal de produto e visualizar tudo num modal de detalhe do produto.

**Architecture:** O vínculo produto↔fornecedor é uma **entidade de junção** `ProdutoFornecedor` (`produto_id`, `fornecedor_id`, `preco_compra` nullable), não uma tabela N:N pura — é o que permite guardar preço por par e preços distintos do mesmo fornecedor em produtos diferentes. `Produto` mapeia `@OneToMany(cascade=ALL, orphanRemoval=true)`, então adicionar/remover linha no modal reflete direto no banco. As DTOs trafegam **nomes** de fornecedor + preço; o `ProdutoService` resolve nome→`Fornecedor` via `FornecedorService.resolverPorNomes` (criar-na-hora) e monta os vínculos. `preco_compra` é **independente** de `Produto.valorCompra` — não toca custo/lucro.

**Tech Stack:** Backend Spring Boot / Java / JPA / Lombok (MySQL dev via `ddl-auto: update`, Flyway só no perfil docker) / JUnit 5 + `@SpringBootTest` H2 (`profile=test`). Frontend Angular 22 standalone + PrimeNG 21 + Tailwind, testes Vitest (`@angular/build:unit-test`, rodar com `npx ng test --watch=false`).

**Spec:** `docs/superpowers/specs/2026-07-24-fornecedor-produto-design.md`

**Ambiente:** o `pom.xml` pede Java 21, mas o PATH do shell tem só 17. Rodar Maven com `JAVA_HOME="/c/Users/Miguel/.jdks/corretto-24.0.2" ./mvnw ...`.

**Decisões travadas:** vários fornecedores por produto; preço por vínculo, opcional, independente de `valorCompra`; preço por par (produto, fornecedor); vínculo opcional sem backfill; lista editável (fornecedor **e** preço) no modal; modal de view com botão "ver" separado do "editar"; sem tela global de fornecedores.

**Descartado:** o componente `multi-select-create` (chips de `string[]`) — não comporta preço. Removido.

---

## Estado atual (o que já foi feito)

| Item | Status |
|---|---|
| Migration `V11` (fornecedores + produto_fornecedores com `preco_compra`, `id`, unique) | ✅ feito |
| `Fornecedor` (model), `FornecedorRepository`, `FornecedorService.resolverPorNomes` | ✅ feito, 10 testes verdes |
| `FornecedorResponse`, `FornecedorController` (`GET /api/fornecedores`) | ✅ feito |
| `ProdutoServiceTest` — 8 testes de fornecedor+preço (fase RED) | ✅ escrito, falha por DTOs ausentes |
| Frontend: models, `fornecedor.service.ts` | ⚠️ existe, mas ainda com contrato antigo (`string[]`) |
| Frontend: 7 specs legados corrigidos | ✅ feito |

O `FornecedorService` e seus testes **não mudam**. O que falta é a entidade de junção, os DTOs de vínculo, o wiring no `ProdutoService`, e todo o frontend do editor + modal de view.

---

## Convenções de path

- **Backend** (`marluse/`): pacote base `src/main/java/com/example/marluse`, testes em `src/test/...`, migrações em `src/main/resources/db/migration`.
- **Frontend** (`marluse-frontend/`): `src/app`.

---

## File Structure

**Backend — criar:**
- `estoque/model/ProdutoFornecedor.java` — entidade de junção.
- `estoque/dto/ProdutoFornecedorRequest.java` — `(nome, precoCompra)`.
- `estoque/dto/ProdutoFornecedorResponse.java` — `(nome, precoCompra)`.

**Backend — modificar:**
- `estoque/model/Produto.java` — `@OneToMany List<ProdutoFornecedor>` no lugar do `@ManyToMany`.
- `estoque/dto/ProdutoRequest.java` / `ProdutoAtualizarRequest.java` — `List<ProdutoFornecedorRequest> fornecedores`.
- `estoque/dto/ProdutoResponse.java` — `List<ProdutoFornecedorResponse> fornecedores` + mapeamento ordenado.
- `estoque/service/ProdutoService.java` — montar/substituir vínculos a partir dos nomes+preços.
- `estoque/repository/ProdutoRepository.java` — `@EntityGraph` já presente; confirmar que cobre o `@OneToMany`.

**Frontend — criar:**
- `shared/components/produto-fornecedores-editor/produto-fornecedores-editor.component.ts` (+ `.spec.ts`).
- `features/estoque/produto-detalhe-modal/produto-detalhe-modal.component.ts` (+ `.html`).

**Frontend — modificar:**
- `features/estoque/models/estoque.models.ts` — `fornecedores` vira `ProdutoFornecedorDto[]`.
- `features/estoque/novo-produto-modal/*` — usar o editor no lugar do multi-select-create.
- `features/estoque/estoque/estoque.component.ts` (+ `.html`) — estado + botão "ver" + wiring do detalhe-modal.

**Frontend — remover:**
- `shared/components/multi-select-create/` (componente + spec).

---

## Task 1: Entidade de junção `ProdutoFornecedor`

**Files:**
- Create: `marluse/src/main/java/com/example/marluse/estoque/model/ProdutoFornecedor.java`

- [ ] **Step 1: Criar a entidade**

```java
package com.example.marluse.estoque.model;

import com.example.marluse.fornecedores.model.Fornecedor;
import com.example.marluse.shared.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;

@Entity
@Table(name = "produto_fornecedores",
        uniqueConstraints = @UniqueConstraint(name = "uk_produto_fornecedor",
                columnNames = {"produto_id", "fornecedor_id"}))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ProdutoFornecedor extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "produto_id", nullable = false)
    private Produto produto;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "fornecedor_id", nullable = false)
    private Fornecedor fornecedor;

    @Column(name = "preco_compra", precision = 10, scale = 2)
    private BigDecimal precoCompra;
}
```

Nota: `Fornecedor` está em `com.example.marluse.estoque.model` neste projeto (não em
`fornecedores.model`). Ajustar o import ao pacote real antes de compilar.

- [ ] **Step 2: Compilar**

Run (em `marluse/`): `JAVA_HOME="/c/Users/Miguel/.jdks/corretto-24.0.2" ./mvnw -q compile`
Expected: BUILD SUCCESS (a entidade sozinha compila; o wiring vem depois).

- [ ] **Step 3: Commit**

```bash
git add src/main/java/com/example/marluse/estoque/model/ProdutoFornecedor.java
git commit -m "feat: entidade de juncao ProdutoFornecedor com preco de compra"
```

---

## Task 2: DTOs de vínculo

**Files:**
- Create: `marluse/src/main/java/com/example/marluse/estoque/dto/ProdutoFornecedorRequest.java`
- Create: `marluse/src/main/java/com/example/marluse/estoque/dto/ProdutoFornecedorResponse.java`

- [ ] **Step 1: Request**

```java
package com.example.marluse.estoque.dto;

import java.math.BigDecimal;

public record ProdutoFornecedorRequest(
        String nome,
        BigDecimal precoCompra
) {
}
```

- [ ] **Step 2: Response**

```java
package com.example.marluse.estoque.dto;

import com.example.marluse.estoque.model.ProdutoFornecedor;

import java.math.BigDecimal;

public record ProdutoFornecedorResponse(
        String nome,
        BigDecimal precoCompra
) {
    public static ProdutoFornecedorResponse from(ProdutoFornecedor pf) {
        return new ProdutoFornecedorResponse(pf.getFornecedor().getNome(), pf.getPrecoCompra());
    }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/main/java/com/example/marluse/estoque/dto/ProdutoFornecedorRequest.java src/main/java/com/example/marluse/estoque/dto/ProdutoFornecedorResponse.java
git commit -m "feat: DTOs de vinculo produto-fornecedor"
```

---

## Task 3: Ligar no `Produto` e nas DTOs de produto (fase GREEN)

Aqui os testes já escritos (`ProdutoServiceTest`, fase RED) passam a compilar e devem ficar verdes.

**Files:**
- Modify: `marluse/src/main/java/com/example/marluse/estoque/model/Produto.java`
- Modify: `marluse/src/main/java/com/example/marluse/estoque/dto/ProdutoRequest.java`
- Modify: `marluse/src/main/java/com/example/marluse/estoque/dto/ProdutoAtualizarRequest.java`
- Modify: `marluse/src/main/java/com/example/marluse/estoque/dto/ProdutoResponse.java`

- [ ] **Step 1: Trocar a coleção em `Produto`**

Remover o `@ManyToMany Set<Fornecedor> fornecedores` e colocar:

```java
@Builder.Default
@OneToMany(mappedBy = "produto", cascade = CascadeType.ALL, orphanRemoval = true)
private List<ProdutoFornecedor> fornecedores = new ArrayList<>();
```

Imports: `java.util.ArrayList`, `java.util.List`. Remover os imports de `Set`/`LinkedHashSet` e de `Fornecedor` se ficarem sem uso.

Helper para manter os dois lados da relação em sincronia (evita `null` no `produto` do vínculo):

```java
public void limparFornecedores() {
    this.fornecedores.clear();
}

public void addFornecedor(ProdutoFornecedor pf) {
    pf.setProduto(this);
    this.fornecedores.add(pf);
}
```

- [ ] **Step 2: Campo nas 3 DTOs de produto**

`ProdutoRequest` e `ProdutoAtualizarRequest`: adicionar como último componente
```java
List<ProdutoFornecedorRequest> fornecedores
```
(import `java.util.List`).

`ProdutoResponse`: adicionar `List<ProdutoFornecedorResponse> fornecedores` ao final e, no `from()`, mapear ordenado por nome:

```java
produto.getFornecedores().stream()
        .map(ProdutoFornecedorResponse::from)
        .sorted(java.util.Comparator.comparing(
                ProdutoFornecedorResponse::nome, String.CASE_INSENSITIVE_ORDER))
        .toList()
```

- [ ] **Step 3: Ligar no `ProdutoService`**

Injetar `FornecedorService` (se ainda não estiver). Criar um helper privado que aplica a lista de linhas a um produto:

```java
private void aplicarFornecedores(Produto produto, List<ProdutoFornecedorRequest> linhas) {
    produto.limparFornecedores();
    if (linhas == null) return;
    for (ProdutoFornecedorRequest linha : linhas) {
        if (linha == null || linha.nome() == null || linha.nome().isBlank()) continue;
        Fornecedor fornecedor = fornecedorService.resolverPorNomes(List.of(linha.nome()))
                .iterator().next();
        produto.addFornecedor(ProdutoFornecedor.builder()
                .fornecedor(fornecedor)
                .precoCompra(linha.precoCompra())
                .build());
    }
}
```

Em `criar(...)`: após montar o `produto` (antes do `save`), chamar `aplicarFornecedores(produto, request.fornecedores())`. Manter `@Transactional`.

Em `atualizar(...)`: substituir a linha antiga de fornecedores por
```java
if (request.fornecedores() != null) aplicarFornecedores(produto, request.fornecedores());
```
`null` preserva (não chama), lista (mesmo vazia) substitui — o `limparFornecedores()` + `orphanRemoval` apaga os vínculos que sumiram.

- [ ] **Step 4: Rodar os testes**

Run (em `marluse/`): `JAVA_HOME="/c/Users/Miguel/.jdks/corretto-24.0.2" ./mvnw test -Dtest=FornecedorServiceTest,ProdutoServiceTest`
Expected: PASS — 10 (Fornecedor) + 14 (Produto: 6 antigos + 8 de fornecedor). 24 no total.

- [ ] **Step 5: Verificar lazy fora de transação**

Run: `JAVA_HOME="..." ./mvnw spring-boot:run`, logado, no console do navegador:
```js
await (await fetch('/api/produtos', { credentials: 'include' })).json()
```
Expected: cada item com `"fornecedores": []`, sem erro 500. Se aparecer `LazyInitializationException`, faltou `@EntityGraph` em algum finder.

- [ ] **Step 6: Commit**

```bash
git add src/main/java/com/example/marluse/estoque src/test/java/com/example/marluse/estoque src/main/resources/db/migration/V11__fornecedores.sql
git commit -m "feat: vincula fornecedores com preco ao produto (create e update)"
```

---

## Task 4: Frontend — models e service no novo contrato

**Files:**
- Modify: `marluse-frontend/src/app/features/estoque/models/estoque.models.ts`
- Modify: `marluse-frontend/src/app/features/estoque/fornecedor/fornecedor.service.ts`

- [ ] **Step 1: Tipo de vínculo nos models**

```ts
export interface ProdutoFornecedorDto {
  nome: string;
  precoCompra: number | null;
}
```

Nas 3 interfaces (`ProdutoRequest`, `ProdutoResponse`, `ProdutoAtualizarRequest`), `fornecedores` passa de `string[]` para `ProdutoFornecedorDto[]` (opcional em Request/Atualizar; obrigatório em Response).

- [ ] **Step 2: Confirmar o service**

`fornecedor.service.ts` continua com `listar()` devolvendo `FornecedorResponse[]` (`{id, nome}`) — usado só para as sugestões de nome. Sem mudança de contrato.

- [ ] **Step 3: Typecheck**

Run (em `marluse-frontend/`): `npx tsc -p tsconfig.app.json --noEmit`
Expected: erros no modal (ainda usa contrato antigo) — resolvidos na Task 6. Nos models em si, sem erro.

- [ ] **Step 4: Commit**

```bash
git add src/app/features/estoque/models/estoque.models.ts
git commit -m "feat: tipo ProdutoFornecedorDto no frontend"
```

---

## Task 5: Componente `produto-fornecedores-editor`

Lista editável de linhas (fornecedor + preço), CVA que emite `ProdutoFornecedorDto[]`.

**Files:**
- Create: `marluse-frontend/src/app/shared/components/produto-fornecedores-editor/produto-fornecedores-editor.component.ts`
- Create: `marluse-frontend/src/app/shared/components/produto-fornecedores-editor/produto-fornecedores-editor.component.spec.ts`
- Remove: `marluse-frontend/src/app/shared/components/multi-select-create/`

- [ ] **Step 1: Escrever o teste (RED)**

```ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProdutoFornecedoresEditorComponent } from './produto-fornecedores-editor.component';

describe('ProdutoFornecedoresEditorComponent', () => {
  let component: ProdutoFornecedoresEditorComponent;
  let fixture: ComponentFixture<ProdutoFornecedoresEditorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProdutoFornecedoresEditorComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(ProdutoFornecedoresEditorComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('deve iniciar sem linhas', () => {
    expect(component.linhas).toEqual([]);
  });

  it('deve tratar null do writeValue como lista vazia', () => {
    component.writeValue(null as never);
    expect(component.linhas).toEqual([]);
  });

  it('adicionar cria uma linha vazia', () => {
    component.adicionar();
    expect(component.linhas).toEqual([{ nome: '', precoCompra: null }]);
  });

  it('remover exclui a linha pelo índice', () => {
    component.writeValue([{ nome: 'Tigre', precoCompra: 8 }, { nome: 'Amanco', precoCompra: null }]);
    component.remover(0);
    expect(component.linhas).toEqual([{ nome: 'Amanco', precoCompra: null }]);
  });

  it('emite apenas linhas com fornecedor preenchido, com nome trimado', () => {
    const emitidos: unknown[] = [];
    component.registerOnChange(v => emitidos.push(v));
    component.linhas = [{ nome: '  Tigre  ', precoCompra: 8 }, { nome: '', precoCompra: 5 }];
    component.emitir();
    expect(emitidos.at(-1)).toEqual([{ nome: 'Tigre', precoCompra: 8 }]);
  });
});
```

- [ ] **Step 2: Rodar (RED)**

Run (em `marluse-frontend/`): `npx ng test --include "src/app/shared/components/produto-fornecedores-editor/**" --watch=false`
Expected: falha — módulo não encontrado.

- [ ] **Step 3: Implementar o componente**

CVA sobre uma lista de linhas. Cada linha usa um `app-select-search` (ou `p-autocomplete` single) para o nome do fornecedor com sugestões de `@Input() options: string[]`, e um `p-inputnumber` para o preço. Botão "+ adicionar" chama `adicionar()`; lixeira por linha chama `remover(i)`. Qualquer mudança chama `emitir()`, que filtra linhas sem nome, trima o nome e propaga via `onChange`.

Assinatura mínima que o teste exige:
```ts
linhas: ProdutoFornecedorDto[] = [];
@Input() options: string[] = [];
adicionar(): void
remover(i: number): void
emitir(): void
writeValue(v: ProdutoFornecedorDto[] | null): void
registerOnChange(fn): void ; registerOnTouched(fn): void ; setDisabledState(b): void
```

- [ ] **Step 4: Rodar (GREEN)**

Run: `npx ng test --include "src/app/shared/components/produto-fornecedores-editor/**" --watch=false`
Expected: PASS, 5 testes.

- [ ] **Step 5: Remover o multi-select-create**

```bash
git rm -r src/app/shared/components/multi-select-create
```

- [ ] **Step 6: Commit**

```bash
git add src/app/shared/components/produto-fornecedores-editor
git commit -m "feat: editor de fornecedores+preco; remove multi-select-create"
```

---

## Task 6: Integrar o editor no modal de produto

**Files:**
- Modify: `marluse-frontend/src/app/features/estoque/novo-produto-modal/novo-produto-modal.component.ts` (+ `.html`)

- [ ] **Step 1: Trocar o componente no `.ts`**

Remover o import/uso de `MultiSelectCreateComponent`; importar `ProdutoFornecedoresEditorComponent` e adicioná-lo ao array `imports`. O control `fornecedores` continua sem validator, mas agora seu valor é `ProdutoFornecedorDto[]`:
```ts
fornecedores: [[] as ProdutoFornecedorDto[]],
```
No `ngOnChanges` (edição) preencher com `this.produto.fornecedores ?? []`; na criação, `[]`. No `onSalvar`, enviar `v.fornecedores ?? []`.

- [ ] **Step 2: Campo no `.html`**

Substituir o bloco `app-multi-select-create` por:
```html
<app-produto-fornecedores-editor formControlName="fornecedores"
  [options]="fornecedoresDisponiveis" />
```

- [ ] **Step 3: Typecheck + rodar**

Run: `npx tsc -p tsconfig.app.json --noEmit` → sem erro.
Run: `npx ng test --watch=false` → sem falha nova.

- [ ] **Step 4: Commit**

```bash
git add src/app/features/estoque/novo-produto-modal
git commit -m "feat: usa o editor de fornecedores no modal de produto"
```

---

## Task 7: Modal de visualização do produto

**Files:**
- Create: `marluse-frontend/src/app/features/estoque/produto-detalhe-modal/produto-detalhe-modal.component.ts` (+ `.html`)
- Modify: `marluse-frontend/src/app/features/estoque/estoque/estoque.component.ts` (+ `.html`)

- [ ] **Step 1: Criar o modal de detalhe**

No padrão de `cliente-detalhe-modal`: standalone, `DialogModule`, `@Input() visible`, `@Input() produto: ProdutoResponse | null`, `@Output() fechar`, `@Output() editar`. Somente leitura. Renderiza os campos do produto e uma tabela/lista dos fornecedores com `nome` e `precoCompra` (formatado em BRL; "—" quando nulo). Botão "Editar" emite `editar`.

- [ ] **Step 2: Ligar no estoque**

Em `estoque.component.ts`: `showDetalhe = false; produtoDetalhe: ProdutoResponse | null = null;` e métodos `abrirDetalhe(p)`, `fecharDetalhe()`, e um `onEditarDoDetalhe(p)` que fecha o detalhe e chama `abrirModalEditar(p)`. Importar `ProdutoDetalheModalComponent`.

Em `estoque.component.html`: adicionar o `<app-produto-detalhe-modal>` e, na linha do produto, um ícone de olho (`pi pi-eye`) ao lado do lápis, com `(click)` chamando `abrirDetalhe(produto)`. Emitir `(editar)` → `onEditarDoDetalhe`.

- [ ] **Step 3: Typecheck + rodar**

Run: `npx tsc -p tsconfig.app.json --noEmit` → sem erro.
Run: `npx ng test --watch=false` → sem falha nova.

- [ ] **Step 4: Commit**

```bash
git add src/app/features/estoque/produto-detalhe-modal src/app/features/estoque/estoque
git commit -m "feat: modal de visualizacao de produto com fornecedores e precos"
```

---

## Task 8: Verificação ponta a ponta

**Files:** nenhum (verificação)

- [ ] **Step 1: Subir backend e frontend**

`JAVA_HOME="..." ./mvnw spring-boot:run` (em `marluse/`) e `npm start` (em `marluse-frontend/`).

- [ ] **Step 2: Criar produto com fornecedores e preços**

Novo produto → "+ adicionar" → escolher/criar "Votorantim", preço 10,00 → "+ adicionar" → "Tigre", preço 8,50. Salvar. Sem erro.

- [ ] **Step 3: Ver no modal de detalhe**

Clicar no ícone de olho do produto. Expected: modal de leitura mostra Votorantim R$10,00 e Tigre R$8,50.

- [ ] **Step 4: Editar preço e fornecedor**

Do detalhe, "Editar". Mudar o preço da Votorantim para 9,00, remover a Tigre, adicionar "Amanco" sem preço. Salvar. Reabrir o detalhe. Expected: Votorantim R$9,00 e Amanco "—".

- [ ] **Step 5: Preço diferente em outro produto**

Criar "Reboco" com "votorantim" (minúsculo), preço 7,00. No detalhe do Reboco: Votorantim R$7,00. No detalhe do Cimento: Votorantim R$9,00.
```js
await (await fetch('/api/fornecedores', { credentials: 'include' })).json()
```
Expected: **1** Votorantim (não dois) — mesmo cadastro, preços distintos por produto.

- [ ] **Step 6: Telas vizinhas intactas**

Vendas → Novo pedido e Locações → Nova locação: a lista de produtos carrega sem erro no console (é onde um `LazyInitializationException` apareceria).

---

## Checklist de aceite

- [ ] `JAVA_HOME=... ./mvnw test` passa em `marluse/`
- [ ] `npx ng test --watch=false` sem falhas novas em `marluse-frontend/`
- [ ] `GET /api/produtos` devolve `fornecedores` (nome + precoCompra) sem 500
- [ ] Mesmo fornecedor com preços diferentes em produtos diferentes; um só cadastro
- [ ] Preço opcional (vínculo sem preço aparece como "—")
- [ ] Produto sem fornecedor continua sendo criado normalmente
- [ ] Modal de view abre pelo ícone "ver" e mostra fornecedores + preços
- [ ] `multi-select-create` removido do repositório
