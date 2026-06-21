const https = require('https');
const fs = require('fs');

if (!fs.existsSync('public')) {
  fs.mkdirSync('public');
}

const url = "https://storage.googleapis.com/shari-img/3947b74f-9e8c-4876-805c-e5bc418182cd";
const file = fs.createWriteStream("public/Logo_backup.png");

https.get(url, response => {
  response.pipe(file);
  file.on('finish', () => {
    file.close();
    console.log("Download completed");
  });
}).on('error', err => {
  fs.unlink("public/Logo_backup.png", () => {});
  console.error("Error downloading:", err.message);
});
