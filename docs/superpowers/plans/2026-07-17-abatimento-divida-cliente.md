# Abatimento de Dívida do Cliente (FIFO, valores personalizados) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Na aba de histórico do cliente, mostrar quanto o cliente deve (saldo devedor total e por pedido/locação) e permitir debitar valores personalizados que são abatidos automaticamente do pedido/locação **mais antigo** para o mais recente, quitando cada um por completo antes de passar para o próximo.

**Architecture:** A dívida do cliente **já existe** modelada como `LancamentoFinanceiro` do tipo `RECEITA` ligados a cada `Pedido`/`Locacao`, com `status = PENDENTE`/`VENCIDO` (em aberto) e `PAGO` (quitado). Cada parcela é um lançamento. Hoje o pagamento é tudo-ou-nada (`pagar()` vira o lançamento inteiro para `PAGO`). Este plano adiciona **pagamento parcial** via um campo `valorPago` no lançamento e uma **alocação FIFO** de um valor debitado sobre os lançamentos em aberto, ordenados pela data do pedido/locação (mais antigo primeiro) e depois pelo número da parcela. Cada débito é registrado como um `Abatimento` (auditável e estornável) com linhas `AbatimentoParcela` apontando quanto foi para cada lançamento. O caixa/relatórios passam a contar o dinheiro recebido de duas fontes que **nunca se sobrepõem** (invariante `valorPago`): lançamentos à-vista (`valorPago = 0`, contados pelo `valor`) e abatimentos (`valorPago > 0`, contados pelas linhas `AbatimentoParcela`).

**Tech Stack:** Backend Spring Boot 3 / Java 17 / JPA (MySQL em dev via `ddl-auto: update`, Flyway no perfil docker) / JUnit 5 + `@SpringBootTest` com H2 (`profile=test`). Frontend Angular standalone + PrimeNG. Os testes de backend são a fonte de verdade da lógica de alocação; o frontend é verificado por navegador.

**Decisões travadas (confirmadas com o usuário):**
- **Auditoria:** cada abatimento é registrado (tabela `abatimentos` + `abatimento_parcela`), com estorno possível.
- **Caixa:** o valor abatido entra no caixa/relatórios **na data do abatimento**, mesmo que a parcela ainda não esteja 100% quitada.
- **Ordem FIFO:** ordenar pela **data do pedido/locação** (`dataMovimento`) — "desconta do pedido mais antigo até completá-lo".

**Invariante central (não quebrar):** um lançamento (`LancamentoFinanceiro` RECEITA) tem seu dinheiro contado em **exatamente um** lugar:
- `valorPago == 0` → dinheiro contado pelo `valor` do lançamento quando `status = PAGO` (fluxo à-vista/legado, incluindo o `pagar()` atual). 
- `valorPago > 0` → o lançamento foi tocado por abatimento; seu dinheiro é contado **somente** pelas linhas `AbatimentoParcela` (não pelo `valor`). 
Como o abatimento só atua sobre lançamentos em aberto e um lançamento quitado por abatimento nunca é re-pago pelo `pagar()`, os dois caminhos são mutuamente exclusivos e não há dupla contagem.

**Limitações conhecidas (aceitas, fora de escopo):**
- Não há troco/adiantamento: se o valor debitado exceder a dívida total, o excedente é **rejeitado** (erro de validação) — não guardamos crédito a favor do cliente.
- Orçamentos (`ORCAMENTO`) não geram lançamento, portanto não entram na dívida (comportamento atual, mantido).
- Estorno é **total por abatimento** (desfaz um `Abatimento` inteiro, com todas as suas `AbatimentoParcela`); não há estorno parcial.

---

## Convenções de path

- **Backend** (raiz `marluse/`): pacote base `src/main/java/com/example/marluse`, testes `src/test/java/com/example/marluse`, migrações `src/main/resources/db/migration`.
- **Frontend** (raiz `marluse-frontend/`): `src/app`.

Comandos de backend rodam a partir de `marluse/`. Comandos de frontend a partir de `marluse-frontend/`.

Build/test backend: `./mvnw test` (ou `./mvnw -Dtest=NomeDaClasse test` para uma classe). Frontend: `npm test` e verificação por navegador (preview_start).

---

## File Structure

**Backend — criar:**
- `financeiro/model/Abatimento.java` — o abatimento (evento de dinheiro recebido).
- `financeiro/model/AbatimentoParcela.java` — linha de alocação (quanto do abatimento foi para cada lançamento).
- `financeiro/repository/AbatimentoRepository.java` — queries de abatimento (somar por período, listar por cliente).
- `financeiro/dto/AbatimentoRequest.java` — `{ valor, observacao? }`.
- `financeiro/dto/AbatimentoResultado.java` — resposta do débito (saldo antes/depois + linhas alocadas).
- `financeiro/dto/AbatimentoResumo.java` — item de histórico de abatimentos.
- `financeiro/service/AbatimentoService.java` — alocação FIFO + estorno.
- `clientes/dto/ClienteSaldoResponse.java` — saldo devedor total + por pedido/locação.
- `src/main/resources/db/migration/V9__abatimento_divida_cliente.sql` — coluna `valor_pago` + tabelas de abatimento.

> **Vocabulário (padronizado):** a entidade que representa **um débito** chama-se `Abatimento` (tabela `abatimentos`); suas linhas de distribuição chamam-se `AbatimentoParcela` (tabela `abatimento_parcela`). Não usar "PagamentoCliente" em lugar nenhum.

**Backend — modificar:**
- `financeiro/model/LancamentoFinanceiro.java` — nova coluna `valorPago`.
- `financeiro/repository/LancamentoFinanceiroRepository.java` — queries de saldo em aberto por cliente/pedido/locação; ajustar as duas queries de "recebido" para excluir `valorPago > 0`.
- `clientes/service/ClienteService.java` — método `saldoCliente(id)`.
- `clientes/controller/ClienteController.java` — `GET /{id}/saldo`, `POST /{id}/abatimentos`, `GET /{id}/abatimentos`, `POST /abatimentos/{abatimentoId}/estorno`.
- `financeiro/repository/LancamentoFinanceiroRepository.java` (relatórios) — somar abatimentos no "recebido" do período.

**Frontend — criar:**
- `features/clientes/components/cliente-abatimento-modal/` (opcional — pode ser embutido no histórico). Este plano embute no histórico para simplicidade.

**Frontend — modificar:**
- `features/clientes/models/clientes.models.ts` — interfaces de saldo/abatimento.
- `features/clientes/clientes/clientes.service.ts` — métodos `getSaldo`, `debitar`, `getAbatimentos`, `estornar`.
- `features/clientes/components/cliente-historico-modal/cliente-historico-modal.component.ts` + `.html` — nova aba "Dívida" com saldo, campo de débito e histórico de abatimentos.

---

## Modelo de dados (referência para todas as tasks)

`LancamentoFinanceiro` (existente, `financeiro/model/LancamentoFinanceiro.java`):
- `valor` (BigDecimal) — valor cheio da parcela.
- **NOVO** `valorPago` (BigDecimal, default 0) — quanto já foi abatido nesta parcela.
- `status` — `PENDENTE`/`VENCIDO`/`PAGO`/`CANCELADO`.
- `pedido` / `locacao` (ManyToOne, um dos dois) — origem da dívida.
- `dataPagamento` — setado quando a parcela é quitada (`valorPago >= valor`).

Saldo em aberto de uma parcela = `valor - valorPago` (só conta se `status IN (PENDENTE, VENCIDO)`).

`Abatimento` (novo) — **o valor total que o operador digitou**:
- `cliente` (ManyToOne), `valor` (BigDecimal, total debitado), `data` (LocalDate), `observacao` (String, nullable), `estornado` (boolean default false), `estornadoEm` (LocalDate, nullable).
- `parcelas` (OneToMany `AbatimentoParcela`).

`AbatimentoParcela` (novo) — **a distribuição desse valor pelas parcelas em aberto**:
- `abatimento` (ManyToOne), `lancamento` (ManyToOne `LancamentoFinanceiro`), `valor` (BigDecimal — quanto deste abatimento foi para este lançamento).

Invariante: `SUM(AbatimentoParcela.valor) == Abatimento.valor` para todo abatimento.

---

## Task 1: Migração de banco + campo `valorPago` no lançamento

**Files:**
- Create: `marluse/src/main/resources/db/migration/V9__abatimento_divida_cliente.sql`
- Modify: `marluse/src/main/java/com/example/marluse/financeiro/model/LancamentoFinanceiro.java`

- [ ] **Step 1: Escrever a migração**

Create `marluse/src/main/resources/db/migration/V9__abatimento_divida_cliente.sql`:

```sql
-- Abatimento de dívida do cliente: pagamento parcial de lançamentos (valor_pago)
-- + registro auditável de cada débito (abatimentos / abatimento_parcela).

ALTER TABLE lancamento_financeiros
    ADD COLUMN valor_pago DECIMAL(10,2) NOT NULL DEFAULT 0;

-- Um abatimento = um débito que o operador registrou (o valor total digitado).
CREATE TABLE abatimentos (
    id            VARCHAR(36)  NOT NULL,
    cliente_id    VARCHAR(36)  NOT NULL,
    valor         DECIMAL(10,2) NOT NULL,
    data          DATE          NOT NULL,
    observacao    VARCHAR(255)  NULL,
    estornado     BOOLEAN       NOT NULL DEFAULT FALSE,
    estornado_em  DATE          NULL,
    created_at    DATETIME      NULL,
    updated_at    DATETIME      NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_abatimento_cliente FOREIGN KEY (cliente_id) REFERENCES clientes (id)
);

-- Distribuição do abatimento pelas parcelas (SUM(valor) = abatimentos.valor).
CREATE TABLE abatimento_parcela (
    id             VARCHAR(36)  NOT NULL,
    abatimento_id  VARCHAR(36)  NOT NULL,
    lancamento_id  VARCHAR(36)  NOT NULL,
    valor          DECIMAL(10,2) NOT NULL,
    created_at     DATETIME      NULL,
    updated_at     DATETIME      NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_abatparcela_abatimento FOREIGN KEY (abatimento_id) REFERENCES abatimentos (id),
    CONSTRAINT fk_abatparcela_lancamento FOREIGN KEY (lancamento_id) REFERENCES lancamento_financeiros (id)
);
```

- [ ] **Step 2: Adicionar `valorPago` na entidade**

In `marluse/.../financeiro/model/LancamentoFinanceiro.java`, add after the `valor` field (around line 36):

```java
    @Builder.Default
    @Column(name = "valor_pago", nullable = false, precision = 10, scale = 2)
    private BigDecimal valorPago = BigDecimal.ZERO;
```

- [ ] **Step 3: Compilar**

Run: `./mvnw -q -DskipTests compile` (from `marluse/`)
Expected: BUILD SUCCESS.

- [ ] **Step 4: Commit**

```bash
git add src/main/resources/db/migration/V9__abatimento_divida_cliente.sql src/main/java/com/example/marluse/financeiro/model/LancamentoFinanceiro.java
git commit -m "feat(financeiro): campo valorPago e migração das tabelas de abatimento"
```

---

## Task 2: Entidades `Abatimento` e `AbatimentoParcela`

**Files:**
- Create: `marluse/.../financeiro/model/Abatimento.java`
- Create: `marluse/.../financeiro/model/AbatimentoParcela.java`

- [ ] **Step 1: Criar `Abatimento`**

Create `marluse/src/main/java/com/example/marluse/financeiro/model/Abatimento.java`:

```java
package com.example.marluse.financeiro.model;

import com.example.marluse.clientes.model.Cliente;
import com.example.marluse.shared.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "abatimentos")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Abatimento extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "cliente_id", nullable = false)
    private Cliente cliente;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal valor;

    @Column(nullable = false)
    private LocalDate data;

    private String observacao;

    @Builder.Default
    @Column(nullable = false)
    private boolean estornado = false;

    @Column(name = "estornado_em")
    private LocalDate estornadoEm;

    @Builder.Default
    @OneToMany(mappedBy = "abatimento", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<AbatimentoParcela> parcelas = new ArrayList<>();
}
```

- [ ] **Step 2: Criar `AbatimentoParcela`**

Create `marluse/src/main/java/com/example/marluse/financeiro/model/AbatimentoParcela.java`:

```java
package com.example.marluse.financeiro.model;

import com.example.marluse.shared.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;

@Entity
@Table(name = "abatimento_parcela")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AbatimentoParcela extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "abatimento_id", nullable = false)
    private Abatimento abatimento;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "lancamento_id", nullable = false)
    private LancamentoFinanceiro lancamento;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal valor;
}
```

- [ ] **Step 3: Compilar**

Run: `./mvnw -q -DskipTests compile`
Expected: BUILD SUCCESS.

- [ ] **Step 4: Commit**

```bash
git add src/main/java/com/example/marluse/financeiro/model/Abatimento.java src/main/java/com/example/marluse/financeiro/model/AbatimentoParcela.java
git commit -m "feat(financeiro): entidades Abatimento e AbatimentoParcela"
```

---

## Task 3: Repositórios — queries de saldo em aberto e de abatimentos em aberto

**Files:**
- Create: `marluse/.../financeiro/repository/AbatimentoRepository.java`
- Modify: `marluse/.../financeiro/repository/LancamentoFinanceiroRepository.java`

- [ ] **Step 1: Criar `AbatimentoRepository`**

Create `marluse/src/main/java/com/example/marluse/financeiro/repository/AbatimentoRepository.java`:

```java
package com.example.marluse.financeiro.repository;

import com.example.marluse.financeiro.model.Abatimento;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public interface AbatimentoRepository extends JpaRepository<Abatimento, String> {

    List<Abatimento> findByClienteIdOrderByDataDesc(String clienteId);

    /** Soma dos abatimentos (não estornados) recebidos no período — dinheiro que entrou no caixa. */
    @Query("SELECT COALESCE(SUM(a.valor), 0) FROM Abatimento a " +
           "WHERE a.estornado = false AND a.data BETWEEN :inicio AND :fim")
    BigDecimal somarAbatimentosPorPeriodo(@Param("inicio") LocalDate inicio,
                                          @Param("fim") LocalDate fim);
}
```

- [ ] **Step 2: Adicionar queries de saldo em aberto no `LancamentoFinanceiroRepository`**

In `marluse/.../financeiro/repository/LancamentoFinanceiroRepository.java`, add these methods inside the interface:

```java
    /** Lançamentos RECEITA em aberto de um cliente, ordenados: pedido/locação mais antigo primeiro,
     *  depois número da parcela. Usa a data de movimento do pedido/locação (COALESCE). */
    @Query("SELECT l FROM LancamentoFinanceiro l " +
           "LEFT JOIN l.pedido pe LEFT JOIN l.locacao lo " +
           "WHERE l.cliente.id = :clienteId AND l.tipo = 'RECEITA' " +
           "AND l.status IN ('PENDENTE','VENCIDO') " +
           "AND l.valorPago < l.valor " +
           "ORDER BY COALESCE(pe.dataMovimento, lo.dataMovimento) ASC, l.numParcelas ASC")
    List<LancamentoFinanceiro> findEmAbertoPorClienteFifo(@Param("clienteId") String clienteId);

    /** Saldo devedor total do cliente = soma de (valor - valorPago) dos lançamentos em aberto. */
    @Query("SELECT COALESCE(SUM(l.valor - l.valorPago), 0) FROM LancamentoFinanceiro l " +
           "WHERE l.cliente.id = :clienteId AND l.tipo = 'RECEITA' " +
           "AND l.status IN ('PENDENTE','VENCIDO')")
    BigDecimal saldoDevedorPorCliente(@Param("clienteId") String clienteId);
```

- [ ] **Step 3: Ajustar as queries de "recebido" para não contar lançamentos abatidos (evita dupla contagem)**

In the same repository, `somarReceitaVendasPorPagamento` and `somarReceitaLocacoesPorPagamento` (and `somarReceitaPorPeriodo`) currently count `SUM(l.valor)` for `status = 'PAGO'`. Add `AND l.valorPago = 0` so that parcelas quitadas via abatimento **não** sejam contadas aqui (elas são contadas pelos `Abatimento`). Change:

`somarReceitaVendasPorPagamento` (around line 41):

```java
    @Query("SELECT COALESCE(SUM(l.valor), 0) FROM LancamentoFinanceiro l " +
           "WHERE l.pedido IS NOT NULL AND l.status = 'PAGO' AND l.valorPago = 0 " +
           "AND l.dataPagamento BETWEEN :inicio AND :fim")
    BigDecimal somarReceitaVendasPorPagamento(@Param("inicio") LocalDate inicio,
                                              @Param("fim") LocalDate fim);
```

Apply the same `AND l.valorPago = 0` addition to `somarReceitaLocacoesPorPagamento` (around line 155) and `somarReceitaPorPeriodo` (line 37).

> NOTE: A soma dos abatimentos no "recebido" total é feita na Task 8 (integração de relatórios). Aqui só garantimos que parcelas abatidas não sejam contadas em dobro.

- [ ] **Step 4: Compilar**

Run: `./mvnw -q -DskipTests compile`
Expected: BUILD SUCCESS.

- [ ] **Step 5: Commit**

```bash
git add src/main/java/com/example/marluse/financeiro/repository/AbatimentoRepository.java src/main/java/com/example/marluse/financeiro/repository/LancamentoFinanceiroRepository.java
git commit -m "feat(financeiro): queries de saldo devedor e abatimentos"
```

---

## Task 4: DTOs de saldo e abatimento

**Files:**
- Create: `marluse/.../clientes/dto/ClienteSaldoResponse.java`
- Create: `marluse/.../financeiro/dto/AbatimentoRequest.java`
- Create: `marluse/.../financeiro/dto/AbatimentoResultado.java`
- Create: `marluse/.../financeiro/dto/AbatimentoResumo.java`

- [ ] **Step 1: `ClienteSaldoResponse`** (saldo total + por pedido/locação em aberto)

Create `marluse/src/main/java/com/example/marluse/clientes/dto/ClienteSaldoResponse.java`:

```java
package com.example.marluse.clientes.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record ClienteSaldoResponse(
        BigDecimal saldoDevedor,
        List<ItemDevido> itens
) {
    public record ItemDevido(
            String origemTipo,   // "PEDIDO" ou "LOCACAO"
            String origemId,
            Long numero,
            LocalDate data,
            BigDecimal valorTotal,
            BigDecimal valorPago,
            BigDecimal saldo
    ) {}
}
```

- [ ] **Step 2: `AbatimentoRequest`**

Create `marluse/src/main/java/com/example/marluse/financeiro/dto/AbatimentoRequest.java`:

```java
package com.example.marluse.financeiro.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

public record AbatimentoRequest(
        @NotNull(message = "Valor é obrigatório")
        @DecimalMin(value = "0.0", inclusive = false, message = "O valor deve ser maior que zero")
        BigDecimal valor,
        String observacao
) {}
```

- [ ] **Step 3: `AbatimentoResultado`**

Create `marluse/src/main/java/com/example/marluse/financeiro/dto/AbatimentoResultado.java`:

```java
package com.example.marluse.financeiro.dto;

import com.example.marluse.financeiro.model.Abatimento;

import java.math.BigDecimal;
import java.time.LocalDate;

public record AbatimentoResultado(
        String abatimentoId,
        BigDecimal valorAbatido,
        BigDecimal saldoAnterior,
        BigDecimal saldoAtual,
        LocalDate data
) {
    public static AbatimentoResultado from(Abatimento a, BigDecimal saldoAnterior, BigDecimal saldoAtual) {
        return new AbatimentoResultado(a.getId(), a.getValor(), saldoAnterior, saldoAtual, a.getData());
    }
}
```

- [ ] **Step 4: `AbatimentoResumo`** (item do histórico de abatimentos)

Create `marluse/src/main/java/com/example/marluse/financeiro/dto/AbatimentoResumo.java`:

```java
package com.example.marluse.financeiro.dto;

import com.example.marluse.financeiro.model.Abatimento;

import java.math.BigDecimal;
import java.time.LocalDate;

public record AbatimentoResumo(
        String id,
        BigDecimal valor,
        LocalDate data,
        String observacao,
        boolean estornado
) {
    public static AbatimentoResumo from(Abatimento a) {
        return new AbatimentoResumo(a.getId(), a.getValor(), a.getData(), a.getObservacao(), a.isEstornado());
    }
}
```

- [ ] **Step 5: Compilar**

Run: `./mvnw -q -DskipTests compile`
Expected: BUILD SUCCESS.

- [ ] **Step 6: Commit**

```bash
git add src/main/java/com/example/marluse/clientes/dto/ClienteSaldoResponse.java src/main/java/com/example/marluse/financeiro/dto/AbatimentoRequest.java src/main/java/com/example/marluse/financeiro/dto/AbatimentoResultado.java src/main/java/com/example/marluse/financeiro/dto/AbatimentoResumo.java
git commit -m "feat(financeiro): DTOs de saldo e abatimento"
```

---

## Task 5: `AbatimentoService` — alocação FIFO (TDD)

Esta é a task-núcleo. Escreva o teste primeiro.

**Files:**
- Create: `marluse/.../financeiro/service/AbatimentoService.java`
- Test: `marluse/src/test/java/com/example/marluse/financeiro/AbatimentoServiceTest.java`

- [ ] **Step 1: Escrever o teste que falha (FIFO completa o pedido mais antigo primeiro)**

Create `marluse/src/test/java/com/example/marluse/financeiro/AbatimentoServiceTest.java`:

```java
package com.example.marluse.financeiro;

import com.example.marluse.clientes.model.Cliente;
import com.example.marluse.clientes.repository.ClienteRepository;
import com.example.marluse.financeiro.dto.AbatimentoRequest;
import com.example.marluse.financeiro.dto.AbatimentoResultado;
import com.example.marluse.financeiro.enums.StatusLancamento;
import com.example.marluse.financeiro.enums.TipoLancamento;
import com.example.marluse.financeiro.model.LancamentoFinanceiro;
import com.example.marluse.financeiro.repository.LancamentoFinanceiroRepository;
import com.example.marluse.financeiro.service.AbatimentoService;
import com.example.marluse.vendas.enums.FormaPagamento;
import com.example.marluse.vendas.enums.StatusPedido;
import com.example.marluse.vendas.model.Pedido;
import com.example.marluse.vendas.repository.PedidoRepository;
import jakarta.transaction.Transactional;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import java.math.BigDecimal;
import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
public class AbatimentoServiceTest {

    @Autowired private AbatimentoService abatimentoService;
    @Autowired private LancamentoFinanceiroRepository lancamentoRepository;
    @Autowired private PedidoRepository pedidoRepository;
    @Autowired private ClienteRepository clienteRepository;

    private Cliente novoCliente() {
        return clienteRepository.save(Cliente.builder().nome("Fulano").ativo(true).consumidorFinal(false).build());
    }

    private Pedido novoPedido(Cliente c, long numero, LocalDate dataMovimento, String valor) {
        return pedidoRepository.save(Pedido.builder()
                .numero(numero).cliente(c).status(StatusPedido.CONFIRMADO)
                .formaPagamento(FormaPagamento.FIADO)
                .valorTotal(new BigDecimal(valor))
                .dataMovimento(dataMovimento).build());
    }

    private LancamentoFinanceiro parcela(Cliente c, Pedido p, String valor, LocalDate venc) {
        return lancamentoRepository.save(LancamentoFinanceiro.builder()
                .tipo(TipoLancamento.RECEITA).categoria("Venda").descricao("Pedido")
                .valor(new BigDecimal(valor)).valorPago(BigDecimal.ZERO)
                .status(StatusLancamento.PENDENTE).dataVencimento(venc)
                .cliente(c).pedido(p).numParcelas(1).totalParcelas(1).build());
    }

    @Test
    void debitoAbateDoPedidoMaisAntigoAteCompletar() {
        Cliente c = novoCliente();
        Pedido antigo = novoPedido(c, 1L, LocalDate.of(2026, 1, 10), "300.00");
        Pedido novo   = novoPedido(c, 2L, LocalDate.of(2026, 2, 10), "700.00");
        LancamentoFinanceiro lancAntigo = parcela(c, antigo, "300.00", LocalDate.of(2026, 1, 10));
        LancamentoFinanceiro lancNovo   = parcela(c, novo,   "700.00", LocalDate.of(2026, 2, 10));

        // Dívida total = 1000. Debita 100 → deve abater só do pedido mais antigo.
        AbatimentoResultado r = abatimentoService.debitar(c.getId(),
                new AbatimentoRequest(new BigDecimal("100.00"), null));

        assertEquals(0, new BigDecimal("1000.00").compareTo(r.saldoAnterior()));
        assertEquals(0, new BigDecimal("900.00").compareTo(r.saldoAtual()));

        LancamentoFinanceiro a = lancamentoRepository.findById(lancAntigo.getId()).orElseThrow();
        LancamentoFinanceiro n = lancamentoRepository.findById(lancNovo.getId()).orElseThrow();
        assertEquals(0, new BigDecimal("100.00").compareTo(a.getValorPago()));
        assertEquals(StatusLancamento.PENDENTE, a.getStatus());   // ainda não quitado
        assertEquals(0, BigDecimal.ZERO.compareTo(n.getValorPago())); // pedido novo intocado
    }

    @Test
    void debitoTransbordaParaOProximoPedidoAoQuitarOAtual() {
        Cliente c = novoCliente();
        Pedido antigo = novoPedido(c, 1L, LocalDate.of(2026, 1, 10), "300.00");
        Pedido novo   = novoPedido(c, 2L, LocalDate.of(2026, 2, 10), "700.00");
        LancamentoFinanceiro lancAntigo = parcela(c, antigo, "300.00", LocalDate.of(2026, 1, 10));
        LancamentoFinanceiro lancNovo   = parcela(c, novo,   "700.00", LocalDate.of(2026, 2, 10));

        // Debita 500 → quita os 300 do antigo e sobra 200 no novo.
        abatimentoService.debitar(c.getId(), new AbatimentoRequest(new BigDecimal("500.00"), null));

        LancamentoFinanceiro a = lancamentoRepository.findById(lancAntigo.getId()).orElseThrow();
        LancamentoFinanceiro n = lancamentoRepository.findById(lancNovo.getId()).orElseThrow();
        assertEquals(StatusLancamento.PAGO, a.getStatus());
        assertEquals(0, new BigDecimal("300.00").compareTo(a.getValorPago()));
        assertNotNull(a.getDataPagamento());
        assertEquals(StatusLancamento.PENDENTE, n.getStatus());
        assertEquals(0, new BigDecimal("200.00").compareTo(n.getValorPago()));
    }

    @Test
    void debitoMaiorQueDividaEhRejeitado() {
        Cliente c = novoCliente();
        Pedido p = novoPedido(c, 1L, LocalDate.of(2026, 1, 10), "300.00");
        parcela(c, p, "300.00", LocalDate.of(2026, 1, 10));

        assertThrows(IllegalArgumentException.class, () ->
                abatimentoService.debitar(c.getId(), new AbatimentoRequest(new BigDecimal("400.00"), null)));
    }
}
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `./mvnw -Dtest=AbatimentoServiceTest test`
Expected: FAIL — `AbatimentoService` não existe / não compila.

- [ ] **Step 3: Implementar `AbatimentoService`**

Create `marluse/src/main/java/com/example/marluse/financeiro/service/AbatimentoService.java`:

```java
package com.example.marluse.financeiro.service;

import com.example.marluse.clientes.model.Cliente;
import com.example.marluse.clientes.repository.ClienteRepository;
import com.example.marluse.financeiro.dto.AbatimentoRequest;
import com.example.marluse.financeiro.dto.AbatimentoResultado;
import com.example.marluse.financeiro.dto.AbatimentoResumo;
import com.example.marluse.financeiro.enums.StatusLancamento;
import com.example.marluse.financeiro.model.Abatimento;
import com.example.marluse.financeiro.model.AbatimentoParcela;
import com.example.marluse.financeiro.model.LancamentoFinanceiro;
import com.example.marluse.financeiro.repository.AbatimentoRepository;
import com.example.marluse.financeiro.repository.LancamentoFinanceiroRepository;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Service
@RequiredArgsConstructor
public class AbatimentoService {

    private final ClienteRepository clienteRepository;
    private final LancamentoFinanceiroRepository lancamentoRepository;
    private final AbatimentoRepository abatimentoRepository;

    @Transactional
    public AbatimentoResultado debitar(String clienteId, AbatimentoRequest request) {
        Cliente cliente = clienteRepository.findById(clienteId)
                .orElseThrow(() -> new EntityNotFoundException("Cliente não encontrado"));

        BigDecimal saldoAnterior = lancamentoRepository.saldoDevedorPorCliente(clienteId);
        BigDecimal valor = request.valor();

        if (valor.compareTo(saldoAnterior) > 0) {
            throw new IllegalArgumentException(
                    "Valor do débito (" + valor + ") maior que a dívida do cliente (" + saldoAnterior + ")");
        }

        Abatimento abatimento = Abatimento.builder()
                .cliente(cliente)
                .valor(valor)
                .data(LocalDate.now())
                .observacao(request.observacao())
                .estornado(false)
                .build();

        // Alocação FIFO: pedido/locação mais antigo primeiro, completando cada parcela antes de passar.
        List<LancamentoFinanceiro> emAberto = lancamentoRepository.findEmAbertoPorClienteFifo(clienteId);
        BigDecimal restante = valor;

        for (LancamentoFinanceiro lanc : emAberto) {
            if (restante.signum() <= 0) break;

            BigDecimal saldoParcela = lanc.getValor().subtract(lanc.getValorPago());
            if (saldoParcela.signum() <= 0) continue;

            BigDecimal aplicar = restante.min(saldoParcela);
            lanc.setValorPago(lanc.getValorPago().add(aplicar));

            if (lanc.getValorPago().compareTo(lanc.getValor()) >= 0) {
                lanc.setStatus(StatusLancamento.PAGO);
                lanc.setDataPagamento(abatimento.getData());
            }
            lancamentoRepository.save(lanc);

            abatimento.getParcelas().add(AbatimentoParcela.builder()
                    .abatimento(abatimento)
                    .lancamento(lanc)
                    .valor(aplicar)
                    .build());

            restante = restante.subtract(aplicar);
        }

        abatimentoRepository.save(abatimento);

        BigDecimal saldoAtual = lancamentoRepository.saldoDevedorPorCliente(clienteId);
        return AbatimentoResultado.from(abatimento, saldoAnterior, saldoAtual);
    }

    public List<AbatimentoResumo> listarAbatimentos(String clienteId) {
        return abatimentoRepository.findByClienteIdOrderByDataDesc(clienteId)
                .stream().map(AbatimentoResumo::from).toList();
    }

    @Transactional
    public void estornar(String abatimentoId) {
        Abatimento abatimento = abatimentoRepository.findById(abatimentoId)
                .orElseThrow(() -> new EntityNotFoundException("Abatimento não encontrado"));

        if (abatimento.isEstornado()) {
            throw new IllegalArgumentException("Abatimento já estornado");
        }

        for (AbatimentoParcela parcela : abatimento.getParcelas()) {
            LancamentoFinanceiro lanc = parcela.getLancamento();
            lanc.setValorPago(lanc.getValorPago().subtract(parcela.getValor()));
            if (lanc.getStatus() == StatusLancamento.PAGO
                    && lanc.getValorPago().compareTo(lanc.getValor()) < 0) {
                lanc.setStatus(statusDeReabertura(lanc));
                lanc.setDataPagamento(null);
            }
            lancamentoRepository.save(lanc);
        }

        abatimento.setEstornado(true);
        abatimento.setEstornadoEm(LocalDate.now());
        abatimentoRepository.save(abatimento);
    }

    /** Ao reabrir uma parcela quitada, respeita o vencimento: se já passou, volta como VENCIDO.
     *  Sem isso a parcela voltaria sempre como PENDENTE e só seria reclassificada no próximo
     *  ciclo do scheduler de vencidos. */
    private StatusLancamento statusDeReabertura(LancamentoFinanceiro lanc) {
        return lanc.getDataVencimento() != null && lanc.getDataVencimento().isBefore(LocalDate.now())
                ? StatusLancamento.VENCIDO
                : StatusLancamento.PENDENTE;
    }
}
```

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `./mvnw -Dtest=AbatimentoServiceTest test`
Expected: PASS (3 testes).

- [ ] **Step 5: Commit**

```bash
git add src/main/java/com/example/marluse/financeiro/service/AbatimentoService.java src/test/java/com/example/marluse/financeiro/AbatimentoServiceTest.java
git commit -m "feat(financeiro): AbatimentoService com alocação FIFO da dívida"
```

---

## Task 6: Teste de estorno (TDD)

**Files:**
- Test: `marluse/src/test/java/com/example/marluse/financeiro/AbatimentoServiceTest.java` (adicionar teste)

- [ ] **Step 1: Adicionar os testes de estorno**

São **dois** testes, porque a reabertura depende do vencimento: parcela vencida volta como `VENCIDO`, parcela a vencer volta como `PENDENTE`. Use datas relativas a `LocalDate.now()` para o teste não quebrar com o passar do tempo.

Add to `AbatimentoServiceTest.java`:

```java
    @Test
    void estornoDesfazAlocacaoEReabreParcelaVencida() {
        Cliente c = novoCliente();
        LocalDate vencidoOntem = LocalDate.now().minusDays(1);
        Pedido p = novoPedido(c, 1L, LocalDate.now().minusMonths(2), "300.00");
        LancamentoFinanceiro lanc = parcela(c, p, "300.00", vencidoOntem);

        AbatimentoResultado r = abatimentoService.debitar(c.getId(),
                new AbatimentoRequest(new BigDecimal("300.00"), null));
        // parcela quitada
        assertEquals(StatusLancamento.PAGO,
                lancamentoRepository.findById(lanc.getId()).orElseThrow().getStatus());

        abatimentoService.estornar(r.abatimentoId());

        LancamentoFinanceiro reaberto = lancamentoRepository.findById(lanc.getId()).orElseThrow();
        assertEquals(StatusLancamento.VENCIDO, reaberto.getStatus());  // vencimento já passou
        assertEquals(0, BigDecimal.ZERO.compareTo(reaberto.getValorPago()));
        assertNull(reaberto.getDataPagamento());
        assertEquals(0, new BigDecimal("300.00").compareTo(lancamentoRepository.saldoDevedorPorCliente(c.getId())));
    }

    @Test
    void estornoReabreComoPendenteQuandoAindaNaoVenceu() {
        Cliente c = novoCliente();
        LocalDate venceDaquiUmMes = LocalDate.now().plusMonths(1);
        Pedido p = novoPedido(c, 1L, LocalDate.now(), "300.00");
        LancamentoFinanceiro lanc = parcela(c, p, "300.00", venceDaquiUmMes);

        AbatimentoResultado r = abatimentoService.debitar(c.getId(),
                new AbatimentoRequest(new BigDecimal("300.00"), null));
        abatimentoService.estornar(r.abatimentoId());

        assertEquals(StatusLancamento.PENDENTE,
                lancamentoRepository.findById(lanc.getId()).orElseThrow().getStatus());
    }

    @Test
    void estornoDuplicadoEhRejeitado() {
        Cliente c = novoCliente();
        Pedido p = novoPedido(c, 1L, LocalDate.now(), "300.00");
        parcela(c, p, "300.00", LocalDate.now().plusMonths(1));

        AbatimentoResultado r = abatimentoService.debitar(c.getId(),
                new AbatimentoRequest(new BigDecimal("100.00"), null));
        abatimentoService.estornar(r.abatimentoId());

        assertThrows(IllegalArgumentException.class, () -> abatimentoService.estornar(r.abatimentoId()));
    }
```

- [ ] **Step 2: Rodar e ver passar**

Run: `./mvnw -Dtest=AbatimentoServiceTest test`
Expected: PASS (6 testes). Se `estornoDesfazAlocacaoEReabreParcelaVencida` falhar com `expected VENCIDO but was PENDENTE`, o helper `statusDeReabertura` da Task 5 não foi aplicado.

- [ ] **Step 3: Commit**

```bash
git add src/test/java/com/example/marluse/financeiro/AbatimentoServiceTest.java
git commit -m "test(financeiro): estorno reabre a parcela respeitando o vencimento"
```

---

## Task 7: Saldo do cliente no `ClienteService` + endpoints no controller

**Files:**
- Modify: `marluse/.../clientes/service/ClienteService.java`
- Modify: `marluse/.../clientes/controller/ClienteController.java`
- Test: `marluse/src/test/java/com/example/marluse/clientes/ClienteServiceTest.java` (adicionar teste de saldo)

- [ ] **Step 1: Escrever o teste de `saldoCliente`**

Add to `marluse/src/test/java/com/example/marluse/clientes/ClienteServiceTest.java` (siga o padrão de setup já existente na classe; injete `LancamentoFinanceiroRepository` e `PedidoRepository` se ainda não estiverem):

```java
    @Test
    void saldoClienteSomaLancamentosEmAbertoPorPedido() {
        // Arrange: cliente com um pedido FIADO de 300 (parcela PENDENTE)
        var cliente = clienteRepository.save(
                com.example.marluse.clientes.model.Cliente.builder()
                        .nome("Devedor").ativo(true).consumidorFinal(false).build());
        var pedido = pedidoRepository.save(
                com.example.marluse.vendas.model.Pedido.builder()
                        .numero(1L).cliente(cliente)
                        .status(com.example.marluse.vendas.enums.StatusPedido.CONFIRMADO)
                        .formaPagamento(com.example.marluse.vendas.enums.FormaPagamento.FIADO)
                        .valorTotal(new java.math.BigDecimal("300.00"))
                        .dataMovimento(java.time.LocalDate.of(2026, 1, 10)).build());
        lancamentoRepository.save(
                com.example.marluse.financeiro.model.LancamentoFinanceiro.builder()
                        .tipo(com.example.marluse.financeiro.enums.TipoLancamento.RECEITA)
                        .categoria("Venda").descricao("Pedido")
                        .valor(new java.math.BigDecimal("300.00")).valorPago(java.math.BigDecimal.ZERO)
                        .status(com.example.marluse.financeiro.enums.StatusLancamento.PENDENTE)
                        .dataVencimento(java.time.LocalDate.of(2026, 1, 10))
                        .cliente(cliente).pedido(pedido).numParcelas(1).totalParcelas(1).build());

        // Act
        var saldo = clienteService.saldoCliente(cliente.getId());

        // Assert
        assertEquals(0, new java.math.BigDecimal("300.00").compareTo(saldo.saldoDevedor()));
        assertEquals(1, saldo.itens().size());
        assertEquals("PEDIDO", saldo.itens().get(0).origemTipo());
        assertEquals(0, new java.math.BigDecimal("300.00").compareTo(saldo.itens().get(0).saldo()));
    }
```

> Se a classe de teste ainda não tem os repositórios/`import static assertEquals`, adicione: `@Autowired private LancamentoFinanceiroRepository lancamentoRepository;`, `@Autowired private PedidoRepository pedidoRepository;`, `@Autowired private ClienteRepository clienteRepository;` e `import static org.junit.jupiter.api.Assertions.*;`.

- [ ] **Step 2: Rodar e ver falhar**

Run: `./mvnw -Dtest=ClienteServiceTest test`
Expected: FAIL — `saldoCliente` não existe.

- [ ] **Step 3: Implementar `saldoCliente` no `ClienteService`**

In `marluse/.../clientes/service/ClienteService.java`, inject the lançamento repo (add `private final LancamentoFinanceiroRepository lancamentoRepository;` to the fields — it is already available in the `financeiro` package) and add:

```java
    public ClienteSaldoResponse saldoCliente(String id) {
        Cliente cliente = clienteRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Cliente não encontrado"));

        BigDecimal saldoDevedor = lancamentoRepository.saldoDevedorPorCliente(cliente.getId());

        List<ClienteSaldoResponse.ItemDevido> itens =
                lancamentoRepository.findEmAbertoPorClienteFifo(cliente.getId()).stream()
                        .map(l -> {
                            boolean ehPedido = l.getPedido() != null;
                            var origem = ehPedido ? l.getPedido() : null;
                            var loc = l.getLocacao();
                            return new ClienteSaldoResponse.ItemDevido(
                                    ehPedido ? "PEDIDO" : "LOCACAO",
                                    ehPedido ? l.getPedido().getId() : (loc != null ? loc.getId() : null),
                                    ehPedido ? l.getPedido().getNumero() : (loc != null ? loc.getNumero() : null),
                                    ehPedido ? l.getPedido().getDataMovimento() : (loc != null ? loc.getDataMovimento() : null),
                                    l.getValor(),
                                    l.getValorPago(),
                                    l.getValor().subtract(l.getValorPago())
                            );
                        })
                        .toList();

        return new ClienteSaldoResponse(saldoDevedor, itens);
    }
```

Add imports: `com.example.marluse.clientes.dto.ClienteSaldoResponse;` and `com.example.marluse.financeiro.repository.LancamentoFinanceiroRepository;`.

> NOTA: `findEmAbertoPorClienteFifo` retorna uma linha por **parcela** em aberto. Se um pedido parcelado tiver várias parcelas em aberto, aparecerão várias linhas com o mesmo `numero`. Para o MVP isto é aceitável (cada linha mostra a parcela). Agrupar por pedido é uma melhoria futura fora de escopo.

- [ ] **Step 4: Rodar e ver passar**

Run: `./mvnw -Dtest=ClienteServiceTest test`
Expected: PASS.

- [ ] **Step 5: Adicionar endpoints no `ClienteController`**

In `marluse/.../clientes/controller/ClienteController.java`, inject `AbatimentoService` (add `private final AbatimentoService abatimentoService;` — the class already uses `@RequiredArgsConstructor`) and add:

```java
    @GetMapping("/{id}/saldo")
    public ResponseEntity<ApiResponse<ClienteSaldoResponse>> saldo(@PathVariable String id) {
        return ResponseEntity.ok(ApiResponse.ok(clienteService.saldoCliente(id)));
    }

    @PostMapping("/{id}/abatimentos")
    public ResponseEntity<ApiResponse<AbatimentoResultado>> debitar(
            @PathVariable String id, @Valid @RequestBody AbatimentoRequest request) {
        return ResponseEntity.ok(ApiResponse.ok("Débito registrado com sucesso",
                abatimentoService.debitar(id, request)));
    }

    @GetMapping("/{id}/abatimentos")
    public ResponseEntity<ApiResponse<List<AbatimentoResumo>>> listarAbatimentos(@PathVariable String id) {
        return ResponseEntity.ok(ApiResponse.ok(abatimentoService.listarAbatimentos(id)));
    }

    @PostMapping("/abatimentos/{abatimentoId}/estorno")
    public ResponseEntity<ApiResponse<Void>> estornar(@PathVariable String abatimentoId) {
        abatimentoService.estornar(abatimentoId);
        return ResponseEntity.ok(ApiResponse.ok("Abatimento estornado com sucesso", null));
    }
```

Add imports: `ClienteSaldoResponse`, `com.example.marluse.financeiro.dto.AbatimentoRequest`, `AbatimentoResultado`, `AbatimentoResumo`, `com.example.marluse.financeiro.service.AbatimentoService`.

- [ ] **Step 6: Compilar e rodar a suíte de clientes**

Run: `./mvnw -Dtest=ClienteServiceTest test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/main/java/com/example/marluse/clientes/service/ClienteService.java src/main/java/com/example/marluse/clientes/controller/ClienteController.java src/test/java/com/example/marluse/clientes/ClienteServiceTest.java
git commit -m "feat(clientes): endpoint de saldo devedor e abatimentos"
```

---

## Task 8: Integração com o caixa/relatórios (abatimentos entram no recebido)

O usuário confirmou que o valor abatido entra no caixa na data do abatimento. As parcelas abatidas já foram excluídas das somas por `valor` (Task 3, Step 3). Agora somamos os abatimentos onde o "recebido" é calculado.

**Files:**
- Modify: `marluse/.../financeiro/service/LancamentoFinanceiroService.java` (ou o service que monta o resumo/relatório de recebidos)
- Test: `marluse/src/test/java/com/example/marluse/financeiro/AbatimentoCaixaTest.java`

- [ ] **Step 1: Localizar onde o "recebido do dia/período" é somado**

Run: `grep -rn "somarReceitaPorPeriodo\|somarReceitaVendasPorPagamento\|somarPorTipoEData\|resumoDia" marluse/src/main/java` (from repo root)
Expected: identifica `LancamentoFinanceiroService.resumoDia()` e os serviços de relatórios que chamam as queries de receita. Leia esses métodos antes do próximo passo.

- [ ] **Step 2: Escrever o teste de caixa**

Create `marluse/src/test/java/com/example/marluse/financeiro/AbatimentoCaixaTest.java`:

```java
package com.example.marluse.financeiro;

import com.example.marluse.clientes.model.Cliente;
import com.example.marluse.clientes.repository.ClienteRepository;
import com.example.marluse.financeiro.dto.AbatimentoRequest;
import com.example.marluse.financeiro.enums.StatusLancamento;
import com.example.marluse.financeiro.enums.TipoLancamento;
import com.example.marluse.financeiro.model.LancamentoFinanceiro;
import com.example.marluse.financeiro.repository.AbatimentoRepository;
import com.example.marluse.financeiro.repository.LancamentoFinanceiroRepository;
import com.example.marluse.financeiro.service.AbatimentoService;
import com.example.marluse.vendas.enums.FormaPagamento;
import com.example.marluse.vendas.enums.StatusPedido;
import com.example.marluse.vendas.model.Pedido;
import com.example.marluse.vendas.repository.PedidoRepository;
import jakarta.transaction.Transactional;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import java.math.BigDecimal;
import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.assertEquals;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
public class AbatimentoCaixaTest {

    @Autowired private AbatimentoService abatimentoService;
    @Autowired private LancamentoFinanceiroRepository lancamentoRepository;
    @Autowired private AbatimentoRepository abatimentoRepository;
    @Autowired private PedidoRepository pedidoRepository;
    @Autowired private ClienteRepository clienteRepository;

    @Test
    void abatimentoParcialContaComoRecebidoNoDiaSemDuplicar() {
        Cliente c = clienteRepository.save(Cliente.builder().nome("X").ativo(true).consumidorFinal(false).build());
        Pedido p = pedidoRepository.save(Pedido.builder().numero(1L).cliente(c)
                .status(StatusPedido.CONFIRMADO).formaPagamento(FormaPagamento.FIADO)
                .valorTotal(new BigDecimal("300.00")).dataMovimento(LocalDate.now()).build());
        lancamentoRepository.save(LancamentoFinanceiro.builder()
                .tipo(TipoLancamento.RECEITA).categoria("Venda").descricao("Pedido")
                .valor(new BigDecimal("300.00")).valorPago(BigDecimal.ZERO)
                .status(StatusLancamento.PENDENTE).dataVencimento(LocalDate.now())
                .cliente(c).pedido(p).numParcelas(1).totalParcelas(1).build());

        abatimentoService.debitar(c.getId(), new AbatimentoRequest(new BigDecimal("100.00"), null));

        LocalDate hoje = LocalDate.now();
        BigDecimal abatidoHoje = abatimentoRepository.somarAbatimentosPorPeriodo(hoje, hoje);
        BigDecimal receitaVendasHoje = lancamentoRepository.somarReceitaVendasPorPagamento(hoje, hoje);

        assertEquals(0, new BigDecimal("100.00").compareTo(abatidoHoje));
        // A parcela abatida (valorPago>0) NÃO conta na soma por valor → sem duplicação.
        assertEquals(0, BigDecimal.ZERO.compareTo(receitaVendasHoje));
    }
}
```

- [ ] **Step 3: Rodar e ver passar (valida a não-duplicação da Task 3)**

Run: `./mvnw -Dtest=AbatimentoCaixaTest test`
Expected: PASS. Isto confirma que a exclusão `valorPago = 0` funciona.

- [ ] **Step 4: Somar abatimentos no "recebido" do resumo/relatório**

No método que calcula o total recebido no período (identificado no Step 1 — tipicamente onde `somarReceitaPorPeriodo`/`somarReceitaVendasPorPagamento` é usado para compor o "recebido"), adicione `abatimentoRepository.somarAbatimentosPorPeriodo(inicio, fim)` ao total. Injete `AbatimentoRepository` no service via construtor (`@RequiredArgsConstructor`).

Exemplo (ajuste ao método real): se existe

```java
BigDecimal recebido = lancamentoRepository.somarReceitaPorPeriodo(inicio, fim);
```

passa a ser

```java
BigDecimal recebido = lancamentoRepository.somarReceitaPorPeriodo(inicio, fim)
        .add(abatimentoRepository.somarAbatimentosPorPeriodo(inicio, fim));
```

> Se o resumo separa Venda x Locação, some os abatimentos no total geral de recebidos (não temos como atribuir um abatimento único a venda ou locação quando ele cruza os dois). Documente isto como limitação: **abatimentos entram no "Recebido" total, não na quebra por categoria.**

- [ ] **Step 5: Rodar a suíte financeira inteira (regressão)**

Run: `./mvnw -Dtest="com.example.marluse.financeiro.*" test`
Expected: PASS (incluindo `LancamentoServiceTest` existente — confirmar que o `AND l.valorPago = 0` não quebrou os cenários à-vista, onde `valorPago` é 0).

- [ ] **Step 6: Commit**

```bash
git add src/main/java/com/example/marluse/financeiro/service/LancamentoFinanceiroService.java src/test/java/com/example/marluse/financeiro/AbatimentoCaixaTest.java
git commit -m "feat(financeiro): abatimentos entram no recebido do período sem duplicar"
```

---

## Task 9: Frontend — models e service

**Files:**
- Modify: `marluse-frontend/src/app/features/clientes/models/clientes.models.ts`
- Modify: `marluse-frontend/src/app/features/clientes/clientes/clientes.service.ts`

- [ ] **Step 1: Adicionar interfaces em `clientes.models.ts`**

Append to `marluse-frontend/src/app/features/clientes/models/clientes.models.ts`:

```typescript
export interface ItemDevido {
  origemTipo: 'PEDIDO' | 'LOCACAO';
  origemId: string;
  numero: number;
  data: string;
  valorTotal: number;
  valorPago: number;
  saldo: number;
}

export interface ClienteSaldoResponse {
  saldoDevedor: number;
  itens: ItemDevido[];
}

export interface AbatimentoRequest {
  valor: number;
  observacao?: string;
}

export interface AbatimentoResultado {
  abatimentoId: string;
  valorAbatido: number;
  saldoAnterior: number;
  saldoAtual: number;
  data: string;
}

export interface AbatimentoResumo {
  id: string;
  valor: number;
  data: string;
  observacao: string | null;
  estornado: boolean;
}
```

- [ ] **Step 2: Adicionar métodos no `ClientesService`**

In `marluse-frontend/src/app/features/clientes/clientes/clientes.service.ts`, add the new imports to the existing import block and add these methods inside the class:

```typescript
  getSaldo(id: string): Observable<ClienteSaldoResponse> {
    return this.http.get<{ data: ClienteSaldoResponse }>(`${this.baseUrl}/${id}/saldo`).pipe(map(r => r.data));
  }

  debitar(id: string, request: AbatimentoRequest): Observable<AbatimentoResultado> {
    return this.http.post<{ data: AbatimentoResultado }>(`${this.baseUrl}/${id}/abatimentos`, request).pipe(map(r => r.data));
  }

  getAbatimentos(id: string): Observable<AbatimentoResumo[]> {
    return this.http.get<{ data: AbatimentoResumo[] }>(`${this.baseUrl}/${id}/abatimentos`).pipe(map(r => r.data));
  }

  estornarAbatimento(abatimentoId: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/abatimentos/${abatimentoId}/estorno`, {});
  }
```

Imports to add: `ClienteSaldoResponse, AbatimentoRequest, AbatimentoResultado, AbatimentoResumo` in the `from '../models/clientes.models'` block.

- [ ] **Step 3: Build check**

Run: `npm run build` (from `marluse-frontend/`) — ou confie no HMR do dev server na Task 11.
Expected: sem erros de tipo.

- [ ] **Step 4: Commit**

```bash
git add src/app/features/clientes/models/clientes.models.ts src/app/features/clientes/clientes/clientes.service.ts
git commit -m "feat(clientes): models e service de saldo/abatimento"
```

---

## Task 10: Frontend — aba "Dívida" no histórico (saldo + débito + histórico)

**Files:**
- Modify: `marluse-frontend/.../cliente-historico-modal/cliente-historico-modal.component.ts`
- Modify: `marluse-frontend/.../cliente-historico-modal/cliente-historico-modal.component.html`

- [ ] **Step 1: Estender o componente TS**

In `cliente-historico-modal.component.ts`:

1. Change the `Tab` type: `type Tab = 'vendas' | 'locacoes' | 'divida';`
2. Add imports: `import { FormsModule } from '@angular/forms';` and add `FormsModule` to the component's `imports` array. Import the models `ClienteSaldoResponse, AbatimentoResumo`.
3. Add state and methods:

```typescript
  saldo: ClienteSaldoResponse | null = null;
  abatimentos: AbatimentoResumo[] = [];
  valorDebito: number | null = null;
  debitando = false;
  erroDebito = '';

  private carregarSaldo(id: string): void {
    this.clientesService.getSaldo(id).subscribe({ next: s => this.saldo = s });
    this.clientesService.getAbatimentos(id).subscribe({ next: a => this.abatimentos = a });
  }

  debitar(): void {
    if (!this.cliente || !this.valorDebito || this.valorDebito <= 0) { return; }
    this.erroDebito = '';
    this.debitando = true;
    this.clientesService.debitar(this.cliente.id, { valor: this.valorDebito }).subscribe({
      next: () => {
        this.debitando = false;
        this.valorDebito = null;
        this.carregarSaldo(this.cliente!.id);
      },
      error: err => {
        this.debitando = false;
        this.erroDebito = err?.error?.message ?? 'Não foi possível registrar o débito';
      },
    });
  }

  estornar(abatimentoId: string): void {
    if (!this.cliente) { return; }
    this.clientesService.estornarAbatimento(abatimentoId).subscribe({
      next: () => this.carregarSaldo(this.cliente!.id),
    });
  }
```

4. In `carregarHistorico(...)` (or `ngOnChanges`), also call `this.carregarSaldo(id);` when a cliente is loaded, and reset `this.saldo = null; this.abatimentos = []; this.valorDebito = null; this.erroDebito = '';` when cliente is cleared.

- [ ] **Step 2: Adicionar o botão da aba "Dívida" no HTML**

In `cliente-historico-modal.component.html`, after the "Locações" tab button (line ~57), add a third tab button following the same pattern, showing the saldo devedor as badge:

```html
      <button type="button"
        (click)="tabAtiva = 'divida'"
        class="px-4 py-2 text-[13px] font-medium border-b-2 transition-colors -mb-px"
        [class.border-blue-600]="tabAtiva === 'divida'"
        [class.text-blue-600]="tabAtiva === 'divida'"
        [class.border-transparent]="tabAtiva !== 'divida'"
        [class.text-gray-500]="tabAtiva !== 'divida'"
        [class.hover:text-gray-700]="tabAtiva !== 'divida'">
        <i class="pi pi-wallet mr-1.5 text-xs"></i>
        Dívida
        @if (saldo && saldo.saldoDevedor > 0) {
          <span class="ml-1.5 text-[11px] font-semibold px-1.5 py-0.5 rounded-full bg-red-100 text-red-600">
            {{ formatCurrency(saldo.saldoDevedor) }}
          </span>
        }
      </button>
```

- [ ] **Step 3: Adicionar o conteúdo da aba "Dívida"**

In the content area (`@else if (historico)` block), after the Locações section, add:

```html
        <!-- Aba Dívida -->
        @if (tabAtiva === 'divida') {
          <!-- Resumo do saldo -->
          <div class="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3 mb-4"
               [class.bg-red-50]="saldo && saldo.saldoDevedor > 0"
               [class.bg-emerald-50]="!saldo || saldo.saldoDevedor <= 0">
            <span class="text-[13px] font-medium text-gray-600">Saldo devedor</span>
            <span class="text-[16px] font-bold font-mono"
                  [class.text-red-600]="saldo && saldo.saldoDevedor > 0"
                  [class.text-emerald-600]="!saldo || saldo.saldoDevedor <= 0">
              {{ formatCurrency(saldo?.saldoDevedor ?? 0) }}
            </span>
          </div>

          @if (saldo && saldo.saldoDevedor > 0) {
            <!-- Campo de débito -->
            <div class="flex items-end gap-2 mb-2">
              <div class="flex-1">
                <label class="block text-[11px] font-semibold text-gray-400 uppercase tracking-[0.06em] mb-1">Debitar valor</label>
                <input type="number" min="0.01" step="0.01" [(ngModel)]="valorDebito"
                       [max]="saldo.saldoDevedor" placeholder="0,00"
                       class="w-full text-[13px] px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500" />
              </div>
              <button type="button" (click)="debitar()" [disabled]="debitando || !valorDebito || valorDebito <= 0"
                      class="px-4 py-2 text-[13px] font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors cursor-pointer">
                {{ debitando ? 'Debitando...' : 'Debitar' }}
              </button>
            </div>
            @if (erroDebito) {
              <p class="text-[12px] text-red-600 mb-3">{{ erroDebito }}</p>
            }
            <p class="text-[11px] text-gray-400 mb-4">O valor é abatido do pedido/locação mais antigo até completá-lo.</p>

            <!-- Itens em aberto -->
            <div class="border border-slate-200 rounded-lg overflow-hidden mb-4">
              <div class="grid grid-cols-[1fr_100px_108px] gap-2 bg-slate-50 border-b border-slate-200 px-3 py-[7px]">
                <div class="text-[10.5px] font-semibold text-gray-400 uppercase tracking-[0.06em]">Origem</div>
                <div class="text-[10.5px] font-semibold text-gray-400 uppercase tracking-[0.06em]">Data</div>
                <div class="text-[10.5px] font-semibold text-gray-400 uppercase tracking-[0.06em] text-right">Em aberto</div>
              </div>
              @for (it of saldo.itens; track it.origemId; let last = $last) {
                <div class="grid grid-cols-[1fr_100px_108px] gap-2 items-center px-3 py-[10px]"
                     [class.border-b]="!last" [class.border-slate-100]="!last">
                  <span class="text-[12px] text-gray-600">{{ it.origemTipo === 'PEDIDO' ? 'Pedido' : 'Locação' }} #{{ it.numero }}</span>
                  <span class="text-[12px] text-gray-500">{{ formatDate(it.data) }}</span>
                  <span class="text-[13px] font-semibold text-gray-800 font-mono text-right">{{ formatCurrency(it.saldo) }}</span>
                </div>
              }
            </div>
          }

          <!-- Histórico de abatimentos -->
          @if (abatimentos.length > 0) {
            <p class="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.06em] mb-2">Abatimentos</p>
            <div class="border border-slate-200 rounded-lg overflow-hidden">
              @for (ab of abatimentos; track ab.id; let last = $last) {
                <div class="grid grid-cols-[100px_1fr_auto] gap-2 items-center px-3 py-[10px]"
                     [class.border-b]="!last" [class.border-slate-100]="!last"
                     [class.opacity-50]="ab.estornado">
                  <span class="text-[12px] text-gray-500">{{ formatDate(ab.data) }}</span>
                  <span class="text-[13px] font-semibold text-gray-800 font-mono">{{ formatCurrency(ab.valor) }}</span>
                  @if (ab.estornado) {
                    <span class="text-[11px] text-gray-400">Estornado</span>
                  } @else {
                    <button type="button" (click)="estornar(ab.id)"
                            class="text-[11px] text-red-600 hover:underline cursor-pointer">Estornar</button>
                  }
                </div>
              }
            </div>
          }
        }
```

- [ ] **Step 4: Commit**

```bash
git add src/app/features/clientes/components/cliente-historico-modal/cliente-historico-modal.component.ts src/app/features/clientes/components/cliente-historico-modal/cliente-historico-modal.component.html
git commit -m "feat(clientes): aba de dívida com débito FIFO no histórico"
```

---

## Task 11: Verificação ponta-a-ponta no navegador

**Files:** nenhum (verificação).

- [ ] **Step 1: Subir backend e frontend**

Backend: rodar a aplicação Spring (perfil dev com MySQL local, `ddl-auto: update` cria a coluna/tabelas; ou aplicar a migração V9). Frontend: `preview_start` com o dev server do Angular (`.claude/launch.json` → `npm start`), que usa `proxy.conf.json` para o backend.

- [ ] **Step 2: Preparar dados**

Garantir um cliente com pelo menos 2 pedidos/locações FIADO ou parcelados em aberto (datas diferentes), somando uma dívida conhecida (ex.: pedido antigo 300 + pedido novo 700 = 1000).

- [ ] **Step 3: Verificar exibição do saldo**

Abrir Clientes → histórico do cliente → aba **Dívida**. Confirmar: badge vermelho com R$ 1.000,00, item "Pedido #antigo" e "Pedido #novo" com saldos 300 e 700, ordenados do mais antigo para o mais novo.

- [ ] **Step 4: Verificar débito FIFO**

Debitar R$ 100. Esperado: saldo vira R$ 900; o item do pedido mais antigo mostra "Em aberto" R$ 200 (300 − 100); o pedido novo permanece 700. Debitar R$ 250. Esperado: pedido antigo some da lista (quitado, 300 total abatido), pedido novo mostra 650. Conferir no console/network que não há erro.

- [ ] **Step 5: Verificar estorno**

Estornar o último abatimento. Esperado: saldo volta a subir e o pedido correspondente reabre com o saldo anterior. Confirmar o registro marcado "Estornado". Se a parcela reaberta já estava vencida, conferir no Financeiro que ela reaparece como **VENCIDO** (não PENDENTE).

- [ ] **Step 6: Verificar caixa**

No Financeiro/Dashboard do dia, confirmar que os valores debitados aparecem no total recebido do dia (Task 8) — e que ao estornar, o recebido não conta mais aquele abatimento.

- [ ] **Step 7: Screenshot final**

`computer {action: "screenshot"}` da aba Dívida com o saldo atualizado, para registro.

---

## Self-Review (executada ao escrever o plano)

**Cobertura do spec:**
- "Ver quanto o cliente deve" → Task 7 (`saldoCliente`) + Task 10 (aba Dívida com saldo total e por pedido). ✅
- "Descontar valores personalizados" → `AbatimentoRequest.valor` livre + `AbatimentoService.debitar` (Task 5). ✅
- "Seguir ordem da mais antiga até a mais recente, completando cada pedido" → `findEmAbertoPorClienteFifo` (ORDER BY dataMovimento ASC, numParcelas ASC) + loop de alocação que preenche cada parcela antes de passar (Task 5). Testes `debitoAbateDoPedidoMaisAntigoAteCompletar` e `debitoTransbordaParaOProximoPedidoAoQuitarOAtual`. ✅
- Auditoria/estorno (decisão travada) → `Abatimento`/`AbatimentoParcela` + `estornar` (Tasks 2, 5, 6). ✅
- Caixa na hora (decisão travada) → Task 8 + invariante `valorPago`. ✅
- Reabertura respeitando vencimento → `statusDeReabertura` (Task 5) + teste dedicado (Task 6). ✅

**Consistência de tipos:** `valorPago` (BigDecimal), `saldoDevedorPorCliente` → `BigDecimal`, `findEmAbertoPorClienteFifo` → `List<LancamentoFinanceiro>`, `debitar(clienteId, AbatimentoRequest) → AbatimentoResultado`, `estornar(abatimentoId)`. Frontend: `getSaldo→ClienteSaldoResponse`, `debitar→AbatimentoResultado`, `getAbatimentos→AbatimentoResumo[]`. Nomes batem entre tasks. ✅

**Vocabulário:** nenhuma ocorrência de `PagamentoCliente` restante — a entidade é `Abatimento` (tabela `abatimentos`), o filho é `AbatimentoParcela` (tabela `abatimento_parcela`), o campo de ligação é `abatimento_id`, o id no DTO é `abatimentoId`. ✅

**Placeholders:** nenhum passo com "TBD/implementar depois"; todo passo de código traz o código. ✅

**Risco a vigiar durante a execução:** as queries de "recebido" (`somarReceitaPorPeriodo` etc.) são usadas em vários relatórios; ao adicionar `AND l.valorPago = 0`, rodar a suíte financeira inteira (Task 8 Step 5) para garantir que cenários à-vista (onde `valorPago = 0`) continuam somando normalmente.
