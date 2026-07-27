# Marluse — Demo (Portfólio)

SaaS de gestão para loja de materiais de construção: **vendas, locações, estoque, clientes e financeiro** em um só lugar. Este é um **ambiente de demonstração público**, com dados fictícios que são reiniciados automaticamente — sinta-se à vontade para criar, editar e excluir.

🔗 **Ao vivo:** https://maluse-demo.vercel.app
👤 **Login:** `demo@marluse.com` · **Senha:** `demo123` — ou clique em **"Entrar como visitante"** na tela de login.

> ⚠️ Dados fictícios, gerados por um seeder e **reiniciados a cada 6h**. Nenhuma informação real de clientes.

---

## 🧱 Stack

**Frontend**
- Angular 22 (standalone components, signals, lazy loading)
- PrimeNG 21 · TailwindCSS · ApexCharts
- Autenticação por cookie httpOnly com refresh token automático (interceptor)

**Backend** ([repositório](https://github.com/zeus-crf/maluse_backend_demo))
- Spring Boot 4 · Java 21
- MySQL 8 · Flyway (migrations versionadas)
- Spring Security + JWT (access token + refresh token em cookie httpOnly)
- Testes com JUnit + H2

**Infra**
- Docker · Railway (API + MySQL) · Vercel (frontend)

---

## 📦 Módulos

| Módulo | O que faz |
|--------|-----------|
| **Dashboard** | KPIs, gráficos de receita, estoque crítico, locações em curso |
| **Vendas** | Pedidos com itens, descontos, formas de pagamento, entrega e comprovante |
| **Locações** | Aluguel de equipamentos com controle de retirada/devolução e status (ativa, atrasada, devolvida) |
| **Estoque** | Produtos, categorias, unidades de medida e fornecedores com preço de compra |
| **Clientes** | Cadastro, histórico de compras/locações, saldo devedor e observações |
| **Financeiro** | Lançamentos de receita/despesa, recorrência, abatimento de dívida |
| **Relatórios** | Top clientes/produtos, receita mensal, status financeiro |

---

## 🔒 Sobre o ambiente de demonstração

- Os dados são **gerados por um seeder** no primeiro boot e **reiniciados a cada 6h** por um scheduler — o demo sempre volta a um estado consistente.
- Um único usuário público (`demo@marluse.com`) já vem provisionado; cadastro público está desativado.
- Isolado do ambiente real: repositórios, banco e deploy próprios.

---

## 🚀 Rodar localmente

**Backend** (Docker — sobe API + MySQL e semeia os dados):
```bash
# no repositório do backend, com um .env baseado no .env.example
docker compose up --build
```

**Frontend:**
```bash
npm install --legacy-peer-deps
npm start
```
Abra http://localhost:4200 (o `proxy.conf.json` encaminha `/api` para `http://localhost:8080`).

---

*Projeto de portfólio. O sistema original foi desenvolvido para um cliente real; este demo usa uma base de código separada, sem dados reais.*
