const paymentConfig = {
  stripe: {
    // Keys are loaded from process.env in the controller, 
    // but we can store return URLs here if we want to centralize.
    successUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/booking/success`,
    cancelUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/booking`,
  }
};

module.exports = paymentConfig;
