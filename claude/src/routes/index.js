import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function setupRoutes(app, orchestrator) {
  // Serve the main game page
  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../ui/client.html'));
  });

  app.get('/health', (req, res) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      stats: orchestrator.getSessionStats()
    });
  });

  app.get('/api/stats', (req, res) => {
    res.json(orchestrator.getSessionStats());
  });

  app.post('/api/session', (req, res) => {
    const sessionId = crypto.randomUUID();
    res.json({
      sessionId,
      message: 'Session created successfully'
    });
  });

  app.get('/api/session/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    const session = orchestrator.sessions.get(sessionId);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json(session.toJSON());
  });

  app.delete('/api/session/:sessionId', async (req, res) => {
    const { sessionId } = req.params;
    await orchestrator.shutdownSession(sessionId);
    res.json({ message: 'Session terminated' });
  });

  app.get('/api/images/placeholder-:id.jpg', (req, res) => {
    const { id } = req.params;
    const sceneType = id.split('_')[0];
    const svg = generateSceneSVG(sceneType);

    res.setHeader('Content-Type', 'image/svg+xml');
    res.send(svg);
  });

  function generateSceneSVG(sceneType) {
    const sceneConfigs = {
      tavern: {
        bg: '#8B4513',
        accent: '#FFE4B5',
        title: 'Tavern',
        icon: '🍺',
        elements: ['<rect x="150" y="180" width="40" height="60" fill="#654321"/>',
                  '<circle cx="170" cy="170" r="25" fill="#FFE4B5"/>',
                  '<text x="256" y="360" font-family="Arial" font-size="14" fill="#FFE4B5" text-anchor="middle">The hearth crackles warmly</text>']
      },
      dungeon: {
        bg: '#2F2F2F',
        accent: '#8A8A8A',
        title: 'Dungeon',
        icon: '🗝️',
        elements: ['<rect x="200" y="200" width="20" height="80" fill="#4A4A4A"/>',
                  '<rect x="220" y="200" width="20" height="80" fill="#4A4A4A"/>',
                  '<text x="256" y="360" font-family="Arial" font-size="14" fill="#8A8A8A" text-anchor="middle">Stone walls echo your steps</text>']
      },
      forest: {
        bg: '#228B22',
        accent: '#90EE90',
        title: 'Forest',
        icon: '🌲',
        elements: ['<polygon points="240,200 256,160 272,200" fill="#0F5F0F"/>',
                  '<rect x="252" y="200" width="8" height="20" fill="#654321"/>',
                  '<polygon points="220,220 236,180 252,220" fill="#0F5F0F"/>',
                  '<text x="256" y="360" font-family="Arial" font-size="14" fill="#90EE90" text-anchor="middle">Ancient trees whisper secrets</text>']
      },
      castle: {
        bg: '#708090',
        accent: '#F5F5DC',
        title: 'Castle',
        icon: '🏰',
        elements: ['<rect x="200" y="150" width="112" height="100" fill="#5F5F6F"/>',
                  '<polygon points="200,150 256,120 312,150" fill="#4F4F5F"/>',
                  '<rect x="240" y="180" width="32" height="70" fill="#3F3F4F"/>',
                  '<text x="256" y="360" font-family="Arial" font-size="14" fill="#F5F5DC" text-anchor="middle">Banners flutter in the wind</text>']
      },
      town: {
        bg: '#D2B48C',
        accent: '#8B7355',
        title: 'Town',
        icon: '🏘️',
        elements: ['<rect x="180" y="180" width="40" height="60" fill="#A0522D"/>',
                  '<polygon points="180,180 200,160 220,180" fill="#8B4513"/>',
                  '<rect x="250" y="190" width="35" height="50" fill="#A0522D"/>',
                  '<text x="256" y="360" font-family="Arial" font-size="14" fill="#8B7355" text-anchor="middle">Bustling marketplace sounds</text>']
      },
      mountain: {
        bg: '#696969',
        accent: '#DCDCDC',
        title: 'Mountain',
        icon: '⛰️',
        elements: ['<polygon points="150,250 256,120 362,250" fill="#5F5F5F"/>',
                  '<polygon points="200,250 256,160 312,250" fill="#4F4F4F"/>',
                  '<polygon points="240,200 256,140 280,200" fill="#FFFFFF"/>',
                  '<text x="256" y="360" font-family="Arial" font-size="14" fill="#DCDCDC" text-anchor="middle">Wind howls through peaks</text>']
      },
      ocean: {
        bg: '#4682B4',
        accent: '#F0F8FF',
        title: 'Ocean',
        icon: '🌊',
        elements: ['<path d="M50,280 Q150,260 250,280 T450,280" stroke="#87CEEB" stroke-width="8" fill="none"/>',
                  '<path d="M50,300 Q150,280 250,300 T450,300" stroke="#87CEEB" stroke-width="6" fill="none"/>',
                  '<circle cx="400" cy="150" r="40" fill="#FFD700"/>',
                  '<text x="256" y="360" font-family="Arial" font-size="14" fill="#F0F8FF" text-anchor="middle">Waves crash against the shore</text>']
      },
      desert: {
        bg: '#F4A460',
        accent: '#FFEBCD',
        title: 'Desert',
        icon: '🐪',
        elements: ['<ellipse cx="180" cy="280" rx="60" ry="20" fill="#DEB887"/>',
                  '<ellipse cx="300" cy="260" rx="80" ry="25" fill="#DEB887"/>',
                  '<circle cx="400" cy="120" r="35" fill="#FFD700"/>',
                  '<text x="256" y="360" font-family="Arial" font-size="14" fill="#FFEBCD" text-anchor="middle">Heat shimmers on the sand</text>']
      }
    };

    const config = sceneConfigs[sceneType] || {
      bg: '#4682B4',
      accent: '#F0F8FF',
      title: 'Adventure',
      icon: '⚔️',
      elements: ['<text x="256" y="360" font-family="Arial" font-size="14" fill="#F0F8FF" text-anchor="middle">Your adventure awaits</text>']
    };

    return `
      <svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="bg" cx="50%" cy="30%" r="70%">
            <stop offset="0%" stop-color="${config.accent}30"/>
            <stop offset="100%" stop-color="${config.bg}"/>
          </radialGradient>
          <filter id="shadow">
            <feDropShadow dx="2" dy="2" stdDeviation="3" flood-color="#00000050"/>
          </filter>
        </defs>
        <rect width="512" height="512" fill="url(#bg)"/>
        <rect x="10" y="10" width="492" height="492" fill="none" stroke="${config.accent}" stroke-width="2" stroke-dasharray="8,4"/>

        ${config.elements.join('\n        ')}

        <text x="256" y="80" font-family="Arial, sans-serif" font-size="32" font-weight="bold" fill="${config.accent}" text-anchor="middle" filter="url(#shadow)">${config.title}</text>
        <text x="256" y="110" font-family="Arial, sans-serif" font-size="48" text-anchor="middle">${config.icon}</text>

        <g opacity="0.7">
          <circle cx="256" cy="400" r="15" fill="none" stroke="${config.accent}" stroke-width="2">
            <animate attributeName="r" values="15;25;15" dur="2s" repeatCount="indefinite"/>
            <animate attributeName="opacity" values="1;0;1" dur="2s" repeatCount="indefinite"/>
          </circle>
        </g>
      </svg>
    `;
  }

  // Test Gemini integration
  app.get('/api/gemini/test', async (req, res) => {
    try {
      const { GeminiService } = await import('../services/index.js');
      const gemini = new GeminiService();

      const result = await gemini.testConnection();
      res.json(result);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
        message: 'Gemini service not available'
      });
    }
  });
}