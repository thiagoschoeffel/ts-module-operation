# TS Module Operation

An independent application that exposes `OperationPage.vue` through Module
Federation.

```bash
npm install
npm run dev
```

The application runs at http://localhost:4174. The host loads its
`remoteEntry.js` from http://localhost:4174/remoteEntry.js.

## Pedidos e capacidade

As rotas `/operacoes/pedidos`, `/operacoes/pedidos/novo` e o detalhe usam o
adapter HTTP autenticado recebido do shell. Lista, criação, edição, confirmação,
cancelamento, reagendamento e capacidade são autoritativos; escritas enviam
`Idempotency-Key` e a versão esperada quando existe concorrência otimista.

O formulário consulta ofertas, itens produzíveis e configurações congeladas
ativas na API. A projeção de capacidade não reserva saldo: confirmação e
reagendamento repetem a validação dentro da transação do servidor. Até o E12, o
Pedido continua persistindo um identificador externo de cliente e usa um
diretório provisório apenas para apresentação da seleção.

## Integração com o cardápio diário

O dashboard Hoje ainda consulta o cardápio demonstrativo, mas contagem de
Pedidos e capacidade diária já vêm da API. A montagem de Pedidos usa somente
referências ativas retornadas pelo contexto autoritativo; publicação e
disponibilidade completa de Cardápios entram no E11.

## Painel de produção

A rota `/operacoes/producao` consolida as escolhas efetivas dos pedidos
confirmados e em produção para responder quanto preparar em cada janela de
entrega. Pedidos abertos, cancelados ou já encaminhados para embalagem não
inflam essa necessidade.

O painel é responsivo para uso em tablets e possui **modo TV**, que ocupa a tela
inteira com tipografia ampliada. Enquanto estiver aberto, relógio e dados são
atualizados automaticamente; alterações persistidas em outra aba também são
refletidas sem recarregar a página. O modo TV nunca exibe rolagem: quando a
quantidade de preparações ultrapassa o espaço disponível, o painel divide o
conteúdo em telas e alterna entre elas automaticamente.

## Fila de embalagem

A rota `/operacoes/embalagem` organiza os pedidos liberados para embalagem por
janela de entrega. Cada item precisa ser conferido antes que o pedido possa ser
marcado como embalado; restrições e personalizações recebem destaque visual. A
conclusão registra responsável e horário no pedido e mantém os volumes
embalados disponíveis para a futura etapa de roteirização.

No ambiente demonstrativo, ao clicar em **Embalado**, o operador confere todas
as etiquetas em um diálogo com rolagem interna. Em uma estação configurada no
modo `zebra`, o mesmo clique pula o diálogo e envia diretamente uma etiqueta
para cada item da produção do dia e uma etiqueta externa para o pacote kraft;
congelados mantêm a etiqueta aplicada na entrada do lote. A reimpressão sempre
preserva a conferência e a seleção explícita das etiquetas.

### Impressão direta em Zebra USB

O serviço de impressão possui suporte preparado para Zebra Browser Print e gera
ZPL em 100 × 50 mm para impressoras de 203 ou 300 dpi. O runtime é carregado
uma única vez pelo `ts-host`, evitando configurações divergentes entre
Embalagem e Congelados. Configure o ambiente do host com:

```dotenv
VITE_LABEL_PRINT_MODE=zebra
VITE_ZEBRA_BROWSER_PRINT_SCRIPT=/vendor/BrowserPrint.min.js
VITE_ZEBRA_DPI=203
```

- `zebra`: exige o aplicativo Zebra Browser Print instalado na estação e envia
  o ZPL diretamente para a impressora USB padrão, sem abrir a impressão do
  Chrome;
- `browser`: mantém a janela de impressão usada na demonstração;
- `auto` ou valor ausente: usa Zebra quando a biblioteca estiver disponível e
  recorre ao navegador nos demais ambientes.

A biblioteca JavaScript deve ser obtida no pacote oficial do
[Zebra Browser Print](https://www.zebra.com/us/en/support-downloads/software/printer-software/browser-print.html)
e disponibilizada pela aplicação no endereço configurado. Quando o equipamento
for adquirido, confirme o dpi do modelo e cadastre-o como impressora padrão no
Browser Print da estação.

Estados previsíveis podem ser revisados sem alterar a massa local:

- `?mock=sem-embalagens`: fila sem pedidos aguardando ou embalados.
- `?mock=sem-resultados`: busca preenchida sem correspondências.
- `?mock=erro`: falha simulada ao carregar a fila.

## Entregas

A rota `/operacoes/entregas` recebe os pedidos embalados, agrupa as paradas por
janela e permite atribuir um entregador ativo. Rotas planejadas podem ser
iniciadas e cada parada registra entrega concluída ou falha, mantendo o pedido
e seu histórico sincronizados com o restante da operação. Antes do início, a
rota permite trocar o entregador, adicionar ou remover pedidos da mesma janela,
reordenar as paradas e cancelar o planejamento, devolvendo os pedidos à fila sem
apagar o histórico da rota.
Ao iniciar, o operador revisa a folha da rota em um diálogo e pode imprimi-la;
rotas em andamento mantêm a ação de reimpressão disponível no cabeçalho.
Quando uma entrega falha, o pedido preserva a tentativa anterior e pode ser
reagendado no detalhe para retornar à fila de uma nova rota.

As rotas demonstrativas usam a chave `ts-operation-delivery-routes-v1` do
`localStorage` e compartilham os pedidos persistidos pela operação. Estados
previsíveis podem ser revisados com `?mock=sem-entregas`,
`?mock=sem-resultados` e `?mock=erro`.
