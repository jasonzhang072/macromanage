export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { event_id, email, response } = req.body;
    
    console.log('Response recorded:', { event_id, email, response });
    
    res.status(200).json({ 
      success: true, 
      message: 'Response recorded'
    });
  } catch (error) {
    console.error('Response error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
}
