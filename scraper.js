const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

class HQDownloaderFast {
    constructor(options = {}) {
        this.browser = null;
        this.page = null;
        this.cwd = process.cwd();
        
        // Configurações de performance
        this.maxConcurrentChapters = options.maxConcurrentChapters || 5;
        this.maxConcurrentImages = options.maxConcurrentImages || 15;
        this.pageTimeout = options.pageTimeout || 8000;
        this.requestTimeout = options.requestTimeout || 20000;
    }

    async init() {
        this.browser = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox', 
                '--disable-setuid-sandbox', 
                '--disable-images',
                '--disable-web-security',
                '--disable-features=VizDisplayCompositor',
                '--disable-dev-shm-usage',
                '--no-first-run',
                '--disable-extensions',
                '--disable-plugins',
                '--disable-default-apps',
                '--disable-background-timer-throttling',
                '--disable-backgrounding-occluded-windows',
                '--disable-renderer-backgrounding',
                '--max_old_space_size=4096'
            ]
        });
        this.page = await this.browser.newPage();
        
        // Otimizações básicas
        await this.page.setViewport({ width: 1280, height: 720 });
        await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
        
        // Bloqueia recursos desnecessários
        await this.page.setRequestInterception(true);
        this.page.on('request', (req) => {
            const resourceType = req.resourceType();
            const blockedTypes = ['image', 'stylesheet', 'font', 'media', 'manifest', 'other'];
            if (blockedTypes.includes(resourceType)) {
                req.abort();
            } else {
                req.continue();
            }
        });

        await this.page.setDefaultNavigationTimeout(this.pageTimeout);
        await this.page.setDefaultTimeout(this.pageTimeout);
    }

    isImageAlreadyDownloaded(imgPath) {
        return fs.existsSync(imgPath);
    }

    isChapterAlreadyDownloaded(filesPath, pageCount) {
        if (!fs.existsSync(filesPath)) return false;
        
        const files = fs.readdirSync(filesPath).filter(file => 
            file.endsWith('.jpg') || file.endsWith('.png') || file.endsWith('.jpeg')
        );
        
        // Verifica se tem o número correto de arquivos E se todos têm tamanho > 0
        if (files.length !== pageCount) return false;
        
        try {
            for (const file of files) {
                const filePath = path.join(filesPath, file);
                const stats = fs.statSync(filePath);
                if (stats.size === 0) {
                    console.log(`Arquivo corrompido encontrado: ${file}, será baixado novamente`);
                    return false;
                }
            }
            return true;
        } catch (error) {
            return false;
        }
    }

    getChapterProgress(filesPath, pageCount) {
        if (!fs.existsSync(filesPath)) return { completed: 0, total: pageCount };
        
        const files = fs.readdirSync(filesPath).filter(file => 
            file.endsWith('.jpg') || file.endsWith('.png') || file.endsWith('.jpeg')
        );
        
        let validFiles = 0;
        try {
            for (const file of files) {
                const filePath = path.join(filesPath, file);
                const stats = fs.statSync(filePath);
                if (stats.size > 0) {
                    validFiles++;
                }
            }
        } catch (error) {
            // Ignora erros de leitura
        }
        
        return { completed: validFiles, total: pageCount };
    }

    createDir(dirName) {
        const dirPath = path.join(this.cwd, dirName);
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }
        return dirPath;
    }

    saveProgress(dirPath, progress) {
        const progressFile = path.join(dirPath, '.progress.json');
        try {
            fs.writeFileSync(progressFile, JSON.stringify(progress, null, 2));
        } catch (error) {
            console.error('Erro ao salvar progresso:', error.message);
        }
    }

    loadProgress(dirPath) {
        const progressFile = path.join(dirPath, '.progress.json');
        if (fs.existsSync(progressFile)) {
            try {
                const data = fs.readFileSync(progressFile, 'utf8');
                return JSON.parse(data);
            } catch (error) {
                console.error('Erro ao carregar progresso:', error.message);
                return null;
            }
        }
        return null;
    }

    removeProgress(dirPath) {
        const progressFile = path.join(dirPath, '.progress.json');
        try {
            if (fs.existsSync(progressFile)) {
                fs.unlinkSync(progressFile);
            }
        } catch (error) {
            console.error('Erro ao remover arquivo de progresso:', error.message);
        }
    }

    async appendChapterLinks(chapterLinks, aTagElems) {
        // Pega todos os links de uma vez
        const hrefs = await Promise.all(
            aTagElems.map(elem => elem.evaluate(el => el.href))
        );
        
        // Adiciona na ordem reversa (igual o original)
        for (let i = hrefs.length - 1; i >= 0; i--) {
            if (hrefs[i]) {
                chapterLinks.push(hrefs[i]);
            }
        }
    }

    async downloadImage(imageUrl, imagePath, maxRedirects = 5) {
        return new Promise((resolve, reject) => {
            const followRedirect = (url, redirectCount = 0) => {
                if (redirectCount > maxRedirects) {
                    reject(new Error(`Muitos redirecionamentos (${redirectCount})`));
                    return;
                }

                const protocol = url.startsWith('https:') ? https : http;
                
                const request = protocol.get(url, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
                        'Connection': 'keep-alive',
                        'Referer': url.split('/').slice(0, 3).join('/')
                    },
                    timeout: this.requestTimeout
                }, (response) => {
                    // Seguir redirecionamentos 301, 302, 303, 307, 308
                    if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
                        const redirectUrl = response.headers.location;
                        if (!redirectUrl) {
                            reject(new Error(`Redirecionamento sem URL (${response.statusCode})`));
                            return;
                        }
                        
                        // Se for URL relativa, fazer absoluta
                        const finalUrl = redirectUrl.startsWith('http') ? 
                            redirectUrl : 
                            new URL(redirectUrl, url).href;
                            
                        console.log(`Redirecionamento ${response.statusCode}: ${url} -> ${finalUrl}`);
                        followRedirect(finalUrl, redirectCount + 1);
                        return;
                    }

                    if (response.statusCode !== 200) {
                        reject(new Error(`HTTP ${response.statusCode}`));
                        return;
                    }

                    const file = fs.createWriteStream(imagePath);
                    response.pipe(file);
                    
                    file.on('finish', () => {
                        file.close();
                        resolve();
                    });
                    
                    file.on('error', (err) => {
                        fs.unlink(imagePath, () => {});
                        reject(err);
                    });
                });

                request.on('error', (err) => {
                    reject(new Error(`Erro de conexão: ${err.message}`));
                });
                
                request.on('timeout', () => {
                    request.destroy();
                    reject(new Error(`Timeout após ${this.requestTimeout}ms`));
                });

                request.setTimeout(this.requestTimeout, () => {
                    request.destroy();
                    reject(new Error(`Timeout após ${this.requestTimeout}ms`));
                });
            };

            followRedirect(imageUrl);
        });
    }

    async downloadImageWithRetry(image, maxRetries = 3) {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                await this.downloadImage(image.src, image.path);
                return true;
            } catch (error) {
                const errorMsg = error.message || 'Erro desconhecido';
                console.error(`❌ Tentativa ${attempt}/${maxRetries} - ${image.name}: ${errorMsg}`);
                
                // Se for erro 404, 403 ou similar, não tenta novamente
                if (errorMsg.includes('HTTP 404') || errorMsg.includes('HTTP 403') || errorMsg.includes('HTTP 410')) {
                    console.error(`⚠️  Erro permanente para ${image.name}, pulando...`);
                    return false;
                }
                
                if (attempt === maxRetries) {
                    console.error(`💀 Falha definitiva para ${image.name} após ${maxRetries} tentativas`);
                    return false;
                }
                
                // Aguarda um pouco antes de tentar novamente (backoff exponencial)
                const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
                console.log(`⏳ Aguardando ${delay}ms antes da próxima tentativa...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        return false;
    }

    async downloadImages(images) {
        // Divide em batches pra não sobrecarregar
        const batches = [];
        for (let i = 0; i < images.length; i += this.maxConcurrentImages) {
            batches.push(images.slice(i, i + this.maxConcurrentImages));
        }
        
        let totalDownloaded = 0;
        let totalFailed = 0;
        
        for (const batch of batches) {
            const promises = batch.map(image => 
                this.downloadImageWithRetry(image)
            );
            
            const results = await Promise.all(promises);
            const successCount = results.filter(result => result === true).length;
            const failedCount = results.filter(result => result === false).length;
            
            totalDownloaded += successCount;
            totalFailed += failedCount;
        }
        
        if (totalFailed > 0) {
            console.log(`📊 Resumo: ${totalDownloaded} imagens baixadas com sucesso, ${totalFailed} falharam após todas as tentativas`);
            console.log(`⚠️  Algumas imagens podem estar indisponíveis ou com links quebrados`);
        } else {
            console.log(`✅ Todas as ${totalDownloaded} imagens foram baixadas com sucesso`);
        }
        
        return totalDownloaded;
    }

    async processChapter(chapterLink, chapter, dirPath) {
        const page = await this.browser.newPage();
        
        try {
            await page.setViewport({ width: 1280, height: 720 });
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
            await page.setDefaultNavigationTimeout(this.pageTimeout);
            await page.setDefaultTimeout(this.pageTimeout);
            
            await page.setRequestInterception(true);
            page.on('request', (req) => {
                const resourceType = req.resourceType();
                const blockedTypes = ['image', 'stylesheet', 'font', 'media', 'manifest', 'other'];
                if (blockedTypes.includes(resourceType)) {
                    req.abort();
                } else {
                    req.continue();
                }
            });

            const images = [];
            await page.goto(chapterLink, { waitUntil: 'domcontentloaded' });
            
            try {
                await page.waitForSelector('div[class*="jdQClN"] button', { timeout: 5000 });
                const buttonElems = await page.$$('div[class*="jdQClN"] button');
                const pageCount = buttonElems.length - 2;
                const filesPath = path.join(dirPath, `capitulo-${chapter}`);

                console.log(`Capítulo ${chapter} - ${pageCount} páginas`);

                if (this.isChapterAlreadyDownloaded(filesPath, pageCount)) {
                    console.log(`Capítulo ${chapter} já baixado`);
                    return 0;
                }

                // Verifica progresso parcial
                const progress = this.getChapterProgress(filesPath, pageCount);
                if (progress.completed > 0) {
                    console.log(`Capítulo ${chapter}: continuando download (${progress.completed}/${progress.total} já baixadas)`);
                }

                if (!fs.existsSync(filesPath)) {
                    fs.mkdirSync(filesPath, { recursive: true });
                }

                for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
                    try {
                        await page.waitForSelector('figure img', { timeout: 5000 });
                        
                        const imgSrc = await page.evaluate(() => {
                            const imgElem = document.querySelector('figure img');
                            return imgElem ? imgElem.src : null;
                        });

                        if (imgSrc) {
                            const fileName = imgSrc.split("/").pop();
                            const imgPath = path.join(filesPath, fileName);

                            if (!this.isImageAlreadyDownloaded(imgPath)) {
                                images.push({
                                    src: imgSrc,
                                    name: fileName,
                                    path: imgPath
                                });
                            }
                        }

                        if (pageNum < pageCount) {
                            const currentUrl = page.url();
                            const newUrl = currentUrl.replace(`page/${pageNum}`, `page/${pageNum + 1}`);
                            await page.goto(newUrl, { waitUntil: 'domcontentloaded' });
                        }
                    } catch (error) {
                        console.error(`Erro na página ${pageNum} do capítulo ${chapter}: ${error.message}`);
                    }
                }

                if (images.length > 0) {
                    const downloaded = await this.downloadImages(images);
                    console.log(`Capítulo ${chapter}: ${downloaded}/${images.length} imagens baixadas`);
                    return downloaded;
                } else {
                    console.log(`Capítulo ${chapter}: todas as imagens já existem`);
                    return 0;
                }

            } catch (error) {
                console.error(`Erro no capítulo ${chapter}: ${error.message}`);
                return 0;
            }

        } finally {
            await page.close();
        }
    }

    async main(url) {
        if (!url) {
            console.log("Você precisa informar a URL da HQ");
            return;
        }

        console.log("Iniciando download rápido...");
        await this.init();
        const chapterLinks = [];

        try {
            console.log("Carregando página da HQ...");
            await this.page.goto(url, { waitUntil: 'domcontentloaded' });
            
            await this.page.waitForSelector('tbody a[href]', { timeout: 10000 });
            const aElems = await this.page.$$('tbody a[href]');
            
            const dirName = url.split("/").pop();
            const dirPath = this.createDir(dirName);

            console.log(`HQ: ${dirName}`);
            console.log("Modo rápido ativado");

            await this.appendChapterLinks(chapterLinks, aElems);

            console.log(`${chapterLinks.length} capítulos encontrados`);
            
            // Carrega progresso anterior se existir
            const savedProgress = this.loadProgress(dirPath);
            let completedChapters = new Set();
            
            if (savedProgress) {
                completedChapters = new Set(savedProgress.completedChapters || []);
                console.log(`Progresso encontrado: ${completedChapters.size}/${chapterLinks.length} capítulos já baixados`);
                console.log("Continuando de onde parou...");
            }
            
            console.log(`Baixando ${this.maxConcurrentChapters} capítulos por vez, ${this.maxConcurrentImages} imagens simultâneas`);

            // Filtra apenas os capítulos que ainda não foram baixados
            const remainingChapters = chapterLinks.filter((link, index) => !completedChapters.has(index + 1));
            
            if (remainingChapters.length === 0) {
                console.log("Todos os capítulos já foram baixados!");
                this.removeProgress(dirPath);
                return;
            }
            
            console.log(`${remainingChapters.length} capítulos restantes para baixar`);

            // Processa em batches apenas os capítulos restantes
            const chapterBatches = [];
            for (let i = 0; i < remainingChapters.length; i += this.maxConcurrentChapters) {
                chapterBatches.push(remainingChapters.slice(i, i + this.maxConcurrentChapters));
            }

            let totalImagesDownloaded = 0;
            const startTime = Date.now();

            for (let batchIndex = 0; batchIndex < chapterBatches.length; batchIndex++) {
                const batch = chapterBatches[batchIndex];
                
                console.log(`\nProcessando grupo ${batchIndex + 1}/${chapterBatches.length} (${batch.length} capítulos)`);
                
                const chapterPromises = batch.map((link, batchRelativeIndex) => {
                    // Precisa calcular o número correto do capítulo baseado no índice original
                    const originalIndex = remainingChapters.indexOf(link);
                    const originalChapterIndex = chapterLinks.indexOf(link);
                    const chapterNumber = originalChapterIndex + 1;
                    return this.processChapter(link, chapterNumber, dirPath);
                });

                try {
                    const results = await Promise.all(chapterPromises);
                    const batchTotal = results.reduce((sum, count) => sum + count, 0);
                    totalImagesDownloaded += batchTotal;
                    
                    // Marca os capítulos como concluídos no progresso
                    batch.forEach(link => {
                        const originalChapterIndex = chapterLinks.indexOf(link);
                        const chapterNumber = originalChapterIndex + 1;
                        completedChapters.add(chapterNumber);
                    });
                    
                    // Salva o progresso após cada batch
                    this.saveProgress(dirPath, {
                        totalChapters: chapterLinks.length,
                        completedChapters: Array.from(completedChapters),
                        lastUpdated: new Date().toISOString(),
                        url: url,
                        options: {
                            maxConcurrentChapters: this.maxConcurrentChapters,
                            maxConcurrentImages: this.maxConcurrentImages,
                            pageTimeout: this.pageTimeout,
                            requestTimeout: this.requestTimeout
                        }
                    });
                    
                    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
                    console.log(`Grupo ${batchIndex + 1} finalizado: ${batchTotal} imagens em ${elapsed}s`);
                    console.log(`Progresso salvo: ${completedChapters.size}/${chapterLinks.length} capítulos concluídos\n`);
                } catch (error) {
                    console.error(`Erro no grupo ${batchIndex + 1}: ${error.message}`);
                }
            }

            const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
            const avgSpeed = (totalImagesDownloaded / (totalTime / 60)).toFixed(1);

            console.log(`\nDownload concluído!`);
            console.log(`${totalImagesDownloaded} imagens baixadas em ${totalTime}s`);
            console.log(`Velocidade média: ${avgSpeed} imagens/min`);
            
            // Remove o arquivo de progresso quando terminar
            this.removeProgress(dirPath);
            
        } catch (error) {
            console.error("Erro:", error.message);
        } finally {
            if (this.browser) {
                await this.browser.close();
            }
        }
    }

    async close() {
        if (this.browser) {
            await this.browser.close();
        }
    }
}

// Uso na linha de comando
if (require.main === module) {
    const url = process.argv[2];
    
    const options = {
        maxConcurrentChapters: parseInt(process.env.MAX_CHAPTERS) || 5,
        maxConcurrentImages: parseInt(process.env.MAX_IMAGES) || 15,
        pageTimeout: parseInt(process.env.PAGE_TIMEOUT) || 8000,
        requestTimeout: parseInt(process.env.REQUEST_TIMEOUT) || 20000
    };
    
    console.log("Configurações:", options);
    
    const downloader = new HQDownloaderFast(options);
    
    downloader.main(url).then(() => {
        process.exit(0);
    }).catch((error) => {
        console.error('Erro:', error);
        process.exit(1);
    });
}

module.exports = HQDownloaderFast;