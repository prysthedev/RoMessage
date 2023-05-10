const fs = require('fs');
const { resolve } = require('path');
const request = require('request');
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
};

const getToken = async () => {
  const url = `https://auth.roblox.com/v2/login`;
  const options = {
    url: url,
    method: 'POST',
    headers: {
      "Content-Type": "application/json",
      'cookie': `.ROBLOSECURITY=${cookies[currentCookieIndex].trim()}`
    }
  };

  try {
    const response = await new Promise((resolve, reject) => {
      request(options, (error, response) => {
        if (error) {
          resolve(response);
        } else {
          resolve(response);
        }
      });
    });
    const token = response.headers['x-csrf-token'];
    return token;
  } catch (error) {
    console.error('Error getting token:', error);
    resolve();
  }
};

function getNextProxy() {
  const proxy = proxies[proxyIndex];
  proxyIndex = (proxyIndex + 1) % proxies.length;
  return proxy;
};

const sleepFunc = (ms) => {
  const end = new Date().getTime() + ms;
  while (new Date().getTime() < end) { /* do nothing */ }
}
 
const makeRequests = async () => {
  const ids = fs.readFileSync(process.env.IDS, 'utf8').split('\n');
  for (const id of ids) {
    await makeRequest(id.trim());
  }
}

console.log(`Remember that if you have cookies and they are not verified, program will keep sending the messages but they won't be actually recieved!`);
sleepFunc(3000);

const makeRequest = async (id) => {
      currentCookieIndex = (currentCookieIndex + 1) % cookies.length;
      const url = `https://privatemessages.roblox.com/v1/messages/send`;
      let proxy = getNextProxy();
      const payload = {
        subject: subject,
        body: message,
        recipientid: id,
        cacheBuster: 1681481648561
      };
      const options = {
        url: url,
        method: 'POST',
        json: payload,
        proxy: `http://${proxy}`,
        headers: {
          'User-Agent': 'Mozilla/5.0',
          "x-csrf-token": await getToken(),
          "Content-Type": "application/json",
          'cookie': `.ROBLOSECURITY=${cookies[currentCookieIndex].trim()}`
        }
      };
      console.log(`Making request for id ${id}`);
      request(options, (error, response, body) => {
        if (error) {
          console.log(`Error making request for id ${id}:`, error);
          removeLinesWithKeyword(process.env.IDS, id)
        } else if (response.statusCode == 429) {
          console.log('Oh no, ratelimit exceeded.');
          removeLinesWithKeyword(process.env.IDS, id) 
          sleepFunc(parseInt(process.env.RATE_LIMIT_WAIT));
        } else if (response.statusCode == 200) {
          removeLinesWithKeyword(process.env.IDS, id)
          messagesSent++;
          console.log(`Successfully sent message to id ${id}. Messages sent: ${messagesSent}. Response: ${response.statusMessage}`);
        } else if (response.statusCode == 403) {
          console.log('Token or auth problem, retrying...');
          removeLinesWithKeyword(process.env.IDS, id)
        } else {
          console.log(`Unexpected response for id ${id}:`, response.statusCode, body);
          removeLinesWithKeyword(process.env.IDS, id)
        }
      });
    };

makeRequests()
  .then(() => {
    console.log('All requests complete');
  })
  .catch((error) => {
    console.error('Error making requests:', error);
  });