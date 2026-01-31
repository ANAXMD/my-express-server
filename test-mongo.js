const mongoose = require('mongoose');
require('dotenv').config();

console.log('Testing MongoDB Connection...');

// Debug: Show URI (hide password)
const uri = process.env.MONGODB_URI;
const maskedUri = uri.replace(/:([^:@]*)@/, ':****@');
console.log('URI:', maskedUri);

mongoose.connect(uri)
  .then(() => {
    console.log('✅ SUCCESS: MongoDB Connected!');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ ERROR:', err.message);
    console.log('\nTroubleshooting:');
    console.log('1. Check password encoding');
    console.log('2. Check IP whitelist in Atlas');
    console.log('3. Try simpler password');
    process.exit(1);
  });
