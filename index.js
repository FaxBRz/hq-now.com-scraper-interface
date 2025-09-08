const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

class HQDownloader {
    constructor(options = {}) {
        this.browser = null;
        this.page = null;
        this.cwd = process.cwd();
        this.maxConcurrentChapters = options.maxConcurrentChapters || 3;
        this.maxConcurrentImages = options.maxConcurrentImages || 10;
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
                '--disable-default-apps'
            ]
        });
        this.page = await this.browser.newPage();
        
        // Optimize page settings
        await this.page.setViewport({ width: 1280, height: 720 });
        await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
        
        // Block unnecessary resources
        await this.page.setRequestInterception(true);
        this.page.on('request', (req) => {
            const resourceType = req.resourceType();
            if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
                req.abort();
            } else {
                req.continue();
            }
        });
    }

    isImageAlreadyDownloaded(imgPath) {
        return fs.existsSync(imgPath);
    }

    isChapterAlreadyDownloaded(filesPath, pageCount) {
        if (!fs.existsSync(filesPath)) return false;
        
        const files = fs.readdirSync(filesPath).filter(file => file.endsWith('.jpg'));
        return files.length === pageCount;
    }

    createDir(dirName) {
        const dirPath = path.join(this.cwd, dirName);
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }
        return dirPath;
    }

    async appendChapterLinks(chapterLinks, aTagElems) {
        const size = aTagElems.length;
        for (let i = 1; i <= size; i++) {
            const href = await aTagElems[size - i].evaluate(el => el.href);
            if (href) {
                chapterLinks.push(href);
            }
        }
    }

    async downloadImage(imageUrl, imagePath) {
        return new Promise((resolve, reject) => {
            const protocol = imageUrl.startsWith('https:') ? https : http;
            
            const request = protocol.get(imageUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
                    'Accept-Encoding': 'gzip, deflate, br'
                },
                timeout: 30000
            }, (response) => {
                if (response.statusCode !== 200) {
                    reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
                    return;
                }

                const file = fs.createWriteStream(imagePath);
                response.pipe(file);
                
                file.on('finish', () => {
                    file.close();
                    console.log(`Baixou: ${path.basename(imagePath)}`);
                    resolve();
                });
                
                file.on('error', (err) => {
                    fs.unlink(imagePath, () => {});
                    reject(err);
                });
            });

            request.on('error', (err) => {
                reject(err);
            });

            request.on('timeout', () => {
                request.destroy();
                reject(new Error('Timeout na requisição de imagem'));
            });
        });
    }

    async downloadImages(images) {
        // Process images in batches to avoid overwhelming the server
        const batches = [];
        for (let i = 0; i < images.length; i += this.maxConcurrentImages) {
            batches.push(images.slice(i, i + this.maxConcurrentImages));
        }
        
        let totalDownloaded = 0;
        for (const batch of batches) {
            const promises = batch.map(image => 
                this.downloadImage(image.src, image.path)
            );
            
            try {
                await Promise.all(promises);
                totalDownloaded += batch.length;
            } catch (error) {
                console.error('Erro ao baixar batch de imagens:', error);
                throw error;
            }
        }
        
        return totalDownloaded;
    }

    async processChapter(chapterLink, chapter, dirPath) {
        const page = await this.browser.newPage();
        
        try {
            // Apply same optimizations to the new page
            await page.setViewport({ width: 1280, height: 720 });
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
            
            await page.setRequestInterception(true);
            page.on('request', (req) => {
                const resourceType = req.resourceType();
                if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
                    req.abort();
                } else {
                    req.continue();
                }
            });

            const images = [];
            await page.goto(chapterLink, { waitUntil: 'domcontentloaded', timeout: 15000 });
            
            // Wait for navigation buttons
            await page.waitForSelector('div[class*=\"jdQClN\"] button', { timeout: 10000 });
            const buttonElems = await page.$$('div[class*=\"jdQClN\"] button');
            
            const pageCount = buttonElems.length - 2; // ignore fullscreen and comments buttons
            const filesPath = path.join(dirPath, `capitulo-${chapter}`);

            console.log(`## Iniciando download do capitulo ${chapter} (${pageCount} páginas) ##`);

            if (this.isChapterAlreadyDownloaded(filesPath, pageCount)) {
                console.log(`Capitulo ${chapter} já existe!`);
                return 0;
            }

            if (!fs.existsSync(filesPath)) {
                fs.mkdirSync(filesPath, { recursive: true });
            }

            for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
                try {
                    await page.waitForSelector('figure img', { timeout: 10000 });
                    
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
                        await page.goto(newUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
                    }
                } catch (error) {
                    console.error(`Erro na página ${pageNum} do capítulo ${chapter}:`, error);
                }
            }

            if (images.length > 0) {
                const downloaded = await this.downloadImages(images);
                console.log(`## Finalizado download do capitulo ${chapter} (${downloaded} imagens) ##`);
                return downloaded;
            } else {
                console.log(`## Capítulo ${chapter} - Todas as imagens já existem ##`);
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

        await this.init();
        const chapterLinks = [];

        try {
            await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
            
            // Wait for the table elements to load
            await this.page.waitForSelector('tbody a[href]', { timeout: 10000 });
            const aElems = await this.page.$$('tbody a[href]');
            
            const dirName = url.split("/").pop();
            const dirPath = this.createDir(dirName);

            console.log(`### Fazendo download da HQ: ${dirName} ###`);
            console.log("O tempo de download depende da quantidade de capitulos e paginas existentes na HQ");

            await this.appendChapterLinks(chapterLinks, aElems);

            console.log(`Total de capítulos encontrados: ${chapterLinks.length}`);
            console.log(`Processando ${this.maxConcurrentChapters} capítulos simultaneamente...`);

            // Process chapters in batches for concurrent downloading
            const chapterBatches = [];
            for (let i = 0; i < chapterLinks.length; i += this.maxConcurrentChapters) {
                chapterBatches.push(chapterLinks.slice(i, i + this.maxConcurrentChapters));
            }

            let totalImagesDownloaded = 0;
            for (let batchIndex = 0; batchIndex < chapterBatches.length; batchIndex++) {
                const batch = chapterBatches[batchIndex];
                
                console.log(`\n=== Processando batch ${batchIndex + 1}/${chapterBatches.length} (${batch.length} capítulos) ===`);
                
                const chapterPromises = batch.map((link, index) => {
                    const chapterNumber = (batchIndex * this.maxConcurrentChapters) + index + 1;
                    return this.processChapter(link, chapterNumber, dirPath);
                });

                try {
                    const results = await Promise.all(chapterPromises);
                    const batchTotal = results.reduce((sum, count) => sum + count, 0);
                    totalImagesDownloaded += batchTotal;
                    
                    console.log(`=== Batch ${batchIndex + 1} concluído: ${batchTotal} imagens baixadas ===\n`);
                } catch (error) {
                    console.error(`Erro no batch ${batchIndex + 1}:`, error);
                }
            }

            console.log(`\n### Download concluído! Total: ${totalImagesDownloaded} imagens baixadas ###`);

            console.log("Pronto!");
            
        } catch (error) {
            console.error("Erro:", error);
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

// Command line usage
if (require.main === module) {
    const url = process.argv[2];
    const downloader = new HQDownloader();
    
    downloader.main(url).then(() => {
        process.exit(0);
    }).catch((error) => {
        console.error('Erro fatal:', error);
        process.exit(1);
    });
}

module.exports = HQDownloader;