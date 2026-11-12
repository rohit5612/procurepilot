import emailService from '../../services/auth/emailService.js';

/**
 * Test email service endpoint
 */
export const testEmailService = async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email address is required'
      });
    }

    // Test email sending
    const result = await emailService.sendVerificationEmail(email, 'test-token-123');
    
    res.json({
      success: true,
      message: 'Email test completed',
      emailSent: result,
      emailServiceEnabled: emailService.isEnabled,
      note: result ? 'Email sent successfully' : 'Email service disabled or failed'
    });

  } catch (error) {
    console.error('Email test error:', error);
    res.status(500).json({
      success: false,
      error: 'Email test failed',
      details: error.message,
      emailServiceEnabled: emailService.isEnabled
    });
  }
};

/**
 * Get email service status
 */
export const getEmailServiceStatus = async (req, res) => {
  try {
    res.json({
      success: true,
      emailServiceEnabled: emailService.isEnabled,
      hasTransporter: !!emailService.transporter,
      fromEmail: emailService.fromEmail,
      environment: {
        EMAIL_ENABLED: process.env.EMAIL_ENABLED,
        EMAIL_HOST: process.env.EMAIL_HOST ? 'Set' : 'Not set',
        EMAIL_USER: process.env.EMAIL_USER ? 'Set' : 'Not set',
        EMAIL_PASS: process.env.EMAIL_PASS ? 'Set' : 'Not set'
      }
    });
  } catch (error) {
    console.error('Email status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get email service status',
      details: error.message
    });
  }
};
