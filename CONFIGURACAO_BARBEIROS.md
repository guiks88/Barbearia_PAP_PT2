# Configuração dos Barbeiros - Barbearia João Castro

## Barbeiros Predefinidos

Para configurar os 3 barbeiros (Ana, João Pedro e Manuel), siga os passos abaixo:

### 1. Aceder ao Painel Administrativo
- Aceda a `admin-login.html`
- Faça login com as credenciais de administrador

### 2. Registar os Barbeiros

#### **Ana**
- **Nome**: Ana
- **Email**: ana@barbearia.pt
- **Senha**: ana123456
- **Telefone**: 912345678
- **Especialidade**: Cortes femininos e masculinos
- **Horário de Início**: 09:00
- **Horário de Fim**: 17:00

#### **João Pedro**
- **Nome**: João Pedro
- **Email**: joaopedro@barbearia.pt
- **Senha**: joao123456
- **Telefone**: 913456789
- **Especialidade**: Cortes modernos e barbas
- **Horário de Início**: 10:00
- **Horário de Fim**: 19:00

#### **Manuel**
- **Nome**: Manuel
- **Email**: manuel@barbearia.pt
- **Senha**: manuel123456
- **Telefone**: 914567890
- **Especialidade**: Cortes clássicos e penteados
- **Horário de Início**: 08:00
- **Horário de Fim**: 16:00

### 3. Funcionamento do Sistema

#### Login de Barbeiros
- Os barbeiros agora selecionam o seu nome de uma lista em vez de digitar o email
- Após o login, cada barbeiro vê apenas as suas marcações
- O horário de cada barbeiro é personalizado de acordo com a sua configuração

#### Horários Personalizados
- **Ana**: Trabalha das 09:00 às 17:00
- **João Pedro**: Trabalha das 10:00 às 19:00
- **Manuel**: Trabalha das 08:00 às 16:00

Quando os clientes fazem marcações, apenas os horários do barbeiro selecionado aparecem disponíveis.

### 4. Testar o Sistema

1. Registe os 3 barbeiros no painel administrativo com os dados acima
2. Aceda a `barber-login.html`
3. Selecione um barbeiro da lista (Ana, João Pedro ou Manuel)
4. Introduza a senha correspondente
5. Após o login, verá o painel personalizado com o horário do barbeiro

### 5. Notas Importantes

- As senhas podem ser alteradas ao gosto do administrador
- Os horários podem ser editados através do painel administrativo (futuras atualizações)
- Cada barbeiro apenas vê as suas próprias marcações no painel
- Os clientes verão os horários disponíveis específicos de cada barbeiro ao fazer marcações

---

## Alterações Implementadas

### Sistema de Login de Barbeiros
✅ Substituído campo de email por dropdown de seleção
✅ Opções: Ana, João Pedro, Manuel
✅ Login mantém informação do barbeiro na sessão

### Painel do Barbeiro
✅ Novo painel (`barber-panel.html`) exclusivo para barbeiros
✅ Visualização de marcações por data
✅ Estatísticas de marcações (hoje, semana, mês)
✅ Filtro de data para ver marcações futuras
✅ Informações dos clientes (nome, email, telefone)

### Horários Personalizados
✅ Cada barbeiro tem horário de trabalho configurável
✅ Sistema de reservas respeita os horários individuais
✅ Horários salvos no Firebase para cada barbeiro
✅ Campos de horário adicionados ao formulário de registo

### Calendário de Marcações
✅ Horários disponíveis baseados no barbeiro selecionado
✅ Cálculo correto de slots disponíveis por barbeiro
✅ Sistema de reservas funciona com horários personalizados
