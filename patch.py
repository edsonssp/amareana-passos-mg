import re

with open('src/App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = re.sub(
    r'<div className="bg-white p-5 rounded-3xl shadow-sm border border-stone-100 flex items-center gap-4 hover:shadow-md transition-shadow cursor-pointer">\s*<div className="bg-red-100 p-3 rounded-2xl text-amarena-red"><MapPin size=\{20\} /></div>\s*<div>\s*<p className="font-bold text-stone-800 text-sm">Rua Dois de Novembro</p>\s*<p className="text-xs text-stone-400">Centro - Passos, MG</p>\s*</div>\s*</div>',
    r'<a href="https://maps.google.com/?q=Rua+Dois+de+Novembro,+59+-+Centro,+Passos+-+MG" target="_blank" rel="noopener noreferrer" className="bg-white p-5 rounded-3xl shadow-sm border border-stone-100 flex items-center gap-4 hover:shadow-md transition-shadow w-full text-left">\n                  <div className="bg-red-100 p-3 rounded-2xl text-amarena-red"><MapPin size={20} /></div>\n                  <div>\n                    <p className="font-bold text-stone-800 text-sm">Rua Dois de Novembro, 59</p>\n                    <p className="text-xs text-stone-400">Centro - Passos, MG</p>\n                  </div>\n               </a>',
    content
)

content = re.sub(
    r'<div className="bg-white p-5 rounded-3xl shadow-sm border border-stone-100 flex items-center gap-4 hover:shadow-md transition-shadow cursor-pointer">\s*<div className="bg-green-100 p-3 rounded-2xl text-amarena-green"><MessageCircle size=\{20\} /></div>\s*<p className="font-bold text-stone-800 text-sm">Fale conosco no WhatsApp</p>\s*</div>',
    r'<a href="https://wa.me/553597509179" target="_blank" rel="noopener noreferrer" className="bg-white p-5 rounded-3xl shadow-sm border border-stone-100 flex items-center gap-4 hover:shadow-md transition-shadow w-full text-left">\n                  <div className="bg-green-100 p-3 rounded-2xl text-amarena-green"><MessageCircle size={20} /></div>\n                  <p className="font-bold text-stone-800 text-sm">Fale conosco no WhatsApp</p>\n               </a>',
    content
)

content = re.sub(
    r'<div className="bg-white p-5 rounded-3xl shadow-sm border border-stone-100 flex items-center gap-4 hover:shadow-md transition-shadow cursor-pointer">\s*<div className="bg-pink-100 p-3 rounded-2xl text-pink-500"><Instagram size=\{20\} /></div>\s*<p className="font-bold text-stone-800 text-sm">@amarena\.passos</p>\s*</div>',
    r'<a href="https://instagram.com/amarena.passos" target="_blank" rel="noopener noreferrer" className="bg-white p-5 rounded-3xl shadow-sm border border-stone-100 flex items-center gap-4 hover:shadow-md transition-shadow w-full text-left">\n                  <div className="bg-pink-100 p-3 rounded-2xl text-pink-500"><Instagram size={20} /></div>\n                  <p className="font-bold text-stone-800 text-sm">@amarena.passos</p>\n               </a>',
    content
)

with open('src/App.tsx', 'w', encoding='utf-8', newline='') as f:
    f.write(content)

