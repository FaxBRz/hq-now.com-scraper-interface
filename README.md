# 📚 Baixador de HQs

Um app pra baixar quadrinhos da internet feito com Node.js e Puppeteer. Fiz pra aprender web scraping. 🚀

![Imagem do website](https://i.imgur.com/dIMX0jG.png)

## ⚠️ Aviso 

Isso aqui é só pra estudar mesmo. Fiz pra:

- 🎓 Aprender como usar o Puppeteer
- 🔍 Entender como funciona web scraping
- 💻 Treinar desenvolvimento com Node.js
- 🔌 Brincar com Socket.IO

**Use com responsabilidade:**
- ✅ Só em sites que permitem
- 📋 Respeita os termos de uso
- 🚫 Não sobrecarrega os servidores
- 🎯 É só pra aprender

## 🚀 Como usar

### 📋 Você precisa ter:
- 🟢 Node.js 18+ (recomendo a versão 20 LTS)
- 📦 NPM ou Yarn

### 💾 Instalar

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

### ▶️ Rodar

**🌐 Interface web (mais fácil):**
```bash
npm start
```
Abre no http://localhost:3000

**⌨️ Só o script (linha de comando):**
```bash
# Script direto
npm run scraper <url-da-hq>
```

🚀 **Recomendado:** Use a interface web que tem configurações de velocidade otimizadas!

## ⚙️ Como funciona

### 📁 Arquivos principais

- `scraper.js` - 🤖 Motor de download otimizado com Puppeteer
- `server.js` - 🖥️ Servidor web com API REST e Socket.IO
- `interface.html` - 🎨 Interface web moderna com configurações de velocidade

### ✨ O que faz

- 🌐 Interface web moderna pra não ficar digitando comando
- ⚡ Baixa vários capítulos ao mesmo tempo (concorrência configurável)
- 📊 Mostra o progresso em tempo real com Socket.IO
- ⏹️ Pode cancelar downloads em andamento
- 🔄 Continua de onde parou se der erro (resume automático)
- 📂 Organiza tudo em pastas estruturadas
- 🗑️ Gerencia biblioteca de HQs com opção de deletar

## 🚀 Modos de Velocidade

A interface web oferece diferentes modos de velocidade:

- 🐌 **Conservador**: 3 capítulos, 10 imagens (conexões lentas)
- ⚖️ **Balanceado**: 5 capítulos, 15 imagens (padrão recomendado)
- 🚀 **Rápido**: 8 capítulos, 20 imagens (conexões boas)
- ⚡ **Turbo**: 12 capítulos, 30 imagens (máxima velocidade)
- 🔧 **Personalizado**: Configure do seu jeito

**Por que é rápido:**
- 🔄 Processa múltiplos capítulos simultaneamente
- 📦 Baixa imagens em batches otimizados
- 🚫 Bloqueia recursos desnecessários (CSS, fonts, etc.)
- ⏱️ Timeouts otimizados para navegação rápida
- 💪 Recuperação automática de falhas

### ⚙️ Configurar performance

Use a interface web para configurar ou:

```bash
# Variáveis de ambiente para tuning avançado
MAX_CHAPTERS=8 MAX_IMAGES=20 npm run scraper <url>
```

## 📂 Estrutura dos arquivos

```
nome-da-hq/
├── capitulo-1/
│   ├── imagem1.jpg
│   ├── imagem2.jpg
│   └── ...
├── capitulo-2/
│   └── ...
```

## 👨‍💻 Desenvolvimento

```bash
# Roda com auto-restart
npm run dev

# Só o scraper
npm run scraper <url>
```

## 📄 Licença

📜 GPL-3.0 - Basicamente você pode usar, modificar e compartilhar, mas tem que manter o código aberto.

## 🛠️ Tecnologias usadas

- 🟢 **Node.js** - Runtime JavaScript
- 🎭 **Puppeteer** - Controla o navegador
- 🚂 **Express** - Servidor web
- 🔌 **Socket.IO** - Comunicação em tempo real
- 🌐 **HTML/CSS/JS** - Interface web moderna

## 🔗 Links úteis

- 🟢 [Node.js](https://nodejs.org/)
- 🎭 [Puppeteer](https://pptr.dev/)
- 📚 [Como fazer web scraping ético](https://blog.apify.com/is-web-scraping-legal/)

## 📝 TODO - Próximas Features

### 🌍 Suporte a Outros Sites
Planos para expandir o suporte além do site atual:

- 📖 **MangáLivre** - Suporte para mangás brasileiros
- 🦸 **Comic Book Plus** - HQs clássicas em domínio público
- 📚 **Webtoons** - Manhwas e webtoons verticais
- 🇯🇵 **MangaDex** - Biblioteca internacional de mangás
- 🏴‍☠️ **Archive.org** - HQs históricas e clássicas

### 🚀 Melhorias Técnicas
- 🔧 Sistema de plugins para sites personalizados
- 📱 Interface mobile responsiva
- 🗂️ Exportação para formatos CBR/CBZ
- 🔍 Sistema de busca e filtros
- 📊 Estatísticas de download
- 🎨 Leitor integrado de HQs

### 🛡️ Recursos Defensivos
- 🕰️ Rate limiting inteligente
- 🔄 Retry automático com backoff
- 👻 Rotação de user agents
- 🛡️ Detecção de anti-bot e contornos éticos

**Contribuições são bem-vindas!** 🤝

---

❤️ Feito por diversão e aprendizado. Use com responsabilidade! 🚀
