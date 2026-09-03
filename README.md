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
