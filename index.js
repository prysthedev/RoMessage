const fs = require('fs');
const axios = require('axios');
require('dotenv').config();

function removeLinesWithKeyword(filename, keyword) {
  const fileData = fs.readFileSync(filename, 'utf8');
  const lines = fileData.split('\n');
  const filteredLines = lines.filter(line => !line.includes(keyword));
  const updatedFileData = filteredLines.join('\n');
  fs.writeFileSync(filename, updatedFileData);
}

let proxyIndex = 0;
const subject = process.env.TITLE;
const message = process.env.MESSAGE;
const proxies = fs.readFileSync(process.env.PROXIES, 'utf-8').trim().split('\n');
const cookies = fs.readFileSync(process.env.COOKIES, 'utf8').split('\n');

let currentCookieIndex = 0;
let messagesSent = 0;

if (cookies.length < 2) {
  console.log('Not enough cookies! You need to have at least 2 verified cookies.');
  process.exit(1);
}

function getNextProxy() {
  const proxy = proxies[proxyIndex];
  proxyIndex = (proxyIndex + 1) % proxies.length;
  return proxy;
}

const sleepFunc = (ms) => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

const makeRequests = async () => {
  const ids = fs.readFileSync(process.env.IDS, 'utf8').split('\n');

  const requests = ids.map(id => makeRequest(id.trim()));
  await Promise.all(requests);
};

console.log(`Remember that if you have cookies and they are not verified, the program will keep sending the messages but they won't actually be received!`);
sleepFunc(3000);

const makeRequest = async (id) => {
  let thisIndex = currentCookieIndex;
  let token = '';
  const getToken = async () => {
    const url = `https://auth.roblox.com/v2/login`;
    const options = {
      url: url,
      method: 'POST',
      headers: {
        "Content-Type": "application/json",
        'cookie': `.ROBLOSECURITY=${cookies[thisIndex].trim()}`
      }
    };

    try {
      const response = await axios(options);
      token = response.headers['x-csrf-token'];
    } catch (error) {
      console.error('Error getting token:', error);
    }
  };
  await getToken();
  const url = `https://privatemessages.roblox.com/v1/messages/send`;
  let proxy = getNextProxy();
  const payload = {
    subject: subject,
    body: message,
    recipientid: id
  };
  const options = {
    url: url,
    method: 'POST',
    data: payload,
    proxy: `http://${proxy}`,
    headers: {
      'User-Agent': 'Mozilla/5.0',
      "x-csrf-token": token,
      "Content-Type": "application/json",
      'cookie': `.ROBLOSECURITY=${cookies[thisIndex].trim()}`
    }
  };
  console.log(`Making request for id ${id} with token ${token}`);
  try {
    const response = await axios(options);
    if (response.status == 429) {
      console.log('Oh no, ratelimit exceeded.');
    } else if (response.status == 200) {
      removeLinesWithKeyword(process.env.IDS, id);
      messagesSent++;
      console.log(`Successfully sent message to id ${id}. Messages sent: ${messagesSent}. Response: ${response.statusText}`);
    } else if (response.status == 403) {
      console.log('Token or auth problem, retrying...');
    } else if (response.status == 500) {
      removeLinesWithKeyword(process.env.IDS, id);
    } else {
      console.log(`Unexpected response for id ${id}:`, response.status, response.data);
    }
  } catch (error) {
    console.log(`Error making request for id ${id}:`, error.message);
  }
};

makeRequests()
  .then(() => {
    console.log('All requests complete');
  })
  .catch((error) => {
    console.error('Error making requests:', error);
  });
