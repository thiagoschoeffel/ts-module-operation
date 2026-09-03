# TS Module Operation

An independent application that exposes `OperationPage.vue` through Module
Federation.

```bash
npm install
npm run dev
```

The application runs at http://localhost:4174. The host loads its
`remoteEntry.js` from http://localhost:4174/remoteEntry.js.

## Cenários mock da lista de pedidos

Use o parâmetro `mock` na rota `/operacoes/pedidos` para conferir os estados
vazios da tabela sem alterar a massa de dados:

- `?mock=sem-pedidos`: operação sem pedidos cadastrados.
- `?mock=sem-resultados`: busca preenchida sem resultados correspondentes.
- `?mock=erro`: falha simulada no carregamento da lista.

Sem o parâmetro, a tela continua usando a massa completa de pedidos.

## Integração com o cardápio diário

O dashboard Hoje e a montagem de novos pedidos consultam o cardápio publicado
do dia. Somente ofertas e opções marcadas como disponíveis podem ser adicionadas
a novos pedidos; a massa local padrão mantém a demonstração utilizável quando
nenhum cardápio foi persistido ainda.

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

Estados previsíveis podem ser revisados sem alterar a massa local:

- `?mock=sem-embalagens`: fila sem pedidos aguardando ou embalados.
- `?mock=sem-resultados`: busca preenchida sem correspondências.
- `?mock=erro`: falha simulada ao carregar a fila.
