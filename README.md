# Shipay PIX — Extensão Chrome

Extensão para testar pagamentos PIX no ambiente de staging da Shipay sem precisar usar o celular.

## Como instalar (modo desenvolvedor)

1. Abra o Chrome e acesse: `chrome://extensions/`
2. Ative o **"Modo do desenvolvedor"** (toggle no canto superior direito)
3. Clique em **"Carregar sem compactação"**
4. Selecione a pasta `shipay-extension/`
5. A extensão aparecerá na barra de ferramentas do Chrome

## Como usar

- Clique no ícone verde **S$** na barra de extensões
- O popup abre com o botão com a opção de pagar
- Vocẽ clica em pagar e pronto !

## Estrutura

```
shipay-extension/
├── manifest.json     # Configuração da extensão
├── popup.html        # Interface visual
├── popup.js          # Lógica da extensão
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

## Observação

Alguns sites bloqueiam carregamento via iframe com o header `X-Frame-Options: DENY`.
Se o staging da Shipay usar esse header, o conteúdo não vai aparecer no popup.
Nesse caso, use o botão **"Abrir em Nova Aba"** — abrirá normalmente em uma aba do Chrome.
