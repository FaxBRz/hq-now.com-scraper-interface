# Baixador de HQs

Um app pra baixar quadrinhos da internet feito com Node.js e Puppeteer. Fiz pra aprender web scraping.

## Aviso 

Isso aqui é só pra estudar mesmo. Fiz pra:

- Aprender como usar o Puppeteer
- Entender como funciona web scraping
- Treinar desenvolvimento com Node.js
- Brincar com Socket.IO

**Use com responsabilidade:**
- Só em sites que permitem
- Respeita os termos de uso
- Não sobrecarrega os servidores
- É só pra aprender

## Como usar

### Você precisa ter:
- Node.js 18+ (recomendo a versão 20 LTS)
- NPM ou Yarn

### Instalar

```bash
# Baixa o projeto
git clone <repository-url>
cd HQ-Now_Download

# Se usar NVM
nvm use

# Instala as coisas
npm install

# Se der erro com o Puppeteer
npx puppeteer browsers install chrome
```

### Rodar

**Interface web (mais fácil):**
```bash
npm start
```
Abre no http://localhost:3000

**Só o script (linha de comando):**
```bash
# Versão normal
node index.js <url-da-hq>

# Versão mais rápida
npm run scraper:fast <url-da-hq>

# Versão turbo (bem mais rápida)
npm run scraper:turbo <url-da-hq>
```

A versão fast é uns 3x mais rápida e a turbo é tipo 5x.

## Como funciona

### Arquivos principais

- `index.js` - O script que faz o download (versão normal)
- `index-fast.js` - Versão otimizada que baixa várias coisas ao mesmo tempo
- `server.js` - Servidor web com API
- `interface.html` - A tela bonita pra usar no navegador

### O que faz

- Interface web pra não ficar digitando comando
- Baixa vários capítulos ao mesmo tempo
- Mostra o progresso em tempo real
- Pode cancelar o download
- Continua de onde parou se der erro
- Organiza tudo em pastas

## Otimizações

A versão fast baixa mais rápido porque:

- Processa 5 capítulos ao mesmo tempo (em vez de um por vez)
- Baixa 15 imagens juntas (em batches)
- Não carrega CSS, imagens e outras firulas desnecessárias
- Timeouts menores pra não ficar esperando muito
- Se uma imagem falhar, continua com as outras

### Configurar performance

```bash
# Customizar quantos capítulos e imagens baixar junto
MAX_CHAPTERS=8 MAX_IMAGES=20 node index-fast.js <url>
```

## Estrutura dos arquivos

```
nome-da-hq/
├── capitulo-1/
│   ├── imagem1.jpg
│   ├── imagem2.jpg
│   └── ...
├── capitulo-2/
│   └── ...
```

## Desenvolvimento

```bash
# Roda com auto-restart
npm run dev

# Só o scraper
npm run scraper <url>
```

## Licença

GPL-3.0 - Basicamente você pode usar, modificar e compartilhar, mas tem que manter o código aberto.

## Tecnologias usadas

- Node.js - Runtime JavaScript
- Puppeteer - Controla o navegador
- Express - Servidor web
- Socket.IO - Comunicação em tempo real
- HTML/CSS/JS - Interface web

## Links úteis

- [Node.js](https://nodejs.org/)
- [Puppeteer](https://pptr.dev/)
- [Como fazer web scraping ético](https://blog.apify.com/is-web-scraping-legal/)

---

Feito por diversão e aprendizado. Use com responsabilidade.