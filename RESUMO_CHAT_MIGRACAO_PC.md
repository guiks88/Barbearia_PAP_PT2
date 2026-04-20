# Resumo Tecnico para Continuar noutro PC

Data: 2026-04-20
Branch: main
Ultimo commit enviado: 6b8e310
Repositorio: https://github.com/guiks88/Barbearia_PAP_PT2

## O que foi concluido nesta sessao

1. Registo/login de cliente estabilizado
- Ajustes no fluxo para evitar conta parcial criada sem perfil.
- Fallback para criar/perceber perfil em falta apos autenticacao.

2. Painel admin melhorado para barbeiros
- Fluxo de adicionar/editar barbeiro focado no formulario.
- Comportamento de voltar/fechar melhorado e lista escondida durante edicao.

3. Horarios e disponibilidade
- Slots de marcacao em passos de 10 minutos.
- Bloqueio por sobreposicao com base na duracao real do servico.
- Duracao/preco variam por barbeiro (perfil economico/intermedio/premium).

4. Ordem do fluxo de marcacao
- Fluxo alterado para: escolher barbeiro -> escolher servico -> escolher data/hora.

5. Excecoes de horario (novo)
- Suporte para excecoes por:
  - Dia especifico
  - Semana (YYYY-W##)
  - Mes (YYYY-MM)
- Alvo da excecao:
  - Loja
  - Barbeiro especifico
- CRUD no painel admin para guardar/remover excecoes.

## Ficheiros principais alterados

- public/admin-panel.html
- public/admin-panel.js
- public/booking-calendar.js
- public/script.js
- public/client-register.js
- public/login.js
- public/bookings.html
- public/index.html
- public/styles.css
- database.rules.json

## Estado atual

- Alteracoes principais foram commitadas e enviadas para GitHub.
- Push confirmado em origin/main com commit 6b8e310.

## Como continuar noutro PC

1. Clonar

```bash
git clone https://github.com/guiks88/Barbearia_PAP_PT2.git
cd Barbearia_PAP_PT2
```

2. Atualizar (se ja tiver o repo)

```bash
git pull origin main
```

3. Abrir no VS Code

```bash
code .
```

## Nota importante Firebase

Se houver erro de permissoes em regras, confirmar no Firebase Console se as rules mais recentes ja foram publicadas.
