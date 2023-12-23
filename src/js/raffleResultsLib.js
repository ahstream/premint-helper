import global from './global.js';
console.log(global);

// DATA ----------------------------------------------------------------------------------

// FUNCTIONS ----------------------------------------------------------------------------------

export function trimTeamName(valToTrim, maxLen = 30, errVal = '') {
  if (typeof valToTrim !== 'string') {
    return errVal;
  }
  if (valToTrim.length <= maxLen) {
    return valToTrim;
  }
  return valToTrim.substring(0, maxLen - 1) + '...';
}

export function trimPrice(valToTrim, maxLen = 9, errVal = '') {
  if (valToTrim?.toString) {
    valToTrim = valToTrim.toString();
  }
  if (typeof valToTrim !== 'string') {
    return errVal;
  }
  if (valToTrim.length <= maxLen) {
    return valToTrim;
  }
  return valToTrim.substring(0, maxLen - 1) + '...';
}

export function trimText(valToTrim, maxLen, errVal = '') {
  if (typeof valToTrim !== 'string') {
    return errVal;
  }
  return valToTrim.length <= maxLen ? valToTrim : valToTrim.substring(0, maxLen - 1) + '...';
}

export function trimTextNum(valToTrim, maxLen, errVal = '') {
  if (typeof valToTrim !== 'number') {
    return errVal;
  }
  const text = valToTrim.toString();
  return text.length <= maxLen ? text : text.substring(0, maxLen - 1) + '...';
}
