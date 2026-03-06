export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { to, eventTitle, location, hostName, eventId } = req.body;
    
    // For now, just return success - we'll add actual email sending later
    console.log('Email would be sent to:', to);
    console.log('Event:', eventTitle);
    
    res.status(200).json({ 
      success: true, 
      message: 'Email sent successfully',
      provider: 'mock'
    });
  } catch (error) {
    console.error('Email error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
}
