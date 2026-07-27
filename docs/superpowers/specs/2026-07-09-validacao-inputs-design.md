# Design: Validação de Inputs — Marluse Frontend

**Data:** 2026-07-09
**Status:** Aprovado

---

## Objetivo

Adicionar validação unificada a todos os formulários de criação e edição do sistema, com auto-formatação de campos mascarados (CPF, CNPJ, telefone) e exibição consistente de erros em português.

---

## Abordagem

**Reactive Forms + ngx-mask**

- Migrar todos os modais de `ngModel` para `ReactiveFormsModule` com `FormBuilder`
- Instalar `ngx-mask` para auto-formatação enquanto o usuário digita
- Criar infraestrutura compartilhada reutilizável em todos os modais

---

## Infraestrutura Compartilhada

### 1. `FieldErrorComponent`

**Caminho:** `src/app/shared/components/field-error/field-error.component.ts`

Componente standalone que recebe um `FormControl` e exibe a primeira mensagem de erro em português, apenas quando o campo foi tocado (`touched`) e está inválido.

```html
<app-field-error [control]="form.get('nome')" />
```

Aparência:
```
[input com borda vermelha]
× Campo obrigatório
```

Mensagens mapeadas:

| Erro Angular | Mensagem exibida |
|---|---|
| `required` | Campo obrigatório |
| `email` | E-mail inválido |
| `minlength` | Mínimo {n} caracteres |
| `maxlength` | Máximo {n} caracteres |
| `cpfInvalido` | CPF inválido |
| `cnpjInvalido` | CNPJ inválido |
| `telefoneInvalido` | Telefone inválido |

O input recebe classe `border-red-400` quando `invalid && touched`, voltando ao padrão quando válido.

### 2. `AppValidators`

**Caminho:** `src/app/shared/validators/app-validators.ts`

Validators customizados estáticos:

- `cpfValido()` — verifica se tem exatamente 11 dígitos numéricos após remover máscara
- `cnpjValido()` — verifica se tem exatamente 14 dígitos numéricos após remover máscara
- `telefoneValido()` — verifica se tem entre 10 e 11 dígitos numéricos após remover máscara

### 3. `ngx-mask`

Instalado via `npm install ngx-mask` e provido globalmente em `app.config.ts` com `provideNgxMask()`.

Máscaras usadas:

| Campo | Máscara |
|---|---|
| CPF | `000.000.000-00` |
| CNPJ | `00.000.000/0000-00` |
| Telefone | `(00) 00000-0000` |

A máscara CPF/CNPJ é dinâmica: troca automaticamente conforme o tipo de pessoa selecionado no modal de clientes, sem apagar o conteúdo digitado.

---

## Modais a Migrar

### Clientes — `novo-cliente-modal`

| Campo | Validadores |
|---|---|
| Nome | `required`, `minLength(2)`, `maxLength(100)` |
| CPF/CNPJ | opcional, `AppValidators.cpfValido()` ou `cnpjValido()` (dinâmico) |
| Telefone | opcional, `AppValidators.telefoneValido()` |
| E-mail | opcional, `Validators.email` |
| Endereço | opcional, `maxLength(255)` |

### Estoque — `novo-produto-modal`

| Campo | Validadores |
|---|---|
| Nome | `required`, `minLength(2)`, `maxLength(100)` |
| Custo de compra | `required` — controlado por `p-inputnumber` (já impede valor inválido) |
| Preço unitário | `required` — idem |
| Unidade | `required` |

### Financeiro — `novo-lancamento-modal` e `lancamento-edicao-modal`

| Campo | Validadores |
|---|---|
| Descrição | `required`, `minLength(3)`, `maxLength(512)` |
| Categoria | `required`, `minLength(2)` |
| Valor | `required` — controlado por `p-inputnumber` |

### Locações — `nova-locacao-modal` e `locacao-edicao-modal`

| Campo | Validadores |
|---|---|
| Endereço entrega | opcional, `maxLength(255)` |

### Vendas — `novo-pedido-modal` e `pedido-edicao-modal`

| Campo | Validadores |
|---|---|
| Endereço entrega | opcional, `maxLength(255)` |

---

## Comportamento ao Submeter

1. Usuário clica em "Salvar"
2. Se `form.invalid` → chama `form.markAllAsTouched()`, todos os erros aparecem simultaneamente, salvamento não prossegue
3. Se `form.valid` → prossegue normalmente com os valores do form

---

## O que Não Muda

- `p-inputnumber` continua sendo usado para campos de valor monetário e quantidade — ele já impede entrada inválida nativamente
- Modais de filtro (busca) não recebem validação — não são formulários de persistência
- Login já está em Reactive Forms e não é alterado

---

## Ordem de Implementação

1. Instalar `ngx-mask` e configurar em `app.config.ts`
2. Criar `FieldErrorComponent`
3. Criar `AppValidators`
4. Migrar `novo-cliente-modal` (caso mais complexo — máscara dinâmica)
5. Migrar `novo-produto-modal`
6. Migrar `novo-lancamento-modal` e `lancamento-edicao-modal`
7. Migrar `nova-locacao-modal` e `locacao-edicao-modal`
8. Migrar `novo-pedido-modal` e `pedido-edicao-modal`
