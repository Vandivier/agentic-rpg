export function setupRoutes(app, orchestrator) {
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
    res.redirect('https://via.placeholder.com/512x512/333/fff?text=Scene+Image');
  });
}