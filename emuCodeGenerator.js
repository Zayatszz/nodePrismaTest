// emuCodeGenerator.js

// Function to generate a random string with 3 numeric characters and 3 Mongolian letters
function generateRandomEmuCode(key) {
  const mongolianLetters = [
    "А",
    "Б",
    "В",
    "Г",
    "Д",
    "Е",
    "Ё",
    "Ж",
    "З",
    "И",
    "Й",
    "К",
    "Л",
    "М",
    "Н",
    "О",
    "Ө",
    "П",
    "Р",
    "С",
    "Т",
    "У",
    "Ү",
    "Ф",
    "Х",
    "Ц",
    "Ч",
    "Ш",
    "Щ",
    "Ъ",
    "Ы",
    "Ь",
    "Э",
    "Ю",
    "Я",
  ];
  const numbers = "0123456789";

  // Prefix mapping
  const prefixMap = {
    'Багануур': "БН",
    'Багахангай': "БХ",
    'Баянгол': "БГ",
    'Баянзүрх': "БЗ",
    'Налайх': "НЛ",
    "Сонгино хайрхан": "СХ",
    'Сүхбаатар': "СБ",
    "Хан-Уул": "ХЛ",
    'Чингэлтэй': "ЧГ",
    "Дархан-Уул": "ДА",
    'Сэлэнгэ': "СЭ",
  };

  // Get the prefix for the key
  const prefix = prefixMap[key];

  if (!prefix) {
    throw new Error("Invalid key provided");
  }

  // Helper function to get a random element from an array
  function getRandomElement(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  let emuCode = prefix;
  emuCode += getRandomElement(mongolianLetters);

  for (let i = 0; i < 3; i++) {
    emuCode += getRandomElement(numbers);
  }

  return emuCode;
}

module.exports = generateRandomEmuCode;
