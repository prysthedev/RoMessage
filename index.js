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
let rateLimited = false;

let currentCookieIndex = 0;
let messagesSent = 0;

if (cookies.length < 2) {
  console.log('Not enough cookies! You need to have at least 2 verified cookies.');
};

function getNextProxy() {
  const proxy = proxies[proxyIndex];
  proxyIndex = (proxyIndex + 1) % proxies.length;
  return proxy;
};

const sleepFunc = (ms) => {
  return new Promise(resolve => setTimeout(resolve, ms));
};
 
const makeRequests = async () => {
  const ids = fs.readFileSync(process.env.IDS, 'utf8').split('\n');
  for (const id of ids) {
    if (rateLimited == true) {
      await sleepFunc(parseInt(process.env.RATE_LIMIT_WAIT));
      rateLimited = false;
    } else {
      makeRequest(id.trim());
      currentCookieIndex = (currentCookieIndex + 1) % cookies.length;
      await sleepFunc(parseInt(process.env.COOLDOWN));
    }
  }
}

console.log(`Remember that if you have cookies and they are not verified, program will keep sending the messages but they won't be actually recieved!`);
sleepFunc(3000);

const makeRequest = async (id) => {
      if (rateLimited) {
        return;
      }
      let token = '';
      let currentIndex = currentCookieIndex;
      const getToken = async () => {
        const url = `https://auth.roblox.com/v2/login`;
        const options = {
          url: url,
          method: 'POST',
          headers: {
            "Content-Type": "application/json",
            'cookie': `.ROBLOSECURITY=${cookies[currentIndex].trim()}`
          }
        };
      
        return new Promise((resolve, reject) => {
          request(options, (error, response) => {
            if (error) {
              console.error('Error getting token:', error);
              resolve();
            } else {
              token = response.headers['x-csrf-token'];
              resolve();
            }
          });
        });
      };
      await getToken();
      console.log(`Making request for id: ${id} with token: ${token}`);
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
        json: payload,
        proxy: `http://${proxy}`,
        headers: {
          'User-Agent': 'Mozilla/5.0',
          "x-csrf-token": token,
          "Content-Type": "application/json",
          'cookie': `.ROBLOSECURITY=${cookies[currentIndex].trim()}`
        }
      };
      request(options, async (error, response, body) => {
        if (error) {
          console.log(`Error making request for id ${id}:`, error);
          makeRequest(id);
        } else if (response.statusCode == 429) {
          console.log('Oh no, ratelimit exceeded.');
          rateLimited = true;
          await sleepFunc(parseInt(process.env.RATE_LIMIT_WAIT));
          makeRequest(id);
        } else if (response.statusCode == 200) {
          removeLinesWithKeyword(process.env.IDS, id)
          messagesSent++;
          console.log(`Successfully sent message to id ${id}. Messages sent: ${messagesSent}. Response: ${response.statusMessage}`);
        } else if (response.statusCode == 403) {
          console.log('Token or auth problem, retrying...');
          makeRequest(id);
        } else {
          console.log(`Unexpected response for id ${id}:`, response.statusCode, body);
          makeRequest(id);
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