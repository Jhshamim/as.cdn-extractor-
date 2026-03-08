import express from 'express';
import cors from 'cors';
import puppeteerCore from 'puppeteer-core';
import chromium from '@sparticuz/chromium-min';
import crypto from 'crypto';

const app = express();

// Trust proxy to ensure req.protocol is correct behind Vercel's load balancers
app.set('trust proxy', 1);

// Enable CORS for all routes so it can be used from any site
app.use(cors());

// API routes
app.get(['/api/extract', '/api/extact'], async (req, res) => {
  const targetUrl = req.query.url as string;
  if (!targetUrl) {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    let browser;
    
    // Check if running on Vercel or locally
    if (process.env.VERCEL) {
      try {
        // Use puppeteer-core and @sparticuz/chromium-min for Vercel Serverless
        const sparticuz = chromium as any;
        browser = await puppeteerCore.launch({
          args: sparticuz.args,
          defaultViewport: sparticuz.defaultViewport,
          executablePath: await sparticuz.executablePath(
            'https://github.com/Sparticuz/chromium/releases/download/v131.0.1/chromium-v131.0.1-pack.tar'
          ),
          headless: sparticuz.headless,
        });
      } catch (launchError) {
        console.error('Failed to launch Chromium on Vercel:', launchError);
        return res.status(500).json({ error: 'Failed to launch Chromium', details: String(launchError) });
      }
    } else {
      // Use standard puppeteer for local development
      const puppeteer = (await import('puppeteer')).default;
      browser = await puppeteer.launch({
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        headless: true,
      });
    }

    const page = await browser.newPage();
    const hlsUrls: string[] = [];

    page.on('request', request => {
      const url = request.url();
      if (url.includes('/hls/') && !url.includes('.ts') && !url.includes('.jpg') && !url.includes('.png')) {
        if (url.includes('master.m3u8')) return;
        
        if (!hlsUrls.includes(url)) {
          hlsUrls.push(url);
        }
      }
    });

    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36');

    await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 30000 });

    try {
      await page.evaluate(() => {
        const video = document.querySelector('video');
        if (video) {
          video.muted = true;
          video.play().catch(() => {});
        } else {
          const x = window.innerWidth / 2;
          const y = window.innerHeight / 2;
          const el = document.elementFromPoint(x, y);
          if (el) {
            el.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: x, clientY: y }));
          }
        }
      });
      
      // Wait 8 seconds to ensure all audio tracks (including the last Hindi one) are fetched
      await new Promise(resolve => setTimeout(resolve, 8000));
    } catch (e) {
      console.error('Error playing video:', e);
    }

    await browser.close();

    let videoUrl = '';
    let audioUrl = '';

    if (hlsUrls.length > 0) {
      videoUrl = hlsUrls[0]; // First is video
      audioUrl = hlsUrls[hlsUrls.length - 1]; // Last is the Hindi audio
    }

    let combinedM3u8Url = null;
    if (videoUrl && audioUrl) {
      // Use the request host to generate the correct domain for the M3U8 URL
      const host = req.get('host');
      const protocol = req.protocol || 'https';
      const appUrl = process.env.APP_URL || `${protocol}://${host}`;
      
      combinedM3u8Url = `${appUrl}/api/m3u8?video=${encodeURIComponent(videoUrl)}&audio=${encodeURIComponent(audioUrl)}`;
    }

    res.json({
      success: true,
      videoUrl,
      audioUrl,
      combinedM3u8Url,
      allHlsUrls: hlsUrls,
    });
  } catch (error) {
    console.error('Extraction error:', error);
    res.status(500).json({ error: String(error) });
  }
});

// Endpoint to serve the combined m3u8 in the requested format
// Stateless endpoint using query parameters (works perfectly on Vercel)
app.get('/api/m3u8', (req, res) => {
  const videoUrl = req.query.video as string;
  const audioUrl = req.query.audio as string;

  if (!videoUrl || !audioUrl) {
    return res.status(400).send('Missing video or audio URL parameters');
  }

  const proxyBase = 'https://extract-m3u8-proxy.jahinalamshamim.workers.dev/proxy?url=';
  const proxiedVideo = proxyBase + encodeURIComponent(videoUrl);
  const proxiedAudio = proxyBase + encodeURIComponent(audioUrl);

  const m3u8Content = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio",NAME="Hindi",DEFAULT=YES,AUTOSELECT=YES,URI="${proxiedAudio}"
#EXT-X-STREAM-INF:BANDWIDTH=1500000,RESOLUTION=1280x720,AUDIO="audio"
${proxiedVideo}
`;

  res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
  res.send(m3u8Content);
});

// Only start the server if we are NOT in a Vercel environment
if (!process.env.VERCEL) {
  async function startServer() {
    const PORT = 3000;

    // Vite middleware for development
    if (process.env.NODE_ENV !== 'production') {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } else {
      app.use(express.static('dist'));
    }

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }

  startServer();
}

// Export the app for Vercel serverless functions
export default app;
