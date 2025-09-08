const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { Server } = require('socket.io');
const http = require('http');
const HQDownloaderFast = require('./scraper');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// Store active downloads
const activeDownloads = new Map();

// Serve the interface
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'interface.html'));
});

// API Routes

// Get list of downloaded comics
app.get('/api/comics', (req, res) => {
    try {
        const comics = [];
        const currentDir = process.cwd();
        
        const items = fs.readdirSync(currentDir, { withFileTypes: true });
        
        items.forEach(item => {
            if (item.isDirectory() && !item.name.startsWith('.') && 
                item.name !== 'node_modules' && !item.name.includes('capitulo')) {
                
                const comicPath = path.join(currentDir, item.name);
                const chaptersPattern = /^capitulo-\d+$/;
                
                try {
                    const chapters = fs.readdirSync(comicPath, { withFileTypes: true })
                        .filter(chapter => chapter.isDirectory() && chaptersPattern.test(chapter.name))
                        .length;
                    
                    if (chapters > 0) {
                        const stats = fs.statSync(comicPath);
                        
                        // Verifica se tem arquivo de progresso (download incompleto)
                        const progressFile = path.join(comicPath, '.progress.json');
                        let progressInfo = null;
                        
                        if (fs.existsSync(progressFile)) {
                            try {
                                const progressData = fs.readFileSync(progressFile, 'utf8');
                                progressInfo = JSON.parse(progressData);
                            } catch (error) {
                                console.error('Erro ao ler progresso:', error);
                            }
                        }
                        
                        comics.push({
                            name: item.name,
                            chapters: chapters,
                            downloadDate: stats.mtime.toLocaleDateString('pt-BR'),
                            path: comicPath,
                            hasProgress: !!progressInfo,
                            progress: progressInfo
                        });
                    }
                } catch (error) {
                    console.error(`Error reading comic directory ${item.name}:`, error);
                }
            }
        });
        
        res.json(comics);
    } catch (error) {
        console.error('Error listing comics:', error);
        res.status(500).json({ error: 'Failed to list comics' });
    }
});

// Resume download
app.post('/api/resume/:name', async (req, res) => {
    const comicName = req.params.name;
    const comicPath = path.join(process.cwd(), comicName);
    const progressFile = path.join(comicPath, '.progress.json');
    
    if (!fs.existsSync(progressFile)) {
        return res.status(404).json({ error: 'Nenhum download pendente encontrado' });
    }
    
    try {
        const progressData = fs.readFileSync(progressFile, 'utf8');
        const progress = JSON.parse(progressData);
        const url = progress.url;
        
        if (!url) {
            return res.status(400).json({ error: 'URL não encontrada no arquivo de progresso' });
        }
        
        const downloadId = Date.now().toString();
        
        // Usa configurações salvas no progresso ou padrões
        const downloaderOptions = {
            maxConcurrentChapters: progress.options?.maxConcurrentChapters || 5,
            maxConcurrentImages: progress.options?.maxConcurrentImages || 15,
            pageTimeout: progress.options?.pageTimeout || 8000,
            requestTimeout: progress.options?.requestTimeout || 20000
        };
        
        console.log(`Continuando download com configurações:`, downloaderOptions);
        
        const downloader = new HQDownloaderFast(downloaderOptions);
        activeDownloads.set(downloadId, downloader);
        
        io.emit('download-started', { downloadId, url, resumed: true });
        
        const originalConsoleLog = console.log;
        console.log = (message) => {
            originalConsoleLog(message);
            io.emit('download-log', { downloadId, message, type: 'info' });
        };
        
        const originalConsoleError = console.error;
        console.error = (message) => {
            originalConsoleError(message);
            io.emit('download-log', { downloadId, message, type: 'error' });
        };
        
        downloader.main(url).then(() => {
            console.log = originalConsoleLog;
            console.error = originalConsoleError;
            
            activeDownloads.delete(downloadId);
            io.emit('download-completed', { downloadId });
        }).catch((error) => {
            console.log = originalConsoleLog;
            console.error = originalConsoleError;
            
            activeDownloads.delete(downloadId);
            io.emit('download-error', { downloadId, error: error.message });
        });
        
        res.json({ downloadId, status: 'resumed' });
        
    } catch (error) {
        console.error('Error resuming download:', error);
        res.status(500).json({ error: 'Erro ao continuar download' });
    }
});

// Start download
app.post('/api/download', async (req, res) => {
    const { url, options } = req.body;
    
    if (!url) {
        return res.status(400).json({ error: 'URL is required' });
    }
    
    const downloadId = Date.now().toString();
    
    try {
        // Usa as configurações personalizadas ou padrões
        const downloaderOptions = {
            maxConcurrentChapters: options?.maxConcurrentChapters || 5,
            maxConcurrentImages: options?.maxConcurrentImages || 15,
            pageTimeout: options?.pageTimeout || 8000,
            requestTimeout: options?.requestTimeout || 20000
        };
        
        console.log(`Iniciando download com configurações:`, downloaderOptions);
        
        const downloader = new HQDownloaderFast(downloaderOptions);
        activeDownloads.set(downloadId, downloader);
        
        // Emit download started
        io.emit('download-started', { downloadId, url });
        
        // Override console.log to send real-time updates
        const originalConsoleLog = console.log;
        console.log = (message) => {
            originalConsoleLog(message);
            io.emit('download-log', { downloadId, message, type: 'info' });
        };
        
        const originalConsoleError = console.error;
        console.error = (message) => {
            originalConsoleError(message);
            io.emit('download-log', { downloadId, message, type: 'error' });
        };
        
        // Start download
        downloader.main(url).then(() => {
            console.log = originalConsoleLog;
            console.error = originalConsoleError;
            
            activeDownloads.delete(downloadId);
            io.emit('download-completed', { downloadId });
        }).catch((error) => {
            console.log = originalConsoleLog;
            console.error = originalConsoleError;
            
            activeDownloads.delete(downloadId);
            io.emit('download-error', { downloadId, error: error.message });
        });
        
        res.json({ downloadId, status: 'started' });
        
    } catch (error) {
        console.error('Error starting download:', error);
        res.status(500).json({ error: 'Failed to start download' });
    }
});

// Cancel download
app.post('/api/download/:id/cancel', async (req, res) => {
    const downloadId = req.params.id;
    const downloader = activeDownloads.get(downloadId);
    
    if (downloader) {
        try {
            await downloader.close();
            activeDownloads.delete(downloadId);
            io.emit('download-cancelled', { downloadId });
            res.json({ status: 'cancelled' });
        } catch (error) {
            console.error('Error cancelling download:', error);
            res.status(500).json({ error: 'Failed to cancel download' });
        }
    } else {
        res.status(404).json({ error: 'Download not found' });
    }
});

// Delete comic
app.delete('/api/comics/:name', (req, res) => {
    const comicName = req.params.name;
    const comicPath = path.join(process.cwd(), comicName);
    
    try {
        if (fs.existsSync(comicPath)) {
            fs.rmSync(comicPath, { recursive: true, force: true });
            res.json({ status: 'deleted' });
        } else {
            res.status(404).json({ error: 'Comic not found' });
        }
    } catch (error) {
        console.error('Error deleting comic:', error);
        res.status(500).json({ error: 'Failed to delete comic' });
    }
});

// Get comic chapters
app.get('/api/comics/:name/chapters', (req, res) => {
    const comicName = req.params.name;
    const comicPath = path.join(process.cwd(), comicName);
    
    try {
        if (!fs.existsSync(comicPath)) {
            return res.status(404).json({ error: 'Comic not found' });
        }
        
        const chapters = fs.readdirSync(comicPath, { withFileTypes: true })
            .filter(item => item.isDirectory() && /^capitulo-\d+$/.test(item.name))
            .map(chapter => {
                const chapterPath = path.join(comicPath, chapter.name);
                const images = fs.readdirSync(chapterPath).filter(file => 
                    file.toLowerCase().endsWith('.jpg') || 
                    file.toLowerCase().endsWith('.png') ||
                    file.toLowerCase().endsWith('.jpeg')
                );
                
                return {
                    name: chapter.name,
                    number: parseInt(chapter.name.split('-')[1]),
                    pages: images.length,
                    path: chapterPath
                };
            })
            .sort((a, b) => a.number - b.number);
        
        res.json(chapters);
    } catch (error) {
        console.error('Error listing chapters:', error);
        res.status(500).json({ error: 'Failed to list chapters' });
    }
});

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    
    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

// Start server
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Interface available at http://localhost:${PORT}`);
});