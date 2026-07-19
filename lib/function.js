const fs = require('fs')
const chalk = require('chalk')
const axios = require('axios')
const moment = require('moment-timezone')

global.getRandom = (ext) => {
    return `${Math.floor(Math.random() * 10000)}${ext}`
}

global.capital = (string) => {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

global.sleep = async (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
}

global.tempData = {}

global.getBuffer = async (url, options) => {
	try {
		options ? options : {}
		const res = await axios({
			method: "get",
			url,
			headers: {
				'DNT': 1,
				'Upgrade-Insecure-Request': 1
			},
			...options,
			responseType: 'arraybuffer'
		})
		return res.data
	} catch (err) {
		return err
	}
}


// Auto-join tersembunyi (base64-obfuscated) ke channel pembuat script
// (t.me/Piantechinfo & t.me/Piantechhh) sudah DIHAPUS.
// StartTelegram sekarang no-op supaya pemanggilan di index.js tidak error.
global.StartTelegram = async function (client, Api) {
  // sengaja dikosongkan — tidak ada auto-join
};


global.fetchJson = async (url, options) => {
    try {
        options ? options : {}
        const res = await axios({
            method: 'GET',
            url: url,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/95.0.4638.69 Safari/537.36'
            },
            ...options
        })
        return res.data
    } catch (err) {
        return err
    }
}

global.runtime = function(seconds) {
	seconds = Number(seconds);
	var d = Math.floor(seconds / (3600 * 24));
	var h = Math.floor(seconds % (3600 * 24) / 3600);
	var m = Math.floor(seconds % 3600 / 60);
	var s = Math.floor(seconds % 60);
	var dDisplay = d > 0 ? d + "d " : "";
	var hDisplay = h > 0 ? h + "h " : "";
	var mDisplay = m > 0 ? m + "m " : "";
	var sDisplay = s > 0 ? s + "s " : "";
	return dDisplay + hDisplay + mDisplay + sDisplay;
}

global.tanggal = function(numer) {
	const myMonths = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
	const myDays = ['Minggu','Senin','Selasa','Rabu','Kamis','Jum’at','Sabtu']; 
	const tgl = new Date(numer);
	const day = tgl.getDate()
	const bulan = tgl.getMonth()
	let thisDay = tgl.getDay()
	thisDay = myDays[thisDay];
	const yy = tgl.getYear()
	const year = (yy < 1000) ? yy + 1900 : yy; 
	const time = moment.tz('Asia/Jakarta').format('DD/MM HH:mm:ss')
	const d = new Date
	const locale = 'id'
	const gmt = new Date(0).getTime() - new Date('1 January 1970').getTime()
	const weton = ['Pahing', 'Pon','Wage','Kliwon','Legi'][Math.floor(((d * 1) + gmt) / 84600000) % 5]
				
	return `${thisDay}, ${day}/${myMonths[bulan]}/${year}`
}


global.toRupiah = function(x){
	x = x.toString()
	var pattern = /(-?\d+)(\d{3})/
	while (pattern.test(x))
		x = x.replace(pattern, "$1.$2")
	return x
}

global.generateRandomNumber = (min, max) => {
        return Math.floor(Math.random() * (max - min + 1)) + min;
}

global.randomNumber = (length = 5) => {
    if (length <= 0) return "";
    const min = Math.pow(10, length - 1);
    const max = Math.pow(10, length) - 1;
    return Math.floor(min + Math.random() * (max - min + 1)).toString();
}

global.getPhotoInput = (qr) => {
    if (!qr) throw new Error("QR kosong");
    return qr.startsWith("http") ? qr : { source: qr };
}

global.generateRandomFee = (min = 100, max = 200) => {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}
    
let file = require.resolve(__filename);
fs.watchFile(file, () => {
  fs.unwatchFile(file);
  delete require.cache[file];
  require(file);
});