export type Region = { name: string; districts: string[] };

export const UZ_REGIONS: Region[] = [
  { name: 'Toshkent shahri', districts: ['Bektemir', 'Chilonzor', 'Mirobod', 'Mirzo Ulug‘bek', 'Olmazor', 'Sergeli', 'Shayxontohur', 'Uchtepa', 'Yakkasaroy', 'Yashnobod', 'Yunusobod', 'Yangi hayot'] },
  { name: 'Toshkent viloyati', districts: ['Bekobod', 'Bo‘ka', 'Bo‘stonliq', 'Chinoz', 'Qibray', 'O‘rtachirchiq', 'Oqqo‘rg‘on', 'Ohangaron', 'Parkent', 'Piskent', 'Quyichirchiq', 'Yangiyo‘l', 'Yuqorichirchiq', 'Zangiota'] },
  { name: 'Andijon', districts: ['Andijon shahri', 'Oltinko‘l', 'Asaka', 'Baliqchi', 'Bo‘ston', 'Buloqboshi', 'Izboskan', 'Jalaquduq', 'Xo‘jaobod', 'Qo‘rg‘ontepa', 'Marhamat', 'Paxtaobod', 'Shahrixon', 'Ulug‘nor'] },
  { name: 'Buxoro', districts: ['Buxoro shahri', 'Olot', 'Buxoro', 'G‘ijduvon', 'Jondor', 'Kogon', 'Qorako‘l', 'Qorovulbozor', 'Peshku', 'Romitan', 'Shofirkon', 'Vobkent'] },
  { name: 'Farg‘ona', districts: ['Farg‘ona shahri', 'Qo‘qon', 'Marg‘ilon', 'Quvasoy', 'Oltiariq', 'Bag‘dod', 'Beshariq', 'Buvayda', 'Dang‘ara', 'Furqat', 'Qo‘shtepa', 'Quva', 'Rishton', 'So‘x', 'Toshloq', 'O‘zbekiston', 'Yozyovon'] },
  { name: 'Jizzax', districts: ['Jizzax shahri', 'Arnasoy', 'Baxmal', 'Do‘stlik', 'Forish', 'G‘allaorol', 'Mirzacho‘l', 'Paxtakor', 'Sh.Rashidov', 'Yangiobod', 'Zafarobod', 'Zarbdor', 'Zomin'] },
  { name: 'Xorazm', districts: ['Urganch shahri', 'Xiva', 'Bog‘ot', 'Gurlan', 'Hazorasp', 'Xonqa', 'Qo‘shko‘pir', 'Shovot', 'Urganch', 'Yangiariq', 'Yangibozor', 'Tuproqqal’a'] },
  { name: 'Namangan', districts: ['Namangan shahri', 'Chortoq', 'Chust', 'Kosonsoy', 'Mingbuloq', 'Namangan', 'Norin', 'Pop', 'To‘raqo‘rg‘on', 'Uychi', 'Uchqo‘rg‘on', 'Yangiqo‘rg‘on'] },
  { name: 'Navoiy', districts: ['Navoiy shahri', 'Konimex', 'Qiziltepa', 'Karmana', 'Nurota', 'Tomdi', 'Uchquduq', 'Xatirchi', 'Navbahor'] },
  { name: 'Qashqadaryo', districts: ['Qarshi shahri', 'Shahrisabz shahri', 'Chiroqchi', 'Dehqonobod', 'G‘uzor', 'Kasbi', 'Kitob', 'Koson', 'Mirishkor', 'Muborak', 'Nishon', 'Qamashi', 'Qarshi', 'Shahrisabz', 'Yakkabog‘'] },
  { name: 'Samarqand', districts: ['Samarqand shahri', 'Oqdaryo', 'Bulung‘ur', 'Jomboy', 'Ishtixon', 'Kattaqo‘rg‘on', 'Qo‘shrabot', 'Narpay', 'Nurobod', 'Oqtosh', 'Pastdarg‘om', 'Paxtachi', 'Payariq', 'Samarqand', 'Toyloq', 'Urgut'] },
  { name: 'Sirdaryo', districts: ['Guliston shahri', 'Shirin', 'Yangiyer', 'Boyovut', 'Guliston', 'Mirzaobod', 'Oqoltin', 'Sardoba', 'Sayxunobod', 'Sirdaryo', 'Xovos'] },
  { name: 'Surxondaryo', districts: ['Termiz shahri', 'Angor', 'Bandixon', 'Boysun', 'Denov', 'Jarqo‘rg‘on', 'Qiziriq', 'Qumqo‘rg‘on', 'Muzrabot', 'Oltinsoy', 'Sariosiyo', 'Sherobod', 'Sho‘rchi', 'Termiz', 'Uzun'] },
  { name: 'Qoraqalpog‘iston', districts: ['Nukus shahri', 'Amudaryo', 'Beruniy', 'Chimboy', 'Ellikqal’a', 'Kegeyli', 'Mo‘ynoq', 'Nukus', 'Qanliko‘l', 'Qo‘ng‘irot', 'Qorao‘zak', 'Shumanay', 'Taxiatosh', 'Taxtako‘pir', 'To‘rtko‘l', 'Xo‘jayli'] },
];

export type Gender = 'erkak' | 'ayol';
