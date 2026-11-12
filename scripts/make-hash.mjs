// One-off script to generate bcrypt hashes for test development users
import bcrypt from 'bcryptjs';

const accounts = [
  { role: 'student', registrationNo: '11111111', password: 'student123' },
  { role: 'estate_staff', registrationNo: '22222222', password: 'staff123' },
];

console.log('--- Test Accounts Hashes ---');
for (const acc of accounts) {
  const salt = bcrypt.genSaltSync(10);
  const hash = bcrypt.hashSync(acc.password, salt);
  console.log(`\nRole: ${acc.role}`);
  console.log(`Registration No: ${acc.registrationNo}`);
  console.log(`Plain Password:  ${acc.password}`);
  console.log(`Bcrypt Hash:     ${hash}`);
}

