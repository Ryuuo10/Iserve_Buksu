const axios = require('axios');

async function testSuperAdminLogin() {
  try {
    const email = (process.env.SUPERADMIN_EMAIL || 'iservebuksu@gmail.com').toLowerCase();
    const password = process.env.SUPERADMIN_PASSWORD;

    if (!password) {
      throw new Error('SUPERADMIN_PASSWORD is required');
    }

    console.log('Testing Superadmin Login...');

    const response = await axios.post('http://localhost:5000/api/auth/login', {
      email,
      password,
      role: 'admin',
      recaptchaToken: 'test-token',
    }, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    console.log('Login Response:', response.data);

    if (response.data.success) {
      console.log('Superadmin login successful.');
      console.log('User Info:');
      console.log('   Email:', response.data.user.email);
      console.log('   Role:', response.data.user.role);
      console.log('   Name:', response.data.user.name);
      console.log('   Token Length:', response.data.token.length);

      console.log('\nTesting Profile Endpoint...');
      const profileResponse = await axios.get('http://localhost:5000/api/auth/profile', {
        headers: {
          Authorization: `Bearer ${response.data.token}`,
          'Content-Type': 'application/json',
        },
      });

      console.log('Profile Response:', profileResponse.data);

      if (profileResponse.data.user.role === 'superadmin') {
        console.log('Superadmin role confirmed.');
        console.log('User should be able to access /admin-manage');
      } else {
        console.log('Role mismatch detected');
      }
    } else {
      console.log('Login failed:', response.data.message);
    }
  } catch (error) {
    console.error('Test failed:', error.response?.data || error.message);
  }
}

testSuperAdminLogin();
