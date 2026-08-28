# TS Module Operation

An independent application that exposes `OperationPage.vue` through Module
Federation.

```bash
npm install
npm run dev
```

The application runs at http://localhost:4174. The host loads its
`remoteEntry.js` from http://localhost:4174/remoteEntry.js.
