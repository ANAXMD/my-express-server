const mongoose = require('mongoose');

mongoose.connect('MONGODB_URI=mongodb+srv://Express:Express123@cluster0.ffg9quz.mongodb.net/expressdb?retrywrites=true&w=majority')
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
