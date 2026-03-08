import express from "express";
import { createServer as createViteServer } from "vite";
import axios from "axios";
import cors from "cors";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // Proxy pour récupérer les fichiers distants (contourne CORS)
  app.get("/api/proxy-fetch", async (req, res) => {
    const { url } = req.query;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'URL manquante' });
    }

    try {
      console.log(`Proxying request for: ${url}`);
      
      // Transformation des liens SharePoint/OneDrive en liens de téléchargement direct si possible
      let finalUrl = url;
      if (url.includes('sharepoint.com') && !url.includes('download=1')) {
        finalUrl = url.includes('?') ? `${url}&download=1` : `${url}?download=1`;
      }

      const response = await axios({
        method: 'get',
        url: finalUrl,
        responseType: 'arraybuffer',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });

      res.set('Content-Type', response.headers['content-type']);
      res.send(response.data);
    } catch (error: any) {
      console.error('Proxy error:', error.message);
      res.status(500).json({ error: 'Impossible de récupérer le fichier distant. Vérifiez que le lien est public ou accessible.' });
    }
  });

  // Vite middleware pour le frontend
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Serveur prêt sur http://localhost:${PORT}`);
  });
}

startServer();
