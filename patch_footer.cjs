const fs = require('fs');

let content = fs.readFileSync('src/App.tsx', 'utf-8');

content = content.replace(
  /<div className="bg-white p-5 rounded-3xl shadow-sm border border-stone-100 flex items-center gap-4 hover:shadow-md transition-shadow cursor-pointer">\s*<div className="bg-red-100 p-3 rounded-2xl text-amarena-red"><MapPin size={20} \/><\/div>\s*<div>\s*<p className="font-bold text-stone-800 text-sm">Rua Dois de Novembro<\/p>\s*<p className="text-xs text-stone-400">Centro - Passos, MG<\/p>\s*<\/div>\s*<\/div>/g,
  `<a href="https://maps.google.com/?q=Rua+Dois+de+Novembro,+59+-+Centro,+Passos+-+MG" target="_blank" rel="noopener noreferrer" className="bg-white p-5 rounded-3xl shadow-sm border border-stone-100 flex items-center gap-4 hover:shadow-md transition-shadow w-full text-left">
                  <div className="bg-red-100 p-3 rounded-2xl text-amarena-red"><MapPin size={20} /></div>
                  <div>
                    <p className="font-bold text-stone-800 text-sm">Rua Dois de Novembro, 59</p>
                    <p className="text-xs text-stone-400">Centro - Passos, MG</p>
                  </div>
               </a>`
);

content = content.replace(
  /<div className="bg-white p-5 rounded-3xl shadow-sm border border-stone-100 flex items-center gap-4 hover:shadow-md transition-shadow cursor-pointer">\s*<div className="bg-green-100 p-3 rounded-2xl text-amarena-green"><MessageCircle size={20} \/><\/div>\s*<p className="font-bold text-stone-800 text-sm">Fale conosco no WhatsApp<\/p>\s*<\/div>/g,
  `<a href="https://wa.me/553597509179" target="_blank" rel="noopener noreferrer" className="bg-white p-5 rounded-3xl shadow-sm border border-stone-100 flex items-center gap-4 hover:shadow-md transition-shadow w-full text-left">
                  <div className="bg-green-100 p-3 rounded-2xl text-amarena-green"><MessageCircle size={20} /></div>
                  <p className="font-bold text-stone-800 text-sm">Fale conosco no WhatsApp</p>
               </a>`
);

content = content.replace(
  /<div className="bg-white p-5 rounded-3xl shadow-sm border border-stone-100 flex items-center gap-4 hover:shadow-md transition-shadow cursor-pointer">\s*<div className="bg-pink-100 p-3 rounded-2xl text-pink-500"><Instagram size={20} \/><\/div>\s*<p className="font-bold text-stone-800 text-sm">\@amarena\.passos<\/p>\s*<\/div>/g,
  `<a href="https://instagram.com/amarena.passos" target="_blank" rel="noopener noreferrer" className="bg-white p-5 rounded-3xl shadow-sm border border-stone-100 flex items-center gap-4 hover:shadow-md transition-shadow w-full text-left">
                  <div className="bg-pink-100 p-3 rounded-2xl text-pink-500"><Instagram size={20} /></div>
                  <p className="font-bold text-stone-800 text-sm">@amarena.passos</p>
               </a>`
);

fs.writeFileSync('src/App.tsx', content);
