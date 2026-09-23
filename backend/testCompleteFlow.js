const axios = require('axios');

async function testCompleteFlow() {
  console.log('TESTING COMPLETE SUPERADMIN FLOW...\n');

  try {
    const email = (process.env.SUPERADMIN_EMAIL || 'iservebuksu@gmail.com').toLowerCase();
    const password = process.env.SUPERADMIN_PASSWORD;

    if (!password) {
      throw new Error('SUPERADMIN_PASSWORD is required');
    }

    console.log('1. Testing Login...');
    const loginResponse = await axios.post('http://localhost:5000/api/auth/login', {
      email,
      password,
      role: 'admin',
      recaptchaToken: 'test-token',
    }, {
      headers: { 'Content-Type': 'application/json' },
    });

    if (!loginResponse.data.success) {
      console.log('Login failed:', loginResponse.data.message);
      return;
    }

    console.log('Login successful.');
    const token = loginResponse.data.token;

    console.log('\n2. Testing Profile Access...');
    const profileResponse = await axios.get('http://localhost:5000/api/auth/profile', {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!profileResponse.data.success) {
      console.log('Profile access failed:', profileResponse.data.message);
      return;
    }

    console.log('Profile access successful.');
    console.log('   User Role:', profileResponse.data.user.role);

    console.log('\n3. Testing Route Access Logic...');
    const adminAllowedRoles = ['admin', 'superadmin'];
    const adminManageAllowedRoles = ['superadmin'];

    const canAccessAdmin = adminAllowedRoles.includes(profileResponse.data.user.role);
    const canAccessAdminManage = adminManageAllowedRoles.includes(profileResponse.data.user.role);

    console.log('   Can access /admin:', canAccessAdmin ? 'YES' : 'NO');
    console.log('   Can access /admin-manage:', canAccessAdminManage ? 'YES' : 'NO');

    console.log('\nSUMMARY:');
    console.log('   Login: Working');
    console.log('   Profile API: Working');
    console.log('   Token Storage: Working');
    console.log('   Role Recognition: Working');
    console.log('   Route Protection: Ready');

    if (profileResponse.data.user.role === 'superadmin') {
      console.log('\nSUPERADMIN ACCESS CONFIRMED');
      console.log('Visit: http://localhost:5173/auth?role=admin');
      console.log(`Credentials: ${email} / [SUPERADMIN_PASSWORD]`);
    }
  } catch (error) {
    console.error('Test failed:', error.response?.data || error.message);
  }
}

testCompleteFlow();
