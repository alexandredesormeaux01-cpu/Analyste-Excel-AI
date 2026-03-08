import axios from 'axios';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
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

    res.setHeader('Content-Type', response.headers['content-type'] || 'application/octet-stream');
    res.send(Buffer.from(response.data));
  } catch (error: any) {
    console.error('Proxy error:', error.message);
    res.status(500).json({ 
      error: 'Impossible de récupérer le fichier distant. Vérifiez que le lien est public ou accessible.' 
    });
  }
}
