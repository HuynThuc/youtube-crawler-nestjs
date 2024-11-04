const fs = require('fs');
const bcrypt = require('bcryptjs');

const username = 'huynthuc'; //tên người dùng
const password = '123456'; //mật khẩu

// Mã hóa mật khẩu
const hashedPassword = bcrypt.hashSync(password, 10);
const htpasswdEntry = `${username}:${hashedPassword}\n`;

// Lưu vào file .htpasswd
fs.appendFile('./nginx/auth/.htpasswd', htpasswdEntry, (err) => {
    if (err) {
        console.error('Error writing to .htpasswd file:', err);
    } else {
        console.log('.htpasswd file created successfully.');
    }
});
